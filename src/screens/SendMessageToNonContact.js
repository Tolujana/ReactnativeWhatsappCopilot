// SendMessageToNonContact.js
import React, {useState} from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  FlatList,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import {
  Text,
  IconButton,
  useTheme,
  Dialog,
  Portal,
  Button,
} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {Linking} from 'react-native';
import {COUNTRIES} from '../util/Constant';
import Header from '../components/Header';

const SendMessageToNonContact = ({toggleTheme}) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [messageText, setMessageText] = useState('');
  const [visible, setVisible] = useState(false);
  const [countryModalVisible, setCountryModalVisible] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [telegramUsername, setTelegramUsername] = useState('');

  const theme = useTheme();
  const styles = makeStyles(theme);

  const trimmedNumber = phoneNumber.trim().replace(/^0+/, '');
  const fullNumber = `${country.callingCode}${trimmedNumber}`;
  const encodedMessage = encodeURIComponent(messageText || '');

  const openApp = app => {
    if (app === 'telegram') {
      if (!telegramUsername.trim()) {
        Alert.alert('Missing Username', 'Please enter a Telegram username.');
        return;
      }
      const username = telegramUsername.replace(/^@/, '');
      const url = `https://t.me/${username}`;
      Linking.openURL(url).catch(err => {
        console.error('❌ Failed to open Telegram:', err);
        Alert.alert('Error', 'Could not open Telegram.');
      });
      setVisible(false);
      return;
    }

    let url = '';
    if (app === 'whatsapp') {
      url = `whatsapp://send?phone=${fullNumber}&text=${encodedMessage}`;
    } else if (app === 'whatsapp_business') {
      if (Platform.OS === 'android') {
        url = `intent://send?phone=${fullNumber}&text=${encodedMessage}#Intent;scheme=whatsapp;package=com.whatsapp.w4b;end`;
      } else {
        url = `whatsapp://send?phone=${fullNumber}&text=${encodedMessage}`;
      }
    } else {
      Alert.alert('Unsupported App', 'Only WhatsApp & Telegram supported.');
      return;
    }

    Linking.openURL(url).catch(err => {
      console.error('❌ Could not open messaging app:', err);
      Alert.alert('App not installed', 'The selected app is not installed.');
    });
  };

  const handleSend = () => {
    if (!trimmedNumber || trimmedNumber.length < 6) {
      Alert.alert('Invalid Number', 'Please enter a valid phone number.');
      return;
    }
    setVisible(true);
  };

  return (
    <View
      style={[styles.container, {backgroundColor: theme.colors.background}]}>
      <Header toggleTheme={toggleTheme} showBackButton={true} />

      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.select({ios: 'padding', android: undefined})}
        keyboardVerticalOffset={Platform.select({ios: 0, android: 0})}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.label}>Country:</Text>
            <TouchableOpacity
              style={styles.countryPicker}
              onPress={() => setCountryModalVisible(true)}>
              <Text style={styles.countryText}>
                {country.name} (+{country.callingCode})
              </Text>
              <Icon
                name="chevron-down"
                size={20}
                color={theme.colors.onSurface}
              />
            </TouchableOpacity>

            <Text style={styles.label}>Phone number:</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 9012345678"
              placeholderTextColor={theme.colors.onSurfaceDisabled}
              keyboardType="phone-pad"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
            />

            <Text style={styles.label}>Message (optional):</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Type your message"
              placeholderTextColor={theme.colors.onSurfaceDisabled}
              multiline
              value={messageText}
              onChangeText={setMessageText}
            />

            <IconButton
              icon="send"
              iconColor={theme.colors.onPrimary}
              containerColor={theme.colors.primary}
              size={24}
              onPress={handleSend}
              style={styles.sendButton}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* App selection dialog */}
      <Portal>
        <Dialog
          visible={visible}
          onDismiss={() => {
            setVisible(false);
            setSelectedApp(null);
          }}
          style={{backgroundColor: theme.colors.surface}}>
          <Dialog.Title style={{color: theme.colors.onSurface}}>
            Select App
          </Dialog.Title>
          <Dialog.Content>
            <Button
              mode="outlined"
              onPress={() => openApp('whatsapp')}
              style={styles.dialogButton}>
              WhatsApp
            </Button>
            <Button
              mode="outlined"
              onPress={() => setSelectedApp('telegram')}
              style={styles.dialogButton}>
              Telegram
            </Button>

            {selectedApp === 'telegram' && (
              <View style={styles.telegramSection}>
                <TextInput
                  placeholder="Telegram username (without @)"
                  placeholderTextColor={theme.colors.onSurfaceDisabled}
                  value={telegramUsername}
                  onChangeText={setTelegramUsername}
                  style={[
                    styles.telegramInput,
                    {
                      color: theme.colors.onSurface,
                      borderColor: theme.colors.outline,
                    },
                  ]}
                />
                <Button
                  mode="contained"
                  onPress={() => openApp('telegram')}
                  disabled={!telegramUsername.trim()}
                  style={styles.telegramButton}>
                  Continue to Telegram
                </Button>
              </View>
            )}
          </Dialog.Content>
        </Dialog>
      </Portal>

      {/* Country picker modal */}
      <Portal>
        <Dialog
          visible={countryModalVisible}
          onDismiss={() => setCountryModalVisible(false)}
          style={[
            styles.countryDialog,
            {backgroundColor: theme.colors.surface},
          ]}>
          <Dialog.Title style={{color: theme.colors.onSurface}}>
            Select Country
          </Dialog.Title>
          <Dialog.ScrollArea style={styles.countryScrollArea}>
            <FlatList
              data={COUNTRIES}
              keyExtractor={item => item.code}
              renderItem={({item}) => (
                <TouchableOpacity
                  style={[
                    styles.countryItem,
                    {borderBottomColor: theme.colors.outline},
                  ]}
                  onPress={() => {
                    setCountry(item);
                    setCountryModalVisible(false);
                  }}>
                  <Text
                    style={[
                      styles.countryItemText,
                      {color: theme.colors.onSurface},
                    ]}>
                    {item.name}
                  </Text>
                  <Text style={{color: theme.colors.onSurface}}>
                    +{item.callingCode}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </Dialog.ScrollArea>
        </Dialog>
      </Portal>
    </View>
  );
};

const makeStyles = theme =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingTop: 0, // Ensure no padding at top
    },
    keyboardAvoidingView: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
      padding: 20,
    },
    card: {
      backgroundColor: theme.colors.surface,
      padding: 24,
      borderRadius: 16,
      elevation: 3,
      shadowColor: theme.colors.shadow,
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 0.1,
      shadowRadius: 6,
    },
    label: {
      fontSize: 16,
      marginTop: 12,
      marginBottom: 4,
      color: theme.colors.onSurface,
    },
    input: {
      borderBottomWidth: 1,
      borderColor: theme.colors.outline,
      fontSize: 16,
      paddingVertical: 6,
      marginBottom: 10,
      color: theme.colors.onSurface,
    },
    textArea: {
      height: 80,
      textAlignVertical: 'top',
    },
    countryPicker: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderColor: theme.colors.outline,
      marginBottom: 10,
    },
    countryText: {
      flex: 1,
      fontSize: 16,
      color: theme.colors.onSurface,
    },
    countryItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderBottomWidth: 0.5,
    },
    countryItemText: {
      flex: 1,
    },
    sendButton: {
      alignSelf: 'flex-end',
      marginTop: 20,
    },
    dialogButton: {
      marginVertical: 4,
    },
    telegramSection: {
      marginTop: 12,
    },
    telegramInput: {
      borderBottomWidth: 1,
      paddingBottom: 8,
      marginBottom: 12,
      fontSize: 16,
    },
    telegramButton: {
      marginTop: 8,
    },
    countryDialog: {
      maxHeight: '80%',
    },
    countryScrollArea: {
      maxHeight: 300,
      paddingHorizontal: 0,
    },
  });

export default SendMessageToNonContact;

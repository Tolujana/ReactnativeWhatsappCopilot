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

const SendMessageToNonContact = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [messageText, setMessageText] = useState('');
  const [visible, setVisible] = useState(false);
  const [countryModalVisible, setCountryModalVisible] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [telegramUsername, setTelegramUsername] = useState('');

  const theme = useTheme();

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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.select({ios: 'padding', android: undefined})}>
      <View style={styles.card}>
        <Text style={styles.label}>Country:</Text>
        <TouchableOpacity
          style={styles.countryPicker}
          onPress={() => setCountryModalVisible(true)}>
          <Text style={styles.countryText}>
            {country.name} (+{country.callingCode})
          </Text>
          <Icon name="chevron-down" size={20} />
        </TouchableOpacity>

        <Text style={styles.label}>Phone number:</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 9012345678"
          keyboardType="phone-pad"
          value={phoneNumber}
          onChangeText={setPhoneNumber}
        />

        <Text style={styles.label}>Message (optional):</Text>
        <TextInput
          style={[styles.input, {height: 80}]}
          placeholder="Type your message"
          multiline
          value={messageText}
          onChangeText={setMessageText}
        />

        <IconButton
          icon={() => (
            <Icon name="send" size={24} color={theme.colors.primary} />
          )}
          onPress={handleSend}
          style={styles.sendButton}
        />
      </View>

      {/* App selection dialog */}
      <Portal>
        <Dialog visible={visible} onDismiss={() => setVisible(false)}>
          <Dialog.Title>Select App</Dialog.Title>
          <Dialog.Content>
            <Button onPress={() => openApp('whatsapp')}>WhatsApp</Button>
            <Button onPress={() => setSelectedApp('telegram')}>Telegram</Button>

            {selectedApp === 'telegram' && (
              <>
                <TextInput
                  placeholder="Telegram username (without @)"
                  value={telegramUsername}
                  onChangeText={setTelegramUsername}
                  style={{
                    marginTop: 12,
                    borderBottomWidth: 1,
                    borderColor: '#ccc',
                    paddingBottom: 4,
                  }}
                />
                <Button
                  mode="contained"
                  onPress={() => openApp('telegram')}
                  disabled={!telegramUsername.trim()}>
                  Continue to Telegram
                </Button>
              </>
            )}
          </Dialog.Content>
        </Dialog>
      </Portal>

      {/* Country picker modal */}
      <Portal>
        <Dialog
          visible={countryModalVisible}
          onDismiss={() => setCountryModalVisible(false)}
          style={{maxHeight: '80%'}}>
          <Dialog.Title>Select Country</Dialog.Title>
          <Dialog.ScrollArea style={{maxHeight: 300}}>
            <FlatList
              data={COUNTRIES}
              keyExtractor={item => item.code}
              renderItem={({item}) => (
                <TouchableOpacity
                  style={styles.countryItem}
                  onPress={() => {
                    setCountry(item);
                    setCountryModalVisible(false);
                  }}>
                  <Text style={{flex: 1}}>{item.name}</Text>
                  <Text>+{item.callingCode}</Text>
                </TouchableOpacity>
              )}
            />
          </Dialog.ScrollArea>
        </Dialog>
      </Portal>
    </KeyboardAvoidingView>
  );
};

export default SendMessageToNonContact;

const styles = StyleSheet.create({
  container: {flex: 1, justifyContent: 'center', padding: 20},
  card: {
    backgroundColor: '#f9f9f9',
    padding: 24,
    borderRadius: 16,
    elevation: 3,
  },
  label: {fontSize: 16, marginTop: 12, marginBottom: 4},
  input: {
    borderBottomWidth: 1,
    borderColor: '#ccc',
    fontSize: 16,
    paddingVertical: 6,
    marginBottom: 10,
  },
  countryPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: '#ccc',
    marginBottom: 10,
  },
  countryText: {flex: 1, fontSize: 16},
  countryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderColor: '#eee',
  },
  sendButton: {alignSelf: 'flex-end', marginTop: 20},
});

import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  Alert,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  DeviceEventEmitter,
} from 'react-native';
import {DataTable, Button, Title, Checkbox, useTheme} from 'react-native-paper';
import {launchWhatsappMessage} from '../util/WhatsappHelper';
import {MyDataTable} from '../components/DataTable';
import Header from '../components/Header';

const WhatsappResultScreen = ({navigation, route, toggleTheme}) => {
  const {totalContacts, whatsappPackage} = route.params;
  const [report, setReport] = useState(null);
  const [data, setData] = useState(null);
  const [selectedItems, setSelectedItems] = useState([]);
  const [updatedList, setUpdatedList] = useState([]);
  const theme = useTheme();
  const styles = makeStyles(theme);

  useEffect(() => {
    function checkContacts(totalContacts, successfulContacts) {
      const result = totalContacts.map(contact => {
        const exists = successfulContacts.some(
          successfulContact => successfulContact.phone === contact.phone,
        );
        return {...contact, exists};
      });
      console.log('this is result', result);
      console.log('this is result', totalContacts);
      setUpdatedList(result); // assuming setState is your state update function
    }

    const subscription = DeviceEventEmitter.addListener(
      'onMessageSendReport',
      data => {
        try {
          console.log('✅ Report received:', data.success_list);
          const parsedList = JSON.parse(data.success_list);
          setReport(data);
          checkContacts(totalContacts, parsedList);
          //setData(parsedList);
        } catch (error) {
          console.error('❌ Failed to parse success_list:', error);
        }
      },
    );

    return () => subscription.remove();
  }, []);

  const handleViewMessage = message => {
    Alert.alert('📩 Message', message);
  };

  const toggleSelectItem = index => {
    setSelectedItems(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index],
    );
  };

  const handleResend = () => {
    const selectedData = selectedItems.map(index => updatedList[index]);
    console.log('this is the selectedata', selectedData);
    navigation.navigate('WhatsappResultScreen', {
      totalContacts: selectedData,
      whatsappPackage,
    });
    launchWhatsappMessage(selectedData, whatsappPackage);
  };

  const handleDone = () => {
    // Navigate back to Home screen
    navigation.navigate('Main', {screen: 'Home'});
  };

  return (
    <View style={styles.container}>
      <Header toggleTheme={toggleTheme} showBackButton={false} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {report ? (
          <>
            <Title style={styles.title}>✅ WhatsApp Report</Title>

            <Text style={styles.subtitle}>
              Successful Messages: {report.sent_count}
              {'\n'}Items in green were successfully sent
            </Text>

            {MyDataTable(
              updatedList,
              selectedItems,
              toggleSelectItem,
              handleViewMessage,
            )}
            {selectedItems.length > 0 && (
              <View style={styles.resendButtonContainer}>
                <Button
                  mode="contained"
                  onPress={handleResend}
                  icon="send"
                  style={styles.resendButton}>
                  Resend Message
                </Button>
              </View>
            )}
          </>
        ) : (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>
              Waiting for WhatsApp report...
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Done Button at Bottom */}
      <View style={styles.doneButtonContainer}>
        <Button
          mode="contained"
          onPress={handleDone}
          style={styles.doneButton}
          labelStyle={styles.doneButtonText}
          icon="check">
          Done
        </Button>
      </View>
    </View>
  );
};

const makeStyles = theme =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContent: {
      flexGrow: 1,
      padding: 16,
      paddingBottom: 80, // Extra padding to account for the fixed button
    },
    title: {
      fontSize: 22,
      marginBottom: 16,
      textAlign: 'center',
      color: theme.colors.onSurface,
    },
    subtitle: {
      fontSize: 16,
      marginBottom: 10,
      fontWeight: '500',
      color: theme.colors.onSurfaceVariant,
      textAlign: 'center',
    },
    table: {
      backgroundColor: theme.colors.surface,
      borderRadius: 8,
      overflow: 'hidden',
    },
    tableHeader: {
      backgroundColor: theme.colors.surfaceVariant,
    },
    loadingContainer: {
      marginTop: 50,
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 12,
      fontSize: 16,
      color: theme.colors.onSurfaceVariant,
    },
    resendButtonContainer: {
      marginTop: 20,
      marginBottom: 10,
    },
    resendButton: {
      borderRadius: 8,
    },
    doneButtonContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: theme.colors.background,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: theme.colors.outline,
    },
    doneButton: {
      borderRadius: 8,
      paddingVertical: 6,
    },
    doneButtonText: {
      fontSize: 16,
      fontWeight: 'bold',
    },
  });

export default WhatsappResultScreen;

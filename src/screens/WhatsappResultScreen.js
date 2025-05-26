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
import {DataTable, Button, Title, Checkbox} from 'react-native-paper';
import {launchWhatsappMessage} from '../util/WhatsappHelper';
import {MyDataTable} from '../components/DataTable';

const WhatsappResultScreen = ({navigation, route}) => {
  const {totalContacts} = route.params;
  const [report, setReport] = useState(null);
  const [data, setData] = useState(null);
  const [selectedItems, setSelectedItems] = useState([]);
  const [updatedList, setUpdatedList] = useState([]);
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
    });
    launchWhatsappMessage(selectedData, 'com.whatsapp.w4b');
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
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
            <View style={{marginTop: 20}}>
              <Button mode="contained" onPress={handleResend} icon="send">
                Resend Message
              </Button>
            </View>
          )}
        </>
      ) : (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6200ee" />
          <Text style={styles.loadingText}>Waiting for WhatsApp report...</Text>
        </View>
      )}
    </ScrollView>
  );
};

export default WhatsappResultScreen;

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#00000',
  },
  title: {
    fontSize: 22,
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 10,
    fontWeight: '500',
    color: '#444',
  },
  table: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableHeader: {
    backgroundColor: '#e0e0e0',
  },
  loadingContainer: {
    marginTop: 50,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#777',
  },
});

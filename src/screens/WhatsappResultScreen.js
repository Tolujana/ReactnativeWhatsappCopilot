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

          <DataTable style={styles.table}>
            <DataTable.Header style={styles.tableHeader}>
              <DataTable.Title style={{flex: 0.5}}>✔</DataTable.Title>
              <DataTable.Title style={{flex: 1}}>👤 Name</DataTable.Title>
              <DataTable.Title style={{flex: 2}}>📱 Number</DataTable.Title>
              <DataTable.Title style={{flex: 1.5}}>💬 Message</DataTable.Title>
            </DataTable.Header>

            {Array.isArray(updatedList) &&
              updatedList.map((item, index) => (
                <DataTable.Row
                  key={index}
                  style={{
                    paddingVertical: 6,
                    backgroundColor: item.exists ? '#bdf2cb' : '#f2c8bd',
                  }}>
                  <DataTable.Cell style={{flex: 0.5}}>
                    <Checkbox
                      status={
                        selectedItems.includes(index) ? 'checked' : 'unchecked'
                      }
                      onPress={() => toggleSelectItem(index)}
                    />
                  </DataTable.Cell>
                  <DataTable.Cell style={{flex: 1}}>
                    <View style={{paddingRight: 1}}>
                      <Text style={{flexWrap: 'wrap'}}>{item.name}</Text>
                    </View>
                  </DataTable.Cell>
                  <DataTable.Cell style={{flex: 2}}>
                    <View style={{paddingRight: 1}}>
                      <Text style={{flexWrap: 'wrap'}}>{item.phone}</Text>
                    </View>
                  </DataTable.Cell>

                  <DataTable.Cell style={{flex: 1.5}}>
                    <Button
                      contentStyle={{paddingVertical: 2, paddingHorizontal: 1}}
                      mode="contained"
                      onPress={() => handleViewMessage(item.message)}
                      compact>
                      View Message
                    </Button>
                  </DataTable.Cell>
                </DataTable.Row>
              ))}
          </DataTable>
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

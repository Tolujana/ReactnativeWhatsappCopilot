import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import {getMessageReport} from '../../util/database'; // Adjust the import path as needed
import {useNavigation} from '@react-navigation/native';
const MessageReportScreen = () => {
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation();
  useEffect(() => {
    getMessageReport(data => {
      setReportData(data);
      setLoading(false);
    });
  }, []);

  const renderItem = ({item}) => {
    const {date, data} = item;
    const rawMessage = data[0]?.message || []; // assuming only one message per entry
    console.log('Raw message:', rawMessage);
    return (
      <TouchableOpacity
        style={styles.messageCard}
        onPress={() =>
          navigation.navigate('Campaign Selection', {
            prefillMessages: rawMessage || [],
          })
        }>
        <View style={styles.card}>
          <Text style={styles.date}>{new Date(date).toLocaleString()}</Text>
          <Text style={styles.label}>sent Message:</Text>
          <Text style={styles.message}>{rawMessage?.join(' ')}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text>Loading report...</Text>
      </View>
    );
  }

  if (reportData.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>
          No messages have been backed up yet.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={reportData}
      keyExtractor={item => item.id.toString()}
      renderItem={renderItem}
      contentContainerStyle={styles.listContainer}
    />
  );
};

const styles = StyleSheet.create({
  listContainer: {
    padding: 16,
  },
  card: {
    backgroundColor: '#f7f7f7',
    padding: 16,
    marginBottom: 12,
    borderRadius: 10,
    elevation: 2,
  },
  date: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
    fontWeight: 'bold',
  },
  label: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  message: {
    fontSize: 16,
    color: '#333',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
});

export default MessageReportScreen;

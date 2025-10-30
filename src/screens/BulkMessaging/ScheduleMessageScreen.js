// src/screens/ScheduledMessagesScreen.js
import React, {useEffect, useState, useCallback} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import notifee from '@notifee/react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  getMessageReport,
  deleteSentMessages,
  insertSentMessage,
} from '../../util/data';
import {launchWhatsappMessage} from '../util/whatsappUtils'; // your existing utility

const ScheduledMessagesScreen = ({navigation}) => {
  const [scheduledMessages, setScheduledMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);

  // Load scheduled messages
  const loadScheduled = useCallback(async () => {
    try {
      setLoading(true);
      const reports = await getMessageReport();
      const scheduled = reports.filter(
        r => r.data?.isScheduled === true && Array.isArray(r.data.messages),
      );
      setScheduledMessages(scheduled);
    } catch (e) {
      console.warn('Failed to load scheduled messages', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadScheduled();
  }, [loadScheduled]);

  const toggleSelect = id => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id],
    );
  };

  const deleteSelected = async () => {
    if (selectedIds.length === 0) return;
    Alert.alert(
      'Delete',
      `Delete ${selectedIds.length} scheduled message(s)?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteSentMessages(selectedIds);
              setScheduledMessages(prev =>
                prev.filter(m => !selectedIds.includes(m.id)),
              );
              setSelectedIds([]);
            } catch (e) {
              Alert.alert('Error', 'Failed to delete messages');
            }
          },
        },
      ],
    );
  };

  const sendNow = async msg => {
    try {
      if (!msg?.data?.messages?.length) return;
      const {messages, whatsappPackage} = msg.data;
      await launchWhatsappMessage(messages, whatsappPackage);
      const updated = {
        ...msg.data,
        status: 'sent',
        sentAt: new Date().toISOString(),
      };
      await insertSentMessage(updated, new Date().toISOString());
      Alert.alert('Sent', 'Message marked as sent');
      loadScheduled();
    } catch (e) {
      Alert.alert('Error', 'Failed to send message.');
    }
  };

  const renderItem = ({item}) => {
    const {id, date, data} = item;
    const isSelected = selectedIds.includes(id);
    const contactCount = data?.messages?.length || 0;
    const scheduledTime = data?.scheduledTime
      ? new Date(data.scheduledTime).toLocaleString()
      : '—';

    return (
      <TouchableOpacity
        style={[
          styles.card,
          isSelected && {backgroundColor: '#e3f2fd'},
          data.status === 'sent' && {opacity: 0.6},
        ]}
        onPress={() => toggleSelect(id)}
        onLongPress={() => sendNow(item)}>
        <View style={styles.rowBetween}>
          <Text style={styles.title}>
            {data.status === 'sent' ? '✅ Sent' : '🕒 Pending'}
          </Text>
          <Text style={styles.subtitle}>{scheduledTime}</Text>
        </View>
        <Text style={styles.body}>
          {data.messages?.[0]?.message || '(no message content)'}
        </Text>
        <View style={styles.rowBetween}>
          <Text style={styles.subtitle}>
            Contacts: {contactCount} | Created:{' '}
            {new Date(date).toLocaleString()}
          </Text>
          {data.status !== 'sent' && (
            <TouchableOpacity
              style={styles.sendNowBtn}
              onPress={() => sendNow(item)}>
              <Icon name="send" size={18} color="white" />
              <Text style={styles.sendNowText}>Send now</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {scheduledMessages.length === 0 ? (
        <View style={styles.center}>
          <Text>No scheduled messages yet</Text>
        </View>
      ) : (
        <FlatList
          data={scheduledMessages}
          keyExtractor={item => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{padding: 10}}
        />
      )}

      {selectedIds.length > 0 && (
        <View style={styles.deleteBar}>
          <Text style={styles.deleteText}>{selectedIds.length} selected</Text>
          <TouchableOpacity onPress={deleteSelected}>
            <Icon name="delete" size={22} color="white" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

export default ScheduledMessagesScreen;

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: 'white'},
  center: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  card: {
    backgroundColor: '#fafafa',
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {fontWeight: 'bold', fontSize: 15},
  subtitle: {color: '#666', fontSize: 12},
  body: {marginTop: 6, marginBottom: 8, fontSize: 14},
  sendNowBtn: {
    flexDirection: 'row',
    backgroundColor: '#2196f3',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignItems: 'center',
  },
  sendNowText: {color: 'white', marginLeft: 5, fontSize: 12},
  deleteBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#f44336',
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    alignItems: 'center',
  },
  deleteText: {color: 'white', fontWeight: 'bold'},
});

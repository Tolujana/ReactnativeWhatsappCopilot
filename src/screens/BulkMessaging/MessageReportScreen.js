import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {IconButton} from 'react-native-paper';
import {useNavigation} from '@react-navigation/native';
import {BannerAd, BannerAdSize} from 'react-native-google-mobile-ads';
import {getMessageReport, deleteSentMessages} from '../../util/data';

const MessageReportScreen = () => {
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation();

  useEffect(() => {
    loadMessages();
  }, []);

  const loadMessages = async () => {
    try {
      setLoading(true);
      const data = await getMessageReport();
      setReportData(data);
    } catch (e) {
      console.warn('Failed to load message report', e);
      Alert.alert('Error', 'Failed to load message history');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async id => {
    Alert.alert(
      'Delete Message',
      'Are you sure you want to delete this message history entry?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteSentMessages([id]);
              await loadMessages();
            } catch (e) {
              Alert.alert('Delete failed', String(e.message || e));
            }
          },
        },
      ],
    );
  };

  // Insert banner ads after every 3rd item
  const dataWithAds = reportData.reduce((acc, item, index) => {
    acc.push({type: 'message', data: item});
    if ((index + 1) % 3 === 0) {
      acc.push({type: 'ad', id: `ad-${index}`});
    }
    return acc;
  }, []);

  const renderItem = ({item}) => {
    if (item.type === 'ad') {
      return (
        <View style={styles.adContainer}>
          <BannerAd
            unitId="ca-app-pub-3940256099942544/6300978111" // Test ID, replace with your AdMob ID
            size={BannerAdSize.BANNER}
            requestOptions={{requestNonPersonalizedAdsOnly: true}}
          />
        </View>
      );
    }

    const {date, data, id} = item.data;
    const rawMessage = data[0]?.message || [];
    return (
      <TouchableOpacity
        style={styles.messageCard}
        onPress={() =>
          navigation.navigate('Campaign Selection', {
            prefillMessages: rawMessage || [],
          })
        }>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.date}>{new Date(date).toLocaleString()}</Text>
            <IconButton
              icon="delete"
              size={20}
              iconColor="#d32f2f"
              onPress={() => handleDelete(id)}
            />
          </View>
          <Text style={styles.label}>Sent Message:</Text>
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
      data={dataWithAds}
      keyExtractor={(item, index) =>
        item.type === 'message' ? item.data.id.toString() : item.id
      }
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  adContainer: {
    alignItems: 'center',
    marginVertical: 10,
  },
  messageCard: {
    marginBottom: 12,
  },
});

export default MessageReportScreen;

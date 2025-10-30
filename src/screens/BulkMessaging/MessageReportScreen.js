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
import {IconButton, useTheme, Card, Surface} from 'react-native-paper';
import {useNavigation} from '@react-navigation/native';
import {BannerAd, BannerAdSize} from 'react-native-google-mobile-ads';
import {getMessageReport, deleteSentMessages} from '../../util/data';

const MessageReportScreen = () => {
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation();
  const theme = useTheme();
  const styles = makeStyles(theme);

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
            unitId="ca-app-pub-7993847549836206/9152830275" // Test ID, replace with your AdMob ID
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
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.cardHeader}>
              <Text variant="bodySmall" style={styles.date}>
                {new Date(date).toLocaleString()}
              </Text>
              <IconButton
                icon="delete"
                size={20}
                iconColor={theme.colors.error}
                onPress={() => handleDelete(id)}
              />
            </View>
            <Text variant="labelLarge" style={styles.label}>
              Sent Message:
            </Text>
            <Text variant="bodyMedium" style={styles.message}>
              {rawMessage?.join(' ')}
            </Text>
          </Card.Content>
        </Card>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text variant="bodyMedium" style={styles.loadingText}>
          Loading report...
        </Text>
      </View>
    );
  }

  if (reportData.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <Text variant="bodyLarge" style={styles.emptyText}>
            No messages have been backed up yet.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={dataWithAds}
        keyExtractor={(item, index) =>
          item.type === 'message' ? item.data.id.toString() : item.id
        }
        renderItem={renderItem}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const makeStyles = theme =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    listContainer: {
      padding: 16,
    },
    card: {
      backgroundColor: theme.colors.surface,
      marginBottom: 12,
      elevation: 2,
      shadowColor: theme.colors.shadow,
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    date: {
      color: theme.colors.onSurfaceVariant,
      fontWeight: 'bold',
      flex: 1,
    },
    label: {
      color: theme.colors.onSurface,
      marginBottom: 4,
    },
    message: {
      color: theme.colors.onSurface,
      lineHeight: 20,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    },
    loadingText: {
      marginTop: 12,
      color: theme.colors.onSurfaceVariant,
    },
    emptyText: {
      color: theme.colors.onSurfaceVariant,
      textAlign: 'center',
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

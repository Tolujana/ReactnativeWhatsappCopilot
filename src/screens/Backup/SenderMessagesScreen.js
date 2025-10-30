// src/screens/SenderMessagesScreen.js
import React, {useState, useEffect} from 'react';
import {View, FlatList, StyleSheet, Alert} from 'react-native';
import {Text, useTheme, Card, Button} from 'react-native-paper';
import {
  getChatMessages,
  preloadRewardedAd,
  showRewardedAd,
} from '../../util/data';
import Header from '../../components/Header';

const SenderMessagesScreen = ({route, toggleTheme}) => {
  const theme = useTheme();
  const {app, contactIdentifier, name} = route.params || {}; // Fallback if params missing
  const [messages, setMessages] = useState([]);
  const [adShown, setAdShown] = useState(false);
  const [error, setError] = useState(null);
  const [isRecentSender, setIsRecentSender] = useState(false); // Flag for better prompt
  const [loading, setLoading] = useState(false); // Added loading state

  useEffect(() => {
    if (!app || !contactIdentifier) {
      setError('Invalid chat details');
      return;
    }
    loadMessages();
    preloadRewardedAd(); // Preload for inline ads
  }, [app, contactIdentifier]);

  const loadMessages = async () => {
    setLoading(true); // Set loading
    try {
      setError(null);
      const msgs = await getChatMessages(app, contactIdentifier);
      // Sort by timestamp ASC for chat order
      const sorted = msgs.sort(
        (a, b) => Number(b.timestamp) - Number(a.timestamp),
      );
      setMessages(sorted);
      setIsRecentSender(false); // Reset flag
      if (sorted.length > 0) {
        Alert.alert('Success', 'Messages refreshed!'); // Alert on successful load
      }
    } catch (e) {
      console.warn('Load messages error', e);
      if (e.message?.includes('INSUFFICIENT_POINTS')) {
        Alert.alert('Low Points', 'Watch an ad to view this chat?', [
          {text: 'Cancel'},
          {
            text: 'Watch Ad',
            onPress: async () => {
              try {
                await showRewardedAd();
                loadMessages(); // Retry
              } catch (err) {
                Alert.alert('Ad Error', 'Failed to load ad');
              }
            },
          },
        ]);
      } else if (e.message?.includes('CHAT_NOT_FOUND')) {
        setIsRecentSender(true); // For recent sender context
        setMessages([]); // Show empty with custom prompt
      } else {
        Alert.alert(
          'Error',
          'Failed to load messages: ' + (e.message || 'Unknown error'),
        );
        setMessages([]); // Show empty
      }
    } finally {
      setLoading(false); // Clear loading
    }
  };

  const renderBubble = ({item, index}) => {
    const isSent = item.isSent;
    const showAd = (index + 1) % 4 === 0 && index > 0 && !adShown;
    return (
      <View>
        <View
          style={[
            styles.bubble,
            isSent ? styles.sentBubble : styles.receivedBubble,
            {
              backgroundColor: isSent
                ? theme.colors.primary
                : theme.colors.surfaceVariant,
            },
          ]}>
          <Text
            style={[styles.timestamp, {color: theme.colors.onSurfaceVariant}]}>
            {new Date(Number(item.timestamp)).toLocaleTimeString()}
          </Text>
          <Text style={[styles.content, {color: theme.colors.onSurface}]}>
            {item.content}
          </Text>
        </View>
        {showAd && (
          <View style={styles.adContainer}>
            <Card
              style={[styles.adCard, {backgroundColor: theme.colors.surface}]}>
              <Card.Content>
                <Text
                  variant="bodyMedium"
                  style={{color: theme.colors.onSurface}}>
                  Sponsored Ad
                </Text>
                <Button
                  mode="contained"
                  onPress={async () => {
                    try {
                      await showRewardedAd();
                      setAdShown(true);
                    } catch (e) {
                      Alert.alert('Ad Error', 'Failed to show ad');
                    }
                  }}
                  style={{backgroundColor: theme.colors.primary}}>
                  Watch for Points
                </Button>
              </Card.Content>
            </Card>
          </View>
        )}
      </View>
    );
  };

  const renderEmptyState = () => {
    if (isRecentSender) {
      return (
        <View
          style={[
            styles.emptyContainer,
            {backgroundColor: theme.colors.background},
          ]}>
          <Text variant="bodyMedium" style={{color: theme.colors.onBackground}}>
            No saved messages yet for {name || contactIdentifier}.
          </Text>
          <Text
            variant="bodySmall"
            style={[styles.subText, {color: theme.colors.onSurfaceVariant}]}>
            This sender has messaged you recently, but backups start after
            enabling. Future incoming messages will be saved automatically (1
            point each).
          </Text>
          <Button
            mode="outlined"
            onPress={loadMessages}
            style={styles.retryButton}
            textColor={theme.colors.primary}>
            Refresh
          </Button>
        </View>
      );
    }
    return (
      <View
        style={[
          styles.emptyContainer,
          {backgroundColor: theme.colors.background},
        ]}>
        <Text variant="bodyMedium" style={{color: theme.colors.onBackground}}>
          No messages yet. Enable backup to start saving incoming messages.
        </Text>
        <Button
          mode="outlined"
          onPress={loadMessages}
          style={styles.retryButton}
          textColor={theme.colors.primary}>
          Refresh
        </Button>
      </View>
    );
  };

  if (error && !isRecentSender) {
    return (
      <View
        style={[
          styles.errorContainer,
          {backgroundColor: theme.colors.background},
        ]}>
        <Text variant="bodyLarge" style={{color: theme.colors.onBackground}}>
          {error}
        </Text>
        <Button
          mode="outlined"
          onPress={loadMessages}
          textColor={theme.colors.primary}>
          Retry
        </Button>
      </View>
    );
  }

  return (
    <View
      style={[styles.container, {backgroundColor: theme.colors.background}]}>
      <Header toggleTheme={toggleTheme} showBackButton={true} />
      <Text
        style={[
          styles.header,
          {
            color: theme.colors.onBackground,
            backgroundColor: theme.colors.surface,
          },
        ]}>
        Chat with {name || contactIdentifier} ({app})
      </Text>
      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={{color: theme.colors.onBackground}}>
            Loading messages...
          </Text>
        </View>
      ) : messages.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={messages}
          renderItem={renderBubble}
          keyExtractor={item => item.timestamp}
          style={styles.chatList}
          inverted // Bottom-up like WhatsApp
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1},
  header: {
    padding: 4,
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 18,
    elevation: 2,
  },
  chatList: {flex: 1},
  bubble: {
    margin: 8,
    padding: 12,
    borderRadius: 18,
    maxWidth: '80%',
    elevation: 1,
  },
  sentBubble: {alignSelf: 'flex-end', marginLeft: '20%'},
  receivedBubble: {alignSelf: 'flex-start', marginRight: '20%'},
  content: {fontSize: 16},
  timestamp: {fontSize: 12, opacity: 0.7, marginBottom: 4},
  adContainer: {alignSelf: 'center', marginVertical: 8},
  adCard: {width: 200, elevation: 2},
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  subText: {textAlign: 'center', marginVertical: 8},
  retryButton: {marginTop: 8},
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default SenderMessagesScreen;

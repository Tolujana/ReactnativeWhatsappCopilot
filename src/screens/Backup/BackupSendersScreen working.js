// src/screens/BackupSendersScreen.js - FIXED VERSION
import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  FlatList,
  Alert,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import {
  List,
  Switch,
  Button,
  Text,
  useTheme,
  Card,
  Avatar,
  IconButton,
  SegmentedButtons,
  ActivityIndicator,
} from 'react-native-paper';
import {useFocusEffect} from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getRecentChats,
  getDeviceContacts,
  enableBackup,
  disableBackup,
  getEnabledBackups,
  isNotificationAccessGranted,
  openNotificationAccessSettings,
} from '../../util/data';

const STORAGE_ENABLED_MAP = 'enabledMap';

const BackupSendersScreen = ({navigation}) => {
  const theme = useTheme();
  const [allItems, setAllItems] = useState([]);
  const [enabled, setEnabled] = useState({});
  const [hasPermission, setHasPermission] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState('all');

  const loadFromStorage = async () => {
    try {
      const enabledStr = await AsyncStorage.getItem(STORAGE_ENABLED_MAP);
      if (enabledStr !== null) {
        setEnabled(JSON.parse(enabledStr));
      }
    } catch (e) {
      console.warn('Storage load failed', e);
    }
  };

  const saveToStorage = async enMap => {
    try {
      await AsyncStorage.setItem(STORAGE_ENABLED_MAP, JSON.stringify(enMap));
    } catch (e) {
      console.warn('Storage save failed', e);
    }
  };

  const checkPermission = async () => {
    try {
      const granted = await isNotificationAccessGranted();
      console.log('Notification permission:', granted);
      setHasPermission(granted);
    } catch (e) {
      console.warn('Permission check failed', e);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      console.log('Loading data for app:', selectedApp);

      // Load recent chats (filtered by app if not 'all')
      const recents = await getRecentChats(
        selectedApp === 'all' ? null : selectedApp,
      );
      console.log('Recent chats loaded:', recents.length);

      // Load contacts (only if whatsapp or all is selected)
      let contacts = [];
      if (selectedApp === 'all' || selectedApp === 'whatsapp') {
        contacts = await getDeviceContacts();
        console.log('Device contacts loaded:', contacts.length);
      }

      // Load enabled backups from DB
      const enabledList = await getEnabledBackups();
      console.log('Enabled backups from DB:', enabledList.length);

      // Build enabled map
      const enabledMap = {};

      // First, add all from DB
      enabledList.forEach(item => {
        const key = `${item.app || 'whatsapp'}_${item.contact_identifier}`;
        enabledMap[key] = true;
      });

      // Check for wildcard entries (from createTables default enable)
      const hasWildcard = enabledList.some(
        item => item.contact_identifier === '*',
      );

      console.log('Has wildcard enabled:', hasWildcard);

      // If wildcard exists for an app, enable all items for that app by default
      const wildcardApps = enabledList
        .filter(item => item.contact_identifier === '*')
        .map(item => item.app);

      console.log('Wildcard apps:', wildcardApps);

      // Enable recent chats that match wildcard or explicit enable
      for (const chat of recents) {
        const key = `${chat.app}_${chat.contact_identifier}`;
        if (!(key in enabledMap)) {
          // Check if wildcard enabled for this app
          if (wildcardApps.includes(chat.app)) {
            enabledMap[key] = true;
            // Persist explicit enable
            await enableBackup(chat.app, chat.contact_identifier, chat.name);
          } else {
            enabledMap[key] = false;
          }
        }
      }

      // Enable contacts that match wildcard
      for (const contact of contacts) {
        const key = `whatsapp_${contact.phones[0]}`;
        if (!(key in enabledMap)) {
          if (wildcardApps.includes('whatsapp')) {
            enabledMap[key] = true;
            await enableBackup('whatsapp', contact.phones[0], contact.name);
          } else {
            enabledMap[key] = false;
          }
        }
      }

      setEnabled(enabledMap);
      await saveToStorage(enabledMap);

      // Combine items
      const combined = [
        ...recents.map(chat => ({...chat, type: 'recent'})),
        ...contacts.map(contact => ({
          ...contact,
          type: 'contact',
          app: 'whatsapp', // Default app for contacts
        })),
      ];

      console.log('Total combined items:', combined.length);

      // Filter by selected app
      let filtered = combined;
      if (selectedApp !== 'all') {
        filtered = combined.filter(item => item.app === selectedApp);
      }

      console.log('Filtered items:', filtered.length);
      setAllItems(filtered);
    } catch (e) {
      console.error('loadData failed:', e);
      Alert.alert('Load Error', 'Failed to load data: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      console.log('Screen focused, loading data...');
      loadFromStorage();
      checkPermission();
      loadData();
    }, [selectedApp]),
  );

  const toggleBackup = async (app, identifier, name, isEnabled) => {
    const key = `${app}_${identifier}`;
    const newEnabled = {...enabled, [key]: !isEnabled};
    setEnabled(newEnabled);

    try {
      if (isEnabled) {
        await disableBackup(app, identifier);
        console.log('Disabled backup for:', key);
      } else {
        await enableBackup(app, identifier, name);
        console.log('Enabled backup for:', key);
      }
      await saveToStorage(newEnabled);
    } catch (e) {
      console.error('Toggle error:', e);
      Alert.alert(
        'Toggle Error',
        'Failed to update backup setting: ' + e.message,
      );
      // Revert on error
      setEnabled(enabled);
    }
  };

  const navigateToChat = (app, identifier, name) => {
    console.log('Navigating to chat:', {app, identifier, name});
    navigation.navigate('SenderMessages', {
      app,
      contactIdentifier: identifier,
      name,
    });
  };

  const navigateToSettings = () => {
    navigation.navigate('BackupSettings');
  };

  const renderItem = ({item}) => {
    const isRecent = item.type === 'recent';
    const app = item.app || 'whatsapp';
    const identifier = isRecent ? item.contact_identifier : item.phones[0];
    const name = item.name || (isRecent ? 'Unknown Sender' : 'Unknown Contact');
    const key = `${app}_${identifier}`;
    const isEnabled = enabled[key] || false;

    const initials = name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);

    return (
      <TouchableOpacity
        onPress={() => isEnabled && navigateToChat(app, identifier, name)}
        disabled={!isEnabled}>
        <View style={styles.chatRow}>
          <Avatar.Text size={48} label={initials} style={styles.avatar} />
          <View style={styles.chatInfo}>
            <Text variant="titleSmall" numberOfLines={1}>
              {name}
            </Text>
            <Text variant="bodySmall" numberOfLines={1}>
              {isRecent
                ? `Last: ${new Date(
                    Number(item.last_timestamp || 0),
                  ).toLocaleDateString()}`
                : `Phone: ${identifier}`}
            </Text>
          </View>
          <View style={styles.rightSection}>
            <Switch
              value={isEnabled}
              onValueChange={() =>
                toggleBackup(app, identifier, name, isEnabled)
              }
              trackColor={{
                false: theme.colors.backdrop,
                true: theme.colors.primary,
              }}
              thumbColor={
                isEnabled
                  ? theme.colors.primaryContainer
                  : theme.colors.backdrop
              }
            />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
        <Text style={{marginTop: 16}}>Loading senders...</Text>
      </View>
    );
  }

  const appOptions = [
    {value: 'all', label: 'All Apps'},
    {value: 'whatsapp', label: 'WhatsApp'},
    {value: 'whatsapp_business', label: 'WhatsApp Business'},
    {value: 'telegram', label: 'Telegram'},
  ];

  return (
    <View
      style={[styles.container, {backgroundColor: theme.colors.background}]}>
      <View style={styles.header}>
        <Text variant="headlineLarge" style={styles.title}>
          Backup Senders
        </Text>
        <IconButton
          icon="cog"
          size={24}
          onPress={navigateToSettings}
          style={styles.settingsIcon}
        />
      </View>

      {!hasPermission && (
        <Card style={styles.infoCard}>
          <Card.Content>
            <Text variant="bodyMedium">
              To start backing up messages, grant notification access. This is
              required by Android to detect incoming messages from your selected
              apps (WhatsApp, WhatsApp Business, Telegram). We use it only to
              capture message content for backups—your chats stay private on
              your device.
            </Text>
          </Card.Content>
          <Card.Actions>
            <Button mode="contained" onPress={openNotificationAccessSettings}>
              Grant Access Now
            </Button>
          </Card.Actions>
        </Card>
      )}

      <SegmentedButtons
        value={selectedApp}
        onValueChange={setSelectedApp}
        buttons={appOptions}
        style={styles.segmentedButtons}
      />

      {allItems.length === 0 ? (
        <View style={styles.noItemsContainer}>
          <Text variant="bodyMedium">
            {selectedApp === 'all'
              ? 'No messages yet. Send or receive messages in enabled apps.'
              : `No messages from ${selectedApp.replace(
                  '_',
                  ' ',
                )}. Install the app or wait for chats.`}
          </Text>
          <Button mode="outlined" onPress={loadData} style={{marginTop: 16}}>
            Refresh
          </Button>
        </View>
      ) : (
        <FlatList
          data={allItems}
          renderItem={renderItem}
          keyExtractor={(item, index) =>
            `${item.type}_${item.app || 'whatsapp'}_${
              item.contact_identifier || item.phones?.[0] || index
            }`
          }
          style={styles.flatList}
          showsVerticalScrollIndicator={true}
          removeClippedSubviews={false}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={10}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, padding: 16},
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {flex: 1},
  settingsIcon: {marginLeft: 8},
  infoCard: {marginBottom: 16},
  segmentedButtons: {marginBottom: 16},
  noItemsContainer: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  flatList: {flex: 1},
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  avatar: {marginRight: 12},
  chatInfo: {flex: 1},
  rightSection: {alignItems: 'flex-end'},
  loading: {flex: 1, justifyContent: 'center', alignItems: 'center'},
});

export default BackupSendersScreen;

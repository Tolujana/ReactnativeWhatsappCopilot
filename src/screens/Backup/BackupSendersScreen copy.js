// src/screens/BackupSendersScreen.js
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
  const [selectedApp, setSelectedApp] = useState('all'); // 'all', 'whatsapp', 'whatsapp_business', 'telegram'

  const loadFromStorage = async () => {
    try {
      const enabledStr = await AsyncStorage.getItem(STORAGE_ENABLED_MAP);
      if (enabledStr !== null) setEnabled(JSON.parse(enabledStr));
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
      setHasPermission(granted);
    } catch (e) {
      console.warn('Permission check failed', e);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const recents = await getRecentChats(
        selectedApp === 'all' ? null : selectedApp,
      );
      const contacts = await getDeviceContacts(); // Always load contacts, filter if needed
      const enabledList = await getEnabledBackups();
      const enabledMap = {...enabled}; // Merge stored + DB
      enabledList.forEach(item => {
        enabledMap[
          `${item.app || 'whatsapp'}_${item.contact_identifier}`
        ] = true;
      });
      // Default to enabled if no entry (as per request)
      recents.forEach(async item => {
        const key = `${item.app}_${item.contact_identifier}`;
        if (!(key in enabledMap)) {
          enabledMap[key] = true; // Enable by default
          await enableBackup(item.app, item.contact_identifier, item.name); // Persist default
        }
      });
      contacts.forEach(async item => {
        const key = `whatsapp_${item.phones[0]}`;
        if (!(key in enabledMap)) {
          enabledMap[key] = true; // Enable by default
          await enableBackup('whatsapp', item.phones[0], item.name); // Persist default
        }
      });
      setEnabled(enabledMap);
      await saveToStorage(enabledMap);
      // Combine and filter by selectedApp
      let combined = [
        ...recents.map(chat => ({...chat, type: 'recent'})),
        ...contacts.map(contact => ({...contact, type: 'contact'})),
      ];
      if (selectedApp !== 'all') {
        combined = combined.filter(
          item =>
            item.app === selectedApp ||
            (item.type === 'contact' && selectedApp === 'whatsapp'), // Contacts default to whatsapp
        );
      }
      setAllItems(combined);
    } catch (e) {
      console.warn('loadData failed', e);
      Alert.alert('Load Error', 'Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  // useFocusEffect(
  //   useCallback(() => {
  //     checkPermission(); // Always check on focus
  //   }, []), // No deps—runs every focus
  // );
  useFocusEffect(
    useCallback(() => {
      loadFromStorage();
      checkPermission();
      loadData();
    }, [selectedApp]), // Re-run on app change
  );

  const toggleBackup = async (app, identifier, name, isEnabled) => {
    const newEnabled = {...enabled};
    newEnabled[`${app}_${identifier}`] = !isEnabled;
    setEnabled(newEnabled);
    try {
      if (isEnabled) {
        await disableBackup(app, identifier);
      } else {
        await enableBackup(app, identifier, name);
      }
    } catch (e) {
      Alert.alert('Toggle Error', 'Failed to update backup setting.');
      return; // Revert on error
    }
    await saveToStorage(newEnabled);
    loadData(); // Refresh
  };

  const navigateToChat = (app, identifier, name) => {
    navigation.navigate('SenderMessages', {
      app,
      contactIdentifier: identifier,
      name,
    });
  };

  const navigateToSettings = () => {
    navigation.navigate('BackupSettings');
  };

  // Render item based on type
  const renderItem = ({item}) => {
    if (item.type === 'recent') {
      const key = `${item.app}_${item.contact_identifier}`;
      const isEnabled = enabled[key] || false;
      const initials = (item.name || 'Unknown')
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
      return (
        <TouchableOpacity
          onPress={() =>
            isEnabled &&
            navigateToChat(item.app, item.contact_identifier, item.name)
          }
          disabled={!isEnabled}>
          <View style={styles.chatRow}>
            <Avatar.Text size={48} label={initials} style={styles.avatar} />
            <View style={styles.chatInfo}>
              <Text variant="titleSmall" numberOfLines={1}>
                {item.name || 'Unknown Sender'}
              </Text>
              <Text variant="bodySmall" numberOfLines={1}>
                Last:{' '}
                {new Date(
                  Number(item.last_timestamp || 0),
                ).toLocaleDateString()}
              </Text>
            </View>
            <View style={styles.rightSection}>
              <Switch
                value={isEnabled}
                onValueChange={() =>
                  toggleBackup(
                    item.app,
                    item.contact_identifier,
                    item.name,
                    isEnabled,
                  )
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
    } else {
      // contact
      const key = `whatsapp_${item.phones[0]}`;
      const isEnabled = enabled[key] || false;
      const initials = (item.name || 'Contact')
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
      return (
        <TouchableOpacity
          onPress={() =>
            isEnabled && navigateToChat('whatsapp', item.phones[0], item.name)
          }
          disabled={!isEnabled}>
          <View style={styles.chatRow}>
            <Avatar.Text size={48} label={initials} style={styles.avatar} />
            <View style={styles.chatInfo}>
              <Text variant="titleSmall" numberOfLines={1}>
                {item.name || 'Unknown Contact'}
              </Text>
              <Text variant="bodySmall" numberOfLines={1}>
                Phone: {item.phones[0] || 'N/A'}
              </Text>
            </View>
            <View style={styles.rightSection}>
              <Switch
                value={isEnabled}
                onValueChange={() =>
                  toggleBackup('whatsapp', item.phones[0], item.name, isEnabled)
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
    }
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <Text>Loading senders...</Text>
      </View>
    );
  }

  const appOptions = [
    {value: 'all', label: 'All Apps'},
    {value: 'whatsapp', label: 'WhatsApp'},
    {value: 'whatsapp_business', label: 'WhatsApp Business'},
    {value: 'telegram', label: 'Telegram'},
  ];

  const hasItemsForApp = allItems.some(
    item =>
      item.app === selectedApp ||
      (selectedApp === 'whatsapp' && item.type === 'contact'),
  );

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
      {!hasItemsForApp && selectedApp !== 'all' && (
        <View style={styles.noItemsContainer}>
          <Text variant="bodyMedium">
            No messages from this app. Install the app or wait for chats.
          </Text>
        </View>
      )}
      <FlatList
        data={allItems}
        renderItem={renderItem}
        keyExtractor={(item, index) =>
          `${item.type}_${item.contact_identifier || item.name || index}`
        }
        style={styles.flatList}
        showsVerticalScrollIndicator={true}
        removeClippedSubviews={false}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={10}
      />
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
  noItemsContainer: {padding: 16, alignItems: 'center'},
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
  enabledText: {fontWeight: 'bold'},
  loading: {flex: 1, justifyContent: 'center', alignItems: 'center'},
});

export default BackupSendersScreen;

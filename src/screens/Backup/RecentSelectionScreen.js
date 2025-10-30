// New src/screens/RecentChatsSelectionScreen.js
import React, {useState, useEffect} from 'react';
import {View, FlatList, StyleSheet} from 'react-native';
import {List, Switch, Text, useTheme} from 'react-native-paper';
import {
  getRecentChats,
  enableBackup,
  disableBackup,
  getEnabledBackups,
} from '../../util/data';

const RecentChatsSelectionScreen = ({navigation}) => {
  const theme = useTheme();
  const [recentChats, setRecentChats] = useState([]);
  const [enabled, setEnabled] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const chats = await getRecentChats();
    setRecentChats(chats);
    const enabledList = await getEnabledBackups();
    const enabledMap = {};
    enabledList.forEach(item => {
      enabledMap[`${item.app}_${item.contact_identifier}`] = true;
    });
    setEnabled(enabledMap);
  };

  const toggleChat = async (app, identifier, name, isEnabled) => {
    if (isEnabled) {
      await disableBackup(app, identifier);
    } else {
      await enableBackup(app, identifier, name);
    }
    loadData(); // Refresh
  };

  const renderItem = ({item}) => {
    const key = `${item.app}_${item.contact_identifier}`;
    const isEnabled = enabled[key] || false;
    return (
      <List.Item
        title={item.name}
        description={`App: ${item.app} | Last: ${new Date(
          Number(item.last_timestamp),
        ).toLocaleDateString()}`}
        right={() => (
          <Switch
            value={isEnabled}
            onValueChange={() =>
              toggleChat(
                item.app,
                item.contact_identifier,
                item.name,
                isEnabled,
              )
            }
          />
        )}
      />
    );
  };

  return (
    <View
      style={[styles.container, {backgroundColor: theme.colors.background}]}>
      <Text variant="headlineLarge" style={styles.title}>
        Select Recent Chats
      </Text>
      <FlatList
        data={recentChats}
        renderItem={renderItem}
        keyExtractor={item => `${item.app}_${item.contact_identifier}`}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, padding: 16},
  title: {marginBottom: 16},
});

export default RecentChatsSelectionScreen;

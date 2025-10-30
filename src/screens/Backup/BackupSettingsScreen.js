// src/screens/BackupSettingsScreen.js (WhatsApp enabled by default)
import React, {useState, useEffect} from 'react';
import {View, Alert, StyleSheet} from 'react-native';
import {
  List,
  Checkbox,
  TextInput,
  Button,
  Text,
  useTheme,
} from 'react-native-paper';
import {
  getAutoDeleteDays,
  setAutoDeleteDays,
  getBackupPrivateOnly,
  setBackupPrivateOnly,
  getEnabledNotificationApps,
  setEnabledNotificationApps,
} from '../../util/data';

const BackupSettingsScreen = () => {
  const theme = useTheme();
  const [days, setDays] = useState('0');
  const [enabledApps, setEnabledApps] = useState(['com.whatsapp']); // WhatsApp enabled by default
  const [privateOnly, setPrivateOnly] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const currentDays = await getAutoDeleteDays();
    setDays(currentDays.toString());
    const apps = await getEnabledNotificationApps();
    // If no apps set, default to WhatsApp
    if (apps.length === 0) {
      setEnabledApps(['com.whatsapp']);
      await setEnabledNotificationApps(['com.whatsapp']);
    } else {
      setEnabledApps(apps);
    }
    const priv = await getBackupPrivateOnly();
    setPrivateOnly(priv);
  };

  const saveDays = async () => {
    try {
      await setAutoDeleteDays(Number(days));
      Alert.alert('Success', 'Auto-delete days updated');
    } catch (e) {
      Alert.alert('Error', 'Failed to update');
    }
  };

  const togglePrivateOnly = async () => {
    const newVal = !privateOnly;
    try {
      await setBackupPrivateOnly(newVal);
      setPrivateOnly(newVal);
      Alert.alert(
        'Success',
        `Private chats only: ${newVal ? 'Enabled' : 'Disabled'}`,
      );
    } catch (e) {
      Alert.alert('Error', 'Failed to update');
    }
  };

  const toggleApp = async appPackage => {
    const newApps = enabledApps.includes(appPackage)
      ? enabledApps.filter(a => a !== appPackage)
      : [...enabledApps, appPackage];
    try {
      await setEnabledNotificationApps(newApps);
      setEnabledApps(newApps);
      Alert.alert('Success', `App toggled: ${appPackage}`);
    } catch (e) {
      Alert.alert('Error', 'Failed to update app settings');
    }
  };

  const appOptions = [
    {pkg: 'com.whatsapp', name: 'WhatsApp'},
    {pkg: 'com.whatsapp.w4b', name: 'WhatsApp Business'},
    {pkg: 'org.telegram.messenger', name: 'Telegram'},
  ];

  return (
    <View
      style={[styles.container, {backgroundColor: theme.colors.background}]}>
      <Text variant="headlineLarge" style={styles.title}>
        Backup Settings
      </Text>

      <List.Section title="Auto-Delete Messages">
        <Text variant="bodyMedium">
          Delete messages after (days, 0 to disable):
        </Text>
        <TextInput
          mode="outlined"
          style={styles.input}
          value={days}
          onChangeText={setDays}
          keyboardType="numeric"
          placeholder="0"
        />
        <Button mode="contained" onPress={saveDays} style={styles.button}>
          Save Days
        </Button>
      </List.Section>

      <Checkbox.Item
        label="Backup Private Chats Only (Skip Groups)"
        status={privateOnly ? 'checked' : 'unchecked'}
        onPress={togglePrivateOnly}
      />

      <List.Section title="Enabled Notification Apps">
        {appOptions.map(({pkg, name}) => (
          <Checkbox.Item
            key={pkg}
            label={name}
            status={enabledApps.includes(pkg) ? 'checked' : 'unchecked'}
            onPress={() => toggleApp(pkg)}
          />
        ))}
        <Button mode="outlined" onPress={loadSettings} style={styles.button}>
          Refresh
        </Button>
      </List.Section>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, padding: 16},
  title: {marginBottom: 16},
  input: {marginVertical: 8},
  button: {marginVertical: 8},
});

export default BackupSettingsScreen;

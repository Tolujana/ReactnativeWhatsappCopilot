import React, {useState} from 'react';
import {ScrollView, StyleSheet} from 'react-native';
import {List, Switch, Text, useTheme} from 'react-native-paper';

const MESSENGERS = [
  'WhatsApp',
  'WhatsApp Business',
  'Telegram',
  'Signal',
  'Messenger',
];

export default function RetrieveMessageSettings() {
  const theme = useTheme();
  const [enabledApps, setEnabledApps] = useState({
    WhatsApp: true,
    'WhatsApp Business': true,
    Telegram: false,
    Signal: false,
    Messenger: false,
  });

  const toggleApp = app => {
    setEnabledApps(prev => ({...prev, [app]: !prev[app]}));
  };

  return (
    <ScrollView
      style={{flex: 1, backgroundColor: theme.colors.background, padding: 16}}>
      <Text variant="titleLarge" style={{marginBottom: 12}}>
        Choose apps to monitor:
      </Text>
      {MESSENGERS.map(app => (
        <List.Item
          key={app}
          title={app}
          right={() => (
            <Switch
              value={enabledApps[app]}
              onValueChange={() => toggleApp(app)}
            />
          )}
        />
      ))}
    </ScrollView>
  );
}

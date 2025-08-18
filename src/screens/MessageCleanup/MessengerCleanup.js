import React, {useEffect, useState} from 'react';
import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import {Text, Surface, useTheme, Button} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useNavigation} from '@react-navigation/native';
import {NativeModules} from 'react-native';

const {StatusModule} = NativeModules;

const MESSENGERS = [
  {
    app: 'WhatsApp',
    icon: 'whatsapp',
  },
  {
    app: 'Telegram',
    icon: 'telegram',
  },
  {
    app: 'WhatsApp Business',
    icon: 'briefcase',
  },
];

export default function MessengerCleanup() {
  const theme = useTheme();
  const navigation = useNavigation();
  const [treeUri, setTreeUri] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const savedUri = await StatusModule.getSavedTreeUri();
        if (savedUri) {
          setTreeUri(savedUri);
        }
      } catch (e) {
        console.warn('No saved folder found yet');
      }
    })();
  }, []);

  const pickFolder = async () => {
    try {
      const picked = await StatusModule.openStatusFolderPicker('cleanup');

      console.log('Picked folder URI:', picked);

      setTreeUri(picked);

      Alert.alert(
        'Folder Selected',
        'You can now tap any app below to continue.',
      );
    } catch (e) {
      Alert.alert('Folder Picker Failed', e.message || 'Unable to pick folder');
    }
  };

  const getAppKey = app => {
    if (app === 'WhatsApp') return 'whatsapp';
    if (app === 'WhatsApp Business') return 'business';
    if (app === 'Telegram') return 'telegram';
    return 'whatsapp'; // default fallback
  };

  const handlePress = app => {
    if (!treeUri) {
      Alert.alert(
        'Folder Required',
        'Please pick the Android/media folder first to continue.',
        [{text: 'Pick Folder', onPress: pickFolder}, {text: 'Cancel'}],
      );
    } else {
      const appKey = getAppKey(app);
      // StatusModule.launchMessengerMedia(appKey);
      navigation.navigate('MessengerMediaGrid', {app, appKey, treeUri});
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.noticeBox}>
        <Text variant="bodyMedium" style={{textAlign: 'center'}}>
          {treeUri
            ? 'You’ve already selected a folder. You can change it if needed.'
            : 'You must select the Android/media folder to access messenger media.'}
        </Text>
        <Button mode="contained" onPress={pickFolder} style={{marginTop: 8}}>
          {treeUri ? 'Change Folder' : 'Pick Folder'}
        </Button>
      </View>

      {MESSENGERS.map(({app, icon}) => (
        <TouchableOpacity key={app} onPress={() => handlePress(app)}>
          <Surface
            style={[
              styles.card,
              {backgroundColor: theme.colors.elevation.level1},
            ]}>
            <Icon name={icon} size={30} color={theme.colors.primary} />
            <Text style={styles.appName}>{app}</Text>
          </Surface>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'center',
  },
  card: {
    width: 100,
    height: 100,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  appName: {
    marginTop: 6,
    fontSize: 13,
    textAlign: 'center',
  },
  noticeBox: {
    width: '100%',
    padding: 16,
    backgroundColor: '#FFE0B2',
    marginBottom: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
});

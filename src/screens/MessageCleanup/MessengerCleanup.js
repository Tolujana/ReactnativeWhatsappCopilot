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
import AsyncStorage from '@react-native-async-storage/async-storage';

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

// Key for AsyncStorage
const TREE_URI_STORAGE_KEY = 'savedTreeUri';

export default function MessengerCleanup() {
  const theme = useTheme();
  const navigation = useNavigation();
  const [treeUri, setTreeUri] = useState(null);

  // Save treeUri to AsyncStorage
  const saveTreeUriToStorage = async uri => {
    try {
      await AsyncStorage.setItem(TREE_URI_STORAGE_KEY, uri);
      console.log('Tree URI saved to storage:', uri);
    } catch (error) {
      console.error('Failed to save tree URI to storage:', error);
    }
  };

  // Load treeUri from AsyncStorage
  const loadTreeUriFromStorage = async () => {
    try {
      const savedUri = await AsyncStorage.getItem(TREE_URI_STORAGE_KEY);
      if (savedUri) {
        setTreeUri(savedUri);
        console.log('Tree URI loaded from storage:', savedUri);
      }
    } catch (error) {
      console.error('Failed to load tree URI from storage:', error);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        // First try to load from AsyncStorage
        await loadTreeUriFromStorage();

        // Also check if there's a saved URI from StatusModule (for backward compatibility)
        const savedUri = await StatusModule.getSavedTreeUri();
        if (savedUri && !treeUri) {
          setTreeUri(savedUri);
          // Also save it to AsyncStorage for future use
          await saveTreeUriToStorage(savedUri);
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

      // Update state
      setTreeUri(picked);

      // Save to AsyncStorage
      await saveTreeUriToStorage(picked);

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
      navigation.navigate('MessengerMediaGrid', {app, appKey, treeUri});
    }
  };

  // Helper function to check if the treeUri is the Android/media folder
  const isAndroidMediaFolder = treeUri => {
    if (!treeUri) return false;

    const uriString = treeUri.toString().toLowerCase();

    const androidMediaPatterns = [
      '/android/media',
      '%2fandroid%2fmedia',
      'android%2fmedia',
      'content://com.android.externalstorage.documents/tree/primary%3Aandroid%2fmedia',
      'content://com.android.externalstorage.documents/tree/primary%3Aandroid/document/primary%3Aandroid%2fmedia',
    ];

    return androidMediaPatterns.some(pattern => uriString.includes(pattern));
  };

  // Optional: Function to clear the saved treeUri
  const clearSavedTreeUri = async () => {
    try {
      await AsyncStorage.removeItem(TREE_URI_STORAGE_KEY);
      setTreeUri(null);
      Alert.alert('Success', 'Saved folder has been cleared.');
    } catch (error) {
      console.error('Failed to clear tree URI:', error);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.noticeBox}>
        <Text variant="bodyMedium" style={{textAlign: 'center'}}>
          {treeUri
            ? isAndroidMediaFolder(treeUri)
              ? "You've selected the correct Android/media folder."
              : 'Selected folder is not Android/media. Please select the correct folder.'
            : 'Please select the Android/media folder to access messenger media.'}
        </Text>

        <Button mode="contained" onPress={pickFolder} style={{marginTop: 8}}>
          {treeUri ? 'Change Folder' : 'Pick Folder'}
        </Button>

        {treeUri && (
          <Button
            mode="outlined"
            onPress={clearSavedTreeUri}
            style={{marginTop: 8}}>
            Clear Saved Folder
          </Button>
        )}
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

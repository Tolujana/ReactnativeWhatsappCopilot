import React, {useEffect, useState} from 'react';
import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import {Text, Surface, useTheme, Button, Card} from 'react-native-paper';
import Icon from 'react-native-vector-icons/FontAwesome5';
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
  const styles = makeStyles(theme);

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
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card style={styles.noticeCard}>
          <Card.Content>
            <Text variant="bodyMedium" style={styles.noticeText}>
              {treeUri
                ? isAndroidMediaFolder(treeUri)
                  ? "You've selected the correct Android/media folder."
                  : 'Selected folder is not Android/media. Please select the correct folder.'
                : 'Please select the Android/media folder to access messenger media.'}
            </Text>
          </Card.Content>
          <Card.Actions style={styles.cardActions}>
            <Button
              mode="contained"
              onPress={pickFolder}
              style={styles.folderButton}>
              {treeUri ? 'Change Folder' : 'Pick Folder'}
            </Button>
            {treeUri && (
              <Button
                mode="outlined"
                onPress={clearSavedTreeUri}
                style={styles.clearButton}>
                Clear Saved Folder
              </Button>
            )}
          </Card.Actions>
        </Card>

        <View style={styles.appsContainer}>
          {MESSENGERS.map(({app, icon}) => (
            <TouchableOpacity
              key={app}
              onPress={() => handlePress(app)}
              style={styles.appTouchable}>
              <Card style={styles.appCard}>
                <Card.Content style={styles.appCardContent}>
                  <Icon name={icon} size={32} color={theme.colors.primary} />
                  <Text variant="bodyMedium" style={styles.appName}>
                    {app}
                  </Text>
                </Card.Content>
              </Card>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const makeStyles = theme =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 20,
    },
    noticeCard: {
      marginBottom: 24,
      backgroundColor: theme.colors.surfaceVariant,
    },
    noticeText: {
      textAlign: 'center',
      color: theme.colors.onSurfaceVariant,
    },
    cardActions: {
      flexDirection: 'column',
      alignItems: 'stretch',
      gap: 8,
    },
    folderButton: {
      borderRadius: 8,
    },
    clearButton: {
      borderRadius: 8,
      borderColor: theme.colors.outline,
    },
    appsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 16,
      justifyContent: 'center',
    },
    appTouchable: {
      width: '30%',
      minWidth: 100,
    },
    appCard: {
      backgroundColor: theme.colors.surface,
      elevation: 2,
    },
    appCardContent: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
    },
    appName: {
      marginTop: 8,
      textAlign: 'center',
      color: theme.colors.onSurface,
      fontWeight: '500',
    },
  });

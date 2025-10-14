// StatusSaver.js updated with FlashList
import React, {useState, useEffect, useCallback} from 'react';
import CheckBox from '@react-native-community/checkbox';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Modal,
  Dimensions,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Video from 'react-native-video';
import {NativeModules} from 'react-native';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {BannerAd, BannerAdSize} from 'react-native-google-mobile-ads';
import {FlashList} from '@shopify/flash-list'; // Add this import

const {StatusModule} = NativeModules;
const SCREEN_WIDTH = Dimensions.get('window').width;

export default function StatusSaver() {
  const navigation = useNavigation();
  const [files, setFiles] = useState([]);
  const [sources, setSources] = useState([]);
  const [current, setCurrent] = useState(null);
  const [media, setMedia] = useState([]);
  const [selected, setSelected] = useState({});
  const [previewIndex, setPreviewIndex] = useState(-1);
  const [folderPicked, setFolderPicked] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [savedTreeUri, setSavedTreeUri] = useState(null);

  // Load saved treeUri from native module
  const loadSavedTreeUri = async () => {
    try {
      console.log('🔍 Retrieving saved treeUri from native module...');
      const savedUri = await StatusModule.getSavedTreeUri();
      console.log('📁 Retrieved URL:', savedUri);

      if (savedUri) {
        setSavedTreeUri(savedUri);
        console.log('✅ Successfully loaded saved treeUri from native module');
        return savedUri;
      } else {
        console.log('❌ No saved treeUri found in native module');
        return null;
      }
    } catch (error) {
      console.error(
        '🚨 Failed to load saved treeUri from native module:',
        error,
      );
      return null;
    }
  };

  // Check if we have a saved treeUri and use it automatically
  useEffect(() => {
    const initializeWithSavedUri = async () => {
      console.log('🚀 Initializing StatusSaver component...');
      const uri = await loadSavedTreeUri();
      if (uri) {
        // We have a saved URI, try to load files using it
        try {
          console.log('🔄 Attempting to load files with saved treeUri...');
          setFolderPicked(true);
          await refreshFiles();
          console.log('✅ Successfully loaded files with saved treeUri');
        } catch (error) {
          console.error('❌ Failed to load files with saved URI:', error);
          // If it fails, show the pick folder button
        }
      } else {
        console.log('ℹ️ No saved treeUri found, user needs to pick folder');
      }
    };
    initializeWithSavedUri();
  }, []);

  const pickFolder = async () => {
    try {
      // Check if tutorial has been shown
      const hasSeenTutorial = await AsyncStorage.getItem('hasSeenTutorial');
      if (!hasSeenTutorial) {
        console.log('📚 Showing tutorial for first-time users');
        setShowTutorial(true);
        return;
      }

      console.log('📁 Opening folder picker...');
      const all = await StatusModule.openStatusFolderPicker('status');
      console.log('📄 Files returned from picker:', all?.length || 0);

      if (!all || all.length === 0) {
        console.log('❌ No files found in selected folder');
        Alert.alert(
          'No statuses found',
          'View statuses first via WhatsApp, Telegram, etc.',
        );
        return;
      }

      setFolderPicked(true);
      updateFiles(all);

      // Since openStatusFolderPicker already saves to prefs, retrieve it
      const uri = await loadSavedTreeUri();
      if (uri) {
        console.log('✅ Retrieved newly saved treeUri:', uri);
      } else {
        console.log('⚠️ Could not retrieve treeUri after picking');
      }
    } catch (e) {
      console.error('❌ Error in pickFolder:', e);
      Alert.alert('Error', e.message);
    }
  };

  const dismissTutorial = async () => {
    console.log('✅ Tutorial dismissed, proceeding with folder picker');
    await AsyncStorage.setItem('hasSeenTutorial', 'true');
    setShowTutorial(false);
    // Proceed with folder picking after tutorial
    pickFolder();
  };

  const updateFiles = all => {
    console.log('📋 Updating files list with', all.length, 'items');
    setFiles(all);
    const appsFound = [...new Set(all.map(f => f.app))];
    console.log('📱 Apps found:', appsFound);
    setSources(appsFound);
    if (appsFound.length) {
      setCurrent(prev => prev || appsFound[0]);
      console.log('🎯 Current app set to:', appsFound[0]);
    }
  };

  const refreshFiles = async () => {
    try {
      if (!folderPicked) {
        console.log('ℹ️ Refresh skipped - no folder picked yet');
        return;
      }

      console.log('🔄 Refreshing files...');
      const all = await StatusModule.refreshStatuses();
      console.log('📊 Refresh returned:', all?.length || 0, 'items');
      if (all?.length) updateFiles(all);
    } catch (e) {
      console.log('❌ Refresh failed', e.message);
    }
  };

  useEffect(() => {
    const m = files.filter(f => f.app === current);
    console.log('🎨 Rendering media for', current + ':', m.length, 'items');

    // Insert ads after every 3rd item
    const mediaWithAds = m.reduce((acc, item, index) => {
      acc.push({type: 'media', data: item});
      if ((index + 1) % 6 === 0) {
        acc.push({type: 'ad', id: `ad-${index}`});
      }
      return acc;
    }, []);

    setMedia(mediaWithAds);
    const s = Object.fromEntries(m.map(f => [f.uri, selected[f.uri] || false]));
    setSelected(s);
  }, [current, files]);

  useFocusEffect(
    useCallback(() => {
      console.log('🎯 StatusSaver screen focused, refreshing files...');
      refreshFiles();
    }, [folderPicked]),
  );

  const toggleSel = uri => {
    console.log('🔘 Toggling selection for URI:', uri);
    setSelected(prev => ({...prev, [uri]: !prev[uri]}));
  };

  const handleSave = async () => {
    const selectedItems = Object.entries(selected).filter(([, v]) => v);
    console.log('💾 Saving', selectedItems.length, 'selected items');

    if (!selectedItems.length) return;
    try {
      for (const [uri] of selectedItems) {
        await StatusModule.saveToGalleryAndGetUri(uri);
      }
      console.log('✅ Successfully saved', selectedItems.length, 'items');
      Alert.alert('Saved', `${selectedItems.length} item(s) saved to gallery.`);
    } catch (e) {
      console.error('❌ Failed to save items:', e);
      Alert.alert('Error', 'Failed to save items');
    }
  };

  const handleUseStatus = async () => {
    const chosen = Object.entries(selected).find(([, v]) => v);
    if (chosen) {
      console.log('📤 Posting to WhatsApp status:', chosen[0]);
      try {
        await StatusModule.postToWhatsappStatus(chosen[0]);
        console.log('✅ Successfully posted to WhatsApp status');
      } catch (e) {
        console.error('❌ Failed to post to WhatsApp status:', e);
        Alert.alert('Error', 'Failed to post to WhatsApp Status');
      }
    }
  };

  // Clear saved folder and force re-pick
  const clearSavedFolder = async () => {
    console.log('🗑️ Clearing saved folder...');
    try {
      await StatusModule.clearSavedTreeUri();
      console.log('✅ Saved treeUri cleared from native module');

      setSavedTreeUri(null);
      setFolderPicked(false);
      setFiles([]);
      setSources([]);
      setMedia([]);

      console.log('🔄 State reset, ready for new folder selection');
      Alert.alert(
        'Success',
        'Saved folder has been cleared. Please pick a new folder.',
      );
    } catch (error) {
      console.error('❌ Failed to clear saved folder:', error);
    }
  };

  const renderPreview = () => {
    if (previewIndex < 0) return null;
    const f = media[previewIndex]?.data;
    if (!f) return null;

    console.log('👀 Opening preview for:', f.name);
    return (
      <Modal visible transparent style={{flex: 1}}>
        <View style={styles.preview}>
          {/\.(mp4)$/i.test(f.name) ? (
            <Video
              source={{uri: f.uri}}
              style={{width: '100%', height: '80%'}}
              controls
            />
          ) : (
            <Image
              source={{uri: f.uri}}
              style={{width: '100%', height: '80%'}}
            />
          )}
          <Text style={{color: '#fff'}}>{f.name}</Text>
          <View style={styles.previewNav}>
            <TouchableOpacity
              onPress={() => setPreviewIndex(i => Math.max(i - 1, 0))}>
              <Text style={styles.navText}>◀️ Prev</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() =>
                setPreviewIndex(i => Math.min(i + 1, media.length - 1))
              }>
              <Text style={styles.navText}>Next ▶️</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => setPreviewIndex(-1)}>
            <Text style={{color: '#fff'}}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  };

  const renderItem = ({item, index}) => {
    if (item.type === 'ad') {
      console.log('📢 Rendering ad at position', index);
      return (
        <View style={styles.adContainer}>
          <BannerAd
            unitId="ca-app-pub-3940256099942544/6300978111"
            size={BannerAdSize.BANNER}
            requestOptions={{requestNonPersonalizedAdsOnly: true}}
          />
        </View>
      );
    }

    const {data} = item;
    return (
      <TouchableOpacity
        onLongPress={() => toggleSel(data.uri)}
        onPress={() => setPreviewIndex(index)}>
        <View style={styles.imageWrapper}>
          <Image source={{uri: data.uri}} style={styles.image} />
          <View style={styles.checkboxContainer}>
            <CheckBox
              value={!!selected[data.uri]}
              onValueChange={() => toggleSel(data.uri)}
              tintColors={{true: '#1976d2', false: '#fff'}}
            />
          </View>
          {/\.(mp4)$/i.test(data.name) && (
            <Text style={styles.playIcon}>▶️</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Status Saver</Text>

      <View style={styles.headerActions}>
        <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
          <Text style={{color: '#1976d2'}}>⚙️ Settings</Text>
        </TouchableOpacity>

        {savedTreeUri && (
          <TouchableOpacity onPress={clearSavedFolder}>
            <Text style={{color: '#ff4444', marginLeft: 16}}>
              🔄 Change Folder
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {!folderPicked && files.length === 0 && (
        <TouchableOpacity style={styles.btn} onPress={pickFolder}>
          <Text style={{color: '#fff'}}>
            {savedTreeUri ? 'Use Saved Folder' : 'Pick Android/media Folder'}
          </Text>
        </TouchableOpacity>
      )}

      {savedTreeUri && !folderPicked && (
        <Text style={styles.savedFolderInfo}>
          📁 Using previously selected folder
        </Text>
      )}

      {!!sources.length && (
        <View style={styles.tabs}>
          {sources.map(s => {
            const count = files.filter(f => f.app === s).length;
            return (
              <TouchableOpacity
                key={s}
                onPress={() => setCurrent(s)}
                style={[styles.tab, current === s && styles.activeTab]}>
                <Text style={{color: current === s ? '#fff' : '#000'}}>
                  {s} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {media.length ? (
        <FlashList
          data={media}
          renderItem={renderItem}
          keyExtractor={(item, index) =>
            item.type === 'media' ? item.data.uri : item.id
          }
          estimatedItemSize={110}
          numColumns={3}
          contentContainerStyle={[styles.gallery, {justifyContent: 'center'}]}
          initialNumToRender={20}
          maxToRenderPerBatch={10}
          windowSize={5}
          viewabilityConfig={{itemVisiblePercentThreshold: 50}}
          extraData={selected}
        />
      ) : folderPicked ? (
        <Text style={styles.empty}>No media found for {current}</Text>
      ) : null}

      {Object.values(selected).some(v => v) && (
        <View style={styles.actions}>
          <TouchableOpacity onPress={handleSave}>
            <Text>✅ Save</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleUseStatus}>
            <Text>📥 Use as Status</Text>
          </TouchableOpacity>
        </View>
      )}

      {renderPreview()}

      <Modal
        visible={showTutorial}
        transparent
        animationType="slide"
        onRequestClose={dismissTutorial}>
        <View style={styles.tutorialOverlay}>
          <ScrollView style={styles.tutorialContent}>
            <Text style={styles.tutorialTitle}>
              How to Select the Android/media Folder
            </Text>
            <Text style={styles.tutorialText}>
              Welcome to Status Saver! Follow these steps to select the
              Android/media folder and view statuses from apps like WhatsApp or
              Telegram:
            </Text>
            <Text style={styles.tutorialStep}>
              1. <Text style={styles.bold}>Grant Permissions</Text>: When
              prompted, allow storage access. On Android 11+, you may need to
              enable "All files access" in Settings > Privacy > Special app
              access.
            </Text>
            <Text style={styles.tutorialStep}>
              2. <Text style={styles.bold}>Select Folder</Text>: Tap "Pick
              Android/media Folder" to open the folder picker. Navigate to
              Internal Storage > Android > media. Choose the folder for your app
              (e.g., com.whatsapp for WhatsApp statuses).
            </Text>
            <Text style={styles.tutorialStep}>
              3. <Text style={styles.bold}>View Statuses First</Text>: Ensure
              you've viewed statuses in the source app (e.g., WhatsApp's Status
              tab). Unviewed statuses may not appear.
            </Text>
            <Text style={styles.tutorialStep}>
              4. <Text style={styles.bold}>Confirm Selection</Text>: Select the
              folder and tap "OK" or "Select." The app will list available
              statuses.
            </Text>
            <Text style={styles.tutorialStep}>
              5. <Text style={styles.bold}>Troubleshooting</Text>: If no
              statuses appear, check permissions in Settings > Apps > Status
              Saver > Permissions. Ensure the folder (e.g.,
              /Android/media/com.whatsapp/WhatsApp/Media/.Statuses) has media
              files.
            </Text>
            <Text style={styles.tutorialNote}>
              Note: Your folder selection will be saved for future use. You can
              change it anytime.
            </Text>
            <TouchableOpacity
              style={styles.tutorialButton}
              onPress={dismissTutorial}>
              <Text style={styles.tutorialButtonText}>Got it</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, padding: 20, backgroundColor: '#fff'},
  title: {fontSize: 24, textAlign: 'center', marginBottom: 10},
  headerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 10,
  },
  btn: {
    backgroundColor: '#1976d2',
    padding: 12,
    alignItems: 'center',
    marginVertical: 10,
    borderRadius: 6,
  },
  savedFolderInfo: {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 10,
  },
  tabs: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 10,
    flexWrap: 'wrap',
  },
  tab: {padding: 10, backgroundColor: '#eee', margin: 4, borderRadius: 20},
  activeTab: {backgroundColor: '#1976d2'},
  gallery: {
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageWrapper: {
    margin: 4,
    width: 110,
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {width: 100, height: 100, borderRadius: 6},
  playIcon: {
    position: 'absolute',
    top: 4,
    left: 4,
    fontSize: 20,
    color: '#fff',
  },
  checkboxContainer: {
    position: 'absolute',
    top: 5,
    right: 5,
    zIndex: 2,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#000',
  },
  empty: {textAlign: 'center', marginTop: 20, color: '#888'},
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 10,
    borderTopWidth: 1,
  },
  preview: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {position: 'absolute', top: 40, right: 20},
  previewNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '80%',
    marginVertical: 10,
  },
  navText: {
    color: '#fff',
    fontSize: 18,
  },
  adContainer: {
    alignItems: 'center',
    marginVertical: 10,
    width: SCREEN_WIDTH,
  },
  tutorialOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  tutorialContent: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    maxHeight: '80%',
    width: '90%',
  },
  tutorialTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  tutorialText: {
    fontSize: 16,
    marginBottom: 10,
  },
  tutorialStep: {
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20,
  },
  bold: {
    fontWeight: 'bold',
  },
  tutorialNote: {
    fontSize: 14,
    color: '#888',
    marginTop: 10,
    marginBottom: 20,
  },
  tutorialButton: {
    backgroundColor: '#1976d2',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  tutorialButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

import React, {useState, useEffect, useCallback} from 'react';
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
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Video from 'react-native-video';
import {NativeModules} from 'react-native';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {BannerAd, BannerAdSize} from 'react-native-google-mobile-ads';
import {FlashList} from '@shopify/flash-list';
import {Snackbar, Button, Checkbox} from 'react-native-paper';

const {StatusModule} = NativeModules;
const screenWidth = Dimensions.get('window').width;
const itemSize = Math.floor((screenWidth - 20) / 3);

export default function StatusSaver() {
  const navigation = useNavigation();
  const [files, setFiles] = useState([]);
  const [sources, setSources] = useState([]);
  const [current, setCurrent] = useState(null);
  const [media, setMedia] = useState([]);
  const [displayData, setDisplayData] = useState([]);
  const [selectedItems, setSelectedItems] = useState({});
  const [previewIndex, setPreviewIndex] = useState(-1);
  const [folderPicked, setFolderPicked] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [savedTreeUri, setSavedTreeUri] = useState(null);
  const [snackbarMsg, setSnackbarMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Load saved treeUri from native module
  const loadSavedTreeUri = async () => {
    try {
      console.log('🔍 Retrieving saved treeUri from native module...');
      const savedUri = await StatusModule.getSavedTreeUri();
      console.log('📁 Retrieved URL:', savedUri);
      return savedUri || null;
    } catch (error) {
      console.error('🚨 Failed to load saved treeUri:', error);
      return null;
    }
  };

  // Load folderPicked state from AsyncStorage
  const loadFolderPicked = async () => {
    try {
      const value = await AsyncStorage.getItem('folderPicked');
      console.log('📂 Retrieved folderPicked:', value);
      return value === 'true';
    } catch (error) {
      console.error('🚨 Failed to load folderPicked:', error);
      return false;
    }
  };

  // Save folderPicked state to AsyncStorage
  const saveFolderPicked = async value => {
    try {
      await AsyncStorage.setItem('folderPicked', value.toString());
      console.log('✅ Saved folderPicked state:', value);
    } catch (error) {
      console.error('🚨 Failed to save folderPicked:', error);
    }
  };

  // Load current app from AsyncStorage
  const loadCurrentApp = async () => {
    try {
      const value = await AsyncStorage.getItem('currentApp');
      console.log('📱 Retrieved current app:', value);
      return value || null;
    } catch (error) {
      console.error('🚨 Failed to load current app:', error);
      return null;
    }
  };

  // Save current app to AsyncStorage
  const saveCurrentApp = async value => {
    try {
      await AsyncStorage.setItem('currentApp', value);
      console.log('✅ Saved current app:', value);
    } catch (error) {
      console.error('🚨 Failed to save current app:', error);
    }
  };

  // Validate treeUri with retry mechanism
  const validateTreeUri = async (uri, retries = 2) => {
    if (!uri) return false;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(
          `🔎 Validating treeUri (attempt ${attempt}/${retries}):`,
          uri,
        );
        const isAccessible = await StatusModule.checkUriPermission(uri);
        if (!isAccessible) {
          console.log('❌ TreeUri permission revoked or invalid');
          if (attempt < retries) {
            console.log('⏳ Retrying in 500ms...');
            await new Promise(resolve => setTimeout(resolve, 500));
            continue;
          }
          return false;
        }
        const files = await StatusModule.refreshStatuses();
        console.log('📊 Validation returned:', files?.length || 0, 'items');
        return files && files.length >= 0;
      } catch (error) {
        console.error(
          `❌ TreeUri validation failed (attempt ${attempt}):`,
          error,
        );
        if (attempt < retries) {
          console.log('⏳ Retrying in 500ms...');
          await new Promise(resolve => setTimeout(resolve, 500));
          continue;
        }
        return false;
      }
    }
    return false;
  };

  // Initialize component
  useEffect(() => {
    const initialize = async () => {
      setIsLoading(true);
      console.log('🚀 Initializing StatusSaver...');
      const uri = await loadSavedTreeUri();
      const picked = await loadFolderPicked();
      const savedCurrentApp = await loadCurrentApp();

      if (uri && picked) {
        const isValid = await validateTreeUri(uri);
        if (isValid) {
          setSavedTreeUri(uri);
          setFolderPicked(true);
          await refreshFiles(uri);
          if (savedCurrentApp) {
            setCurrent(savedCurrentApp);
          }
          console.log('✅ Initialized with valid saved treeUri');
        } else {
          console.log(
            '❌ Saved treeUri invalid after retries, prompting reselect',
          );
          setFolderPicked(false);
          setSavedTreeUri(null);
          await saveFolderPicked(false);
          Alert.alert(
            'Folder Access Lost',
            'The previously selected folder is no longer accessible. Please select it again.',
            [{text: 'OK', onPress: pickFolder}],
          );
        }
      } else {
        console.log('ℹ️ No valid saved treeUri or folderPicked');
        setFolderPicked(false);
        setSavedTreeUri(null);
        await saveFolderPicked(false);
      }
      setIsLoading(false);
    };
    initialize();
  }, []);

  const pickFolder = async () => {
    try {
      const hasSeenTutorial = await AsyncStorage.getItem('hasSeenTutorial');
      if (!hasSeenTutorial) {
        console.log('📚 Showing tutorial');
        setShowTutorial(true);
        return;
      }

      setIsLoading(true);
      console.log('📁 Opening folder picker...');
      const all = await StatusModule.openStatusFolderPicker('status');
      console.log('📄 Files returned:', all?.length || 0);

      if (!all || all.length === 0) {
        console.log('❌ No files found in selected folder');
        Alert.alert(
          'No statuses found',
          'View statuses first via WhatsApp, Telegram, etc.',
        );
        setIsLoading(false);
        return;
      }

      setFolderPicked(true);
      await saveFolderPicked(true);
      updateFiles(all);

      const uri = await loadSavedTreeUri();
      if (uri) {
        setSavedTreeUri(uri);
        await StatusModule.setSavedTreeUri(uri); // Re-persist URI to ensure permission
        console.log('✅ Retrieved and re-persisted treeUri:', uri);
      } else {
        console.log('⚠️ Could not retrieve treeUri after picking');
      }
    } catch (e) {
      console.error('❌ Error in pickFolder:', e);
      Alert.alert('Error', e.message);
    }
    setIsLoading(false);
  };

  const dismissTutorial = async () => {
    console.log('✅ Tutorial dismissed');
    await AsyncStorage.setItem('hasSeenTutorial', 'true');
    setShowTutorial(false);
    pickFolder();
  };

  const updateFiles = all => {
    console.log('📋 Updating files:', all.length, 'items');
    setFiles(all);
    const appsFound = [...new Set(all.map(f => f.app))];
    console.log('📱 Apps found:', appsFound);
    setSources(appsFound);
    if (appsFound.length && !current) {
      setCurrent(appsFound[0]);
      saveCurrentApp(appsFound[0]);
      console.log('🎯 Current app:', appsFound[0]);
    }
  };

  const refreshFiles = async uri => {
    console.log('🔄 Refreshing files with URI:', uri);
    try {
      const all = await StatusModule.refreshStatuses();
      console.log('📊 Refresh returned:', all?.length || 0, 'items');
      updateFiles(all);
      return true;
    } catch (e) {
      console.error('❌ Refresh failed:', e.message);
      return false;
    }
  };

  useEffect(() => {
    const m = files.filter(f => f.app === current);
    console.log(
      '🎨 Rendering media for',
      current ? current : 'null',
      ':',
      m.length,
      'items',
    );
    setMedia(m);

    // Build displayData with rows and ads
    const displayDataTemp = [];
    let tempRow = [];
    let adCounter = 0;
    m.forEach((data, flatIndex) => {
      tempRow.push({data, flatIndex});
      if (tempRow.length === 3 || flatIndex === m.length - 1) {
        displayDataTemp.push({type: 'row', items: tempRow});
        tempRow = [];
      }
      if ((flatIndex + 1) % 6 === 0 && flatIndex < m.length - 1) {
        displayDataTemp.push({type: 'ad', id: `ad-${adCounter++}`});
      }
    });
    setDisplayData(displayDataTemp);

    const s = Object.fromEntries(
      m.map(f => [f.uri, selectedItems[f.uri] || false]),
    );
    setSelectedItems(s);
  }, [current, files]);

  useFocusEffect(
    useCallback(() => {
      const refreshOnFocus = async () => {
        const picked = await loadFolderPicked();
        const uri = await loadSavedTreeUri();
        const savedCurrentApp = await loadCurrentApp();
        if (picked && uri) {
          setIsLoading(true);
          const isValid = await validateTreeUri(uri);
          if (isValid) {
            setFolderPicked(true);
            setSavedTreeUri(uri);
            if (savedCurrentApp) {
              setCurrent(savedCurrentApp);
            }
            await refreshFiles(uri);
            console.log('✅ Refreshed files on focus');
          } else {
            console.log('❌ URI invalid on focus, prompting reselect');
            setFolderPicked(false);
            setSavedTreeUri(null);
            await saveFolderPicked(false);
            Alert.alert(
              'Folder Access Lost',
              'The previously selected folder is no longer accessible. Please select it again.',
              [{text: 'OK', onPress: pickFolder}],
            );
          }
          setIsLoading(false);
        } else {
          console.log('ℹ️ No folder picked or URI on focus');
          setFolderPicked(false);
          setSavedTreeUri(null);
          await saveFolderPicked(false);
        }
      };
      refreshOnFocus();
    }, []),
  );

  const toggleSelect = uri => {
    setSelectedItems(prev => ({...prev, [uri]: !prev[uri]}));
  };

  const handleSelectionSave = async () => {
    const uris = Object.keys(selectedItems).filter(uri => selectedItems[uri]);
    if (!uris.length) return;
    try {
      let savedCount = 0;
      for (const uri of uris) {
        await StatusModule.saveToGalleryAndGetUri(uri);
        savedCount++;
      }
      setSnackbarMsg(`${savedCount} items saved to gallery`);
    } catch (e) {
      console.error('Save error:', e);
      setSnackbarMsg('Failed to save some items');
    }
    setSelectedItems({});
  };

  const handleSelectionDelete = () => {
    const uris = Object.keys(selectedItems).filter(uri => selectedItems[uri]);
    if (!uris.length) return;
    Alert.alert(
      'Delete Selected',
      `Delete ${uris.length} selected item(s)?`,
      [
        {text: 'Cancel'},
        {
          text: 'Delete',
          onPress: () => {
            StatusModule.deleteMediaBatch(uris);
            const updated = files.filter(f => !uris.includes(f.uri));
            setFiles(updated);
            setSelectedItems({});
            setSnackbarMsg(`${uris.length} items deleted`);
          },
        },
      ],
      {cancelable: true},
    );
  };

  const handleSelectionShareAsStatus = async () => {
    const uris = Object.keys(selectedItems).filter(uri => selectedItems[uri]);
    if (!uris.length) return;
    try {
      let sharedCount = 0;
      for (const uri of uris) {
        await StatusModule.postToWhatsappStatus(uri);
        sharedCount++;
      }
      setSnackbarMsg(`${sharedCount} items shared as status`);
    } catch (e) {
      console.error('Share as status error:', e);
      setSnackbarMsg('Failed to share some items as status');
    }
    setSelectedItems({});
  };

  const clearSelection = () => {
    setSelectedItems({});
  };

  const isAnySelected = Object.values(selectedItems).some(Boolean);

  const renderPreview = () => {
    if (previewIndex < 0) return null;
    const f = media[previewIndex];
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

  const renderItem = ({item}) => {
    if (item.type === 'ad') {
      console.log('📢 Rendering ad');
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

    // Render row
    return (
      <View style={styles.row}>
        {item.items.map((sub, subIndex) => {
          const {data, flatIndex} = sub;
          const selected = selectedItems[data.uri];
          return (
            <TouchableOpacity
              key={subIndex}
              onPress={() => {
                if (isAnySelected) {
                  toggleSelect(data.uri);
                } else {
                  setPreviewIndex(flatIndex);
                }
              }}
              onLongPress={() => toggleSelect(data.uri)}
              style={styles.itemContainer}
              activeOpacity={0.8}>
              <View
                style={[styles.mediaContainer, {opacity: selected ? 0.5 : 1}]}>
                {/\.(mp4)$/i.test(data.name) ? (
                  <Video
                    source={{uri: data.uri}}
                    paused
                    style={styles.image}
                    resizeMode="cover"
                  />
                ) : (
                  <Image
                    source={{uri: data.uri, cache: 'force-cache'}}
                    style={styles.image}
                  />
                )}
              </View>
              {selected && (
                <Checkbox
                  status="checked"
                  onPress={() => toggleSelect(data.uri)}
                  style={styles.checkbox}
                />
              )}
              {/\.(mp4)$/i.test(data.name) && (
                <Text style={styles.playIcon}>▶️</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  // Clear saved folder and force re-pick
  const clearSavedFolder = async () => {
    console.log('🗑️ Clearing saved folder...');
    try {
      await StatusModule.clearSavedTreeUri();
      await AsyncStorage.removeItem('folderPicked');
      await AsyncStorage.removeItem('currentApp');
      console.log('✅ Cleared treeUri, folderPicked, and currentApp');

      setSavedTreeUri(null);
      setFolderPicked(false);
      setFiles([]);
      setSources([]);
      setMedia([]);
      setDisplayData([]);
      setCurrent(null);

      console.log('🔄 State reset');
      Alert.alert(
        'Success',
        'Saved folder has been cleared. Please pick a new folder.',
      );
    } catch (error) {
      console.error('❌ Failed to clear saved folder:', error);
      Alert.alert('Error', 'Failed to clear saved folder.');
    }
  };

  return (
    <View style={styles.container}>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976d2" />
        </View>
      ) : (
        <>
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
              <Text style={styles.btnText}>Pick Android/media Folder</Text>
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
                    onPress={() => {
                      setCurrent(s);
                      saveCurrentApp(s);
                    }}
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
              data={displayData}
              renderItem={renderItem}
              keyExtractor={(item, index) =>
                item.type === 'ad' ? item.id : `row-${index}`
              }
              estimatedItemSize={itemSize}
              numColumns={1}
              contentContainerStyle={styles.gallery}
              initialNumToRender={20}
              maxToRenderPerBatch={10}
              windowSize={5}
              viewabilityConfig={{itemVisiblePercentThreshold: 50}}
              extraData={selectedItems}
            />
          ) : folderPicked ? (
            <Text style={styles.empty}>
              No media found for {current || 'selected app'}
            </Text>
          ) : null}

          {/* Selection Bar */}
          {Object.values(selectedItems).some(Boolean) && (
            <View style={styles.selectionBar}>
              <Text style={styles.selectionText}>
                {Object.values(selectedItems).filter(Boolean).length} selected
              </Text>
              <Button
                onPress={handleSelectionSave}
                mode="contained"
                color="green">
                Save
              </Button>
              <Button
                onPress={handleSelectionShareAsStatus}
                mode="contained"
                color="blue">
                Share as Status
              </Button>
              <Button
                onPress={handleSelectionDelete}
                mode="contained"
                color="red">
                Delete
              </Button>
              <Button onPress={clearSelection} mode="text" color="white">
                Clear
              </Button>
            </View>
          )}
        </>
      )}

      {renderPreview()}

      {/* Snackbar */}
      <Snackbar
        visible={!!snackbarMsg}
        onDismiss={() => setSnackbarMsg('')}
        duration={3000}>
        {snackbarMsg}
      </Snackbar>

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
              change it anytime via Settings or by clearing the folder.
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
  container: {flex: 1, backgroundColor: '#fff'},
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 8,
  },
  btn: {
    backgroundColor: '#1976d2',
    padding: 12,
    alignItems: 'center',
    marginVertical: 10,
    borderRadius: 6,
    marginHorizontal: 16,
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
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
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  itemContainer: {
    width: itemSize,
    height: itemSize,
    margin: 2,
    borderRadius: 10,
    backgroundColor: '#eee',
    position: 'relative',
    overflow: 'visible',
  },
  mediaContainer: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  playIcon: {
    position: 'absolute',
    top: 4,
    left: 4,
    fontSize: 20,
    color: '#fff',
    zIndex: 1,
  },
  checkbox: {
    position: 'absolute',
    top: 4,
    left: 4,
    zIndex: 2,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 10,
  },
  empty: {textAlign: 'center', marginTop: 20, color: '#888'},
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
    width: '100%',
  },
  selectionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#222',
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectionText: {
    color: 'white',
    fontSize: 15,
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

import React, {useState, useEffect, useCallback} from 'react';
import CheckBox from '@react-native-community/checkbox';
import {
  View,
  Text,
  FlatList,
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

  const pickFolder = async () => {
    try {
      // Check if tutorial has been shown
      const hasSeenTutorial = await AsyncStorage.getItem('hasSeenTutorial');
      if (!hasSeenTutorial) {
        setShowTutorial(true);
        return;
      }
      const all = await StatusModule.openStatusFolderPicker('status');
      if (!all || all.length === 0) {
        Alert.alert(
          'No statuses found',
          'View statuses first via WhatsApp, Telegram, etc.',
        );
        return;
      }
      setFolderPicked(true);
      updateFiles(all);
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  const dismissTutorial = async () => {
    await AsyncStorage.setItem('hasSeenTutorial', 'true');
    setShowTutorial(false);
    // Proceed with folder picking after tutorial
    pickFolder();
  };

  const updateFiles = all => {
    setFiles(all);
    const appsFound = [...new Set(all.map(f => f.app))];
    setSources(appsFound);
    if (appsFound.length) {
      setCurrent(prev => prev || appsFound[0]);
    }
  };

  const refreshFiles = async () => {
    try {
      if (!folderPicked) return;
      const all = await StatusModule.refreshStatuses?.();
      if (all?.length) updateFiles(all);
    } catch (e) {
      console.log('Refresh failed', e.message);
    }
  };

  useEffect(() => {
    const m = files.filter(f => f.app === current);
    // Insert ads after every 3rd item
    const mediaWithAds = m.reduce((acc, item, index) => {
      acc.push({type: 'media', data: item});
      if ((index + 1) % 3 === 0) {
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
      refreshFiles();
    }, [folderPicked]),
  );

  const toggleSel = uri => {
    setSelected(prev => ({...prev, [uri]: !prev[uri]}));
  };

  const handleSave = async () => {
    const selectedItems = Object.entries(selected).filter(([, v]) => v);
    if (!selectedItems.length) return;
    try {
      for (const [uri] of selectedItems) {
        await StatusModule.saveToGalleryAndGetUri(uri);
      }
      Alert.alert('Saved', `${selectedItems.length} item(s) saved to gallery.`);
    } catch (e) {
      Alert.alert('Error', 'Failed to save items');
    }
  };

  useEffect(() => {
    const restorePrevious = async () => {
      try {
        const restored = await StatusModule.refreshStatuses();
        if (restored?.length) {
          setFolderPicked(true);
          updateFiles(restored);
        }
      } catch (e) {
        console.log('No previous folder', e.message);
      }
    };
    restorePrevious();
  }, []);

  const handleUseStatus = async () => {
    const chosen = Object.entries(selected).find(([, v]) => v);
    if (chosen) {
      try {
        await StatusModule.postToWhatsappStatus(chosen[0]);
      } catch (e) {
        Alert.alert('Error', 'Failed to post to WhatsApp Status');
      }
    }
  };

  const renderPreview = () => {
    if (previewIndex < 0) return null;
    const f = media[previewIndex]?.data;
    if (!f) return null;
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
      <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
        <Text style={{color: '#1976d2', textAlign: 'right'}}>⚙️ Settings</Text>
      </TouchableOpacity>
      {!folderPicked && files.length === 0 && (
        <TouchableOpacity style={styles.btn} onPress={pickFolder}>
          <Text style={{color: '#fff'}}>Pick Android/media Folder</Text>
        </TouchableOpacity>
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
        <FlatList
          data={media}
          renderItem={renderItem}
          keyExtractor={(item, index) =>
            item.type === 'media' ? item.data.uri : item.id
          }
          numColumns={3}
          contentContainerStyle={[styles.gallery, {justifyContent: 'center'}]}
        />
      ) : folderPicked ? (
        <Text style={styles.empty}>No media found for {current}</Text>
      ) : null}
      {Object.values(selected).some(v => v) && (
        <View style={styles.actions}>
          <TouchableOpacity onPress={handleSave}>
            <Text>✅ save</Text>
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
              Note: You can refresh statuses via the Settings screen (⚙️) or by
              revisiting this screen.
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
  title: {fontSize: 24, textAlign: 'center'},
  btn: {
    backgroundColor: '#1976d2',
    padding: 12,
    alignItems: 'center',
    marginVertical: 10,
    borderRadius: 6,
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

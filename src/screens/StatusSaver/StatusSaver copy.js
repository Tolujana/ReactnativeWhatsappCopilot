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
  PanResponder,
} from 'react-native';
import Share from 'react-native-share';
import Video from 'react-native-video';
import {NativeModules} from 'react-native';
import {useFocusEffect, useNavigation} from '@react-navigation/native';

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

  const pickFolder = async () => {
    try {
      const all = await StatusModule.openStatusFolderPicker();
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
    setMedia(m);
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

  const handleSave = () => {
    const selectedItems = Object.entries(selected).filter(([, v]) => v);
    Alert.alert('Save', `Saving ${selectedItems.length} item(s)...`);
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
  const getGalleryUris = async uris => {
    const results = [];
    for (let uri of uris) {
      const res = await StatusModule.saveToGalleryAndGetUri(uri); // returns { uri, mime }
      results.push(res);
    }
    return results;
  };

  const shareMedia = async () => {
    const uris = Object.entries(selected)
      .filter(([, v]) => v)
      .map(([u]) => u);
    if (!uris.length) return;

    try {
      const results = await getGalleryUris(uris);
      const urls = results.map(r => r.uri);
      const mimeType = results[0]?.mime || '*/*';

      await Share.open({
        urls,
        type: mimeType,
        failOnCancel: false,
      });
    } catch (e) {
      console.log('Gallery share error:', e);
      Alert.alert('Error', 'Failed to share');
    }
  };

  const shareMedia1 = async () => {
    const uris = Object.entries(selected)
      .filter(([, v]) => v)
      .map(([u]) => u);
    if (!uris.length) return;

    try {
      const results = [];
      for (let uri of uris) {
        const cached = await StatusModule.copyFileToCache(uri); // now returns { uri, mime }
        results.push(cached);
      }

      const urls = results.map(r => r.uri);
      const mimeType = results[0]?.mime || '*/*';

      await Share.open({
        urls,
        type: mimeType,
        failOnCancel: false,
      });
    } catch (e) {
      console.log('Share error:', e);
      Alert.alert('Error', 'Share failed');
    }
  };

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

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 20,
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dx > 50) {
        setPreviewIndex(i => Math.max(i - 1, 0));
      } else if (gesture.dx < -50) {
        setPreviewIndex(i => Math.min(i + 1, media.length - 1));
      }
    },
  });

  const renderPreview = () => {
    if (previewIndex < 0) return null;
    const f = media[previewIndex];
    return (
      <Modal visible transparent style={{flex: 1}}>
        <View style={styles.preview} {...panResponder.panHandlers}>
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

  const renderItem = ({item, index}) => (
    <TouchableOpacity
      onLongPress={() => toggleSel(item.uri)}
      onPress={() => setPreviewIndex(index)}>
      <View style={styles.imageWrapper}>
        <Image source={{uri: item.uri}} style={styles.image} />
        <View style={styles.checkboxContainer}>
          <CheckBox
            value={!!selected[item.uri]}
            onValueChange={() => toggleSel(item.uri)}
            tintColors={{true: '#1976d2', false: '#fff'}}
          />
        </View>
        {/\.(mp4)$/i.test(item.name) && <Text style={styles.playIcon}>▶️</Text>}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Status Saver</Text>
      <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
        <Text style={{color: '#1976d2', textAlign: 'right'}}>⚙️ Settings</Text>
      </TouchableOpacity>
      {folderPicked === false && files.length === 0 && (
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
          keyExtractor={i => i.uri}
          numColumns={3}
          contentContainerStyle={[styles.gallery, {justifyContent: 'center'}]}
        />
      ) : folderPicked ? (
        <Text style={styles.empty}>No media found for {current}</Text>
      ) : null}
      {Object.values(selected).some(v => v) && (
        <View style={styles.actions}>
          <TouchableOpacity onPress={handleSave}>
            <Text>💾 Save</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={shareMedia}>
            <Text>📤 Share</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleUseStatus}>
            <Text>📥 Use as Status</Text>
          </TouchableOpacity>
        </View>
      )}
      {renderPreview()}
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
});

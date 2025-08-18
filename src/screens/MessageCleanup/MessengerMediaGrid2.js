import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  SectionList,
  Image,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Pressable,
  Dimensions,
  Alert,
  DeviceEventEmitter,
} from 'react-native';
import {Button, Checkbox, Snackbar, IconButton} from 'react-native-paper';
import {useFocusEffect} from '@react-navigation/native';
import {NativeModules} from 'react-native';
import Video from 'react-native-video';

const {StatusModule} = NativeModules;
const screenWidth = Dimensions.get('window').width;
const itemSize = screenWidth / 3 - 12;

const sizeBucket = size => {
  if (size < 10 * 1024 * 1024) return '<10MB';
  if (size < 50 * 1024 * 1024) return '10–50MB';
  if (size < 100 * 1024 * 1024) return '50–100MB';
  return '100MB+';
};

const formatDate = ts => {
  const d = new Date(ts);
  return d.toLocaleString('default', {month: 'long', year: 'numeric'});
};

const MessengerMediaGrid = ({route}) => {
  const {appKey: selectedMessenger, treeUri: folderUri} = route.params;
  const [mediaInfo, setMediaInfo] = useState({count: 0, totalSizeMb: 0});
  const [mediaFiles, setMediaFiles] = useState([]);
  const [grouped, setGrouped] = useState([]);
  const [selectedItems, setSelectedItems] = useState({});
  const [previewIndex, setPreviewIndex] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sortBySize, setSortBySize] = useState(false);
  const [groupBy, setGroupBy] = useState('none'); // none | date | size
  const [snackbarMsg, setSnackbarMsg] = useState('');
  const [folderStack, setFolderStack] = useState([]);
  const [currentFolderPath, setCurrentFolderPath] = useState(null);

  useFocusEffect(
    useCallback(() => {
      resetAndLoad(folderUri);
    }, [folderUri, selectedMessenger, sortBySize, groupBy]),
  );

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(
      'FolderSizeUpdate',
      ({uri, size}) => {
        setMediaFiles(prev =>
          prev.map(item => (item.uri === uri ? {...item, size} : item)),
        );
      },
    );
    return () => sub.remove();
  }, []);

  const resetAndLoad = async (path = null) => {
    setLoading(true);
    setCurrentFolderPath(path || folderUri);
    setSelectedItems({});
    try {
      const response = await StatusModule.getFolderAndMediaList(
        selectedMessenger,
        path || folderUri,
      );
      const items = response.items || [];
      const totalSize = response.totalSize || 0;
      setMediaInfo({
        count: items.length,
        totalSizeMb: totalSize / 1024 / 1024,
      });

      const sortedItems = [...items].sort((a, b) =>
        sortBySize ? b.size - a.size : b.timestamp - a.timestamp,
      );

      setMediaFiles(sortedItems);
      setGrouped(groupMedia(sortedItems));
    } catch (e) {
      console.error('Failed to load:', e);
    } finally {
      setLoading(false);
    }
  };

  const groupMedia = items => {
    if (groupBy === 'none') return [{title: '', data: items}];

    const groups = {};
    items.forEach(item => {
      const key =
        groupBy === 'date'
          ? formatDate(item.timestamp || 0)
          : sizeBucket(item.size || 0);
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });

    return Object.keys(groups)
      .sort()
      .map(title => ({title, data: groups[title]}));
  };

  const toggleSelect = uri => {
    setSelectedItems(prev => ({
      ...prev,
      [uri]: !prev[uri],
    }));
  };

  const isImage = fileName => /\.(jpe?g|png|webp)$/i.test(fileName || '');
  const isVideo = fileName => /\.(mp4|3gp|mkv|avi|mov)$/i.test(fileName || '');
  const isAudio = fileName =>
    /\.(mp3|wav|m4a|aac|opus|ogg)$/i.test(fileName || '');
  const isDoc = fileName =>
    /\.(pdf|docx?|xlsx?|pptx?|txt)$/i.test(fileName || '');

  const renderIcon = item => {
    if (item.isDirectory) return '📁';
    if (isImage(item.name)) return null;
    if (isVideo(item.name)) return '🎥';
    if (isAudio(item.name)) return '🎵';
    if (isDoc(item.name)) return '📄';
    return '📦';
  };

  const renderItem = ({item, index}) => {
    const selected = selectedItems[item.uri];
    const icon = renderIcon(item);
    return (
      <TouchableOpacity
        onPress={() => {
          if (item.isDirectory) {
            setFolderStack(prev => [...prev, currentFolderPath]);
            resetAndLoad(item.path);
          } else {
            setPreviewIndex(index);
          }
        }}
        onLongPress={() => toggleSelect(item.uri)}
        style={styles.itemContainer}>
        {isImage(item.name) ? (
          <Image source={{uri: item.uri}} style={styles.image} />
        ) : (
          <View style={styles.videoBox}>
            <Text style={styles.videoText}>{icon}</Text>
          </View>
        )}

        {item.size >= 0 && (
          <Text style={styles.percentText}>
            {(item.size / (1024 * 1024)).toFixed(1)} MB
          </Text>
        )}

        <Checkbox
          status={selected ? 'checked' : 'unchecked'}
          onPress={() => toggleSelect(item.uri)}
          style={styles.checkbox}
        />
      </TouchableOpacity>
    );
  };

  const deleteSelected = async () => {
    const selectedUris = Object.keys(selectedItems).filter(
      uri => selectedItems[uri],
    );
    if (selectedUris.length === 0) return;
    Alert.alert('Delete', `Delete ${selectedUris.length} files?`, [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        onPress: async () => {
          try {
            await StatusModule.deleteMediaFiles(selectedUris);
            setSnackbarMsg(`${selectedUris.length} file(s) deleted`);
            resetAndLoad(currentFolderPath);
          } catch (e) {
            console.error('Delete failed:', e);
            setSnackbarMsg('Delete failed');
          }
        },
      },
    ]);
  };

  const selectAll = () => {
    const allSelected = {};
    mediaFiles.forEach(item => {
      allSelected[item.uri] = true;
    });
    setSelectedItems(allSelected);
  };

  const PreviewModal = () => {
    if (previewIndex === null) return null;
    const item = mediaFiles[previewIndex];
    if (!item) return null;

    return (
      <Modal visible transparent>
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalClose}
            onPress={() => setPreviewIndex(null)}>
            <Text style={{color: 'white', fontSize: 20}}>✕</Text>
          </Pressable>
          {isImage(item.name) ? (
            <Image
              source={{uri: item.uri}}
              style={styles.fullPreview}
              resizeMode="contain"
            />
          ) : (
            <Video
              source={{uri: item.uri}}
              style={styles.fullPreview}
              controls
              resizeMode="contain"
              paused={false}
            />
          )}
          <View style={styles.modalNav}>
            <IconButton
              icon="chevron-left"
              onPress={() => setPreviewIndex(i => Math.max(0, i - 1))}
            />
            <IconButton
              icon="chevron-right"
              onPress={() =>
                setPreviewIndex(i => Math.min(mediaFiles.length - 1, i + 1))
              }
            />
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <View style={{flex: 1}}>
      <Text style={styles.infoText}>
        {selectedMessenger} • {mediaInfo.count} files • ~
        {mediaInfo.totalSizeMb?.toFixed(1)} MB
      </Text>

      <View style={styles.buttonRow}>
        <Button onPress={selectAll} mode="outlined">
          Select All
        </Button>
        <Button
          onPress={deleteSelected}
          mode="outlined"
          disabled={Object.keys(selectedItems).length === 0}>
          Delete
        </Button>
        <Button onPress={() => setSortBySize(s => !s)} mode="outlined">
          Sort: {sortBySize ? 'Size' : 'Date'}
        </Button>
        <Button
          onPress={() =>
            setGroupBy(g =>
              g === 'none' ? 'date' : g === 'date' ? 'size' : 'none',
            )
          }
          mode="outlined">
          Group: {groupBy}
        </Button>
        {folderStack.length > 0 && (
          <Button
            onPress={() => {
              const previous = folderStack.pop();
              setFolderStack([...folderStack]);
              resetAndLoad(previous);
            }}
            mode="outlined">
            ⬅️ Back
          </Button>
        )}
      </View>

      {loading ? (
        <ActivityIndicator size="large" style={{marginTop: 20}} />
      ) : (
        <SectionList
          sections={grouped}
          keyExtractor={(item, idx) => item.uri + idx}
          renderItem={renderItem}
          renderSectionHeader={({section: {title}}) =>
            title ? <Text style={styles.sectionHeader}>{title}</Text> : null
          }
          numColumns={3}
          contentContainerStyle={styles.grid}
        />
      )}

      {PreviewModal()}

      <Snackbar
        visible={!!snackbarMsg}
        onDismiss={() => setSnackbarMsg('')}
        duration={3000}>
        {snackbarMsg}
      </Snackbar>
    </View>
  );
};

const styles = StyleSheet.create({
  grid: {
    paddingHorizontal: 8,
    paddingBottom: 80,
  },
  itemContainer: {
    position: 'relative',
    width: itemSize,
    height: itemSize,
    margin: 4,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#eee',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  videoBox: {
    width: '100%',
    height: '100%',
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
  },
  folderText: {
    color: '#fff',
    fontSize: 28,
  },
  videoText: {
    color: '#fff',
    fontSize: 24,
  },
  checkbox: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  percentText: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    color: 'white',
    fontSize: 12,
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  infoText: {
    fontWeight: 'bold',
    margin: 10,
    fontSize: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    marginBottom: 10,
  },
  sectionHeader: {
    fontWeight: 'bold',
    fontSize: 16,
    marginVertical: 8,
    marginLeft: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullPreview: {
    width: '100%',
    height: '80%',
  },
  modalClose: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
  },
  modalNav: {
    position: 'absolute',
    bottom: 20,
    flexDirection: 'row',
  },
});

export default MessengerMediaGrid;

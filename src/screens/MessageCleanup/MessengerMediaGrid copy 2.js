// ✅ STEP 1: UI side (React Native JS)
// Add chips to show folders in WhatsApp Media
// Shows files of the selected folder only

import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Image,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  ScrollView,
  FlatList,
} from 'react-native';
import {Checkbox, Snackbar, Chip, IconButton} from 'react-native-paper';
import {useFocusEffect} from '@react-navigation/native';
import {NativeModules} from 'react-native';
import Video from 'react-native-video';

const {StatusModule} = NativeModules;
const screenWidth = Dimensions.get('window').width;
const itemSize = screenWidth / 3 - 12;

const formatDate = ts =>
  new Date(ts).toLocaleString('default', {month: 'long', year: 'numeric'});
const sizeBucket = size => {
  if (size >= 1024 * 1024 * 1000) return '≥ 1GB';
  if (size >= 1024 * 1024 * 500) return '≥ 500MB';
  if (size >= 1024 * 1024 * 200) return '≥ 200MB';
  if (size >= 1024 * 1024 * 100) return '≥ 100MB';
  if (size >= 1024 * 1024 * 50) return '≥ 50MB';
  return '< 50MB';
};

const MessengerMediaGrid = ({route}) => {
  const {appKey: selectedMessenger, treeUri: folderUri} = route.params;
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [mediaFiles, setMediaFiles] = useState([]);
  const [visibleItems, setVisibleItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState({});
  const [loading, setLoading] = useState(false);
  const [sortBySize, setSortBySize] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState('');
  const PAGE_SIZE = 60;

  useFocusEffect(
    useCallback(() => {
      loadSubfolders();
    }, [folderUri, selectedMessenger]),
  );

  useEffect(() => {
    if (selectedFolder) {
      setLoading(true);
      setTimeout(() => {
        loadFilesInFolder(selectedFolder);
      }, 50);
    }
  }, [sortBySize]);

  const loadSubfolders = async () => {
    try {
      const result = await StatusModule.listMediaFolders(selectedMessenger);
      setFolders(result || []);
      if (result?.length) loadFilesInFolder(result[0]);
    } catch (e) {
      console.error('📂 Folder load error', e?.message || e);
    }
  };

  const loadFilesInFolder = async folderName => {
    setSelectedFolder(folderName);
    setLoading(true);
    try {
      const result = await StatusModule.getMediaInFolder(
        selectedMessenger,
        folderName,
      );
      const items = result.items || [];
      const sorted = [...items].sort((a, b) =>
        sortBySize ? b.size - a.size : b.timestamp - a.timestamp,
      );
      setMediaFiles(sorted);
      setVisibleItems(sorted.slice(0, PAGE_SIZE));
    } catch (e) {
      console.error('❌ Load files error:', e);
    } finally {
      setTimeout(() => setLoading(false), 100);
    }
  };

  const loadMore = () => {
    const next = mediaFiles.slice(
      visibleItems.length,
      visibleItems.length + PAGE_SIZE,
    );
    if (next.length > 0) {
      setVisibleItems(prev => [...prev, ...next]);
    }
  };

  const toggleSelect = uri => {
    setSelectedItems(prev => ({...prev, [uri]: !prev[uri]}));
  };

  const renderItem = ({item, index}) => {
    const selected = selectedItems[item.uri];
    const isImage = /\.(jpe?g|png|webp)$/i.test(item.name);
    const isVideo = /\.(mp4|3gp|mkv)$/i.test(item.name);
    const isAudio = /\.(mp3|m4a|opus)$/i.test(item.name);
    const icon = isImage ? null : isVideo ? '🎥' : isAudio ? '🎵' : '📄';

    const sectionLabel = sortBySize
      ? sizeBucket(item.size)
      : formatDate(item.timestamp);

    const showLabel =
      index === 0 ||
      (sortBySize
        ? sizeBucket(mediaFiles[index - 1]?.size) !== sectionLabel
        : formatDate(mediaFiles[index - 1]?.timestamp) !== sectionLabel);

    return (
      <View style={{width: itemSize, margin: 4}}>
        {showLabel && <Text style={styles.sectionHeader}>{sectionLabel}</Text>}
        <TouchableOpacity
          onLongPress={() => toggleSelect(item.uri)}
          style={styles.itemContainer}>
          {isImage ? (
            <Image source={{uri: item.uri}} style={styles.image} />
          ) : isVideo ? (
            <Video
              source={{uri: item.uri}}
              paused
              style={styles.image}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.videoBox}>
              <Text style={styles.videoText}>{icon}</Text>
            </View>
          )}
          <Text style={styles.percentText}>
            {(item.size / (1024 * 1024)).toFixed(1)} MB
          </Text>
          <Checkbox
            status={selected ? 'checked' : 'unchecked'}
            onPress={() => toggleSelect(item.uri)}
            style={styles.checkbox}
          />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={{flex: 1}}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{height: 48, maxHeight: 48, marginTop: 12}}>
        {folders.map(folder => (
          <Chip
            key={folder}
            selected={folder === selectedFolder}
            onPress={() => loadFilesInFolder(folder)}
            style={styles.chip}>
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={styles.chipText}>
              {folder.replace(/.*\//, '')}
            </Text>
          </Chip>
        ))}
      </ScrollView>

      <View style={styles.buttonRow}>
        <IconButton
          icon={sortBySize ? 'sort-ascending' : 'sort-calendar-ascending'}
          onPress={() => setSortBySize(s => !s)}
        />
      </View>

      <View style={{flex: 1}}>
        {loading ? (
          <ActivityIndicator size="large" style={{marginTop: 40}} />
        ) : (
          <FlatList
            data={visibleItems}
            keyExtractor={(item, idx) => item.uri + idx}
            numColumns={3}
            renderItem={renderItem}
            onEndReached={loadMore}
            onEndReachedThreshold={0.4}
            contentContainerStyle={styles.grid}
          />
        )}
      </View>

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
  grid: {paddingHorizontal: 8, paddingBottom: 80},
  itemContainer: {
    width: '100%',
    height: itemSize,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#eee',
  },
  image: {width: '100%', height: '100%'},
  videoBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#333',
  },
  videoText: {fontSize: 22, color: '#fff'},
  percentText: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    fontSize: 11,
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 4,
  },
  checkbox: {position: 'absolute', top: 4, right: 4},
  chip: {
    height: 36,
    justifyContent: 'center',
    marginRight: 8,
    maxWidth: 140,
  },
  chipText: {
    fontSize: 13,
    maxWidth: 120,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 4,
  },
  sectionHeader: {
    fontWeight: 'bold',
    fontSize: 13,
    marginBottom: 2,
    color: '#666',
  },
});

export default MessengerMediaGrid;

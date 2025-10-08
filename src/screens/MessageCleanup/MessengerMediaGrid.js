import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Image,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  SectionList,
  Dimensions,
  Modal,
} from 'react-native';
import {IconButton, Checkbox, Snackbar, Chip, Button} from 'react-native-paper';
import {useFocusEffect} from '@react-navigation/native';
import {NativeModules} from 'react-native';
import Video from 'react-native-video';
import {Header} from 'react-native/Libraries/NewAppScreen';

const {StatusModule} = NativeModules;
const screenWidth = Dimensions.get('window').width;
const itemSize = screenWidth / 3 - 12;

const formatDate = ts =>
  new Date(ts).toLocaleString('default', {month: 'long', year: 'numeric'});

const sizeBucket = size => {
  if (size < 10 * 1024 * 1024) return '<10MB';
  if (size < 50 * 1024 * 1024) return '10–50MB';
  if (size < 100 * 1024 * 1024) return '50–100MB';
  return '100MB+';
};

const MessengerMediaGrid = ({route, toggleTheme}) => {
  const {appKey: selectedMessenger, treeUri: folderUri} = route.params;
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [mediaFiles, setMediaFiles] = useState([]);
  const [sortOption, setSortOption] = useState({by: 'date', order: 'desc'});
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [selectedItems, setSelectedItems] = useState({});
  const [loading, setLoading] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState('');
  const [sortModalVisible, setSortModalVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadSubfolders();
    }, [folderUri, selectedMessenger]),
  );

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
      const sorted = sortItems(items);
      setMediaFiles(sorted);
    } catch (e) {
      console.error('❌ Load files error:', e);
    } finally {
      setTimeout(() => setLoading(false), 100);
    }
  };

  const sortItems = items => {
    const {by, order} = sortOption;
    return [...items].sort((a, b) => {
      const valueA = by === 'size' ? a.size : a.timestamp;
      const valueB = by === 'size' ? b.size : b.timestamp;
      return order === 'desc' ? valueB - valueA : valueA - valueB;
    });
  };

  const buildGroupedItems = () => {
    const grouped = {};
    const {by} = sortOption;

    mediaFiles.forEach(item => {
      const key =
        by === 'size' ? sizeBucket(item.size) : formatDate(item.timestamp);
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    });

    return Object.entries(grouped).map(([title, data]) => ({
      title,
      data: collapsedGroups[title] ? [] : data,
      fullData: data,
    }));
  };

  const toggleSelect = uri => {
    setSelectedItems(prev => ({...prev, [uri]: !prev[uri]}));
  };

  const handleGroupDelete = (title, data) => {
    Alert.alert(
      'Delete Group',
      `Delete all ${data.length} items in "${title}"?`,
      [
        {text: 'Cancel'},
        {
          text: 'Delete',
          onPress: () => {
            const urisToDelete = data.map(i => i.uri);
            StatusModule.deleteMediaBatch(urisToDelete);
            const updated = mediaFiles.filter(
              f => !urisToDelete.includes(f.uri),
            );
            setMediaFiles(updated);
            setSelectedItems({});
            setSnackbarMsg(`${data.length} items deleted`);
          },
        },
      ],
      {cancelable: true},
    );
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
            const updated = mediaFiles.filter(f => !uris.includes(f.uri));
            setMediaFiles(updated);
            setSelectedItems({});
            setSnackbarMsg(`${uris.length} items deleted`);
          },
        },
      ],
      {cancelable: true},
    );
  };

  const renderGridItem = item => {
    const selected = selectedItems[item.uri];
    const isImage = /\.(jpe?g|png|webp)$/i.test(item.name);
    const isVideo = /\.(mp4|3gp|mkv)$/i.test(item.name);
    const isAudio = /\.(mp3|m4a|opus)$/i.test(item.name);
    const icon = isImage ? null : isVideo ? '🎥' : isAudio ? '🎵' : '📄';

    return (
      <TouchableOpacity
        key={item.uri}
        onLongPress={() => toggleSelect(item.uri)}
        style={styles.itemContainer}>
        {isImage ? (
          <Image
            source={{uri: item.uri, cache: 'force-cache'}}
            style={styles.image}
          />
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
    );
  };

  return (
    <View style={{flex: 1}}>
      <Header toggleTheme={toggleTheme} showBackButton={false} />
      {/* Folder Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{height: 48, marginTop: 12}}>
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

      {/* Sort Icon */}
      <View style={styles.buttonRow}>
        <IconButton
          icon="sort"
          size={24}
          onPress={() => setSortModalVisible(true)}
        />
      </View>

      {/* Grouped Grid */}
      <View style={{flex: 1, minHeight: 400}}>
        {loading ? (
          <ActivityIndicator size="large" style={{marginTop: 40}} />
        ) : (
          <SectionList
            sections={buildGroupedItems()}
            keyExtractor={(item, idx) => item.uri + idx}
            renderItem={({section}) => {
              const rows = [];
              const data = section.data;
              for (let i = 0; i < data.length; i += 3) {
                rows.push(data.slice(i, i + 3));
              }

              return (
                <View>
                  {rows.map((row, idx) => (
                    <View key={idx} style={styles.gridRow}>
                      {row.map(renderGridItem)}
                    </View>
                  ))}
                </View>
              );
            }}
            contentContainerStyle={styles.grid}
            renderSectionHeader={({section: {title, fullData}}) => (
              <TouchableOpacity
                onPress={() =>
                  setCollapsedGroups(prev => ({
                    ...prev,
                    [title]: !prev[title],
                  }))
                }
                onLongPress={() => handleGroupDelete(title, fullData)}>
                <Text style={styles.sectionHeader}>
                  {title} {collapsedGroups[title] ? '▶' : '▼'}
                </Text>
              </TouchableOpacity>
            )}
          />
        )}
      </View>

      {/* Bottom Delete Bar */}
      {Object.values(selectedItems).some(Boolean) && (
        <View style={styles.selectionBar}>
          <Text style={styles.selectionText}>
            {Object.values(selectedItems).filter(Boolean).length} selected
          </Text>
          <Button onPress={handleSelectionDelete} mode="contained" color="red">
            Delete
          </Button>
        </View>
      )}

      {/* Sort Modal */}
      <Modal transparent visible={sortModalVisible} animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => setSortModalVisible(false)}>
          <View style={styles.modalBox}>
            {[
              {label: '📅 Date: New → Old', by: 'date', order: 'desc'},
              {label: '📅 Date: Old → New', by: 'date', order: 'asc'},
              {label: '📦 Size: Big → Small', by: 'size', order: 'desc'},
              {label: '📦 Size: Small → Big', by: 'size', order: 'asc'},
            ].map(opt => (
              <Button
                key={opt.label}
                onPress={() => {
                  setSortOption({by: opt.by, order: opt.order});
                  setSortModalVisible(false);
                  setMediaFiles(sortItems(mediaFiles));
                }}>
                {opt.label}
              </Button>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Snackbar */}
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
  grid: {paddingBottom: 80},
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  itemContainer: {
    width: itemSize,
    height: itemSize,
    margin: 4,
    borderRadius: 10,
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
  checkbox: {
    position: 'absolute',
    top: 4,
    right: 4,
    zIndex: 2,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 10,
  },
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
    paddingHorizontal: 4,
    paddingTop: 6,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    backgroundColor: '#f2f2f2',
    padding: 6,
    marginTop: 12,
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
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    padding: 40,
  },
  modalBox: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    elevation: 4,
  },
});

export default MessengerMediaGrid;

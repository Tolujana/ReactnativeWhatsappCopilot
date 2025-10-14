import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  Dimensions,
  Modal,
  SafeAreaView,
  Linking,
} from 'react-native';
import {
  IconButton,
  Checkbox,
  Snackbar,
  Chip,
  Button,
  Text,
  useTheme,
  Surface,
} from 'react-native-paper';
import {useFocusEffect} from '@react-navigation/native';
import {NativeModules} from 'react-native';
import Video from 'react-native-video';
import {FlashList} from '@shopify/flash-list';
import {BannerAd, BannerAdSize} from 'react-native-google-mobile-ads';

const {StatusModule} = NativeModules;
const screenWidth = Dimensions.get('window').width;
const itemSize = Math.floor((screenWidth - 20) / 3);
const PAGE_SIZE = 30; // Number of items to load per page

const formatDate = ts =>
  new Date(ts).toLocaleString('default', {month: 'long', year: 'numeric'});

const sizeBucket = size => {
  if (size < 10 * 1024 * 1024) return '<10MB';
  if (size < 50 * 1024 * 1024) return '10–50MB';
  if (size < 100 * 1024 * 1024) return '50–100MB';
  return '100MB+';
};

const MessengerMediaGrid = ({route, toggleTheme}) => {
  const theme = useTheme();
  const {appKey: selectedMessenger, treeUri: folderUri} = route.params;
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [mediaFiles, setMediaFiles] = useState([]);
  const [sortOption, setSortOption] = useState({by: 'date', order: 'desc'});
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [selectedItems, setSelectedItems] = useState({});
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState('');
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [flatData, setFlatData] = useState([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadSubfolders();
    }, [folderUri, selectedMessenger]),
  );

  const loadSubfolders = async () => {
    try {
      const result = await StatusModule.listMediaFolders(selectedMessenger);
      setFolders(result || []);
      if (result?.length) {
        setSelectedFolder(result[0]);
        loadFilesInFolder(result[0], true);
      }
    } catch (e) {
      console.error('📂 Folder load error', e?.message || e);
      setSnackbarMsg('Failed to load folders');
    }
  };

  const loadFilesInFolder = async (folderName, reset = false) => {
    if (reset) {
      setLoading(true);
      setOffset(0);
      setMediaFiles([]);
      setHasMore(true);
    } else {
      if (!hasMore || loadingMore) return;
      setLoadingMore(true);
    }
    setSelectedFolder(folderName);

    try {
      const result = await StatusModule.getMediaInFolderPaged(
        selectedMessenger,
        folderName,
        reset ? 0 : offset,
        PAGE_SIZE,
      );
      const items = result.items || [];
      const sorted = sortItems(items);
      setMediaFiles(prev => (reset ? sorted : [...prev, ...sorted]));
      setOffset(prev => prev + items.length);
      setHasMore(items.length === PAGE_SIZE);
    } catch (e) {
      console.error('❌ Load files error:', e);
      setSnackbarMsg('Failed to load media files');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMoreFiles = useCallback(() => {
    if (hasMore && selectedFolder && !loading && !loadingMore) {
      loadFilesInFolder(selectedFolder);
    }
  }, [hasMore, selectedFolder, loading, loadingMore]);

  const sortItems = items => {
    const {by, order} = sortOption;
    return [...items].sort((a, b) => {
      const valueA = by === 'size' ? a.size : a.timestamp;
      const valueB = by === 'size' ? b.size : b.timestamp;
      return order === 'desc' ? valueB - valueA : valueA - valueB;
    });
  };

  const flattenData = files => {
    const {by} = sortOption;
    const grouped = {};
    files.forEach(item => {
      const key =
        by === 'size' ? sizeBucket(item.size) : formatDate(item.timestamp);
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    });

    const flattened = Object.entries(grouped).map(([title, groupData]) => {
      const dataWithAds = [];
      const collapsed = collapsedGroups[title];
      if (!collapsed) {
        groupData.forEach((item, index) => {
          dataWithAds.push(item);
          if ((index + 1) % 6 === 0 && index + 1 < groupData.length) {
            dataWithAds.push({type: 'ad', id: `ad-${title}-${index}`});
          }
        });
      }
      return {
        type: 'section',
        title,
        data: dataWithAds,
      };
    });
    setFlatData(flattened);
  };

  useEffect(() => {
    flattenData(mediaFiles);
  }, [mediaFiles, sortOption, collapsedGroups]);

  const toggleSelect = uri => {
    setSelectedItems(prev => ({...prev, [uri]: !prev[uri]}));
  };

  const handleGroupDelete = (title, data) => {
    Alert.alert(
      'Delete Group',
      `Delete all ${data.filter(i => i.uri).length} items in "${title}"?`,
      [
        {text: 'Cancel'},
        {
          text: 'Delete',
          onPress: () => {
            const urisToDelete = data.filter(i => i.uri).map(i => i.uri);
            StatusModule.deleteMediaBatch(urisToDelete);
            const updated = mediaFiles.filter(
              f => !urisToDelete.includes(f.uri),
            );
            setMediaFiles(updated);
            setSelectedItems({});
            setSnackbarMsg(`${urisToDelete.length} items deleted`);
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

  const clearSelection = () => {
    setSelectedItems({});
  };

  const selectAllInGroup = data => {
    const newSelected = {...selectedItems};
    data.forEach(file => {
      if (file.type !== 'ad') {
        newSelected[file.uri] = true;
      }
    });
    setSelectedItems(newSelected);
  };

  const toggleGroup = title => {
    setCollapsedGroups(prev => ({
      ...prev,
      [title]: !prev[title],
    }));
  };

  const openFile = async uri => {
    try {
      await Linking.openURL(uri);
    } catch (e) {
      console.error('Failed to open file:', e);
      Alert.alert('Error', 'Unable to open the file.');
    }
  };

  const isAnySelected = Object.values(selectedItems).some(Boolean);

  const renderItem = ({item}) => {
    if (item.type !== 'section') return null;

    const {title, data} = item;

    return (
      <View style={{marginBottom: 12}}>
        <Surface
          style={[
            styles.sectionHeaderContainer,
            {backgroundColor: theme.colors.surfaceVariant},
          ]}>
          <TouchableOpacity
            style={styles.sectionHeaderTouchable}
            onPress={() => toggleGroup(title)}
            onLongPress={() => handleGroupDelete(title, data)}>
            <Text
              variant="titleSmall"
              style={[
                styles.sectionHeader,
                {color: theme.colors.onSurfaceVariant},
              ]}>
              {title} {collapsedGroups[title] ? '▶' : '▼'}
            </Text>
          </TouchableOpacity>
          {!collapsedGroups[title] && (
            <TouchableOpacity onPress={() => selectAllInGroup(data)}>
              <Text
                variant="labelMedium"
                style={[styles.selectAllText, {color: theme.colors.primary}]}>
                Select All
              </Text>
            </TouchableOpacity>
          )}
        </Surface>

        {data.length > 0 && (
          <View style={styles.gridContainer}>
            {data.map((file, index) => {
              if (file.type === 'ad') {
                return (
                  <View key={file.id} style={styles.adContainer}>
                    <BannerAd
                      unitId="ca-app-pub-3940256099942544/6300978111"
                      size={BannerAdSize.BANNER}
                      requestOptions={{requestNonPersonalizedAdsOnly: true}}
                    />
                  </View>
                );
              }

              const selected = selectedItems[file.uri];
              const isImage = /\.(jpe?g|png|webp)$/i.test(file.name);
              const isVideo = /\.(mp4|3gp|mkv)$/i.test(file.name);
              const isAudio = /\.(mp3|m4a|opus)$/i.test(file.name);
              const icon = isImage
                ? null
                : isVideo
                ? '🎥'
                : isAudio
                ? '🎵'
                : '📄';

              return (
                <TouchableOpacity
                  key={file.uri}
                  onPress={() => {
                    if (isAnySelected) {
                      toggleSelect(file.uri);
                    } else {
                      openFile(file.uri);
                    }
                  }}
                  onLongPress={() => toggleSelect(file.uri)}
                  style={[
                    styles.itemContainer,
                    {backgroundColor: theme.colors.surface},
                  ]}
                  activeOpacity={0.8}>
                  <View
                    style={[
                      styles.mediaContainer,
                      {opacity: selected ? 0.5 : 1},
                    ]}>
                    {isImage ? (
                      <Image
                        source={{uri: file.uri, cache: 'force-cache'}}
                        style={styles.image}
                      />
                    ) : isVideo ? (
                      <Video
                        source={{uri: file.uri}}
                        paused
                        style={styles.image}
                        resizeMode="cover"
                      />
                    ) : (
                      <View
                        style={[
                          styles.videoBox,
                          {backgroundColor: theme.colors.surfaceVariant},
                        ]}>
                        <Text
                          style={[
                            styles.videoText,
                            {color: theme.colors.onSurfaceVariant},
                          ]}>
                          {icon}
                        </Text>
                      </View>
                    )}
                    <Text
                      variant="labelSmall"
                      style={[
                        styles.percentText,
                        {backgroundColor: theme.colors.scrim},
                      ]}>
                      {(file.size / (1024 * 1024)).toFixed(1)} MB
                    </Text>
                  </View>
                  {selected && (
                    <Checkbox
                      status="checked"
                      onPress={() => toggleSelect(file.uri)}
                      style={[
                        styles.checkbox,
                        {backgroundColor: theme.colors.surface},
                      ]}
                      color={theme.colors.primary}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, {backgroundColor: theme.colors.background}]}
      edges={['right', 'bottom', 'left']}>
      <Surface
        style={[styles.customHeader, {backgroundColor: theme.colors.surface}]}
        elevation={1}>
        <Text
          variant="titleLarge"
          style={[styles.headerText, {color: theme.colors.onSurface}]}>
          Media Grid
        </Text>
        <IconButton
          icon="theme-light-dark"
          size={24}
          onPress={toggleTheme}
          iconColor={theme.colors.primary}
        />
      </Surface>

      <Surface
        style={[styles.folderSection, {backgroundColor: theme.colors.surface}]}
        elevation={1}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsScrollView}>
          {folders.map(folder => (
            <Chip
              key={folder}
              selected={folder === selectedFolder}
              onPress={() => loadFilesInFolder(folder, true)}
              style={styles.chip}
              mode={folder === selectedFolder ? 'flat' : 'outlined'}>
              <Text
                variant="labelMedium"
                numberOfLines={1}
                ellipsizeMode="tail"
                style={[styles.chipText, {color: theme.colors.onSurface}]}>
                {folder.replace(/.*\//, '')}
              </Text>
            </Chip>
          ))}
        </ScrollView>
        <View style={styles.buttonRow}>
          <IconButton
            icon="sort"
            size={24}
            onPress={() => setSortModalVisible(true)}
            iconColor={theme.colors.primary}
          />
        </View>
      </Surface>

      <View
        style={[
          styles.listContainer,
          {backgroundColor: theme.colors.background},
        ]}>
        {loading ? (
          <ActivityIndicator
            size="large"
            color={theme.colors.primary}
            style={{marginTop: 20}}
          />
        ) : (
          <FlashList
            data={flatData}
            renderItem={renderItem}
            keyExtractor={(item, index) => item.title + index}
            estimatedItemSize={itemSize + 30}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
            viewabilityConfig={{itemVisiblePercentThreshold: 50}}
            extraData={selectedItems}
            onEndReached={loadMoreFiles}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              loadingMore && hasMore ? (
                <ActivityIndicator
                  size="small"
                  color={theme.colors.primary}
                  style={{marginVertical: 20}}
                />
              ) : null
            }
          />
        )}
      </View>

      {Object.values(selectedItems).some(Boolean) && (
        <Surface
          style={[styles.selectionBar, {backgroundColor: theme.colors.surface}]}
          elevation={4}>
          <Text
            variant="bodyMedium"
            style={[styles.selectionText, {color: theme.colors.onSurface}]}>
            {Object.values(selectedItems).filter(Boolean).length} selected
          </Text>
          <View style={styles.selectionButtons}>
            <Button
              onPress={handleSelectionSave}
              mode="contained"
              style={styles.selectionButton}
              icon="content-save">
              Save
            </Button>
            <Button
              onPress={handleSelectionDelete}
              mode="contained"
              style={[
                styles.selectionButton,
                {backgroundColor: theme.colors.error},
              ]}
              icon="delete">
              Delete
            </Button>
            <Button
              onPress={clearSelection}
              mode="outlined"
              style={styles.selectionButton}
              icon="close">
              Clear
            </Button>
          </View>
        </Surface>
      )}

      <Modal transparent visible={sortModalVisible} animationType="fade">
        <TouchableOpacity
          style={[styles.modalOverlay, {backgroundColor: theme.colors.scrim}]}
          onPress={() => setSortModalVisible(false)}
          activeOpacity={1}>
          <View
            style={[styles.modalBox, {backgroundColor: theme.colors.surface}]}>
            <Text
              variant="titleMedium"
              style={[styles.modalTitle, {color: theme.colors.onSurface}]}>
              Sort By
            </Text>
            {[
              {label: '📅 Date: New → Old', by: 'date', order: 'desc'},
              {label: '📅 Date: Old → New', by: 'date', order: 'asc'},
              {label: '📦 Size: Big → Small', by: 'size', order: 'desc'},
              {label: '📦 Size: Small → Big', by: 'size', order: 'asc'},
            ].map(opt => (
              <Button
                key={opt.label}
                mode="text"
                onPress={() => {
                  setSortOption({by: opt.by, order: opt.order});
                  setSortModalVisible(false);
                  setMediaFiles(sortItems(mediaFiles));
                }}
                style={styles.modalButton}
                contentStyle={styles.modalButtonContent}>
                <Text style={{color: theme.colors.onSurface}}>{opt.label}</Text>
              </Button>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <Snackbar
        visible={!!snackbarMsg}
        onDismiss={() => setSnackbarMsg('')}
        duration={3000}
        style={{backgroundColor: theme.colors.surface}}
        theme={{colors: {onSurface: theme.colors.onSurface}}}>
        {snackbarMsg}
      </Snackbar>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  customHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  headerText: {
    fontWeight: 'bold',
  },
  folderSection: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  chipsScrollView: {
    height: 40,
  },
  chip: {
    height: 36,
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
    marginTop: 4,
  },
  listContainer: {
    flex: 1,
    marginTop: 8,
  },
  sectionHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 8,
    marginTop: 8,
    borderRadius: 8,
  },
  sectionHeaderTouchable: {
    flex: 1,
  },
  sectionHeader: {
    fontWeight: 'bold',
  },
  selectAllText: {
    paddingLeft: 8,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  itemContainer: {
    width: itemSize,
    height: itemSize,
    margin: 2,
    borderRadius: 8,
    position: 'relative',
    overflow: 'visible',
    elevation: 2,
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  mediaContainer: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  videoBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoText: {
    fontSize: 22,
  },
  percentText: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    fontSize: 11,
    paddingHorizontal: 4,
    borderRadius: 4,
    overflow: 'hidden',
  },
  checkbox: {
    position: 'absolute',
    top: 4,
    left: 4,
    zIndex: 2,
    borderRadius: 10,
  },
  selectionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectionText: {
    fontWeight: 'bold',
  },
  selectionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectionButton: {
    marginHorizontal: 4,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 40,
  },
  modalBox: {
    padding: 20,
    borderRadius: 12,
    elevation: 8,
  },
  modalTitle: {
    marginBottom: 16,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  modalButton: {
    marginVertical: 4,
  },
  modalButtonContent: {
    justifyContent: 'flex-start',
  },
  adContainer: {
    width: '100%',
    alignItems: 'center',
    marginVertical: 8,
  },
});

export default MessengerMediaGrid;

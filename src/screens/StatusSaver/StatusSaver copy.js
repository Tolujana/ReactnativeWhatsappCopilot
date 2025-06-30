import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  Alert,
  PermissionsAndroid,
  Platform,
  StyleSheet,
} from 'react-native';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import Modal from 'react-native-modal';
import {NativeModules} from 'react-native';
import {copilot, walkthroughable, CopilotStep} from 'react-native-copilot';

const {StatusModule} = NativeModules;
const isAndroid11Plus = Platform.OS === 'android' && Platform.Version >= 30;

const CopilotTouchable = walkthroughable(TouchableOpacity);

function StatusSaver({start, copilotEvents}) {
  const [statusMedia, setStatusMedia] = useState([]);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    if (!isAndroid11Plus) requestLegacyPermissions();
    setTimeout(() => {
      start(); // Start Copilot after load
    }, 1000);
  }, []);

  const requestLegacyPermissions = async () => {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert('Permission Required', 'Storage access is needed.');
      }
    } catch (err) {
      console.warn(err);
    }
  };

  const loadFromLegacyPath = async () => {
    const dirPath =
      RNFS.ExternalStorageDirectoryPath + '/WhatsApp/Media/.Statuses';
    const exists = await RNFS.exists(dirPath);
    if (!exists) {
      Alert.alert(
        'Folder Not Found',
        'The WhatsApp .Statuses folder was not found. Is WhatsApp installed?',
      );
      return;
    }
    const files = await RNFS.readDir(dirPath);
    const media = files
      .filter(file => /\.(jpg|jpeg|png|mp4|webp)$/i.test(file.name))
      .map(file => ({
        path: file.path,
        uri: 'file://' + file.path,
        name: file.name,
      }));
    setStatusMedia(media);
  };

  const loadFromNativeSAF = async () => {
    try {
      Alert.alert(
        'Step Guide',
        'When the file picker opens, select:\n\n📁 com.whatsapp ➜ WhatsApp ➜ Media ➜ .Statuses\n\nOr if you use WhatsApp Business:\n\n📁 com.whatsapp.w4b ➜ WhatsApp Business ➜ Media ➜ .Statuses',
      );

      const files = await StatusModule.openStatusFolderPicker();
      const formatted = files.map(item => ({
        uri: item.uri,
        name: item.name,
        mimeType: item.mimeType || 'image/*',
      }));
      setStatusMedia(formatted);
    } catch (err) {
      if (err?.message?.includes('User cancelled')) return;
      Alert.alert('Error', err.message || 'SAF failed.');
    }
  };

  const saveMedia = async media => {
    try {
      const destFolder = `${RNFS.PicturesDirectoryPath}/WhatsAppStatusSaver`;
      await RNFS.mkdir(destFolder);
      const fileName = media.name || media.path?.split('/').pop();
      const destPath = `${destFolder}/${fileName}`;

      if (media.path) {
        await RNFS.copyFile(media.path, destPath);
      } else if (media.uri.startsWith('content://')) {
        const base64data = await RNFS.readFile(media.uri, 'base64');
        await RNFS.writeFile(destPath, base64data, 'base64');
      }

      Alert.alert('Saved', 'Media saved to gallery.');
    } catch (err) {
      Alert.alert('Error', 'Save failed: ' + err.message);
    }
  };

  const renderItem = ({item}) => (
    <TouchableOpacity
      style={styles.imageContainer}
      onPress={() => {
        setSelectedMedia(item);
        setModalVisible(true);
      }}>
      <Image source={{uri: item.uri}} style={styles.image} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>📂 WhatsApp Status Saver</Text>

      <CopilotStep
        text="Tap this button to load statuses. If you're on Android 11+, you'll need to select the WhatsApp or WhatsApp Business folder manually."
        order={1}
        name="pick-folder">
        <CopilotTouchable
          style={styles.pickBtn}
          onPress={() =>
            isAndroid11Plus ? loadFromNativeSAF() : loadFromLegacyPath()
          }>
          <Text style={styles.pickText}>
            {isAndroid11Plus
              ? 'Pick WhatsApp Status Folder (Android 11+)'
              : 'Load from WhatsApp Status Folder'}
          </Text>
        </CopilotTouchable>
      </CopilotStep>

      <FlatList
        data={statusMedia}
        keyExtractor={item => item.uri || item.path}
        renderItem={renderItem}
        numColumns={3}
        contentContainerStyle={styles.gallery}
      />

      <Modal
        isVisible={modalVisible}
        onBackdropPress={() => setModalVisible(false)}>
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>Choose an action</Text>
          <TouchableOpacity
            style={styles.modalBtn}
            onPress={() => {
              saveMedia(selectedMedia);
              setModalVisible(false);
            }}>
            <Text>💾 Save</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.modalBtn}
            onPress={() => {
              Share.open({url: selectedMedia.uri});
              setModalVisible(false);
            }}>
            <Text>📤 Share</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, paddingTop: 50},
  title: {fontSize: 20, textAlign: 'center', marginBottom: 10},
  pickBtn: {
    backgroundColor: '#1976d2',
    margin: 10,
    padding: 10,
    borderRadius: 5,
  },
  pickText: {color: 'white', textAlign: 'center'},
  gallery: {paddingHorizontal: 6},
  imageContainer: {margin: 4},
  image: {width: 100, height: 100, borderRadius: 5},
  modal: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
  },
  modalTitle: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 10,
  },
  modalBtn: {
    padding: 12,
    backgroundColor: '#f1f1f1',
    borderRadius: 5,
    marginTop: 10,
  },
});

export default copilot({
  animated: true,
  overlay: 'svg', // or 'view' if you have issues
  tooltipStyle: {padding: 16},
  stepNumberTextStyle: {color: 'black'},
})(StatusSaver);

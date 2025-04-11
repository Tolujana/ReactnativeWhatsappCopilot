import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  AccessibilityInfo,
  TextInput,
  Image,
} from 'react-native';
import {launchImageLibrary} from 'react-native-image-picker';
import {openAccessibilitySettings} from '../../util/AccessibilityService';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const BulkMessagingScreen = ({navigation}) => {
  const [message, setMessage] = useState('');
  const [media, setMedia] = useState(null);

  useEffect(() => {
    checkAccessibilityPermission();
  }, []);

  const checkAccessibilityPermission = async () => {
    const enabled = await AccessibilityInfo.isScreenReaderEnabled();

    if (!enabled) {
      Alert.alert(
        'Permission Required',
        'Accessibility permissions are needed to send WhatsApp messages. Please enable the Accessibility Service for this app.',
        [
          {text: 'Cancel', style: 'cancel'},
          {text: 'Go to Settings', onPress: openAccessibilitySettings},
        ],
        {cancelable: true},
      );
    }
  };

  const insertPlaceholder = placeholder => {
    setMessage(prev => `${prev} {{${placeholder}}} `);
  };

  const pickMedia = () => {
    launchImageLibrary(
      {
        mediaType: 'mixed',
        selectionLimit: 1,
      },
      res => {
        if (!res.didCancel && res.assets && res.assets.length > 0) {
          setMedia(res.assets[0]);
        }
      },
    );
  };

  const handleSend = () => {
    if (!message.trim()) {
      Alert.alert('Message Required', 'Please enter a message.');
      return;
    }

    navigation.navigate('CampaignSelectionScreen', {
      message,
      media,
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Compose Message</Text>

      <TextInput
        style={styles.input}
        multiline
        placeholder="Type your message here..."
        value={message}
        onChangeText={setMessage}
      />

      <View style={styles.placeholderRow}>
        <TouchableOpacity
          style={styles.placeholderButton}
          onPress={() => insertPlaceholder('name')}>
          <Text style={styles.placeholderText}>+ Name</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.placeholderButton}
          onPress={() => insertPlaceholder('phone')}>
          <Text style={styles.placeholderText}>+ Phone</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.mediaButton} onPress={pickMedia}>
        <Icon name="attachment" size={22} color="#4F46E5" />
        <Text style={{marginLeft: 6, color: '#4F46E5'}}>Attach Media</Text>
      </TouchableOpacity>

      {media && (
        <View style={styles.preview}>
          <Image source={{uri: media.uri}} style={styles.previewImage} />
          <Text numberOfLines={1}>{media.fileName}</Text>
        </View>
      )}

      <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
        <Text style={styles.sendButtonText}>Send Message</Text>
      </TouchableOpacity>
    </View>
  );
};

export default BulkMessagingScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
  },
  header: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  placeholderRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  placeholderButton: {
    marginRight: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#E0E7FF',
    borderRadius: 6,
  },
  placeholderText: {
    color: '#4F46E5',
    fontWeight: 'bold',
  },
  mediaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  preview: {
    marginBottom: 16,
  },
  previewImage: {
    width: 100,
    height: 100,
    borderRadius: 10,
  },
  sendButton: {
    backgroundColor: '#4F46E5',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  sendButtonText: {
    color: 'white',
    fontWeight: '600',
  },
});

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
  FlatList,
} from 'react-native';
import {launchImageLibrary} from 'react-native-image-picker';
import {openAccessibilitySettings} from '../../util/AccessibilityService';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const BulkMessagingScreen = ({navigation, route}) => {
  const {campaign} = route.params;
  const [inputMessage, setInputMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [media, setMedia] = useState(null);

  const [editingIndex, setEditingIndex] = useState(null);

  useEffect(() => {
    checkAccessibilityPermission();
  }, []);

  // Add or update message
  const addMessage = () => {
    const trimmed = inputMessage.trim();
    if (!trimmed) return;

    if (editingIndex !== null) {
      const updated = [...messages];
      updated[editingIndex] = trimmed;
      setMessages(updated);
      setEditingIndex(null);
    } else {
      if (messages.length >= 3) {
        Alert.alert('Limit Reached', 'You can only add up to 3 messages.');
        return;
      }
      setMessages([...messages, trimmed]);
    }

    setInputMessage('');
  };

  // Edit message
  const editMessage = index => {
    setInputMessage(messages[index]);
    setEditingIndex(index);
  };

  // Delete message
  const deleteMessage = index => {
    const updated = [...messages];
    updated.splice(index, 1);
    setMessages(updated);
    if (editingIndex === index) {
      setInputMessage('');
      setEditingIndex(null);
    }
  };

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
    setInputMessage(prev => `${prev} {{${placeholder}}} `);
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

  const handleAddMessage = () => {
    if (!inputMessage.trim()) {
      Alert.alert('Message Required', 'Please type a message to add.');
      return;
    }
    if (messages.length >= 3) {
      Alert.alert('Limit Reached', 'You can only add up to 3 messages.');
      return;
    }
    setMessages([...messages, inputMessage.trim()]);
    setInputMessage('');
  };

  const handleSend = () => {
    if (messages.length === 0) {
      Alert.alert('No Messages', 'Please add at least one message.');
      return;
    }

    navigation.navigate('ContactFilterScreen', {
      message: messages,
      media,
      campaign,
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Compose Message</Text>

      {messages.map((msg, index) => (
        <View key={index} style={styles.messageBubble}>
          <Text style={styles.messageText}>{msg}</Text>
          <View style={styles.iconGroup}>
            <TouchableOpacity onPress={() => editMessage(index)}>
              <Icon
                name="pencil-outline"
                size={18}
                color="#4F46E5"
                style={styles.icon}
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => deleteMessage(index)}>
              <Icon
                name="trash-can-outline"
                size={18}
                color="#EF4444"
                style={styles.icon}
              />
            </TouchableOpacity>
          </View>
        </View>
      ))}

      <TextInput
        style={styles.input}
        multiline
        placeholder="Type your message here..."
        value={inputMessage}
        onChangeText={setInputMessage}
      />
      <TouchableOpacity style={styles.addButton} onPress={addMessage}>
        <Text style={styles.addButtonText}>
          {editingIndex !== null ? 'Update Message' : 'Add Message'}
        </Text>
      </TouchableOpacity>

      {/* <TouchableOpacity style={styles.addButton} onPress={handleAddMessage}>
          <Text style={styles.addButtonText}>+ Add Message</Text>
        </TouchableOpacity> */}

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
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 8,
  },
  chatBubble: {
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    alignSelf: 'flex-end',
    maxWidth: '90%',
  },
  addButton: {
    backgroundColor: '#E0E7FF',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  addButtonText: {
    color: '#4F46E5',
    fontWeight: 'bold',
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
  messageBubble: {
    backgroundColor: '#EEF2FF',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  messageText: {
    flex: 1,
    color: '#111827',
  },
  iconGroup: {
    flexDirection: 'row',
    marginLeft: 10,
  },
  icon: {
    marginLeft: 8,
  },
  addButton: {
    backgroundColor: '#E0E7FF',
    padding: 10,
    borderRadius: 6,
    marginBottom: 10,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#4F46E5',
    fontWeight: '600',
  },
});

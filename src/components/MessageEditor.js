import React, {useState} from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const MessageEditorModal = ({
  isModalVisible,
  setIsModalVisible,
  initialMessages,
  campaign,
  handleSave,
  templateList,
}) => {
  const [inputMessage, setInputMessage] = useState('');
  const [messages, setMessages] = useState(initialMessages);
  const [media, setMedia] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  console.log('initial message', messages);
  const parsedFields = [
    'name',
    'phone',
    ...JSON.parse(campaign?.extra_fields || '[]'),
  ];
  const editMessage = index => {
    setInputMessage(messages[index]);
    setEditingIndex(index);
  };

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
      console.log('messages final', messages);
    }

    setInputMessage('');
  };
  const insertPlaceholder = placeholder => {
    setInputMessage(prev => `${prev} {{${placeholder}}} `);
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
  return (
    <Modal visible={isModalVisible} animationType="slide">
      <View style={styles.container}>
        <Text style={styles.title}>Edit Messages</Text>

        <ScrollView contentContainerStyle={styles.messageList}>
          {messages.map((msg, index) => (
            <View key={index} style={styles.messageBubble}>
              <Text style={styles.messageText}>{msg}</Text>
              <View style={styles.iconGroup}>
                <TouchableOpacity onPress={() => editMessage(index)}>
                  <Icon
                    name="pencil-outline"
                    size={20}
                    color="#4F46E5"
                    style={styles.icon}
                  />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => deleteMessage(index)}>
                  <Icon
                    name="trash-can-outline"
                    size={20}
                    color="#EF4444"
                    style={styles.icon}
                  />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>

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

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.placeholderRow}>
          {parsedFields.map((field, index) => (
            <TouchableOpacity
              key={index}
              style={styles.placeholderButton}
              onPress={() => insertPlaceholder(field)}>
              <Text style={styles.placeholderText}>
                + {field.charAt(0).toUpperCase() + field.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <TouchableOpacity
          style={styles.sendButton}
          onPress={() => handleSave(messages)}>
          <Text style={styles.sendButtonText}>Save</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setIsModalVisible(false)}
          style={styles.cancelButton}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

export default MessageEditorModal;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    paddingTop: 48,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  messageList: {
    paddingBottom: 20,
  },
  messageBubble: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 12,
    marginVertical: 6,
    position: 'relative',
  },
  messageText: {
    fontSize: 16,
    color: '#111827',
  },
  iconGroup: {
    position: 'absolute',
    right: 8,
    top: 8,
    flexDirection: 'row',
  },
  icon: {
    marginLeft: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    marginTop: 16,
    textAlignVertical: 'top',
    minHeight: 100,
  },
  addButton: {
    backgroundColor: '#4F46E5',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  addButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 16,
  },
  placeholderRow: {
    flexDirection: 'row',
    marginVertical: 16,
  },
  placeholderButton: {
    backgroundColor: '#E5E7EB',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginRight: 8,
  },
  placeholderText: {
    fontSize: 14,
    color: '#374151',
  },
  sendButton: {
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: 8,
    marginBottom: 12,
  },
  sendButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 16,
  },
  cancelButton: {
    paddingVertical: 12,
  },
  cancelButtonText: {
    color: '#6B7280',
    textAlign: 'center',
    fontSize: 16,
  },
});

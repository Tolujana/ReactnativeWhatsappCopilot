import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  Image,
  FlatList,
  useWindowDimensions,
} from 'react-native';
import {Text as PaperText, useTheme} from 'react-native-paper';
import {launchImageLibrary} from 'react-native-image-picker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Header from '../../components/Header';
import {getCampaigns} from '../../util/data';
import {BannerAd, BannerAdSize} from 'react-native-google-mobile-ads';

const BulkMessagingScreen = ({navigation, route, toggleTheme}) => {
  const theme = useTheme();
  const {width} = useWindowDimensions();
  const {campaign, prefillMessages} = route.params;
  const [inputMessage, setInputMessage] = useState('');
  const [messages, setMessages] = useState(prefillMessages);
  const [media, setMedia] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);

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

  const handleSend = async () => {
    if (messages.length === 0) {
      Alert.alert('No Messages', 'Please add at least one message.');
      return;
    }

    navigation.navigate('Contact Selection', {
      message: messages,
      media,
      campaign,
    });
  };

  return (
    <View
      style={[styles.container, {backgroundColor: theme.colors.background}]}>
      <Header toggleTheme={toggleTheme} showBackButton={true} />
      <View style={styles.bannerContainer}>
        <BannerAd
          unitId="ca-app-pub-3940256099942544/6300978111"
          size={BannerAdSize.BANNER}
        />
      </View>
      <PaperText style={[styles.header, {color: theme.colors.onSurface}]}>
        Compose Message
      </PaperText>

      {messages.map((msg, index) => (
        <View
          key={index}
          style={[
            styles.messageBubble,
            {backgroundColor: theme.colors.elevation.level1},
          ]}>
          <Text style={[styles.messageText, {color: theme.colors.onSurface}]}>
            {msg}
          </Text>
          <View style={styles.iconGroup}>
            <TouchableOpacity onPress={() => editMessage(index)}>
              <Icon
                name="pencil-outline"
                size={18}
                color={theme.colors.primary}
                style={styles.icon}
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => deleteMessage(index)}>
              <Icon
                name="trash-can-outline"
                size={18}
                color={theme.colors.error}
                style={styles.icon}
              />
            </TouchableOpacity>
          </View>
          <View
            style={[
              styles.bubbleTail,
              {borderTopColor: theme.colors.elevation.level1},
            ]}
          />
        </View>
      ))}

      <TextInput
        style={[
          styles.input,
          {
            borderColor: theme.colors.outline,
            backgroundColor: theme.colors.surface,
            color: theme.colors.onSurface,
          },
        ]}
        multiline
        placeholder="Type your message here..."
        placeholderTextColor={theme.colors.onSurfaceVariant}
        value={inputMessage}
        onChangeText={setInputMessage}
      />
      <TouchableOpacity
        style={[
          styles.addButton,
          {backgroundColor: theme.colors.primaryContainer},
        ]}
        onPress={addMessage}>
        <Text
          style={[
            styles.addButtonText,
            {color: theme.colors.onPrimaryContainer},
          ]}>
          {editingIndex !== null ? 'Update Message' : 'Add Message'}
        </Text>
      </TouchableOpacity>

      <View style={styles.placeholderRow}>
        {['name', 'phone', ...(JSON.parse(campaign?.extra_fields) || [])].map(
          (field, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.placeholderButton,
                {backgroundColor: theme.colors.secondaryContainer},
              ]}
              onPress={() => insertPlaceholder(field)}>
              <Text
                style={[
                  styles.placeholderText,
                  {color: theme.colors.onSecondaryContainer},
                ]}>
                + {field.charAt(0).toUpperCase() + field.slice(1)}
              </Text>
            </TouchableOpacity>
          ),
        )}
      </View>
      <View style={styles.bannerContainer}>
        <BannerAd
          unitId="ca-app-pub-3940256099942544/6300978111"
          size={BannerAdSize.BANNER}
        />
      </View>
      <TouchableOpacity style={styles.mediaButton} onPress={pickMedia}>
        <Icon name="attachment" size={22} color={theme.colors.primary} />
        <Text style={{marginLeft: 6, color: theme.colors.primary}}>
          Attach Media
        </Text>
      </TouchableOpacity>

      {media && (
        <View style={styles.preview}>
          <Image source={{uri: media.uri}} style={styles.previewImage} />
          <Text style={{color: theme.colors.onSurface}} numberOfLines={1}>
            {media.fileName}
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.sendButton, {backgroundColor: theme.colors.primary}]}
        onPress={handleSend}>
        <Text style={[styles.sendButtonText, {color: theme.colors.onPrimary}]}>
          Next
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default BulkMessagingScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 8,
  },
  messageBubble: {
    padding: 10,
    borderRadius: 20,
    marginBottom: 8,
    maxWidth: '80%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    alignSelf: 'flex-end',
  },
  messageText: {
    flex: 1,
  },
  iconGroup: {
    flexDirection: 'row',
    marginLeft: 10,
  },
  icon: {
    marginLeft: 8,
  },
  addButton: {
    padding: 10,
    borderRadius: 6,
    marginBottom: 10,
    alignItems: 'center',
  },
  addButtonText: {
    fontWeight: '600',
  },
  placeholderRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  placeholderButton: {
    marginRight: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  placeholderText: {
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
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  sendButtonText: {
    fontWeight: '600',
  },
  bubbleTail: {
    position: 'absolute',
    right: -6,
    bottom: 0,
    width: 0,
    height: 0,
    borderTopWidth: 10,
    borderLeftWidth: 10,
    borderLeftColor: 'transparent',
  },
  bannerContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
});

import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  DeviceEventEmitter,
} from 'react-native';
import CheckBox from '@react-native-community/checkbox'; // Or your preferred checkbox lib
import {launchWhatsappMessage} from '../../util/WhatsappHelper'; // You'll create this helper
import {getContactsByCampaignId} from '../../util/database';
import {NativeModules} from 'react-native';

const {WhatsappServiceModule} = NativeModules;

const ContactFilterScreen = ({navigation, route}) => {
  const {campaign, message, media} = route.params;
  const [contacts, setContacts] = useState([]);
  const [selectedContacts, setSelectedContacts] = useState({});

  const launchWhatsappMessage = (contacts, whatsappType) => {
    WhatsappServiceModule.startSendingMessages(
      JSON.stringify(contacts),
      whatsappType, //
    );
  };

  useEffect(() => {
    getContactsByCampaignId(campaign.id, loadedContacts => {
      setContacts(loadedContacts);
      const selectedMap = {};
      loadedContacts.forEach(contact => {
        selectedMap[contact.id] = true;
      });
      setSelectedContacts(selectedMap);
    });
  }, [campaign.id]);

  const toggleSelect = contactId => {
    setSelectedContacts(prev => ({
      ...prev,
      [contactId]: !prev[contactId],
    }));
  };

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(
      'onMessageSendReport',
      report => {
        console.log('WhatsApp sending finished:', report);
        Alert.alert(
          'Messages Sent',
          `Successfully sent ${report.sent_count} of ${report.total} messages.`,
        );
      },
    );

    return () => subscription.remove();
  }, []);

  const handleSendMessages = () => {
    const contactsToSend = contacts.filter(
      contact => selectedContacts[contact.id],
    );

    if (contactsToSend.length === 0) {
      Alert.alert('No Contacts', 'Please select at least one contact.');
      return;
    }

    function replaceContactPlaceholders(template, contact) {
      return template
        .replace(/{{name}}/g, contact.name || '')
        .replace(/{{phone}}/g, contact.phone || '')
        .replace(
          /{{title}}/g,
          contact.title ? contact.title : contact.name || '',
        );
    }

    const personalizedMessages = contactsToSend.map(contact => ({
      phone: contact.phone,
      message: replaceContactPlaceholders(message, contact),
      mediaPath: contact.mediaPath, // supports per-contact mediaPath fallback
    }));
    console.log('this is persona', personalizedMessages);
    // Assuming `launchWhatsappMessage` expects (array of {phone, message, mediaPath}, type)
    launchWhatsappMessage(personalizedMessages, 'com.Whatsapp');
  };

  const renderContact = ({item}) => (
    <View style={styles.contactItem}>
      <CheckBox
        value={selectedContacts[item.id]}
        onValueChange={() => toggleSelect(item.id)}
      />
      <Text style={styles.contactText}>
        {item.name} ({item.phone})
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Select Contacts</Text>
      <FlatList
        data={contacts}
        keyExtractor={item => item.id.toString()}
        renderItem={renderContact}
        ListEmptyComponent={<Text>No contacts found.</Text>}
      />

      <TouchableOpacity style={styles.sendButton} onPress={handleSendMessages}>
        <Text style={styles.sendButtonText}>Send Messages</Text>
      </TouchableOpacity>
    </View>
  );
};

export default ContactFilterScreen;

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
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  contactText: {
    marginLeft: 10,
    fontSize: 16,
  },
  sendButton: {
    backgroundColor: '#4F46E5',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  sendButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});

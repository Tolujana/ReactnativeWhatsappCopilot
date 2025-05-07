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
import useWhatsappReportListener from '../../util/UseWhatsappReporter';

const ContactFilterScreen = ({navigation, route}) => {
  const {campaign, message, media} = route.params;
  const [contacts, setContacts] = useState([]);
  const [selectedContacts, setSelectedContacts] = useState({});

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

  // useWhatsappReportListener();

  // useEffect(() => {
  //   const subscription = DeviceEventEmitter.addListener(
  //     'onMessageSendReport',
  //     report => {
  //       console.log('WhatsApp sending finished:', report);
  //       Alert.alert(
  //         'Messages Sent',
  //         `Successfully sent ${report.sent_count} of ${report.total} messages.`,
  //       );
  //     },
  //   );

  //   return () => subscription.remove();
  // }, []);

  // useEffect(() => {
  //   const subscription = DeviceEventEmitter.addListener(
  //     'com.copilot3.WHATSAPP_RESULT',
  //     report => {
  //       console.log('WhatsApp sending finished:', report);
  //       const successfulContacts = JSON.parse(report.success_list);
  //       Alert.alert(
  //         'Messages Sent',
  //         `Successfully sent ${successfulContacts.length} messages.`,
  //       );
  //     },
  //   );

  //   return () => subscription.remove();
  // }, []);

  const handleSendMessages = () => {
    const contactsToSend = contacts.filter(
      contact => selectedContacts[contact.id],
    );
    console.log('this is the format', contactsToSend);
    if (contactsToSend.length === 0) {
      Alert.alert('No Contacts', 'Please select at least one contact.');
      return;
    }

    function replaceContactPlaceholders2(template, contact) {
      return template
        .replace(/{{name}}/g, contact.name || '')
        .replace(/{{phone}}/g, contact.phone || '')
        .replace(
          /{{title}}/g,
          contact.title ? contact.title : contact.name || '',
        );
    }

    function replaceContactPlaceholders3(template, contact) {
      //const segments = template.split('----'); // Split by delimiter or just one element
      return template.map(segment =>
        segment
          .replace('{{name}}', contact.name || '')
          .replace('{{phone}}', contact.phone || '')
          .replace('{{title}}', contact.title || contact.name || '')
          .trim(),
      );
    }

    function replaceContactPlaceholders(template, contact) {
      const replacements = {
        '{{name}}': contact.name || '',
        '{{phone}}': contact.phone || '',
      };

      if (contact.extra_field) {
        const extrafield = JSON.parse(contact.extra_field);
        Object.keys(extrafield).forEach(key => {
          replacements[`{{${key}}}`] = extrafield[key] || '';
        });
      }

      const delimiter = '$@#__DELIMITER__#@%';
      const joinedString = template.join(delimiter);

      if (joinedString.length > 1000) {
        Alert.alert(
          'Error',
          'Template string is too long. Please reduce the template size.',
        );
        return template; // or return an empty array, depending on your requirements
      }

      let replacedString = joinedString;
      Object.keys(replacements).forEach(placeholder => {
        replacedString = replacedString.replaceAll(
          placeholder,
          replacements[placeholder],
        );
      });

      return replacedString.split(delimiter).map(segment => segment.trim());
    }

    const personalizedMessages = contactsToSend.map(contact => ({
      phone: contact.phone,
      message: replaceContactPlaceholders(message, contact),
      name: contact.name,
      mediaPath: contact.mediaPath, // supports per-contact mediaPath fallback
    }));
    console.log('this is persona', personalizedMessages);
    // Assuming `launchWhatsappMessage` expects (array of {phone, message, mediaPath}, type)

    navigation.navigate('WhatsappResultScreen', {
      totalContacts: personalizedMessages,
    });

    launchWhatsappMessage(personalizedMessages, 'com.whatsapp.w4b');
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

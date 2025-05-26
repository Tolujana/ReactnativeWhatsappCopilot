import React, {useCallback, useEffect, useState} from 'react';
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
import {Checkbox, DataTable} from 'react-native-paper';
import {MyDataTable} from '../../components/DataTable';
import MessageEditorModal from '../../components/MessageEditor';

const ContactFilterScreen = ({navigation, route}) => {
  const {campaign, message, media} = route.params;
  const [contacts, setContacts] = useState([]);
  const [selectedContacts, setSelectedContacts] = useState({});
  const [messages, setMessages] = useState([]); // default/global message array
  const [templateList, setTemplateList] = useState({}); // { contactId: [msg1, msg2, ...] }
  const [selectedEditorContacts, setSelectedEditorContacts] = useState([]); // contacts being edited
  const [editingMessages, setEditingMessages] = useState([]); // current messages sho
  const [isModalVisible, setIsModalVisible] = useState(false);
  const {AccessibilityHelper} = NativeModules;

  const openSettings = () => {
    AccessibilityHelper.openAccessibilitySettings();
  };

  const openEditorForContacts = contactsToEdit => {
    console.log(contactsToEdit, 'filer contacts');
    const baseMessages = templateList[contactsToEdit[0]] || message;
    console.log('editsmessage', baseMessages);
    setEditingMessages(baseMessages);
    setSelectedEditorContacts(contactsToEdit);
    setIsModalVisible(true);
  };

  useEffect(() => {
    getContactsByCampaignId(campaign.id, loadedContacts => {
      setContacts(loadedContacts);
      console.log('contactFilter-Loadedcontact', loadedContacts);
      const selectedMap = {};
      loadedContacts.forEach(contact => {
        selectedMap[contact.id] = true;
      });
      setSelectedContacts(selectedMap);
    });
  }, [campaign.id]);

  const toggleSelect1 = contactId => {
    setSelectedContacts(prev => ({
      ...prev,
      [contactId]: !prev[contactId],
    }));
  };
  const toggleSelect = useCallback(contactId => {
    if (!contactId) return;

    try {
      setSelectedContacts(prev => ({
        ...prev,
        [contactId]: !prev[contactId],
      }));
    } catch (error) {
      console.error('Error in toggleSelect:', error);
      Alert.alert('Toggle Error', error.message || 'Unknown error');
    }
  }, []);

  console.log('template', templateList);

  const checkAccessibilityPermission = async () => {
    // Note the format: package name + '/' + full service class name with leading dot
    const serviceId = 'com.copilot3/.WhatsAppAccessibilityService';
    try {
      const enabled = await AccessibilityHelper.isAccessibilityServiceEnabled(
        serviceId,
      );
      return enabled;
    } catch (e) {
      console.warn('Failed to check accessibility permission', e);
    }
  };

  const handleSendMessages = async () => {
    const enabled = await checkAccessibilityPermission();

    if (!enabled) {
      Alert.alert(
        'Permission Required',
        'Accessibility permissions are needed to send WhatsApp messages. Please enable the Accessibility Service for this app.',
        [
          {text: 'Cancel', style: 'cancel'},
          {text: 'Go to Settings', onPress: openSettings},
        ],
        {cancelable: true},
      );
    } else {
      const contactsToSend = contacts.filter(
        contact => selectedContacts[contact.id],
      );
      console.log('this is the format', contactsToSend);
      if (contactsToSend.length === 0) {
        Alert.alert('No Contacts', 'Please select at least one contact.');
        return;
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
            'Text is too long. Please reduce the message size.',
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
        message: replaceContactPlaceholders(
          templateList[contact.id] || messages,
          contact,
        ),
        name: contact.name,
        mediaPath: contact.mediaPath, // supports per-contact mediaPath fallback
      }));
      console.log('this is persona', personalizedMessages);
      // Assuming `launchWhatsappMessage` expects (array of {phone, message, mediaPath}, type)

      navigation.navigate('WhatsappResultScreen', {
        totalContacts: personalizedMessages,
      });

      launchWhatsappMessage(personalizedMessages, 'com.whatsapp.w4b');
    }
  };
  const renderContact1 = ({item}) => {
    if (!item || !item.id) return null;
    try {
      return (
        <View style={styles.contactItem}>
          <CheckBox
            value={!!selectedContacts[item.id]}
            onValueChange={() => toggleSelect(item.id)}
          />
          <Text style={styles.contactText}>
            {item.name} ({item.phone})
          </Text>
        </View>
      );
    } catch (error) {
      console.error('Render error for contact:', item, error);
      return <Text>Error rendering contact</Text>;
    }
  };
  const saveEditedMessages = () => {
    const updated = {...templateList};
    selectedEditorContacts.forEach(id => {
      updated[id] = editingMessages;
    });
    setTemplateList(updated);
    setSelectedEditorContacts([]);
    setEditingMessages([]);
  };

  const renderContact = ({item}) => {
    const isChecked = !!selectedContacts[item.id];

    return (
      <TouchableOpacity
        style={styles.contactItem}
        onPress={() => toggleSelect(item.id)}>
        <Checkbox
          status={isChecked ? 'checked' : 'unchecked'}
          onPress={() => toggleSelect(item.id)}
          color="#4F46E5"
        />
        <Text style={styles.contactText}>
          {item.name} ({item.phone})
        </Text>
      </TouchableOpacity>
    );
  };

  if (contacts.length === 0 || Object.keys(selectedContacts).length === 0) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Select Contacts</Text>
      {/* {MyDataTable(contacts, Object.keys(selectedContacts), toggleSelect)} */}

      <DataTable>
        <DataTable.Header style={styles.tableHeader}>
          <DataTable.Title style={{flex: 0.5}}>✔</DataTable.Title>
          <DataTable.Title style={{flex: 1}}>👤 Name</DataTable.Title>
          <DataTable.Title style={{flex: 2}}>📱 Number</DataTable.Title>
          <DataTable.Title style={{flex: 1.5}}>💬 edit Message</DataTable.Title>
        </DataTable.Header>

        {contacts.map(contact => {
          const isChecked = !!selectedContacts[contact.id];
          return (
            <DataTable.Row
              key={contact.id}
              onPress={() => toggleSelect(contact.id)}
              style={styles.row}>
              <DataTable.Cell style={{flex: 0.5}}>
                <Checkbox
                  status={isChecked ? 'checked' : 'unchecked'}
                  onPress={() => toggleSelect(contact.id)}
                  color="#4F46E5"
                />
              </DataTable.Cell>
              <DataTable.Cell style={{flex: 1}}>{contact.name}</DataTable.Cell>
              <DataTable.Cell style={{flex: 2}}>{contact.phone}</DataTable.Cell>
              <DataTable.Cell style={{flex: 1.5}}>
                {' '}
                <TouchableOpacity
                  onPress={() => openEditorForContacts([contact])}>
                  <Text style={{color: '#4F46E5'}}>✏️ EditMessage</Text>
                </TouchableOpacity>
              </DataTable.Cell>
            </DataTable.Row>
          );
        })}
      </DataTable>
      <TouchableOpacity
        style={styles.sendButton}
        onPress={() => openEditorForContacts(Object.keys(selectedContacts))}>
        <Text style={styles.sendButtonText}>Edit selected Messages</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.sendButton} onPress={handleSendMessages}>
        <Text style={styles.sendButtonText}>Send Messages</Text>
      </TouchableOpacity>
      {isModalVisible && (
        <MessageEditorModal
          isModalVisible={isModalVisible}
          setIsModalVisible={setIsModalVisible}
          setMessages={setEditingMessages}
          handleSave={saveEditedMessages}
          campaign={campaign}
          initialMessages={editingMessages}
        />
      )}
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

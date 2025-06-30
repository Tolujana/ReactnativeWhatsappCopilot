import React, {useCallback, useEffect, useState} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  DeviceEventEmitter,
  ScrollView,
} from 'react-native';
import CheckBox from '@react-native-community/checkbox'; // Or your preferred checkbox lib
import {
  checkAccessibilityPermission,
  checkOverlayPermission,
  launchWhatsappMessage,
  openOverlaySettings,
} from '../../util/WhatsappHelper'; // You'll create this helper
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
  const [needsHelp, setNeedsHelp] = useState(false);
  const [whatsappPackage, setWhatsappPackage] = useState('com.whatsapp');
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
  console.log('this is message', message);
  console.log('selectedContacts', selectedContacts);
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

  const handleSendMessages = async () => {
    const contactsToSend = contacts.filter(
      contact => selectedContacts[contact.id],
    );
    console.log('Filtered contacts:', contactsToSend);

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
        return template;
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
        templateList[contact.id] || message,
        contact,
      ),
      name: contact.name,
      mediaPath: contact.mediaPath,
    }));

    console.log('Personalized messages:', personalizedMessages);

    if (needsHelp) {
      const enabled = await checkAccessibilityPermission();

      if (!enabled) {
        Alert.alert(
          'Permission Required',
          'To use this assistive tool, Accessibility feature is required. kindly enable in settings.',
          [
            {text: 'Cancel', style: 'cancel'},
            {text: 'Go to Settings', onPress: openSettings},
          ],
          {cancelable: true},
        );
        return;
      }
      console.log('Accessibility permission granted');
      launchWhatsappMessage(personalizedMessages, whatsappPackage);
      navigation.navigate('WhatsappResultScreen', {
        totalContacts: personalizedMessages,
      });
    } else {
      const overlayGranted = await checkOverlayPermission();

      if (!overlayGranted) {
        Alert.alert(
          'Overlay Permission Required',
          'This feature requires overlay permission to show the floating button and helps controls the message delivery. Please enable it in your settings.',
          [
            {text: 'Cancel', style: 'cancel'},
            {text: 'Go to Settings', onPress: openOverlaySettings},
          ],
          {cancelable: true},
        );
        return;
      }

      Alert.alert(
        'Manual Mode',
        'You will have to tap "Send" button after message input.If you need assistance with this, kindly tick the checkbox above.',
        [
          {text: 'Cancel', style: 'cancel'},
          {
            text: 'Send Manually',
            onPress: () => {
              launchWhatsappMessage(personalizedMessages, whatsappPackage);
              navigation.navigate('WhatsappResultScreen', {
                totalContacts: personalizedMessages,
              });
            },
          },
        ],
      );
    }
  };

  const areAllSelected =
    contacts.length > 0 && contacts.every(c => selectedContacts[c.id]);
  const toggleSelectAll = () => {
    const updated = {};
    contacts.forEach(contact => {
      updated[contact.id] = !areAllSelected;
    });
    setSelectedContacts(updated);
  };

  const saveEditedMessages = input => {
    console.log(
      'saveEditedMessages called with input:',
      selectedEditorContacts,
    );
    const updated = {...templateList};
    selectedEditorContacts.forEach(id => {
      updated[id] = input;
    });
    setTemplateList(updated);

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
      <ScrollView
        style={{maxHeight: 400}}
        contentContainerStyle={{paddingBottom: 10}}>
        <DataTable>
          <DataTable.Header style={styles.tableHeader}>
            <DataTable.Title style={{flex: 0.5, justifyContent: 'center'}}>
              <View
                style={{
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 4,
                }}>
                <Checkbox
                  status={areAllSelected ? 'checked' : 'unchecked'}
                  onPress={toggleSelectAll}
                  color="#4F46E5"
                  style={{transform: [{scaleX: 0.9}, {scaleY: 0.9}]}} // optional resize
                />
              </View>
            </DataTable.Title>
            <DataTable.Title style={{flex: 1}}>👤 Name</DataTable.Title>
            <DataTable.Title style={{flex: 2}}>📱 Number</DataTable.Title>
            <DataTable.Title style={{flex: 1.5}}>
              💬 Edit Message
            </DataTable.Title>
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
                <DataTable.Cell style={{flex: 1}}>
                  {contact.name}
                </DataTable.Cell>
                <DataTable.Cell style={{flex: 2}}>
                  {contact.phone}
                </DataTable.Cell>
                <DataTable.Cell style={{flex: 1.5}}>
                  {' '}
                  <TouchableOpacity
                    onPress={() => openEditorForContacts([contact.id])}>
                    <Text style={{color: '#4F46E5'}}>✏️ Edit</Text>
                  </TouchableOpacity>
                </DataTable.Cell>
              </DataTable.Row>
            );
          })}
        </DataTable>
      </ScrollView>
      <TouchableOpacity
        style={styles.sendButton}
        onPress={() =>
          openEditorForContacts(
            Object.entries(selectedContacts)
              .filter(([_, value]) => value === true)
              .map(([key]) => key),
          )
        }>
        <Text style={styles.sendButtonText}>Edit selected Messages</Text>
      </TouchableOpacity>
      <View style={{marginTop: 16}}>
        <Text style={{fontWeight: 'bold', marginBottom: 4}}>
          Select WhatsApp Type
        </Text>
        <View style={{flexDirection: 'row', alignItems: 'center'}}>
          <TouchableOpacity
            style={{
              marginRight: 16,
              flexDirection: 'row',
              alignItems: 'center',
            }}
            onPress={() => setWhatsappPackage('com.whatsapp')}>
            <Checkbox
              status={
                whatsappPackage === 'com.whatsapp' ? 'checked' : 'unchecked'
              }
              onPress={() => setWhatsappPackage('com.whatsapp')}
              color="#4F46E5"
            />
            <Text style={{marginLeft: 4}}>Normal WhatsApp</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{flexDirection: 'row', alignItems: 'center'}}
            onPress={() => setWhatsappPackage('com.whatsapp.w4b')}>
            <Checkbox
              status={
                whatsappPackage === 'com.whatsapp.w4b' ? 'checked' : 'unchecked'
              }
              onPress={() => setWhatsappPackage('com.whatsapp.w4b')}
              color="#4F46E5"
            />
            <Text style={{marginLeft: 4}}>WhatsApp Business</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 16}}>
        <Checkbox
          status={needsHelp ? 'checked' : 'unchecked'}
          onPress={() => setNeedsHelp(!needsHelp)}
          color="#4F46E5"
        />
        <Text style={{marginLeft: 8, flexWrap: 'wrap'}}>
          I need additional help with sending messages (automated mode)
        </Text>
      </View>
      <TouchableOpacity style={styles.sendButton} onPress={handleSendMessages}>
        <Text style={styles.sendButtonText}>
          {needsHelp ? 'Send Messages' : 'Send Messages Manually'}
        </Text>
      </TouchableOpacity>
      {isModalVisible && (
        <MessageEditorModal
          isModalVisible={isModalVisible}
          setIsModalVisible={setIsModalVisible}
          setMessages={setEditingMessages}
          handleSave={saveEditedMessages}
          campaign={campaign}
          initialMessages={editingMessages}
          templateList={templateList}
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
  tableHeader: {
    backgroundColor: '#e0e0e0',
    height: 56, // Increase from default (approx 48)
    alignItems: 'center',
    paddingVertical: 0,
  },
});

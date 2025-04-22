import React, {useEffect, useState} from 'react';
import RNFS from 'react-native-fs';
import {
  View,
  FlatList,
  StyleSheet,
  PermissionsAndroid,
  Platform,
  Alert,
  TouchableOpacity,
} from 'react-native';
import {
  TextInput,
  Card,
  FAB,
  Portal,
  Provider,
  Text,
  Modal,
  Button,
  IconButton,
  DataTable,
  Checkbox,
} from 'react-native-paper';
import Contacts from 'react-native-contacts';
import {pick} from '@react-native-documents/picker';
import {
  deleteContact,
  deleteContacts,
  getContactsByCampaignId,
  insertContact,
  updateContact,
} from '../../util/database';
import ContactModal from '../../components/ContactModal';
import ContactTable from '../../components/ContactTable';
import {useNavigation} from '@react-navigation/native';
import MyFab from '../../components/MyFab';

export default function ContactSelectionScreen({route, campaignData}) {
  const {campaign} = route?.params || campaignData;
  const [contacts, setContacts] = useState([]);
  const [allContacts, setAllContacts] = useState([]);

  const [modalVisible, setModalVisible] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingContactId, setEditingContactId] = useState(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [extraFields, setExtraFields] = useState({});
  const [fabOpen, setFabOpen] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState({});
  const [initialModalData, setInitialModalData] = useState({});
  const [contactSelectorModalVisible, setContactSelectorModalVisible] =
    useState(false);
  useEffect(() => {
    fetchContacts();
  }, []);
  const toggleSelectContact = id => {
    setSelectedContacts(prev => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const isAnySelected = Object.values(selectedContacts).some(v => v);

  useEffect(() => {
    const fetchContacts = async () => {
      const permission = await requestContactsPermission();
      if (permission) {
        // also fixed the condition here
        Contacts.getAll().then(contacts => {
          setAllContacts(contacts);
        });
      }
    };
    fetchContacts();
  }, []);

  const fetchContacts = () => {
    getContactsByCampaignId(campaign.id, result => {
      console.log('Fetched contacts:', result); // Debug log
      setContacts([...result]); // Spread to ensure it's a new reference
    });
  };
  const getInvalidExtraFields = (fields, allowedKeys) => {
    return Object.keys(fields).filter(key => !allowedKeys.includes(key));
  };

  const showInvalidFieldsAlert = (invalidKeys, allowedKeys) => {
    Alert.alert(
      'Invalid Extra Fields Detected',
      `Invalid fields: ${invalidKeys.join(
        ', ',
      )}\n\nAllowed fields: ${allowedKeys.join(', ')}`,
      [{text: 'OK'}],
    );
  };

  const openAddModal = () => {
    setInitialModalData({});
    setIsEditMode(false);
    setEditingContactId(null);
    setModalVisible(true);
  };

  const openEditModal = contact => {
    setInitialModalData(contact);
    setIsEditMode(true);
    setEditingContactId(contact.id);
    setModalVisible(true);
  };

  const handleSaveContact = () => {
    if (!name || !phone) {
      Alert.alert('Missing Fields', 'Please enter both name and phone.');
      return;
    }
    console.log('thisn to insert', campaign.id, name, phone, extraFields);
    const invalidKeys = getInvalidExtraFields(
      extraFields,
      campaign.extraFields,
    );

    if (invalidKeys.length > 0) {
      showInvalidFieldsAlert(invalidKeys, campaign.extraFields);
      return;
    }

    if (isEditMode && editingContactId) {
      updateContact(editingContactId, name, phone, extraFields, () => {
        setModalVisible(false);
        resetForm();
        fetchContacts(); // Refresh the list
      });
    } else {
      insertContact(campaign.id, name, phone, extraFields, () => {
        setModalVisible(false);
        resetForm();
        fetchContacts(); // Refresh the list
        console.log('done');
      });
    }
  };

  const requestContactsPermission = async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
        {
          title: 'Contacts Permission',
          message: 'This app needs access to your contacts.',
          buttonPositive: 'OK',
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  };

  const handleModalSave = ({name, phone, extraFields}) => {
    if (!name || !phone) {
      Alert.alert('Missing Fields', 'Please enter both name and phone.');
      return;
    }

    const invalidKeys = getInvalidExtraFields(
      extraFields,
      campaign.extraFields,
    );
    if (invalidKeys.length > 0) {
      showInvalidFieldsAlert(invalidKeys, campaign.extraFields);
      return;
    }

    if (isEditMode && editingContactId) {
      updateContact(editingContactId, name, phone, extraFields, () => {
        setModalVisible(false);
        fetchContacts();
      });
    } else {
      insertContact(campaign.id, name, phone, extraFields, () => {
        setModalVisible(false);
        fetchContacts();
      });
    }
  };

  const handleImportFromContacts = async () => {
    const permission = await requestContactsPermission();
    if (!permission) {
      Alert.alert('Permission Denied', 'Cannot access contacts.');
      return;
    }
    setContactSelectorModalVisible(true);
  };

  const handleAddContacts = async contactsToAdd => {
    const insertions = contactsToAdd.map(c => {
      if (c.fullName && c.number) {
        return new Promise(resolve => {
          insertContact(campaign.id, c.fullName, c.number, () => resolve());
        });
      }
      return Promise.resolve();
    });

    await Promise.all(insertions);
    fetchContacts(); // Refresh the contact list
    setContactSelectorModalVisible(false);
  };

  // In your JSX

  const handleImportFromContacts3 = async () => {
    const permission = await requestContactsPermission();
    let deviceContacts = [];
    if (!permission) {
      Alert.alert('Permission Denied', 'Cannot access contacts.');
      return;
    }

    console.log('Fetching contacts...', Contacts);
    try {
      //const deviceContacts = await Contacts.getAll();

      console.log('fetchContacts', allContacts);
      const contactsWithPhone = allContacts.filter(
        c => c.phoneNumbers.length > 0,
      );

      const insertions = contactsWithPhone.map(c => {
        const fullName = `${c.givenName || ''} ${c.familyName || ''}`.trim();
        const number = c.phoneNumbers[0]?.number?.replace(/\s+/g, '') || '';
        if (fullName && number) {
          return new Promise(resolve => {
            insertContact(campaign.id, fullName, number, () => resolve());
          });
        }
        return Promise.resolve(); // Skip if data is missing
      });

      await Promise.all(insertions);
      fetchContacts(); // Refresh once after all insertions
    } catch (err) {
      console.log('Contacts error:', err);
    }
  };

  const handleImportFromContacts2 = async () => {
    const permission = await requestContactsPermission();
    if (!permission) {
      Alert.alert('Permission Denied', 'Cannot access contacts.');
      return;
    }

    try {
      const deviceContacts = await Contacts.getAll();
      const contactsWithPhone = deviceContacts.filter(
        c => c.phoneNumbers.length > 0,
      );

      const insertions = contactsWithPhone.map(c => {
        const fullName = `${c.givenName || ''} ${c.familyName || ''}`.trim();
        const number = c.phoneNumbers[0]?.number?.replace(/\s+/g, '') || '';
        if (fullName && number) {
          return new Promise(resolve => {
            insertContact(campaign.id, fullName, number, () => resolve());
          });
        }
        return Promise.resolve(); // Skip if data is missing
      });

      await Promise.all(insertions);
      fetchContacts(); // Refresh once after all insertions
    } catch (err) {
      console.log('Contacts error:', err);
    }
  };

  const handleImportFromCSV = async () => {
    try {
      const [res] = await pick({type: ['text/csv']});
      const content = await RNFS.readFile(res.uri, 'utf8');
      const lines = content.split('\n').filter(line => line.trim() !== '');

      lines.forEach(line => {
        const parts = line.split(',').map(p => p.trim());
        if (parts.length >= 2) {
          const [csvName, csvPhone, ...extras] = parts;
          const extraFields = {};
          extras.forEach((val, idx) => {
            extraFields[`field_${idx + 1}`] = val;
          });
          insertContact(
            campaign.id,
            csvName,
            csvPhone,
            extraFields,
            fetchContacts,
          );
        }
      });
    } catch (err) {
      if (err.code !== 'DOCUMENT_PICKER_CANCELED') {
        console.error('CSV Import Error:', err);
      }
    }
  };

  return (
    <Provider>
      <View style={{flex: 1, padding: 16}}>
        <ContactTable
          contacts={contacts}
          selectedContacts={selectedContacts}
          toggleSelectContact={toggleSelectContact}
          openEditModal={openEditModal}
          fetchContacts={fetchContacts}
        />
        <Portal>
          <ContactModal
            visible={modalVisible}
            onDismiss={() => setModalVisible(false)}
            onSave={handleModalSave}
            initialData={initialModalData}
            isEditMode={isEditMode}
            extraFieldsKeys={campaign.extraFields}
          />
          {fabOpen && (
            <>
              <FAB
                small
                icon="account-plus"
                label="Add Manually"
                style={[styles.fabOption, {bottom: 240}]}
                onPress={() => {
                  setFabOpen(false);
                  openAddModal();
                }}
              />
              <MyFab
                handleAddContacts={handleAddContacts}
                setFabOpen={setFabOpen}
                styling={styles.fabOption}
              />
              <FAB
                small
                icon="file-delimited"
                label="Import from CSV"
                style={[styles.fabOption, {bottom: 100}]}
                onPress={() => {
                  setFabOpen(false);
                  handleImportFromCSV();
                }}
              />
            </>
          )}
          <FAB
            icon={fabOpen ? 'close' : 'plus'}
            style={styles.fab}
            onPress={() => setFabOpen(!fabOpen)}
            label={!fabOpen ? 'Add' : undefined}
          />
        </Portal>
      </View>
    </Provider>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
  fabOption: {
    position: 'absolute',
    right: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: 'white',
    padding: 20,
    margin: 20,
    borderRadius: 8,
  },
  tableHeader: {
    backgroundColor: '#eee',
  },
  deleteFab: {
    position: 'absolute',
    left: 16,
    bottom: 16,
    backgroundColor: 'red',
  },
});

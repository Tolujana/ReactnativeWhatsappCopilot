import React, {useCallback, useEffect, useState} from 'react';
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
import {useFocusEffect, useNavigation} from '@react-navigation/native';
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
  useFocusEffect(
    useCallback(() => {
      // This runs every time the screen is focused (comes into view)
      fetchContacts(); // Your function to load updated contact data
    }, []),
  );

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
      updateContact(
        editingContactId,
        name,
        phone,
        extraFields,
        isPhoneChanged,
        () => {
          setModalVisible(false);
          resetForm();
          fetchContacts(); // Refresh the list
        },
      );
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

  const handleModalSave1 = ({name, phone, extraFields}) => {
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
  const handleModalSave = async ({name, phone, extraFields}) => {
    console.log('Saving contact:', {name, phone, extraFields});
    if (!name || !phone) {
      Alert.alert('Missing Fields', 'Please enter both name and phone.');
      return;
    }

    const invalidKeys = getInvalidExtraFields(
      extraFields,
      JSON.parse(campaign.extra_fields),
      // campaign.extraFields,
    );
    if (invalidKeys.length > 0) {
      showInvalidFieldsAlert(invalidKeys, campaign.extraFields);
      return;
    }

    try {
      if (isEditMode && editingContactId) {
        const originalPhone = initialModalData.phone; // pass this in from state
        const isPhoneChanged = originalPhone !== phone;

        const result = await updateContact(
          editingContactId,
          name,
          phone,
          extraFields,
          isPhoneChanged,
        );
        if (result.status === 'duplicate') {
          Alert.alert(
            'Duplicate Phone Number',
            'This phone number already exists.',
          );
          return;
        }
      } else {
        const result = await insertContact(
          campaign.id,
          name,
          phone,
          extraFields,
        );
        if (result.status === 'duplicate') {
          Alert.alert(
            'Duplicate Phone Number',
            'This phone number already exists.',
          );
          return;
        }
      }

      setModalVisible(false);
      fetchContacts();
    } catch (err) {
      console.error('Save error:', err);
      Alert.alert('Error', 'Something went wrong while saving the contact.');
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

  const handleAddContacts1 = async contactsToAdd => {
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
  const handleAddContacts = async contactsToAdd => {
    const duplicatePhones = [];

    const insertions = contactsToAdd.map(c => {
      if (c.fullName && c.number) {
        return insertContact(campaign.id, c.fullName, c.number, {}).then(
          result => {
            if (result.status === 'duplicate') {
              duplicatePhones.push(c.number);
            }
          },
        );
      }
      return Promise.resolve();
    });

    await Promise.all(insertions);
    fetchContacts();
    setContactSelectorModalVisible(false);

    if (duplicatePhones.length > 0) {
      Alert.alert(
        'Duplicate Contacts Skipped',
        `These numbers already exist and were not imported:\n\n${duplicatePhones.join(
          '\n',
        )}`,
      );
    } else {
      Alert.alert('Success', 'Contacts added successfully.');
    }
  };

  // In your JSX

  // const handleImportFromCSV1 = async () => {
  //   try {
  //     const [res] = await pick({type: ['text/csv']});
  //     const content = await RNFS.readFile(res.uri, 'utf8');
  //     const lines = content.split('\n').filter(line => line.trim() !== '');

  //     lines.forEach(line => {
  //       const parts = line.split(',').map(p => p.trim());
  //       if (parts.length >= 2) {
  //         const [csvName, csvPhone, ...extras] = parts;
  //         const extraFields = {};
  //         extras.forEach((val, idx) => {
  //           extraFields[`field_${idx + 1}`] = val;
  //         });
  //         insertContact(
  //           campaign.id,
  //           csvName,
  //           csvPhone,
  //           extraFields,
  //           fetchContacts,
  //         );
  //       }
  //     });
  //   } catch (err) {
  //     if (err.code !== 'DOCUMENT_PICKER_CANCELED') {
  //       console.error('CSV Import Error:', err);
  //     }
  //   }
  // };

  const handleImportFromCSV1 = async () => {
    try {
      const [res] = await pick({
        type: [
          'text/csv',
          'application/csv',
          'text/comma-separated-values',
          'application/vnd.ms-excel', // for .csv on some Androids
          '*/*', // fallback
        ],
      });

      const fileExtension = res.name.split('.').pop().toLowerCase();
      if (fileExtension !== 'csv') {
        Alert.alert('Invalid File', 'Please select a valid .csv file.');
        return;
      }

      const content = await RNFS.readFile(res.uri, 'utf8');
      const lines = content.split('\n').filter(line => line.trim() !== '');

      const sanitizePhoneNumber = rawPhone => {
        const cleaned = rawPhone.trim().replace(/[^\d+]/g, ''); // remove everything except digits and +
        // Only keep the first + if it exists at the beginning
        return cleaned.startsWith('+')
          ? '+' + cleaned.slice(1).replace(/\+/g, '') // remove any extra +
          : cleaned.replace(/\+/g, ''); // if no leading +, remove all +
      };

      lines.forEach(line => {
        const parts = line.split(',').map(p => p.trim());
        if (parts.length >= 2) {
          const [csvName, csvPhone, ...extras] = parts;
          const sanitizedPhone = sanitizePhoneNumber(csvPhone);

          const extraFields = {};
          extras.forEach((val, idx) => {
            extraFields[`field_${idx + 1}`] = val;
          });

          insertContact(
            campaign.id,
            csvName,
            sanitizedPhone,
            extraFields,
            fetchContacts,
          );
        }
      });
    } catch (err) {
      if (err.code !== 'DOCUMENT_PICKER_CANCELED') {
        console.error('CSV Import Error:', err);
        Alert.alert(
          'Import Error',
          'An error occurred while importing the CSV file.',
        );
      }
    }
  };
  const handleImportFromCSV3 = async () => {
    try {
      const [res] = await pick({
        type: [
          'text/csv',
          'application/csv',
          'text/comma-separated-values',
          'application/vnd.ms-excel',
          '*/*',
        ],
      });

      const fileExtension = res.name.split('.').pop().toLowerCase();
      if (fileExtension !== 'csv') {
        Alert.alert('Invalid File', 'Please select a valid .csv file.');
        return;
      }

      const content = await RNFS.readFile(res.uri, 'utf8');
      const lines = content.split('\n').filter(line => line.trim() !== '');

      const sanitizePhoneNumber = rawPhone => {
        const cleaned = rawPhone.trim().replace(/[^\d+]/g, '');
        return cleaned.startsWith('+')
          ? '+' + cleaned.slice(1).replace(/\+/g, '')
          : cleaned.replace(/\+/g, '');
      };

      const duplicatePhones = [];

      const insertions = lines.map(async line => {
        const parts = line.split(',').map(p => p.trim());
        if (parts.length >= 2) {
          const [csvName, csvPhone, ...extras] = parts;
          const sanitizedPhone = sanitizePhoneNumber(csvPhone);

          const extraFields = {};
          extras.forEach((val, idx) => {
            extraFields[`field_${idx + 1}`] = val;
          });

          const result = await insertContact(
            campaign.id,
            csvName,
            sanitizedPhone,
            extraFields,
          );

          if (result.status === 'duplicate') {
            duplicatePhones.push(sanitizedPhone);
          }
        }
      });

      await Promise.all(insertions);
      fetchContacts();

      if (duplicatePhones.length > 0) {
        Alert.alert(
          'Duplicate Contacts Skipped',
          `The following numbers were already present and were not imported:\n\n${duplicatePhones.join(
            '\n',
          )}`,
        );
      } else {
        Alert.alert('Success', 'Contacts imported successfully.');
      }
    } catch (err) {
      if (err.code !== 'DOCUMENT_PICKER_CANCELED') {
        console.error('CSV Import Error:', err);
        Alert.alert(
          'Import Error',
          'An error occurred while importing the CSV file.',
        );
      }
    }
  };

  const handleImportFromCSV = async () => {
    try {
      const [res] = await pick({
        type: [
          'text/csv',
          'application/csv',
          'text/comma-separated-values',
          'application/vnd.ms-excel',
          '*/*',
        ],
      });

      const fileExtension = res.name.split('.').pop().toLowerCase();
      if (fileExtension !== 'csv') {
        Alert.alert('Invalid File', 'Please select a valid .csv file.');
        return;
      }

      const content = await RNFS.readFile(res.uri, 'utf8');
      const lines = content.split('\n').filter(line => line.trim() !== '');

      if (lines.length < 2) {
        Alert.alert(
          'CSV Error',
          'The CSV file must contain headers and at least one data row.',
        );
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const duplicatePhones = [];

      const sanitizePhone = raw => {
        const cleaned = raw.trim().replace(/[^\d+]/g, '');
        return raw.trim().startsWith('+')
          ? '+' + cleaned.replace(/\+/g, '')
          : cleaned.replace(/\+/g, '');
      };

      const insertions = lines.slice(1).map(async line => {
        const parts = line.split(',').map(p => p.trim());

        if (parts.length >= 2) {
          const record = Object.fromEntries(
            headers.map((key, i) => [key, parts[i] || '']),
          );

          const name = record.name || '';
          const phone = sanitizePhone(record.phone || '');

          // Build extra fields (exclude name/phone)
          const extraFields = {};
          for (const [key, value] of Object.entries(record)) {
            if (key !== 'name' && key !== 'phone') {
              extraFields[key] = value;
            }
          }

          const result = await insertContact(
            campaign.id,
            name,
            phone,
            extraFields,
          );

          if (result.status === 'duplicate') {
            duplicatePhones.push(phone);
          }
        }
      });

      await Promise.all(insertions);
      fetchContacts();

      if (duplicatePhones.length > 0) {
        Alert.alert(
          'Duplicate Contacts Skipped',
          `The following numbers were already present and were not imported:\n\n${duplicatePhones.join(
            '\n',
          )}`,
        );
      } else {
        Alert.alert('Success', 'Contacts imported successfully.');
      }
    } catch (err) {
      if (err.code !== 'DOCUMENT_PICKER_CANCELED') {
        console.error('CSV Import Error:', err);
        Alert.alert(
          'Import Error',
          'An error occurred while importing the CSV file.',
        );
      }
    }
  };

  console.log('this is the campaing with extrafiled', campaign.extra_fields);
  return (
    <Provider>
      <View style={{flex: 1, padding: 1}}>
        <ContactTable
          contacts={contacts}
          selectedContacts={selectedContacts}
          toggleSelectContact={toggleSelectContact}
          openEditModal={openEditModal}
          fetchContacts={fetchContacts}
          extraFieldsKeys={JSON.parse(campaign.extra_fields)}
        />
        <Portal>
          <ContactModal
            visible={modalVisible}
            onDismiss={() => setModalVisible(false)}
            onSave={handleModalSave}
            initialData={initialModalData}
            isEditMode={isEditMode}
            extraFieldsKeys={JSON.parse(campaign.extra_fields)}
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
                campaign={campaign}
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

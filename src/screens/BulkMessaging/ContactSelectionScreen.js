import React, {useCallback, useEffect, useState} from 'react';
import RNFS from 'react-native-fs';
import {
  View,
  StyleSheet,
  PermissionsAndroid,
  Platform,
  Alert,
} from 'react-native';
import {pick} from '@react-native-documents/picker';
import {FAB, Portal, Provider, Button, useTheme} from 'react-native-paper';
import {
  deleteContacts,
  getContactsByCampaignId,
  insertContact,
  updateContact,
} from '../../util/data';
import ContactModal from '../../components/ContactModal';
import ContactTable from '../../components/ContactTable';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import MyFab from '../../components/MyFab';
import {BannerAd, BannerAdSize} from 'react-native-google-mobile-ads';
import Header from '../../components/Header';

export default function ContactSelectionScreen({
  route,
  campaignData,
  toggleTheme,
}) {
  const navigation = useNavigation(); // Add this hook
  const theme = useTheme();
  const {campaign} = route?.params || campaignData;
  const [contacts, setContacts] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingContactId, setEditingContactId] = useState(null);
  const [initialModalData, setInitialModalData] = useState({});
  const [fabOpen, setFabOpen] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState({});
  const [contactSelectorModalVisible, setContactSelectorModalVisible] =
    useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchContacts();
    }, []),
  );

  const fetchContacts = async () => {
    try {
      const result = await getContactsByCampaignId(campaign.id);
      setContacts(result);
    } catch (e) {}
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

  const handleModalSave = async ({name, phone, extraFields}) => {
    if (!name || !phone) {
      Alert.alert('Missing Fields', 'Please enter both name and phone.');
      return;
    }

    const invalidKeys = getInvalidExtraFields(
      extraFields,
      JSON.parse(campaign.extra_fields),
    );
    if (invalidKeys.length > 0) {
      showInvalidFieldsAlert(invalidKeys, campaign.extraFields);
      return;
    }

    try {
      if (isEditMode && editingContactId) {
        const originalPhone = initialModalData.phone;
        const isPhoneChanged = originalPhone !== phone;

        const result = await updateContact(
          editingContactId,
          name,
          phone,
          extraFields,
        );
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
      Alert.alert('Error', 'Something went wrong while saving the contact.');
    }
  };

  const handleDone = () => {
    // Navigate back to Home screen
    navigation.navigate('Main', {screen: 'Home'});
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

      const insertions = lines.slice(1).map(async (line, index) => {
        const parts = line.split(',').map(p => p.trim());

        if (parts.length >= 2) {
          const record = Object.fromEntries(
            headers.map((key, i) => [key, parts[i] || '']),
          );

          const name = record.name || '';
          const rawPhone = record.phone || record.number || '';

          if (!rawPhone.trim()) {
            throw new Error(`Missing phone number at row ${index + 2}`);
          }

          const phone = sanitizePhone(rawPhone);

          const extraFields = {};
          for (const [key, value] of Object.entries(record)) {
            if (!['name', 'phone', 'number'].includes(key)) {
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
        Alert.alert(
          'Import Error',
          err.message || 'An error occurred while importing the CSV file.',
        );
      }
    }
  };

  const styles = StyleSheet.create({
    fab: {
      position: 'absolute',
      right: 16,
      bottom: 60,
      backgroundColor: theme.colors.primary,
    },
    fabOption: {
      position: 'absolute',
      right: 16,
      backgroundColor: theme.colors.primary,
    },
    doneButtonContainer: {
      padding: 16,
      backgroundColor: theme.colors.surface,
      borderTopWidth: 1,
      borderTopColor: theme.colors.outline,
    },
    doneButton: {
      paddingVertical: 4,
      backgroundColor: theme.colors.primary,
    },
    doneButtonLabel: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.colors.onPrimary,
    },
    bannerContainer: {
      alignItems: 'center',
      marginVertical: 8,
      backgroundColor: theme.colors.surface,
    },
  });

  return (
    <Provider>
      {/* <Header toggleTheme={toggleTheme} /> */}
      <View
        style={{flex: 1, padding: 1, backgroundColor: theme.colors.background}}>
        <ContactTable
          contacts={contacts}
          selectedContacts={selectedContacts}
          toggleSelectContact={id =>
            setSelectedContacts(prev => ({...prev, [id]: !prev[id]}))
          }
          openEditModal={openEditModal}
          fetchContacts={fetchContacts}
          extraFieldsKeys={JSON.parse(campaign.extra_fields)}
        />
        {/* <View style={styles.bannerContainer}>
          <BannerAd
            unitId="ca-app-pub-3940256099942544/6300978111"
            size={BannerAdSize.BANNER}
          />
        </View> */}
        <View style={styles.doneButtonContainer}>
          <Button
            mode="contained"
            onPress={handleDone}
            style={styles.doneButton}
            labelStyle={styles.doneButtonLabel}>
            Done
          </Button>
        </View>
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

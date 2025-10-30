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
  checkDuplicatesAndReserveForImport,
  deductPointsForImport,
  deleteContacts,
  getContactsByCampaignId,
  insertContact,
  insertContactNoDeduction,
  showRewardedAd,
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
      const hasPermission = await requestContactsPermission();
      if (!hasPermission) {
        Alert.alert(
          'Permission Denied',
          'Contacts permission is required to save contacts.',
        );
        return;
      }
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
      console.error(err);
      if (String(err.code || err.message).includes('INSUFFICIENT_POINTS')) {
        Alert.alert(
          'Not enough points',
          'Watch a rewarded ad to earn points and continue?',
          [
            {text: 'Cancel', style: 'cancel'},
            {
              text: 'Watch Ad',
              onPress: async () => {
                try {
                  const reward = await showRewardedAd();
                  Alert.alert(
                    'Points earned!',
                    `You earned ${reward.amount || reward} points. Retrying...`,
                  );
                  await tryInsert();
                } catch (adErr) {
                  Alert.alert('Ad failed', String(adErr?.message || adErr));
                }
              },
            },
          ],
        );
      } else {
        Alert.alert('Error', 'Something went wrong while saving the contact.');
      }
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

  const handleImportFromCSV1 = async () => {
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

  const handleImportFromCSV = async () => {
    // Hoist sanitizePhone for full scope
    const sanitizePhone = raw => {
      const cleaned = raw.trim().replace(/[^\d+]/g, '');
      return raw.trim().startsWith('+')
        ? '+' + cleaned.replace(/\+/g, '')
        : cleaned.replace(/\+/g, '');
    };

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

      // Pre-parse to extract and sanitize phones (for duplicate check & count)
      const potentialPhones = [];

      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',').map(p => p.trim());
        if (parts.length >= 2) {
          const record = Object.fromEntries(
            headers.map((key, idx) => [key, parts[idx] || '']),
          );
          const rawPhone = record.phone || record.number || '';
          if (rawPhone.trim()) {
            const phone = sanitizePhone(rawPhone);
            if (phone) potentialPhones.push(phone); // Only add valid phones
          }
        }
      }

      if (potentialPhones.length === 0) {
        Alert.alert('CSV Error', 'No valid phone numbers found in the CSV.');
        return;
      }

      // NEW: Define performImport FIRST (before reserve, for closure access)
      const performImport = async reserveResult => {
        console.log('performImport starting...'); // Debug log
        const duplicatePhones = [];
        let successCount = 0;
        const insertions = lines.slice(1).map(async (line, index) => {
          const parts = line.split(',').map(p => p.trim());

          if (parts.length >= 2) {
            const record = Object.fromEntries(
              headers.map((key, i) => [key, parts[i] || '']),
            );

            const name = record.name || '';
            const rawPhone = record.phone || record.number || '';

            if (!rawPhone.trim()) {
              return; // Skip invalid
            }

            const phone = sanitizePhone(rawPhone);

            const extraFields = {};
            for (const [key, value] of Object.entries(record)) {
              if (!['name', 'phone', 'number'].includes(key)) {
                extraFields[key] = value;
              }
            }

            try {
              const result = await insertContactNoDeduction(
                campaign.id,
                name,
                phone,
                extraFields,
              );

              if (result.status === 'duplicate') {
                duplicatePhones.push(phone);
              } else {
                successCount++;
                console.log(`Row ${index} inserted successfully: ${phone}`); // Per-row log
              }
            } catch (insertErr) {
              console.error(`Insert failed for row ${index}:`, insertErr);
              // Continue with others; don't fail whole batch
            }
          }
        });

        await Promise.all(insertions);
        fetchContacts(); // Refresh UI

        console.log(
          'performImport ending: successCount=',
          successCount,
          'duplicates=',
          duplicatePhones.length,
        ); // Debug log

        // Check if import mostly succeeded (e.g., at least 1 new)
        const importedCount = reserveResult.newCount - duplicatePhones.length;
        if (importedCount > 0) {
          Alert.alert(
            'Import Partial Success',
            `Imported ${importedCount} new contacts (some skips/errors).`,
          );
          return true; // Proceed to deduct
        } else {
          Alert.alert('Import Failed', 'Some contact(s) were not imported.');
          return true; // No deduct
        }
      };

      // Pre-calculate: Check duplicates & RESERVE (dry-run, no deduct yet)
      try {
        console.log('Starting reserve check...'); // Debug log
        // FIXED: Pass deduct: false for dry-run check only
        const reserveResult = await checkDuplicatesAndReserveForImport(
          potentialPhones,
          campaign.id,
          false, // Dry-run (no deduct; native supports default true)
        );
        console.log('Reserve check result:', reserveResult); // Debug log

        // FIXED: Define proceedWithImport BEFORE Alert (full func, passes performImport)
        const proceedWithImport = async () => {
          console.log('Continue tapped - starting import'); // Debug log (confirms tap works)
          const importSuccess = await performImport(reserveResult); // Pass result
          if (importSuccess) {
            // Deduct ONLY after successful import
            try {
              console.log('Import success - deducting points...'); // Debug log
              await deductPointsForImport(reserveResult.cost); // Separate deduct call
              console.log('Deduct complete'); // Debug log
              Alert.alert(
                'Success',
                `Imported ${reserveResult.newCount} new contacts. Points deducted.`,
              );
            } catch (deductErr) {
              console.error('Deduct failed post-import:', deductErr);
              Alert.alert('Import OK', 'Contacts saved.');
            }
          }
        };

        Alert.alert(
          'Notice',
          `Ready to import ${reserveResult.newCount} new contacts (skipping ${
            reserveResult.duplicates
          } duplicates). Estimated cost: ${
            reserveResult.cost
          } points. Current balance: ${
            reserveResult.currentBalance || reserveResult.newBalance
          }.`,
          [
            {text: 'Cancel', style: 'cancel'},
            {text: 'Continue', onPress: proceedWithImport}, // Now fully defined
          ],
        );
      } catch (reserveErr) {
        console.error('Reserve check failed:', reserveErr);
        if (reserveErr.code === 'INSUFFICIENT_POINTS') {
          Alert.alert(
            'Not Enough Points',
            `${reserveErr.message}\nWatch a rewarded ad to earn points?`,
            [
              {text: 'Cancel', style: 'cancel'},
              {
                text: 'Watch Ad',
                onPress: async () => {
                  try {
                    const reward = await showRewardedAd();
                    await fetchPoints(); // Refresh points (ensure defined)
                    Alert.alert(
                      'Points Earned!',
                      `+${reward.amount} points. New balance: ${reward.balance}. Try importing again.`,
                    );
                  } catch (adErr) {
                    Alert.alert(
                      'Ad Failed',
                      adErr.message || 'Could not earn points.',
                    );
                  }
                },
              },
            ],
          );
        } else {
          Alert.alert(
            'Reserve Error',
            reserveErr.message || 'Failed to check points.',
          );
        }
        return; // Stop import
      }
    } catch (err) {
      console.error('Overall import error:', err);
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
            unitId="ca-app-pub-7993847549836206/9152830275"
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

import React, {useEffect, useState} from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  FlatList,
  Alert,
} from 'react-native';
import {Text, Checkbox, Button} from 'react-native-paper';
import Contacts from 'react-native-contacts';
import {openPicker} from '../util/AccessibilityService';
import {insertContact, preloadRewardedAd, showRewardedAd} from '../util/data';

export default function ContactSelectScreen({navigation, route}) {
  const {campaign} = route.params;
  const [filteredContacts, setFilteredContacts] = useState([]);
  const [selected, setSelected] = useState({});
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [allContacts, setAllContacts] = useState([]);
  const [permissionError, setPermissionError] = useState(false);
  console.log('this contactSelectionScreen campaign', campaign);
  useEffect(() => {
    setIsLoading(true);
    preloadRewardedAd();
    Contacts.checkPermission().then(permission => {
      if (permission === 'undefined' || permission === 'denied') {
        setPermissionError(true);
        setIsLoading(false);
        return;
      }

      Contacts.getAll()
        .then(contacts => {
          setAllContacts(contacts);
          setFilteredContacts(contacts);
          setIsLoading(false);
        })
        .catch(err => {
          console.warn('Failed to load contacts:', err);
          setIsLoading(false);
        });
    });
  }, []);

  const toggleSelect = (id, numberIndex) => {
    setSelected(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [numberIndex]: !prev[id]?.[numberIndex],
      },
    }));
  };

  const handleDone = async () => {
    const selectedContacts = allContacts
      .map(contact => {
        const name = formatContactName(contact);
        const selections = selected[contact.recordID];
        if (!selections) return null;

        const selectedNumbers = contact.phoneNumbers
          .filter((_, index) =>
            selections[-1] === true ? true : selections[index],
          )
          .map(p => p.number.replace(/\s+/g, ''));

        if (selectedNumbers.length === 0) return null;

        return selectedNumbers.map(number => ({
          fullName: name,
          number,
        }));
      })
      .filter(Boolean)
      .flat();

    let allInserted = true;

    const tryInsertContact = async contact => {
      try {
        console.log(
          '📩 Inserting:',
          campaign.id,
          contact.fullName,
          contact.number,
        );
        const result = await insertContact(
          campaign.id,
          contact.fullName,
          contact.number,
          {},
        );
        console.log('✅ Insert result:', result);
        return true;
      } catch (e) {
        const msg = String(e.code || e.message || '');
        if (msg.includes('INSUFFICIENT_POINTS')) {
          allInserted = false; // stop further inserts

          Alert.alert(
            'Not enough points',
            'Watch a rewarded ad to earn points and continue?',
            [
              {text: 'Cancel', style: 'cancel'},
              {
                text: 'Watch Ad',
                onPress: async () => {
                  try {
                    console.log('🎬 Showing ad...');
                    const reward = await showRewardedAd();
                    Alert.alert(
                      'Points earned!',
                      `You earned ${
                        reward.amount || reward
                      } points. Retrying...`,
                    );
                    await tryInsertContact(contact); // retry the failed one
                    await insertRemainingContacts(selectedContacts, contact); // retry the rest
                  } catch (adErr) {
                    Alert.alert('Ad failed', String(adErr?.message || adErr));
                  }
                },
              },
            ],
          );

          return false;
        } else {
          // Some other error — just log and continue
          return false;
        }
      }
    };

    const insertRemainingContacts = async (contacts, startFrom) => {
      const startIndex = contacts.findIndex(
        c => c.fullName === startFrom.fullName && c.number === startFrom.number,
      );
      const rest = contacts.slice(startIndex + 1);
      for (const c of rest) {
        await tryInsertContact(c);
      }

      // ✅ Refresh + close only after successful retry
      if (route.params.fetchContacts) {
        route.params.fetchContacts();
      }
      if (route.params.setContactSelectorModalVisible) {
        route.params.setContactSelectorModalVisible(false);
      }
      navigation.goBack();
    };

    // 👇 Insert contacts sequentially (so we can stop if out of points)
    for (const c of selectedContacts) {
      const success = await tryInsertContact(c);
      if (!success) break;
    }

    // ✅ If everything inserted successfully the first time, then navigate
    if (allInserted) {
      if (route.params.fetchContacts) {
        route.params.fetchContacts();
      }
      if (route.params.setContactSelectorModalVisible) {
        route.params.setContactSelectorModalVisible(false);
      }
      navigation.goBack();
    }
  };

  const requestContactsPermission = async () => {
    try {
      setIsLoading(true);
      const permission = await Contacts.requestPermission();

      if (permission === 'authorized') {
        // Permission granted, load contacts
        await loadContacts();
      } else {
        // Permission denied, show error and option to open settings
        setPermissionError(true);
        Alert.alert(
          'Permission Required',
          'Contacts permission is required to select contacts. Would you like to open app settings to enable it?',
          [
            {text: 'Cancel', style: 'cancel'},
            {
              text: 'Open Settings',
              onPress: () => {
                if (Platform.OS === 'ios') {
                  Linking.openURL('app-settings:');
                } else {
                  Linking.openSettings();
                }
              },
            },
          ],
        );
      }
    } catch (err) {
      console.warn('Error requesting contacts permission:', err);
      setPermissionError(true);
    } finally {
      setIsLoading(false);
    }
  };
  const openAppSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  };

  const renderPermissionDeniedView = () => (
    <View style={styles.permissionContainer}>
      <Text style={styles.errorText}>
        Permission denied. Please enable contacts permission.
      </Text>
      <Button
        mode="contained"
        onPress={requestContactsPermission}
        style={styles.permissionButton}>
        Request Permission
      </Button>
    </View>
  );

  const handleSearch = searchText => {
    setSearch(searchText);
    if (searchText.length === 0) {
      setFilteredContacts(allContacts);
    } else {
      const filtered = allContacts.filter(contact => {
        const name = formatContactName(contact).toLowerCase();
        return name.includes(searchText.toLowerCase());
      });
      setFilteredContacts(filtered);
    }
  };

  const formatContactName = contact => {
    return `${contact.givenName || ''} ${contact.familyName || ''}`.trim();
  };

  const renderItem = ({item: contact}) => {
    const name = `${contact.givenName || ''} ${
      contact.familyName || ''
    }`.trim();
    const selections = selected[contact.recordID] || {};

    return (
      <View style={styles.contactContainer}>
        <Text style={styles.contactName}>{name}</Text>

        {contact.phoneNumbers.map((phone, index) => {
          const number = phone.number;
          const isChecked = selections[index] || false;

          return (
            <View key={index} style={styles.row}>
              <Checkbox
                status={isChecked ? 'checked' : 'unchecked'}
                onPress={() => {
                  setSelected(prev => {
                    const current = prev[contact.recordID] || {};
                    return {
                      ...prev,
                      [contact.recordID]: {
                        ...current,
                        [index]: !current[index],
                      },
                    };
                  });
                }}
              />
              <Text>{number}</Text>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Select Contacts</Text>
      <TextInput
        style={styles.searchInput}
        placeholder="Search contacts..."
        value={search}
        onChangeText={handleSearch}
      />
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>
            Loading contacts...{'\n'} this could take up to 1 minute depending
            on your contact size
          </Text>
        </View>
      ) : permissionError ? (
        <View style={styles.loadingContainer}>
          {renderPermissionDeniedView()}
        </View>
      ) : (
        <FlatList
          data={filteredContacts}
          keyExtractor={item => item.recordID}
          renderItem={renderItem}
          ListEmptyComponent={
            <Text style={styles.placeholderText}>No contacts found.</Text>
          }
        />
      )}

      <Button mode="contained" onPress={handleDone} style={styles.doneBtn}>
        Done
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, padding: 20},
  header: {fontSize: 20, fontWeight: 'bold', marginBottom: 10},
  searchInput: {
    height: 40,
    borderColor: '#ccc',
    borderWidth: 1,
    paddingHorizontal: 10,
    marginBottom: 12,
    borderRadius: 8,
  },
  row: {flexDirection: 'row', alignItems: 'center', marginVertical: 8},
  contactDetails: {marginLeft: 10, flexDirection: 'column'},
  numberRow: {flexDirection: 'row', alignItems: 'center'},
  doneBtn: {marginTop: 20},
  placeholderText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginVertical: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: 'red',
    textAlign: 'center',
  },
  contactContainer: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomColor: '#ddd',
    borderBottomWidth: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
});

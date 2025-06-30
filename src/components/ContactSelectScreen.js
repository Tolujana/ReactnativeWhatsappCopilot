import React, {useEffect, useState} from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import {Text, Checkbox, Button} from 'react-native-paper';
import Contacts from 'react-native-contacts';
import {openPicker} from '../util/AccessibilityService';
import {insertContact} from '../util/database';

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

  const handleDone1 = () => {
    const selectedContacts = filteredContacts
      .filter(
        c =>
          selected[c.recordID] &&
          Object.values(selected[c.recordID]).includes(true),
      )
      .map(c => ({
        fullName: formatContactName(c),
        numbers: c.phoneNumbers
          .filter((_, index) => selected[c.recordID]?.[index])
          .map(phone => phone.number.replace(/\s+/g, '')),
      }));
    if (onDone) onDone(selectedContacts);
    navigation.goBack();
  };
  const handleDone2 = async () => {
    const selectedContacts = filteredContacts
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
      .flat(); // Flatten array of arrays

    // Insert into database before navigating back
    const insertions = allContacts.map(c => {
      if (c.fullName && c.number) {
        return new Promise(resolve => {
          insertContact(route.params.campaign.id, c.fullName, c.number, () =>
            resolve(),
          );
        });
      }
      return Promise.resolve();
    });

    await Promise.all(insertions);

    if (route.params.fetchContacts) {
      route.params.fetchContacts(); // Refresh contact list if passed in
    }

    if (route.params.setContactSelectorModalVisible) {
      route.params.setContactSelectorModalVisible(false);
    }

    navigation.goBack();
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
      .flat(); // Flatten array of arrays

    const insertions = selectedContacts.map(c => {
      if (c.fullName && c.number) {
        return new Promise(resolve => {
          try {
            console.log('things', campaign.id, c.fullName, c.number);
            insertContact(campaign.id, c.fullName, c.number, [], () =>
              resolve(),
            );
          } catch (e) {
            console.error('Insert failed:', e);
            resolve(); // Ensure it doesn’t block
          }
        });
      }
      return Promise.resolve();
    });

    await Promise.all(insertions);

    if (route.params.fetchContacts) {
      route.params.fetchContacts(); // Refresh contact list if passed in
    }

    if (route.params.setContactSelectorModalVisible) {
      route.params.setContactSelectorModalVisible(false);
    }

    navigation.goBack();
  };

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
          <Text style={styles.errorText}>
            Permission denied. Please enable contacts permission.
          </Text>
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

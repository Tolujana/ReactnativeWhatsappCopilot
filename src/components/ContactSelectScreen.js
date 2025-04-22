import React, {useEffect, useState} from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import {Text, Checkbox, Button} from 'react-native-paper';
import Contacts from 'react-native-contacts';

export default function ContactSelectScreen({navigation, route}) {
  const {onDone} = route.params;
  const [filteredContacts, setFilteredContacts] = useState([]);
  const [selected, setSelected] = useState({});
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const toggleSelect = id => {
    setSelected(prev => ({...prev, [id]: !prev[id]}));
  };

  const handleDone = () => {
    const selectedContacts = filteredContacts
      .filter(c => selected[c.recordID] && c.phoneNumbers.length > 0)
      .map(c => ({
        fullName: `${c.givenName || ''} ${c.familyName || ''}`.trim(),
        number: c.phoneNumbers[0]?.number?.replace(/\s+/g, '') || '',
      }));
    if (onDone) onDone(selectedContacts);
    navigation.goBack();
  };

  const handleSearch = searchText => {
    setSearch(searchText);
    if (searchText.length > 0) {
      setIsLoading(true);
      Contacts.getContactsMatchingString(searchText).then(contacts => {
        setFilteredContacts(contacts);
        setIsLoading(false);
      });
    } else {
      setFilteredContacts([]); // Clear contacts if search is empty
    }
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
      <ScrollView>
        {search.length === 0 && filteredContacts.length === 0 ? (
          <Text style={styles.placeholderText}>
            Start typing to see search results
          </Text>
        ) : isLoading ? (
          <ActivityIndicator style={{marginVertical: 10}} />
        ) : (
          filteredContacts.map(contact => {
            const name = `${contact.givenName || ''} ${
              contact.familyName || ''
            }`.trim();
            const number = contact.phoneNumbers[0]?.number || '';
            return (
              <View key={contact.recordID} style={styles.row}>
                <Checkbox
                  status={selected[contact.recordID] ? 'checked' : 'unchecked'}
                  onPress={() => toggleSelect(contact.recordID)}
                />
                <View>
                  <Text>{name}</Text>
                  <Text>{number}</Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
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
  doneBtn: {marginTop: 20},
  placeholderText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginVertical: 20,
  },
});

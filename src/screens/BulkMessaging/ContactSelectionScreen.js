import React, {useEffect, useState} from 'react';
import {View, FlatList} from 'react-native';
import {TextInput, Card, Text, FAB} from 'react-native-paper';
import {getContactsByCampaignId, insertContact} from '../../util/database';
//import {insertContact, getContactsByCampaignId} from './database';

export default function ContactSelectionScreen({route}) {
  const {campaignId} = route.params;
  const [contacts, setContacts] = useState([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = () => {
    getContactsByCampaignId(campaignId, setContacts);
  };

  const handleAddContact = () => {
    if (name && phone) {
      insertContact(campaignId, name, phone, () => {
        setName('');
        setPhone('');
        fetchContacts();
      });
    }
  };

  return (
    <View style={{flex: 1, padding: 16}}>
      <TextInput
        label="Name"
        value={name}
        onChangeText={setName}
        mode="outlined"
        style={{marginBottom: 10}}
      />
      <TextInput
        label="Phone"
        value={phone}
        onChangeText={setPhone}
        mode="outlined"
        keyboardType="phone-pad"
        style={{marginBottom: 20}}
      />

      <FAB
        icon="plus"
        onPress={handleAddContact}
        label="Add Contact"
        style={{marginBottom: 20}}
      />

      <FlatList
        data={contacts}
        keyExtractor={item => item.id.toString()}
        renderItem={({item}) => (
          <Card style={{marginBottom: 10}}>
            <Card.Title title={item.name} subtitle={item.phone} />
          </Card>
        )}
      />
    </View>
  );
}

import React, {useEffect, useState} from 'react';
import {View, FlatList} from 'react-native';
import {TextInput, Button, Card, Text} from 'react-native-paper';
import {
  getContactsByCampaignId,
  updateCampaign,
  deleteContact,
} from '../../util/database';
import ContactSelectionScreen from './ContactSelectionScreen';

export default function EditCampaignScreen({route, navigation}) {
  const {campaign} = route.params;
  const [name, setName] = useState(campaign.name);
  const [description, setDescription] = useState(campaign.description);
  const [contacts, setContacts] = useState([]);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = () => {
    getContactsByCampaignId(campaign.id, setContacts);
  };

  const handleUpdate = () => {
    updateCampaign(campaign.id, name, description, () => {
      navigation.goBack();
    });
  };

  const handleDeleteContact = id => {
    deleteContact(id, fetchContacts);
  };

  return (
    <View style={{flex: 1, padding: 16}}>
      {/* Toggle Button */}
      <Button
        mode="outlined"
        onPress={() => setShowForm(prev => !prev)}
        style={{marginBottom: 16}}>
        {showForm ? 'Hide Campaign Details' : 'Edit Campaign Details'}
      </Button>
      {/* Form Section */}
      {showForm && (
        <View>
          <TextInput
            label="Campaign Name"
            value={name}
            onChangeText={setName}
            mode="outlined"
            style={{marginBottom: 10}}
          />
          <TextInput
            label="Description"
            value={description}
            onChangeText={setDescription}
            mode="outlined"
            style={{marginBottom: 20}}
          />
          <Button mode="contained" onPress={handleUpdate}>
            Save Changes
          </Button>
        </View>
      )}

      <Text style={{marginTop: 20, marginBottom: 10}}>Contacts:</Text>

      <ContactSelectionScreen campaignData={{campaign: campaign}} />
    </View>
  );
}

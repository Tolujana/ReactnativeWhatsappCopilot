import React, {useEffect, useState} from 'react';
import {View, StyleSheet} from 'react-native';
import {TextInput, Button, Text} from 'react-native-paper';
import {
  getContactsByCampaignId,
  updateCampaign,
  deleteContact,
} from '../../util/database';
import ContactSelectionScreen from './ContactSelectionScreen';
import Animated, {FadeInDown} from 'react-native-reanimated';

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
    <View style={styles.container}>
      <Animated.View entering={FadeInDown.duration(400)}>
        <Button
          mode="outlined"
          onPress={() => setShowForm(prev => !prev)}
          style={styles.toggleButton}>
          {showForm ? 'Hide Campaign Details' : 'Edit Campaign Details'}
        </Button>
      </Animated.View>

      {showForm && (
        <Animated.View entering={FadeInDown.delay(150).duration(400)}>
          <TextInput
            label="Campaign Name"
            value={name}
            onChangeText={setName}
            mode="outlined"
            style={styles.input}
          />
          <TextInput
            label="Description"
            value={description}
            onChangeText={setDescription}
            mode="outlined"
            multiline
            numberOfLines={3}
            style={styles.input}
          />
          <Button
            mode="contained"
            onPress={handleUpdate}
            style={styles.saveBtn}>
            Save Changes
          </Button>
        </Animated.View>
      )}

      <Animated.View
        entering={FadeInDown.delay(300).duration(400)}
        style={styles.contactHeader}>
        <Text variant="titleMedium">Contacts:</Text>
      </Animated.View>

      <ContactSelectionScreen
        campaignData={{campaign}}
        onDeleteContact={handleDeleteContact}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#FAFAFA',
  },
  toggleButton: {
    marginBottom: 16,
  },
  input: {
    marginBottom: 12,
  },
  saveBtn: {
    marginBottom: 20,
  },
  contactHeader: {
    marginBottom: 12,
  },
});

import React, {useEffect, useState} from 'react';
import {View, StyleSheet, ScrollView} from 'react-native';
import {TextInput, Button, Text, useTheme, Surface} from 'react-native-paper';
import {
  getContactsByCampaignId,
  updateCampaign,
  deleteContact,
} from '../../util/data';
import ContactSelectionScreen from './ContactSelectionScreen';
import Animated, {FadeInDown} from 'react-native-reanimated';
import Header from '../../components/Header';

export default function EditCampaignScreen({route, navigation, toggleTheme}) {
  const {campaign} = route.params;
  const theme = useTheme();

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
    <ScrollView
      style={[styles.container, {backgroundColor: theme.colors.background}]}
      contentContainerStyle={{paddingBottom: 40}}>
      <Header toggleTheme={toggleTheme} showBackButton={true} />

      <Animated.View entering={FadeInDown.duration(400)}>
        <Button
          mode="outlined"
          onPress={() => setShowForm(prev => !prev)}
          style={styles.toggleButton}
          textColor={theme.colors.primary}>
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
            theme={{colors: {primary: theme.colors.primary}}}
          />
          <TextInput
            label="Description"
            value={description}
            onChangeText={setDescription}
            mode="outlined"
            multiline
            numberOfLines={3}
            style={styles.input}
            theme={{colors: {primary: theme.colors.primary}}}
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
        <Text
          variant="titleMedium"
          style={{
            color: theme.colors.primary,
            fontWeight: '600',
            marginBottom: 4,
          }}>
          Contacts:
        </Text>
      </Animated.View>

      <Surface
        style={[
          styles.contactContainer,
          {backgroundColor: theme.colors.background},
        ]}
        elevation={2}>
        <ContactSelectionScreen
          campaignData={{campaign}}
          onDeleteContact={handleDeleteContact}
        />
      </Surface>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  toggleButton: {
    marginBottom: 16,
    borderRadius: 8,
  },
  input: {
    marginBottom: 12,
  },
  saveBtn: {
    marginBottom: 24,
    borderRadius: 8,
  },
  contactHeader: {
    marginTop: 16,
    marginBottom: 8,
  },
  contactContainer: {
    borderRadius: 12,
    padding: 8,
    marginBottom: 24,
  },
});

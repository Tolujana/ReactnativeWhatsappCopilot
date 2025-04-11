import React, {useEffect, useState} from 'react';
import {View, FlatList, Text, StyleSheet, TouchableOpacity} from 'react-native';
import {
  FAB,
  Portal,
  Dialog,
  TextInput,
  Button,
  Card,
  Title,
  Paragraph,
} from 'react-native-paper';
import {useNavigation} from '@react-navigation/native';
import {getCampaigns, insertCampaign, createTables} from '../../util/database';
//import {createTables, getCampaigns, insertCampaign} from './database'; // Adjust path if needed

const CreateEditCampaignScreen = () => {
  const navigation = useNavigation();
  const [campaigns, setCampaigns] = useState([]);
  const [showDialog, setShowDialog] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState('');
  const [newCampaignDescription, setNewCampaignDescription] = useState('');

  useEffect(() => {
    createTables();
    loadCampaigns();
  }, []);

  const loadCampaigns = () => {
    getCampaigns(data => {
      console.log('📦 Loaded campaigns:', data);
      setCampaigns(data || []);
    });
  };

  const handleSaveCampaign = () => {
    if (!newCampaignName.trim()) return;

    insertCampaign(newCampaignName, newCampaignDescription, insertedId => {
      setShowDialog(false);
      setNewCampaignName('');
      setNewCampaignDescription('');
      loadCampaigns();

      navigation.navigate('ContactSelectionScreen', {
        campaignId: insertedId,
      });
    });
  };

  const handleEditCampaign = campaign => {
    navigation.navigate('EditCampaignScreen', {campaign});
  };

  const renderItem = ({item}) => (
    <TouchableOpacity onPress={() => handleEditCampaign(item)}>
      <Card style={styles.card}>
        <Card.Content>
          <Title>{item.name}</Title>
          <Paragraph numberOfLines={2}>{item.description}</Paragraph>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {campaigns.length === 0 ? (
        <Text style={styles.emptyText}>No campaign created</Text>
      ) : (
        <FlatList
          data={campaigns}
          renderItem={renderItem}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={{paddingBottom: 100}}
        />
      )}

      <FAB
        style={styles.fab}
        icon="plus"
        label="New Campaign"
        onPress={() => setShowDialog(true)}
      />

      <Portal>
        <Dialog visible={showDialog} onDismiss={() => setShowDialog(false)}>
          <Dialog.Title>New Campaign</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Campaign Name"
              value={newCampaignName}
              onChangeText={setNewCampaignName}
              mode="outlined"
              style={{marginBottom: 10}}
            />
            <TextInput
              label="Description"
              value={newCampaignDescription}
              onChangeText={setNewCampaignDescription}
              mode="outlined"
              multiline
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowDialog(false)}>Cancel</Button>
            <Button onPress={handleSaveCampaign}>Save</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};

export default CreateEditCampaignScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    color: 'gray',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 24,
  },
  card: {
    marginVertical: 8,
    borderRadius: 10,
    elevation: 2,
  },
});

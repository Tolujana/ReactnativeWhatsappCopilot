import React, {useEffect, useState} from 'react';
import {View, StyleSheet, ScrollView, Alert} from 'react-native';
import {
  DataTable,
  Checkbox,
  IconButton,
  FAB,
  Button,
  Text,
  Portal,
} from 'react-native-paper';
import {useNavigation} from '@react-navigation/native';
import {
  getCampaigns,
  deleteCampaignById,
  insertCampaign,
  getContactCountForCampaign,
} from '../../util/database';
import CampaignDialog from '../../components/CampaignDialog';

const CreateEditCampaignScreen = () => {
  const navigation = useNavigation();
  const [campaigns, setCampaigns] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showDialog, setShowDialog] = useState(false);

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    getCampaigns(async campaignsList => {
      const campaignsWithCounts = await Promise.all(
        campaignsList.map(async campaign => {
          return new Promise(resolve => {
            getContactCountForCampaign(campaign.id, count => {
              resolve({...campaign, contacts_count: count});
            });
          });
        }),
      );
      setCampaigns(campaignsWithCounts);
    });
  };

  const handleCheckboxToggle = id => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id],
    );
  };

  const handleEdit = campaign => {
    navigation.navigate('EditCampaignScreen', {campaign});
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Campaigns',
      'Are you sure you want to delete the selected campaigns?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            selectedIds.forEach(id => {
              deleteCampaignById(id, () => {});
            });
            setSelectedIds([]);
            loadCampaigns();
          },
        },
      ],
    );
  };

  const handleSaveCampaign = ({name, description, extraFields}) => {
    if (!name.trim()) return;

    insertCampaign(name, description, extraFields, insertedId => {
      if (!insertedId) {
        Alert.alert('Insert failed. Please try again.');
        return;
      }

      setShowDialog(false);
      loadCampaigns();
      navigation.navigate('ContactSelectionScreen2', {
        campaign: {id: insertedId, extraFields},
      });
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>📋 Your Campaigns</Text>

      <ScrollView contentContainerStyle={{alignItems: 'center'}}>
        <DataTable style={styles.table}>
          <DataTable.Header style={styles.header}>
            <DataTable.Title style={{flex: 1}}>Select</DataTable.Title>
            <DataTable.Title style={{flex: 3}}>Name</DataTable.Title>
            <DataTable.Title numeric style={{flex: 2}}>
              Contacts
            </DataTable.Title>
            <DataTable.Title style={{flex: 1}}>Edit</DataTable.Title>
          </DataTable.Header>

          {campaigns.map(campaign => (
            <DataTable.Row key={campaign.id} style={styles.row}>
              <DataTable.Cell style={{flex: 1}}>
                <Checkbox
                  status={
                    selectedIds.includes(campaign.id) ? 'checked' : 'unchecked'
                  }
                  onPress={() => handleCheckboxToggle(campaign.id)}
                />
              </DataTable.Cell>
              <DataTable.Cell style={{flex: 3}}>{campaign.name}</DataTable.Cell>
              <DataTable.Cell numeric style={{flex: 2}}>
                {campaign.contacts_count || 0}
              </DataTable.Cell>
              <DataTable.Cell style={{flex: 1}}>
                <IconButton
                  icon="pencil"
                  size={20}
                  onPress={() => handleEdit(campaign)}
                />
              </DataTable.Cell>
            </DataTable.Row>
          ))}
        </DataTable>
      </ScrollView>

      {selectedIds.length > 0 && (
        <Button
          mode="contained"
          icon="delete"
          onPress={handleDelete}
          style={styles.deleteBtn}>
          Delete Selected
        </Button>
      )}

      <FAB
        style={styles.fab}
        icon="plus"
        label="New Campaign"
        onPress={() => setShowDialog(true)}
      />

      <Portal>
        <CampaignDialog
          visible={showDialog}
          onDismiss={() => setShowDialog(false)}
          onSave={handleSaveCampaign}
        />
      </Portal>
    </View>
  );
};

export default CreateEditCampaignScreen;

const styles = StyleSheet.create({
  container: {flex: 1, padding: 16},
  title: {
    fontSize: 20,
    marginBottom: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  table: {
    borderWidth: 1,
    borderRadius: 8,
    borderColor: '#ccc',
    backgroundColor: '#fafafa',
    overflow: 'hidden',
  },
  header: {backgroundColor: '#e0e0e0'},
  row: {borderBottomWidth: 1, borderColor: '#eee'},
  fab: {position: 'absolute', right: 16, bottom: 30},
  deleteBtn: {
    position: 'absolute',
    left: 16,
    bottom: 30,
    backgroundColor: '#d32f2f',
  },
});

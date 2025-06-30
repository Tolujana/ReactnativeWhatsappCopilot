import React, {useCallback, useState} from 'react';
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
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import Animated, {FadeInUp} from 'react-native-reanimated';
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

  useFocusEffect(
    useCallback(() => {
      loadCampaigns(); // Refresh when screen is focused
    }, []),
  );

  const loadCampaigns = async () => {
    getCampaigns(async campaignsList => {
      const withCounts = await Promise.all(
        campaignsList.map(
          campaign =>
            new Promise(resolve =>
              getContactCountForCampaign(campaign.id, count =>
                resolve({...campaign, contacts_count: count}),
              ),
            ),
        ),
      );
      setCampaigns(withCounts);
    });
  };

  const toggleCheckbox = id => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id],
    );
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Campaigns',
      'Are you sure you want to delete selected campaigns?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            selectedIds.forEach(id => deleteCampaignById(id, () => {}));
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
        campaign: {id: insertedId, extra_fields: JSON.stringify(extraFields)},
      });
    });
  };

  return (
    <View style={styles.container}>
      <Text variant="titleLarge" style={styles.title}>
        📋 Your Campaigns
      </Text>

      <ScrollView contentContainerStyle={{paddingBottom: 100}}>
        <DataTable style={styles.table}>
          <DataTable.Header style={styles.header}>
            <DataTable.Title style={{flex: 1}}>Select</DataTable.Title>
            <DataTable.Title style={{flex: 3}}>Name</DataTable.Title>
            <DataTable.Title numeric style={{flex: 2}}>
              Contacts
            </DataTable.Title>
            <DataTable.Title style={{flex: 1}}>Edit</DataTable.Title>
          </DataTable.Header>

          {campaigns.map((campaign, index) => (
            <Animated.View
              key={campaign.id}
              entering={FadeInUp.delay(index * 60)}>
              <DataTable.Row style={styles.row}>
                <DataTable.Cell style={{flex: 1}}>
                  <Checkbox
                    status={
                      selectedIds.includes(campaign.id)
                        ? 'checked'
                        : 'unchecked'
                    }
                    onPress={() => toggleCheckbox(campaign.id)}
                  />
                </DataTable.Cell>
                <DataTable.Cell style={{flex: 3}}>
                  {campaign.name}
                </DataTable.Cell>
                <DataTable.Cell numeric style={{flex: 2}}>
                  {campaign.contacts_count || 0}
                </DataTable.Cell>
                <DataTable.Cell style={{flex: 1}}>
                  <IconButton
                    icon="pencil"
                    size={20}
                    onPress={() =>
                      navigation.navigate('EditCampaignScreen', {campaign})
                    }
                  />
                </DataTable.Cell>
              </DataTable.Row>
            </Animated.View>
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
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    marginBottom: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  table: {
    borderWidth: 1,
    borderRadius: 8,
    borderColor: '#ccc',
    backgroundColor: '#fff',
  },
  header: {
    backgroundColor: '#f0f0f0',
  },
  row: {
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 30,
  },
  deleteBtn: {
    position: 'absolute',
    left: 16,
    bottom: 30,
    backgroundColor: '#d32f2f',
  },
});
// CampaignDialog.js

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
import {getAuth} from '@react-native-firebase/auth';
import CampaignDialog from '../../components/CampaignDialog';
import DataAPI, {
  getCampaigns,
  insertCampaign,
  preloadRewardedAd,
  showRewardedAd,
} from '../../util/data'; // ✅ native module wrapper
// import {preloadRewardedAd, showRewardedAd} from '../../util/RewardAdManager';

const CreateEditCampaignScreen = () => {
  const navigation = useNavigation();
  const [campaigns, setCampaigns] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showDialog, setShowDialog] = useState(false);
  const [loading, setLoading] = useState(false);

  // ✅ preload ad + load campaigns on screen focus
  useFocusEffect(
    useCallback(() => {
      preloadRewardedAd(); // ← native
      loadCampaigns();
    }, []),
  );

  // ✅ Load campaigns from native DB
  const loadCampaigns = async () => {
    try {
      setLoading(true);
      const list = await getCampaigns(); // ← native
      setCampaigns(list);
    } catch (e) {
      console.warn('Failed to load campaigns', e);
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Delete campaigns (you can wire a native delete function later if needed)
  const handleDelete = async () => {
    if (selectedIds.length === 0) return;

    Alert.alert(
      'Delete Campaigns',
      'Are you sure you want to delete selected campaigns?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // 🔧 You will need to implement a native `deleteCampaignById` method in CampaignsModule later.
              Alert.alert('Delete', 'Native delete not implemented yet.');
            } catch (e) {
              Alert.alert('Delete failed', String(e?.message || e));
            }
          },
        },
      ],
    );
  };

  // ✅ Create campaign using native module
  const handleSaveCampaign = async ({name, description, extraFields}) => {
    if (!name?.trim()) {
      Alert.alert('Validation', 'Campaign name is required.');
      return;
    }

    const user = getAuth().currentUser;
    if (!user) {
      Alert.alert('Not logged in', 'Please sign in before saving a campaign.');
      return;
    }

    const tryInsert = async () => {
      try {
        // 🔥 Native insert
        const insertedId = await insertCampaign(name, description, extraFields);

        setShowDialog(false);
        await loadCampaigns();

        // Navigate to contact selection screen with new campaign
        navigation.navigate('ContactSelectionScreen2', {
          campaign: {id: insertedId, extra_fields: JSON.stringify(extraFields)},
        });
      } catch (e) {
        console.log('Create campaign error:', e);
        if (String(e.code || e.message).includes('INSUFFICIENT_POINTS')) {
          Alert.alert(
            'Not enough points',
            'Watch a rewarded ad to earn points and continue?',
            [
              {text: 'Cancel', style: 'cancel'},
              {
                text: 'Watch Ad',
                onPress: async () => {
                  try {
                    const reward = await showRewardedAd();
                    Alert.alert(
                      'Points earned!',
                      `You earned ${
                        reward.amount || reward
                      } points. Retrying...`,
                    );
                    await tryInsert();
                  } catch (adErr) {
                    Alert.alert('Ad failed', String(adErr?.message || adErr));
                  }
                },
              },
            ],
          );
        } else {
          Alert.alert('Insert failed', String(e?.message || e));
        }
      }
    };

    await tryInsert();
  };

  const toggleCheckbox = id => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id],
    );
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
          onSave={handleSaveCampaign} // ✅ Uses native insert now
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

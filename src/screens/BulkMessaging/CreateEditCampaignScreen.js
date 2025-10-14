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
  useTheme,
} from 'react-native-paper';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import Animated, {FadeInUp} from 'react-native-reanimated';
import {getAuth} from '@react-native-firebase/auth';
import {BannerAd, BannerAdSize, TestIds} from 'react-native-google-mobile-ads';

import CampaignDialog from '../../components/CampaignDialog';
import {
  deleteCampaignById,
  getCampaigns,
  getContactCountForCampaign,
  insertCampaign,
  preloadRewardedAd,
  showRewardedAd,
} from '../../util/data';
import Header from '../../components/Header';

const BANNER_ID = TestIds.BANNER; // Using AdMob test ID

const CreateEditCampaignScreen = ({toggleTheme}) => {
  const navigation = useNavigation();
  const theme = useTheme();

  const [campaigns, setCampaigns] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showDialog, setShowDialog] = useState(false);
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      preloadRewardedAd();
      loadCampaigns();
    }, []),
  );

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      const list = await getCampaigns();
      const updatedList = await Promise.all(
        list.map(async camp => {
          const count = await getContactCountForCampaign(camp.id);
          return {...camp, contact_count: count};
        }),
      );
      setCampaigns(updatedList);
    } catch (e) {
      console.warn('Failed to load campaigns', e);
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  };

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
              await Promise.all(selectedIds.map(id => deleteCampaignById(id)));
              setSelectedIds([]);
              loadCampaigns();
            } catch (e) {
              Alert.alert('Delete failed', String(e?.message || e));
            }
          },
        },
      ],
    );
  };

  const handleSaveCampaign = async ({name, description, extraFields}) => {
    if (!name?.trim()) {
      Alert.alert('Validation', 'Campaign name is required.');
      return;
    }

    const tryInsert = async () => {
      try {
        const insertedId = await insertCampaign(name, description, extraFields);

        setShowDialog(false);
        await loadCampaigns();

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
    <>
      <View
        style={[styles.container, {backgroundColor: theme.colors.background}]}>
        <Header toggleTheme={toggleTheme} />
        <Text
          variant="titleLarge"
          style={[styles.title, {color: theme.colors.onBackground}]}>
          📋 Your Campaigns
        </Text>

        {/* ✅ Top Banner Ad */}
        <BannerAd
          unitId={BANNER_ID}
          size={BannerAdSize.BANNER}
          requestOptions={{requestNonPersonalizedAdsOnly: true}}
        />

        <ScrollView contentContainerStyle={{paddingBottom: 120}}>
          <DataTable
            style={[styles.table, {borderColor: theme.colors.outlineVariant}]}>
            <DataTable.Header
              style={[
                styles.header,
                {backgroundColor: theme.colors.surfaceVariant},
              ]}>
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
                <DataTable.Row
                  style={[
                    styles.row,
                    {borderColor: theme.colors.surfaceVariant},
                  ]}>
                  <DataTable.Cell style={{flex: 1}}>
                    <Checkbox
                      status={
                        selectedIds.includes(campaign.id)
                          ? 'checked'
                          : 'unchecked'
                      }
                      onPress={() => toggleCheckbox(campaign.id)}
                      color={theme.colors.primary}
                    />
                  </DataTable.Cell>
                  <DataTable.Cell style={{flex: 3}}>
                    <Text style={{color: theme.colors.onSurface}}>
                      {campaign.name}
                    </Text>
                  </DataTable.Cell>
                  <DataTable.Cell numeric style={{flex: 2}}>
                    <Text style={{color: theme.colors.onSurface}}>
                      {campaign.contact_count || 0}
                    </Text>
                  </DataTable.Cell>
                  <DataTable.Cell style={{flex: 1}}>
                    <IconButton
                      icon="pencil"
                      size={20}
                      iconColor={theme.colors.secondary}
                      onPress={() =>
                        navigation.navigate('EditCampaignScreen', {campaign})
                      }
                    />
                  </DataTable.Cell>
                </DataTable.Row>
              </Animated.View>
            ))}
          </DataTable>

          {/* ✅ Mid-page Banner Ad (below table) */}
          <View style={styles.bannerWrapper}>
            <BannerAd
              unitId={BANNER_ID}
              size={BannerAdSize.MEDIUM_RECTANGLE}
              requestOptions={{requestNonPersonalizedAdsOnly: true}}
            />
          </View>
        </ScrollView>

        {selectedIds.length > 0 && (
          <Button
            mode="contained"
            icon="delete"
            onPress={handleDelete}
            style={[styles.deleteBtn, {backgroundColor: theme.colors.error}]}
            textColor={theme.colors.onError}>
            Delete Selected
          </Button>
        )}

        <FAB
          style={[styles.fab, {backgroundColor: theme.colors.primaryContainer}]}
          icon="plus"
          label="New Campaign"
          color={theme.colors.onPrimaryContainer}
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
    </>
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
    marginTop: 8,
  },
  header: {},
  row: {
    borderBottomWidth: 1,
  },
  bannerWrapper: {
    marginTop: 20,
    alignItems: 'center',
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
  },
});

import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
} from 'react-native';
import {Text as PaperText, useTheme} from 'react-native-paper';
import {getCampaigns} from '../../util/data';
import Header from '../../components/Header';
import {BannerAd, BannerAdSize} from 'react-native-google-mobile-ads';

const CampaignSelectionScreen = ({navigation, route, toggleTheme}) => {
  const theme = useTheme();
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const cams = await getCampaigns();
        setCampaigns(cams);
      } catch (e) {
        setCampaigns([]);
      }
    };
    load();
  }, []);

  const handleNext = () => {
    if (!selectedCampaignId) {
      Alert.alert('Select Campaign', 'Please select a campaign to continue.');
      return;
    }

    const selectedCampaign = campaigns.find(c => c.id === selectedCampaignId);

    navigation.navigate('BulkMessaging', {
      campaign: selectedCampaign,
      prefillMessages: route.params?.prefillMessages || [],
    });
  };

  const renderItem = ({item, index}) => {
    const isSelected = item.id === selectedCampaignId;
    return (
      <>
        <TouchableOpacity
          style={[
            styles.card,
            {backgroundColor: theme.colors.elevation.level2},
            isSelected && {
              backgroundColor: theme.colors.secondaryContainer,
              borderColor: theme.colors.primary,
              borderWidth: 2,
            },
          ]}
          onPress={() => setSelectedCampaignId(item.id)}>
          <Text style={[styles.cardTitle, {color: theme.colors.onSurface}]}>
            {item.name}
          </Text>
          <Text
            style={[
              styles.cardSubtitle,
              {color: theme.colors.onSurfaceVariant},
            ]}>
            {item.description}
          </Text>
        </TouchableOpacity>
        {(index + 1) % 3 === 0 && (
          <View style={styles.bannerContainer}>
            <BannerAd
              unitId="ca-app-pub-7993847549836206/9152830275"
              size={BannerAdSize.BANNER}
            />
          </View>
        )}
      </>
    );
  };

  return (
    <View
      style={[styles.container, {backgroundColor: theme.colors.background}]}>
      <Header toggleTheme={toggleTheme} showBackButton={true} />
      <View style={styles.bannerContainer}>
        <BannerAd
          unitId="ca-app-pub-7993847549836206/9152830275"
          size={BannerAdSize.BANNER}
        />
      </View>
      <PaperText style={[styles.header, {color: theme.colors.onSurface}]}>
        Select a Campaign
      </PaperText>
      <FlatList
        data={campaigns}
        keyExtractor={item => item.id.toString()}
        renderItem={renderItem}
        ListEmptyComponent={
          <Text style={{color: theme.colors.onSurface}}>
            No campaigns available.
          </Text>
        }
      />
      <TouchableOpacity
        style={[styles.nextButton, {backgroundColor: theme.colors.primary}]}
        onPress={handleNext}>
        <Text style={[styles.nextButtonText, {color: theme.colors.onPrimary}]}>
          Next
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default CampaignSelectionScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  card: {
    padding: 16,
    borderRadius: 10,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  cardSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  nextButton: {
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  nextButtonText: {
    fontWeight: 'bold',
  },
  bannerContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
});

import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
} from 'react-native';
import {getCampaigns} from '../../util/database';
//import {getAllCampaigns} from '../../database/database'; // Adjust path as needed

const CampaignSelectionScreen = ({navigation, route}) => {
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState(null);

  useEffect(() => {
    getCampaigns(setCampaigns);
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

  const renderItem = ({item}) => {
    const isSelected = item.id === selectedCampaignId;
    return (
      <TouchableOpacity
        style={[styles.card, isSelected && styles.selectedCard]}
        onPress={() => setSelectedCampaignId(item.id)}>
        <Text style={styles.cardTitle}>{item.name}</Text>
        <Text style={styles.cardSubtitle}>{item.description}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Select a Campaign</Text>
      <FlatList
        data={campaigns}
        keyExtractor={item => item.id.toString()}
        renderItem={renderItem}
        ListEmptyComponent={<Text>No campaigns available.</Text>}
      />
      <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
        <Text style={styles.nextButtonText}>Next</Text>
      </TouchableOpacity>
    </View>
  );
};

export default CampaignSelectionScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  header: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  card: {
    padding: 16,
    borderRadius: 10,
    backgroundColor: '#E5E7EB',
    marginBottom: 12,
  },
  selectedCard: {
    backgroundColor: '#C7D2FE',
    borderColor: '#4F46E5',
    borderWidth: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#555',
    marginTop: 4,
  },
  nextButton: {
    backgroundColor: '#4F46E5',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  nextButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});

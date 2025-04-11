import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import CategorySection from './CategorySection';

const MENU_ITEMS = {
  'Bulk Messaging': [
    {
      title: 'Msg unSaved contacts',
      icon: 'account-question',
      screen: 'SendMessageToNonContact',
    },
    {
      title: 'Create/edit campaign',
      icon: 'playlist-edit',
      screen: 'CreateCampaign',
    },
    {title: 'Send bulk messages', icon: 'send', screen: 'BulkMessaging'},
    {title: 'Message history', icon: 'history', screen: 'StatusSaver'},
    {title: 'Settings', icon: 'cog', screen: 'StatusSaver'},
  ],
  'Status Saver': [
    {title: 'Settings', icon: 'cog-outline', screen: 'StatusSaver'},
    {title: 'Save status', icon: 'download', screen: 'StatusSaver'},
  ],
  'Contact Extractor': [
    {title: 'Group extractor', icon: 'account-group', screen: 'StatusSaver'},
    {
      title: 'Unsaved contact extractor',
      icon: 'account-off',
      screen: 'StatusSaver',
    },
  ],
  'Retrieve Deleted Messages': [
    {
      title: 'Retrieve messages',
      icon: 'message-reply-text',
      screen: 'StatusSaver',
    },
    {title: 'Retrieve media', icon: 'image-search', screen: 'StatusSaver'},
  ],
};

const MenuCard = ({title, iconName, onPress}) => (
  <TouchableOpacity onPress={onPress} style={styles.menuCard}>
    <View style={styles.menuCardIconContainer}>
      <Icon name={iconName} size={30} color="#4B5563" />
    </View>
    <Text style={styles.menuCardText}>{title}</Text>
  </TouchableOpacity>
);

export default function Home() {
  return (
    <ScrollView style={styles.container}>
      {Object.entries(MENU_ITEMS).map(([category, items], index) => (
        <CategorySection key={index} title={category} items={items} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F9FAFB',
    padding: 8,
  },
  menuCard: {
    alignItems: 'center',
    padding: 8,
    margin: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    width: '22%',
  },
  menuCardIconContainer: {
    marginBottom: 4,
  },
  menuCardText: {
    fontSize: 12,
    textAlign: 'center',
  },
  categorySection: {
    marginBottom: 16,
  },
  categorySectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  categorySectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  categorySectionItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    paddingHorizontal: 8,
  },
});

import React, {useEffect} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  AccessibilityInfo,
  FlatList,
  Linking,
} from 'react-native';
import {openAccessibilitySettings} from '../../util/AccessibilityService';
import CardComponent from '../../components/CardComponent';

const menuOptions = [
  {title: 'Create Campaign', id: 'create'},
  {title: 'Send Messages', id: 'send'},
  {title: 'Edit Campaign', id: 'edit'},
  {title: 'Settings', id: 'settings'},
];

const BulkMessagingScreen = ({navigation}) => {
  useEffect(() => {
    checkAccessibilityPermission();
  }, []);

  const checkAccessibilityPermission = async () => {
    const enabled = await AccessibilityInfo.isScreenReaderEnabled();

    if (!enabled) {
      Alert.alert(
        'Permission Required',
        'Accessibility permissions are needed to send WhatsApp messages. Please enable the Accessibility Service for this app.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Go to Settings',
            onPress: () => openAccessibilitySettings(),
          },
        ],
        {cancelable: true},
      );
    }
  };

  const handleMenuPress = id => {
    switch (id) {
      case 'create':
        navigation.navigate('CreateCampaign');
        break;
      case 'send':
        navigation.navigate('SendMessages');
        break;
      case 'edit':
        navigation.navigate('EditCampaign');
        break;
      case 'settings':
        navigation.navigate('BulkMessagingSettings');
        break;
      default:
        break;
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Bulk Messaging</Text>
      <FlatList
        data={menuOptions}
        numColumns={2}
        keyExtractor={item => item.id}
        renderItem={({item}) =>
          CardComponent(item, handleMenuPress)
          // <TouchableOpacity
          //   style={styles.menuItem}
          //   onPress={() => handleMenuPress(item.id)}>
          //   <Text style={styles.menuText}>{item.title}</Text>
          // </TouchableOpacity>
        }
        contentContainerStyle={styles.grid}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    padding: 16,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  grid: {
    justifyContent: 'space-between',
  },
  menuItem: {
    flex: 1,
    margin: 8,
    backgroundColor: '#4F46E5',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default BulkMessagingScreen;

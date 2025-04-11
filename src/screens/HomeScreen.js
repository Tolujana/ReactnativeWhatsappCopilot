import React from 'react';
import {View, Text, TouchableOpacity, Animated} from 'react-native';
import {Card, Title} from 'react-native-paper'; // Import Card and Title components from React Native Paper
import {useNavigation} from '@react-navigation/native';
import CardComponent from '../components/CardComponent';

const menuItems = [
  {id: 1, title: 'Status Saver', screen: 'StatusSaver'},
  {id: 2, title: 'Bulk Messaging', screen: 'BulkMessaging'},
  {id: 3, title: 'Group Extractor', screen: 'GroupExtractor'},
  {id: 4, title: 'Message Retriever', screen: 'MessageRetriever'},
  {
    id: 5,
    title: 'Send Message to Non-Contact',
    screen: 'SendMessageToNonContact',
  },
];

const HomeScreen = () => {
  const navigation = useNavigation();
  const fadeAnim = new Animated.Value(0);

  // Function to handle menu item press
  const handleMenuItemPress = screen => {
    navigation.navigate(screen);
  };

  // Function to handle animation when component loads
  const handleMenuLoad = () => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  };

  return (
    <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
      {/* <Animated.View style={{opacity: fadeAnim}}> */}
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'space-around',
        }}>
        {menuItems.map((item, index) =>
          CardComponent(item, handleMenuItemPress, handleMenuLoad),
        )}
      </View>
      {/* </Animated.View> */}
    </View>
  );
};

export default HomeScreen;

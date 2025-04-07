import React from 'react';
import {View, Text, TouchableOpacity, Animated} from 'react-native';
import {Card, Title} from 'react-native-paper'; // Import Card and Title components from React Native Paper
import {useNavigation} from '@react-navigation/native';

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
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={item.id}
            onPress={() => handleMenuItemPress(item.screen)}
            onLoad={handleMenuLoad}
            style={{
              width: '40%',
              aspectRatio: 1,
              margin: 10,
            }}>
            <View
              style={{
                borderRadius: 10,
                flex: 1,
                elevation: 4,
                shadowColor: '#000',
                shadowOffset: {width: 0, height: 2},
                shadowOpacity: 0.2,
                shadowRadius: 4,
                backgroundColor: 'white',
              }}>
              <View
                style={{
                  flex: 1,
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderRadius: 10,
                }}>
                <Title
                  style={{
                    fontSize: 16,
                    fontWeight: 'bold',
                    textAlign: 'center',
                  }}>
                  {item.title}
                </Title>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </View>
      {/* </Animated.View> */}
    </View>
  );
};

export default HomeScreen;

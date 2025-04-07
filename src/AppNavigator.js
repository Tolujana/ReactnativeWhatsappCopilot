// navigation/AppNavigator.js
import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import HomeScreen from './screens/HomeScreen';
import StatusSaver from './screens/StatusSaver/StatusSaver';
import BulkMessaging from './screens/BulkMessaging/BulkMessaging';

import GroupExtractor from './screens/GroupExtractor/GroupExtractor';
import SettingsScreen from './screens/SettingsScreen';
import SendMessageToNonContact from './screens/SendMessageToNonContact';
import MessageRetriever from './screens/MessageRetriever/MessageRetriever';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Tab Navigator (bottom tabs)
const TabNavigator = () => (
  <Tab.Navigator>
    <Tab.Screen name="Home" component={HomeScreen} />
    <Tab.Screen name="Settings" component={SettingsScreen} />

    {/* <Tab.Screen name="About" component={About} /> */}
  </Tab.Navigator>
);

// App Navigator with Stack as root
const AppNavigator = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen
          name="Main"
          component={TabNavigator}
          options={{headerShown: false}}
        />
        <Stack.Screen name="StatusSaver" component={StatusSaver} />
        <Stack.Screen name="BulkMessaging" component={BulkMessaging} />
        <Stack.Screen
          name="SendMessageToNonContact"
          component={SendMessageToNonContact}
        />
        <Stack.Screen name="GroupExtractor" component={GroupExtractor} />
        <Stack.Screen name="MessageRetriever" component={MessageRetriever} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;

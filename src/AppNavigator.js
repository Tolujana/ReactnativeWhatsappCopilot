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
import CreateEditCampaignScreen from './screens/BulkMessaging/CreateEditCampaignScreen';
import Home from './screens/Home';
//import ContactSelectionScreen from './screens/BulkMessaging/ContactSelectionScreen';
import EditCampaignScreen from './screens/BulkMessaging/EditCampaignScreen';
import ContactFilterScreen from './screens/BulkMessaging/ContactFilterScreen';
import CampaignSelectionScreen from './screens/BulkMessaging/CampaignSelectionScreen';
import WhatsappResultScreen from './screens/WhatsappResultScreen';
import ContactSelectionScreen from './screens/BulkMessaging/ContactSelectionScreen';
import ContactSelectScreen from './components/ContactSelectScreen';
//import ContactSelectionScreen from './screens/BulkMessaging/ContactSelectionScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Tab Navigator (bottom tabs)
const TabNavigator = () => (
  <Tab.Navigator>
    <Tab.Screen name="Home" component={Home} />
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
        <Stack.Screen
          name="ContactSelectScreen"
          component={ContactSelectScreen}
        />
        <Stack.Screen
          name="CreateCampaign"
          component={CreateEditCampaignScreen}
        />
        <Stack.Screen
          name="ContactSelectionScreen2"
          component={ContactSelectionScreen}
        />
        <Stack.Screen
          name="EditCampaignScreen"
          component={EditCampaignScreen}
        />
        <Stack.Screen
          name="ContactFilterScreen"
          component={ContactFilterScreen}
        />
        <Stack.Screen
          name="CampaignSelectionScreen"
          component={CampaignSelectionScreen}
        />
        <Stack.Screen
          name="WhatsappResultScreen"
          component={WhatsappResultScreen}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;

// navigation/AppNavigator.js
import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import StatusSaver from './screens/StatusSaver/StatusSaver';
import BulkMessaging from './screens/BulkMessaging/BulkMessaging';
import GroupExtractor from './screens/GroupExtractor/GroupExtractor';
import SettingsScreen from './screens/SettingsScreen';
import SendMessageToNonContact from './screens/SendMessageToNonContact';
import CreateEditCampaignScreen from './screens/BulkMessaging/CreateEditCampaignScreen';
import Home from './screens/Home';
import EditCampaignScreen from './screens/BulkMessaging/EditCampaignScreen';
import ContactFilterScreen from './screens/BulkMessaging/ContactFilterScreen';
import CampaignSelectionScreen from './screens/BulkMessaging/CampaignSelectionScreen';
import WhatsappResultScreen from './screens/WhatsappResultScreen';
import ContactSelectionScreen from './screens/BulkMessaging/ContactSelectionScreen';
import ContactSelectScreen from './components/ContactSelectScreen';
import StatusSaverSettings from './screens/StatusSaver/StatusSaverSettings';
import MessageReportScreen from './screens/BulkMessaging/MessageReportScreen';
import MessengerCleanup from './screens/MessageCleanup/MessengerCleanup';
import MessengerMediaGrid from './screens/MessageCleanup/MessengerMediaGrid';
import ScheduledMessagesScreen from './screens/BulkMessaging/ScheduleMessageScreen';
import SenderMessagesScreen from './screens/Backup/SenderMessagesScreen';
import BackupSettingsScreen from './screens/Backup/BackupSettingsScreen';
import BackupSendersScreen from './screens/Backup/BackupSendersScreen';
import RecentChatsSelectionScreen from './screens/Backup/RecentSelectionScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Tab Navigator (bottom tabs)
const TabNavigator = ({toggleTheme}) => (
  <Tab.Navigator
    screenOptions={{headerShown: false, tabBarStyle: {display: 'none'}}}>
    <Tab.Screen name="Home">
      {props => <Home {...props} toggleTheme={toggleTheme} />}
    </Tab.Screen>
    <Tab.Screen name="Settings">
      {props => <SettingsScreen {...props} toggleTheme={toggleTheme} />}
    </Tab.Screen>
  </Tab.Navigator>
);

// App Navigator with Stack as root - ALL HEADERS HIDDEN
const AppNavigator = ({toggleTheme}) => {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{headerShown: false}}>
        <Stack.Screen name="Main">
          {props => <TabNavigator {...props} toggleTheme={toggleTheme} />}
        </Stack.Screen>

        {/* All screens now receive toggleTheme prop */}
        <Stack.Screen name="StatusSaver">
          {props => <StatusSaver {...props} toggleTheme={toggleTheme} />}
        </Stack.Screen>

        <Stack.Screen name="BulkMessaging">
          {props => <BulkMessaging {...props} toggleTheme={toggleTheme} />}
        </Stack.Screen>

        <Stack.Screen name="SendMessageToNonContact">
          {props => (
            <SendMessageToNonContact {...props} toggleTheme={toggleTheme} />
          )}
        </Stack.Screen>

        <Stack.Screen name="RecentChatsSelection">
          {props => (
            <RecentChatsSelectionScreen {...props} toggleTheme={toggleTheme} />
          )}
        </Stack.Screen>

        <Stack.Screen name="GroupExtractor">
          {props => <GroupExtractor {...props} toggleTheme={toggleTheme} />}
        </Stack.Screen>

        <Stack.Screen name="Select Contact(s)">
          {props => (
            <ContactSelectScreen {...props} toggleTheme={toggleTheme} />
          )}
        </Stack.Screen>

        <Stack.Screen name="MessageReport">
          {props => (
            <MessageReportScreen {...props} toggleTheme={toggleTheme} />
          )}
        </Stack.Screen>

        <Stack.Screen name="CreateCampaign">
          {props => (
            <CreateEditCampaignScreen {...props} toggleTheme={toggleTheme} />
          )}
        </Stack.Screen>

        <Stack.Screen name="ContactSelectionScreen2">
          {props => (
            <ContactSelectionScreen {...props} toggleTheme={toggleTheme} />
          )}
        </Stack.Screen>

        <Stack.Screen name="EditCampaignScreen">
          {props => <EditCampaignScreen {...props} toggleTheme={toggleTheme} />}
        </Stack.Screen>

        <Stack.Screen name="StatusSaver Settings">
          {props => (
            <StatusSaverSettings {...props} toggleTheme={toggleTheme} />
          )}
        </Stack.Screen>
        <Stack.Screen name="ScheduledMessages">
          {props => (
            <ScheduledMessagesScreen {...props} toggleTheme={toggleTheme} />
          )}
        </Stack.Screen>

        <Stack.Screen name="Contact Selection">
          {props => (
            <ContactFilterScreen {...props} toggleTheme={toggleTheme} />
          )}
        </Stack.Screen>
        <Stack.Screen name="BackupSendersScreen">
          {props => (
            <BackupSendersScreen {...props} toggleTheme={toggleTheme} />
          )}
        </Stack.Screen>
        <Stack.Screen name="SenderMessages">
          {props => (
            <SenderMessagesScreen {...props} toggleTheme={toggleTheme} />
          )}
        </Stack.Screen>
        <Stack.Screen name="BackupSettingsScreen">
          {props => (
            <BackupSettingsScreen {...props} toggleTheme={toggleTheme} />
          )}
        </Stack.Screen>

        <Stack.Screen name="Campaign Selection">
          {props => (
            <CampaignSelectionScreen {...props} toggleTheme={toggleTheme} />
          )}
        </Stack.Screen>

        <Stack.Screen name="WhatsappResultScreen">
          {props => (
            <WhatsappResultScreen {...props} toggleTheme={toggleTheme} />
          )}
        </Stack.Screen>

        <Stack.Screen name="MessengerMediaGrid">
          {props => <MessengerMediaGrid {...props} toggleTheme={toggleTheme} />}
        </Stack.Screen>

        <Stack.Screen name="Messenger Cleanup">
          {props => <MessengerCleanup {...props} toggleTheme={toggleTheme} />}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;

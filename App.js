// App.js - OPTIMIZED VERSION
// Fetches scheduled message payload from DB instead of notification data

import React, {useState, useEffect} from 'react';
import {View, StyleSheet, Alert} from 'react-native';
import {
  PaperProvider,
  MD3LightTheme,
  MD3DarkTheme,
  ActivityIndicator,
} from 'react-native-paper';
import AppNavigator from './src/AppNavigator';
import mobileAds from 'react-native-google-mobile-ads';
import notifee, {EventType} from '@notifee/react-native';
import {
  scheduleDailyLowPointsCheck,
  createTables,
  getSentMessageById,
} from './src/util/data';
import {launchWhatsappMessage} from './src/util/WhatsappHelper';

scheduleDailyLowPointsCheck();

const App = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const theme = isDarkMode ? MD3DarkTheme : MD3LightTheme;

  useEffect(() => {
    // Initialize database and wildcards on app startup
    const initializeApp = async () => {
      try {
        console.log('Initializing database...');
        await createTables();
        console.log('Database initialized successfully');

        // Create notification channel
        await notifee.createChannel({
          id: 'scheduled-messages',
          name: 'Scheduled Messages',
          importance: 4,
          vibration: true,
          lights: true,
        });
        console.log('Notification channel created');
      } catch (error) {
        console.error('Failed to initialize database:', error);
      }
    };

    initializeApp();
  }, []);

  useEffect(() => {
    const initAds = async () => {
      try {
        await mobileAds().initialize();
        console.log('AdMob SDK initialized successfully');
      } catch (error) {
        console.error('Error initializing AdMob:', error);
      }
    };

    initAds();
  }, []);

  // OPTIMIZED: Fetch full payload from database using row ID
  useEffect(() => {
    // Handle background notification events (app killed/background)
    notifee.onBackgroundEvent(async ({type, detail}) => {
      try {
        console.log('📱 Background event received:', type);

        const notif = detail.notification;
        const data = notif?.data;

        if (!data?.scheduledJobId) {
          console.log('No scheduledJobId found in notification data');
          return;
        }

        const pressActionId = detail.pressAction?.id;
        const isPress = type === EventType.PRESS;
        const isActionSend =
          type === EventType.ACTION_PRESS && pressActionId === 'send-now';

        if (isPress || isActionSend) {
          console.log('🚀 User triggered send from notification');

          // CRITICAL: Fetch full payload from database using row ID
          const rowId = parseInt(data.scheduledJobId, 10);
          if (isNaN(rowId)) {
            console.error('Invalid row ID:', data.scheduledJobId);
            return;
          }

          console.log('📥 Fetching scheduled message from DB, row ID:', rowId);
          const scheduledMessage = await getSentMessageById(rowId);

          if (!scheduledMessage) {
            console.error('❌ Scheduled message not found in database');
            await notifee.displayNotification({
              title: '❌ Message Not Found',
              body: 'Could not retrieve scheduled message. It may have been deleted.',
              android: {channelId: 'scheduled-messages'},
            });
            return;
          }

          // Parse the data field which contains our payload
          let payload = null;
          try {
            // The data field might be stored as JSON string or object
            payload =
              typeof scheduledMessage.data === 'string'
                ? JSON.parse(scheduledMessage.data)
                : scheduledMessage.data;
          } catch (e) {
            console.error('❌ Failed to parse message payload:', e);
            await notifee.displayNotification({
              title: '❌ Invalid Message Data',
              body: 'Could not parse scheduled message data.',
              android: {channelId: 'scheduled-messages'},
            });
            return;
          }

          if (
            !payload?.personalizedMessages ||
            !Array.isArray(payload.personalizedMessages)
          ) {
            console.error('❌ Invalid payload structure:', payload);
            return;
          }

          console.log(
            `✅ Found ${payload.personalizedMessages.length} messages to send`,
          );

          // Trigger send via overlay (native handles permissions)
          try {
            await launchWhatsappMessage(
              payload.personalizedMessages,
              payload.whatsappPackage || 'com.whatsapp',
            );

            console.log('✅ Messages launched successfully');

            // Cancel notification after successful send
            if (notif.id) {
              await notifee.cancelNotification(notif.id);
              console.log('🗑️ Notification cancelled:', notif.id);
            }

            // Show success notification
            await notifee.displayNotification({
              title: '✅ Messages Sent',
              body: `Successfully sent ${payload.personalizedMessages.length} messages`,
              android: {
                channelId: 'scheduled-messages',
                importance: 3,
              },
            });
          } catch (sendError) {
            console.error('❌ Error sending messages:', sendError);

            // Show error notification
            await notifee.displayNotification({
              title: '❌ Send Failed',
              body: 'Could not send messages. Please try again.',
              android: {channelId: 'scheduled-messages'},
            });
          }
        }
      } catch (err) {
        console.error('❌ Background handler error:', err);

        // Show error notification
        try {
          await notifee.displayNotification({
            title: '❌ Error',
            body: 'An error occurred processing your scheduled messages.',
            android: {channelId: 'scheduled-messages'},
          });
        } catch (notifErr) {
          console.error('Could not show error notification:', notifErr);
        }
      }
    });

    // Handle foreground notification events (app open)
    const unsubscribe = notifee.onForegroundEvent(async ({type, detail}) => {
      try {
        console.log('📱 Foreground event received:', type);

        const notif = detail.notification;
        const data = notif?.data;

        if (!data?.scheduledJobId) {
          console.log('No scheduledJobId found in notification data');
          return;
        }

        const pressActionId = detail.pressAction?.id;
        const isPress = type === EventType.PRESS;
        const isActionSend =
          type === EventType.ACTION_PRESS && pressActionId === 'send-now';

        if (isPress || isActionSend) {
          console.log('🚀 User triggered send from notification (foreground)');

          // CRITICAL: Fetch full payload from database using row ID
          const rowId = parseInt(data.scheduledJobId, 10);
          if (isNaN(rowId)) {
            console.error('Invalid row ID:', data.scheduledJobId);
            Alert.alert('Error', 'Invalid scheduled message ID');
            return;
          }

          console.log('📥 Fetching scheduled message from DB, row ID:', rowId);
          const scheduledMessage = await getSentMessageById(rowId);

          if (!scheduledMessage) {
            console.error('❌ Scheduled message not found in database');
            Alert.alert(
              'Message Not Found',
              'Could not retrieve scheduled message. It may have been deleted.',
            );
            return;
          }

          // Parse the data field
          let payload = null;
          try {
            payload =
              typeof scheduledMessage.data === 'string'
                ? JSON.parse(scheduledMessage.data)
                : scheduledMessage.data;
          } catch (e) {
            console.error('❌ Failed to parse message payload:', e);
            Alert.alert('Error', 'Could not parse scheduled message data.');
            return;
          }

          if (
            !payload?.personalizedMessages ||
            !Array.isArray(payload.personalizedMessages)
          ) {
            console.error('❌ Invalid payload structure:', payload);
            Alert.alert('Error', 'Invalid message data structure');
            return;
          }

          console.log(
            `✅ Found ${payload.personalizedMessages.length} messages to send`,
          );

          // Trigger send
          try {
            await launchWhatsappMessage(
              payload.personalizedMessages,
              payload.whatsappPackage || 'com.whatsapp',
            );

            console.log('✅ Messages launched successfully (foreground)');

            // Cancel notification
            if (notif.id) {
              await notifee.cancelNotification(notif.id);
              console.log('🗑️ Notification cancelled:', notif.id);
            }

            Alert.alert(
              '✅ Success',
              `Sending ${payload.personalizedMessages.length} messages`,
            );
          } catch (sendError) {
            console.error('❌ Error sending messages:', sendError);
            Alert.alert(
              'Send Failed',
              'Could not send messages. Please try again.',
            );
          }
        }
      } catch (err) {
        console.error('❌ Foreground handler error:', err);
        Alert.alert(
          'Error',
          'An error occurred processing your scheduled messages.',
        );
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <PaperProvider theme={theme}>
      <AppNavigator toggleTheme={() => setIsDarkMode(prev => !prev)} />
    </PaperProvider>
  );
};

const styles = StyleSheet.create({
  centered: {flex: 1, justifyContent: 'center', alignItems: 'center'},
});

export default App;

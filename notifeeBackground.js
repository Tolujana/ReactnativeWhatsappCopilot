// notifeeBackground.js
import notifee, {EventType} from '@notifee/react-native';
import {launchWhatsappMessage} from './src/util/WhatsappHelper';

notifee.onBackgroundEvent(async ({type, detail}) => {
  try {
    if (type === EventType.TRIGGER_NOTIFICATION) {
      const notif = detail.notification;
      const payload = notif?.data?.payload;
      let parsed = null;
      try {
        parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
      } catch (e) {
        console.warn('Failed to parse payload', e);
      }

      if (!parsed?.personalizedMessages) return;

      try {
        await launchWhatsappMessage(
          parsed.personalizedMessages,
          parsed.whatsappPackage || 'com.whatsapp',
        );
        await notifee.cancelNotification(notif.id);
      } catch (err) {
        console.error('Background send failed', err);
      }
    }
  } catch (err) {
    console.error('Background handler error', err);
  }
});

// 👇 Export a no-op so the bundler keeps this file in build
export default notifee;

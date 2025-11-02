// notifeeBackground.js
// Handles background notification presses/actions for scheduled sends (no auto-trigger in bg to respect restrictions; user must tap/send button)

import notifee, {EventType} from '@notifee/react-native';
import {launchWhatsappMessage} from './src/util/WhatsappHelper';
//

notifee.onBackgroundEvent(async ({type, detail}) => {
  try {
    const notif = detail.notification;
    const data = notif?.data;
    if (!data?.scheduledJobId) return;

    const pressActionId = detail.pressAction?.id;
    const isPress = type === EventType.PRESS;
    const isActionSend =
      type === EventType.ACTION_PRESS && pressActionId === 'send-now';

    if (isPress || isActionSend) {
      const payload = data.payload;
      let parsed = null;
      try {
        parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
      } catch (e) {
        console.warn('Failed to parse payload', e);
        return;
      }

      if (!parsed?.personalizedMessages) return;

      // Trigger send via overlay (native handles permissions)
      await launchWhatsappMessage(
        parsed.personalizedMessages,
        parsed.whatsappPackage || 'com.whatsapp',
      );
      // Cancel after send
      if (notif.id) {
        await notifee.cancelNotification(notif.id);
      }
    }
  } catch (err) {
    console.error('Background handler error', err);
  }
});

// Export no-op for bundler
export default notifee;

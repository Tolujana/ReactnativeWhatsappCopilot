// notifeeBackground.js
// import notifee, {EventType} from '@notifee/react-native';
// import {launchWhatsappMessage} from './src/util/WhatsappHelper';

// notifee.onBackgroundEvent(async ({type, detail}) => {
//   try {
//     if (type === EventType.TRIGGER_NOTIFICATION) {
//       const notif = detail.notification;
//       const payload = notif?.data?.payload;
//       let parsed = null;
//       try {
//         parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
//       } catch (e) {
//         console.warn('Failed to parse payload', e);
//       }

//       if (!parsed?.personalizedMessages) return;

//       try {
//         await launchWhatsappMessage(
//           parsed.personalizedMessages,
//           parsed.whatsappPackage || 'com.whatsapp',
//         );
//         await notifee.cancelNotification(notif.id);
//       } catch (err) {
//         console.error('Background send failed', err);
//       }
//     }
//   } catch (err) {
//     console.error('Background handler error', err);
//   }
// });

// // 👇 Export a no-op so the bundler keeps this file in build
// export default notifee;

// notifeeBackgroundNew.js
import notifee, {EventType} from '@notifee/react-native';
import {launchWhatsappMessage} from './src/util/WhatsappHelper';

notifee.onBackgroundEvent(async ({type, detail}) => {
  try {
    if (type === EventType.PRESS) {
      // NEW: Handle presses only (no auto-send on display)
      const notif = detail.notification;
      const data = notif?.data;
      if (!data?.scheduledJobId) return;

      const payload = data.payload;
      let parsed = null;
      try {
        parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
      } catch (e) {
        console.warn('Failed to parse payload', e);
        return;
      }

      if (!parsed?.personalizedMessages) return;

      // Directly trigger send (or just foreground app; foreground handler will catch)
      await launchWhatsappMessage(
        parsed.personalizedMessages,
        parsed.whatsappPackage || 'com.whatsapp',
      );
      // Optional: Cancel notif after send
      await notifee.cancelNotification(notif.id);
      // Optional: Mark as sent in DB (if you expose a background DB update)
    }
    // REMOVED: No handling for TRIGGER_NOTIFICATION (no auto-send)
  } catch (err) {
    console.error('Background handler error', err);
  }
});

// 👇 Export a no-op so the bundler keeps this file in build
export default notifee;

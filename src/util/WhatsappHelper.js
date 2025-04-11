import {Linking} from 'react-native';

export const launchWhatsappMessage = (phone, message, media) => {
  const url = `whatsapp://send?phone=${phone}&text=${encodeURIComponent(
    message,
  )}`;

  Linking.openURL(url).catch(() => {
    alert('WhatsApp not installed or invalid number');
  });

  // 📌 To send media, you'd need native code or automation
};

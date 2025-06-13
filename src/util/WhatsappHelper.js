import {NativeModules} from 'react-native';
const {WhatsappServiceModule} = NativeModules;

export const launchWhatsappMessage = (contacts, whatsappType) => {
  console.log('this is contact', contacts);
  WhatsappServiceModule.startSendingMessages(
    JSON.stringify(contacts),
    whatsappType, //
  );
};

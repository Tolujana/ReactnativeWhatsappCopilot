import {NativeModules} from 'react-native';
const {WhatsappServiceModule} = NativeModules;

export const launchWhatsappMessage = (contacts, whatsappType) => {
  WhatsappServiceModule.startSendingMessages(
    JSON.stringify(contacts),
    whatsappType, //
  );
};

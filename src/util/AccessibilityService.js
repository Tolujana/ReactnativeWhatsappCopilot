import {NativeModules} from 'react-native';

const {AccessibilityModule} = NativeModules;

export const openAccessibilitySettings = () => {
  AccessibilityModule.openAccessibilitySettings();
};

const {ContactPicker} = NativeModules;

export const openPicker = async () => {
  try {
    const result = await ContactPicker.openContactPicker();
    console.log('Contacts:', result);
  } catch (e) {
    console.warn('Error:', e);
  }
};

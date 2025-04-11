import {NativeModules} from 'react-native';

const {AccessibilityModule} = NativeModules;

export const openAccessibilitySettings = () => {
  AccessibilityModule.openAccessibilitySettings();
};

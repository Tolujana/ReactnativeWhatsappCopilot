import {NativeModules, Platform} from 'react-native';
const {AppServiceModule, AccessibilityHelper} = NativeModules;

export const launchWhatsappMessage = (contacts, whatsappType) => {
  console.log('this is contact', contacts);
  AppServiceModule.startSendingMessages(
    JSON.stringify(contacts),
    whatsappType,
    //
  );
};

export const checkOverlayPermission = async () => {
  if (Platform.OS !== 'android') return true;
  return await AccessibilityHelper.isOverlayPermissionGranted();
};

export const openOverlaySettings = () => {
  if (Platform.OS === 'android') {
    AccessibilityHelper.openOverlaySettings();
  }
};
export const checkAccessibilityPermission = async () => {
  // Note the format: package name + '/' + full service class name with leading dot
  const serviceId = 'com.copilot3/.AppAccessibilityService';
  try {
    const enabled = await AccessibilityHelper.isAccessibilityServiceEnabled(
      serviceId,
    );
    return enabled;
  } catch (e) {
    console.warn('Failed to check accessibility permission', e);
    return false;
  }
};

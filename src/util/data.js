// src/util/data.js
import {NativeModules} from 'react-native';
const {CampaignsModule} = NativeModules;
import Contacts from 'react-native-contacts';
// Helpers to normalize native responses
const toNumber = val => {
  if (val == null) return null;
  if (typeof val === 'number') return val;
  const parsed = Number(val);
  return Number.isNaN(parsed) ? null : parsed;
};

export const createTables = () => CampaignsModule.createTables();

// Premium toggles (native)
export const setPremium = enabled => CampaignsModule.setPremium(enabled);

export const isPremium = async () => {
  try {
    return await CampaignsModule.isPremium();
  } catch (e) {
    console.warn('isPremium error', e);
    return false;
  }
};

export const getPoints = async () => {
  try {
    const pts = await CampaignsModule.getPoints();
    return toNumber(pts) ?? 0;
  } catch (e) {
    console.warn('getPoints error', e);
    return 0;
  }
};

// Ads
export const preloadRewardedAd = async () => {
  try {
    await CampaignsModule.preloadRewardedAd();
    return true;
  } catch (e) {
    console.warn('preloadRewardedAd failed', e);
    throw e;
  }
};

export const showRewardedAd = async () => {
  try {
    // returns a map: { type: string, amount: number, balance: number }
    const reward = await CampaignsModule.showRewardedAd();
    return reward;
  } catch (e) {
    console.warn('showRewardedAd failed', e);
    throw e;
  }
};

// Campaigns
export const insertCampaign = async (name, description, extraFields = []) => {
  const json = JSON.stringify(extraFields);
  const id = await CampaignsModule.insertCampaignNative(
    name,
    description,
    json,
  );
  // native returns number (int)
  return toNumber(id);
};

export const deleteSentMessages = async ids => {
  try {
    await CampaignsModule.deleteSentMessagesNative(ids);
    return true;
  } catch (e) {
    console.warn('deleteSentMessages failed', e);
    throw e;
  }
};

export const getCampaigns = async () => {
  // returns an array of maps [{ id, name, description, extra_fields }]
  try {
    const arr = await CampaignsModule.getCampaignsNative();
    // Convert id to number consistently
    return Array.isArray(arr)
      ? arr.map(item => ({
          id: toNumber(item.id),
          name: item.name,
          description: item.description,
          extra_fields: item.extra_fields ?? item.extraFields ?? null,
        }))
      : [];
  } catch (e) {
    console.warn('getCampaigns failed', e);
    return [];
  }
};

export const deleteCampaignById = async id =>
  CampaignsModule.deleteCampaignByIdNative(Number(id));

export const updateCampaign = async (id, name, description) =>
  CampaignsModule.updateCampaignNative(Number(id), name, description);

// Contacts
export const insertContact1 = async (
  campaignId,
  name,
  phone,
  extraFields = {},
) => {
  const json = JSON.stringify(extraFields);
  const id = await CampaignsModule.insertContactNative(
    Number(campaignId),
    name,
    phone,
    json,
  );
  return toNumber(id);
};

export const insertContact = async (
  campaignId,
  name,
  phone,
  extraFields = {},
) => {
  const json = JSON.stringify(extraFields || {});
  // CampaignsModule.insertContactNative will now return an object:
  // { status: 'duplicate'|'inserted', phone, existing_id?, id? }
  const res = await CampaignsModule.insertContactNative(
    Number(campaignId),
    name,
    phone,
    json,
  );
  return res; // a JS object
};

export const insertContactNoDeduction = async (
  campaignId,
  name,
  phone,
  extraFields = {},
) => {
  const json = JSON.stringify(extraFields || {});
  // CampaignsModule.insertContactNative will now return an object:
  // { status: 'duplicate'|'inserted', phone, existing_id?, id? }
  const res = await CampaignsModule.insertContactNoDeduction(
    Number(campaignId),
    name,
    phone,
    json,
  );
  return res; // a JS object
};

export const getContactsByCampaignId = async campaignId => {
  try {
    const arr = await CampaignsModule.getContactsByCampaignIdNative(
      Number(campaignId),
    );
    return Array.isArray(arr)
      ? arr.map(item => ({
          id: toNumber(item.id),
          name: item.name,
          phone: item.phone,
          extra_field: item.extra_field,
        }))
      : [];
  } catch (e) {
    console.warn('getContactsByCampaignId failed', e);
    return [];
  }
};

export const deleteContacts1 = async ids =>
  CampaignsModule.deleteContactsNative(ids);

export const deleteContacts = async ids => {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new Error('No valid IDs provided for deletion');
  }

  // Ensure IDs are numbers (TurboModule expects consistent types)
  const validIds = ids.filter(id => Number.isInteger(id) && id > 0);

  if (validIds.length === 0) {
    throw new Error('No valid numeric IDs to delete');
  }

  try {
    // TurboModule call: Only pass ids; result/error via returned Promise
    const success = await CampaignsModule.deleteContactsNative(validIds);
    if (!success) {
      throw new Error('Delete operation failed on native side');
    }
    return success; // true from native
  } catch (error) {
    console.error('Native delete error:', error);
    throw new Error(`Failed to delete contacts: ${error.message}`);
  }
};

export const updateContact = async (
  contactId,
  name,
  phone,
  extraFields = {},
) => {
  const json = JSON.stringify(extraFields);
  return CampaignsModule.updateContactNative(
    Number(contactId),
    name,
    phone,
    json,
  );
};

export const getContactCountForCampaign = async campaignId => {
  try {
    const cnt = await CampaignsModule.getContactCountForCampaignNative(
      Number(campaignId),
    );
    return toNumber(cnt) ?? 0;
  } catch (e) {
    console.warn('getContactCountForCampaign failed', e);
    return 0;
  }
};

// Sent messages
export const insertSentMessage = async (successList, date) => {
  const json = JSON.stringify(successList);
  const id = await CampaignsModule.insertSentMessageNative(json, date);
  return toNumber(id);
};

export const getMessageReport = async () => {
  try {
    const rows = await CampaignsModule.getMessageReportNative();
    // rows: array of { id, date, data } where data is JSON string
    return Array.isArray(rows)
      ? rows.map(r => ({
          id: toNumber(r.id),
          date: r.date,
          data: JSON.parse(r.data),
        }))
      : [];
  } catch (e) {
    console.warn('getMessageReport failed', e);
    return [];
  }
};

export const checkDuplicatesAndReserveForImport = async (
  phones,
  campaignId,
  deduct = true, // Optional: true (default) deducts; false for dry-run check only
) => {
  if (!Array.isArray(phones) || phones.length === 0) {
    throw new Error('No phones provided for duplicate check/import reserve');
  }
  if (typeof campaignId !== 'number' || campaignId <= 0) {
    throw new Error('Invalid campaignId (must be positive number)');
  }

  try {
    // FIXED: Add NativeModules. prefix (required for TurboModule bridge)
    const result =
      await NativeModules.CampaignsModule.checkDuplicatesAndReserveForImport(
        JSON.stringify(phones),
        campaignId, // Maps to Double in native
        deduct, // Optional third arg (uses default true if omitted)
      );
    return JSON.parse(result); // Parse JSON string from native
  } catch (e) {
    console.error('Import reserve native error:', e); // Log for debugging
    throw new Error(` ${e.message}`);
  }
};

export const deductPointsForImport = async cost => {
  if (typeof cost !== 'number' || cost < 0) {
    throw new Error('Invalid cost (must be non-negative number)');
  }

  try {
    // Call native TurboModule method (1 arg + implicit Promise)
    const newBalance = await CampaignsModule.deductPointsForImport(cost);
    console.log(`Deducted ${cost} points. New balance: ${newBalance}`); // Optional log
    return {newBalance, cost}; // Return for UX (e.g., show in alert)
  } catch (e) {
    console.error('Deduct points native error:', e);
    throw new Error(`Failed to deduct points: ${e.message}`);
  }
};

// Reserve points for messages (pass array of contact ids)
export const reservePointsForMessagesByIds = async ids =>
  CampaignsModule.reservePointsForMessagesByIds(ids);

// Enable/disable backup for a specific chat (user chooses via UI)
export const enableBackup = async (app, contactIdentifier, name = null) =>
  CampaignsModule.enableBackup(app, contactIdentifier, name);

export const disableBackup = async (app, contactIdentifier) =>
  CampaignsModule.disableBackup(app, contactIdentifier);

// Enable/disable backup for all chats in an app (using '*' wildcard)
export const enableAllBackups = async app =>
  CampaignsModule.enableBackup(app, '*', 'All Chats');

export const disableAllBackups = async app =>
  CampaignsModule.disableBackup(app, '*');

// Get list of enabled backups
export const getEnabledBackups = async () => {
  try {
    const arr = await CampaignsModule.getEnabledBackups();
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    console.warn('getEnabledBackups failed', e);
    return [];
  }
};

// Retrieve chat messages (deducts 2 points)
export const getChatMessages = async (app, contactIdentifier) => {
  try {
    const arr = await CampaignsModule.getChatMessages(app, contactIdentifier);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    console.warn('getChatMessages failed', e);
    throw e; // Handle insufficient points in UI
  }
};

// Schedule the daily low points check (call once on app start or after DB init)
export const scheduleDailyLowPointsCheck = async () => {
  try {
    await CampaignsModule.scheduleDailyLowPointsCheck();
  } catch (e) {
    console.warn('scheduleDailyLowPointsCheck failed', e);
  }
};

// Get recent chats from notifications (app optional, null for all)
export const getRecentChats = async (app = null) => {
  try {
    const arr = await CampaignsModule.getRecentChats(app);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    console.warn('getRecentChats failed', e);
    return [];
  }
};

// Get device contacts using react-native-contacts (handle permissions)
export const getDeviceContacts = async () => {
  try {
    let hasPermission = false;
    if (Platform.OS === 'ios') {
      const permission = await Contacts.checkPermission();
      if (permission === 'undefined') {
        const granted = await Contacts.requestPermission();
        hasPermission = granted === 'authorized';
      } else {
        hasPermission = permission === 'authorized';
      }
    } else if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
        {
          title: 'Contacts Permission',
          message: 'This app needs access to your contacts.',
          buttonPositive: 'OK',
        },
      );
      hasPermission = granted === PermissionsAndroid.RESULTS.GRANTED;
    }

    if (!hasPermission) {
      throw new Error('Permission denied');
    }

    const contacts = await Contacts.getAll();
    // Format to similar structure: array of {name, phones: array of strings}
    return contacts
      .map(contact => ({
        name: contact.givenName || contact.displayName,
        phones: contact.phoneNumbers.map(p => p.number),
      }))
      .filter(c => c.phones.length > 0);
  } catch (e) {
    console.warn('getDeviceContacts failed', e);
    return [];
  }
};

// Notification access
export const isNotificationAccessGranted = async () => {
  try {
    return await CampaignsModule.isNotificationAccessGranted();
  } catch (e) {
    console.warn('isNotificationAccessGranted failed', e);
    return false;
  }
};

export const openNotificationAccessSettings = async () => {
  try {
    await CampaignsModule.openNotificationAccessSettings();
  } catch (e) {
    console.warn('openNotificationAccessSettings failed', e);
  }
};

// Auto-delete days
export const getAutoDeleteDays = async () => {
  try {
    const days = await CampaignsModule.getAutoDeleteDays();
    return toNumber(days) ?? 0;
  } catch (e) {
    console.warn('getAutoDeleteDays failed', e);
    return 0;
  }
};

export const setAutoDeleteDays = async days => {
  try {
    const res = await CampaignsModule.setAutoDeleteDays(Number(days));
    return toNumber(res);
  } catch (e) {
    console.warn('setAutoDeleteDays failed', e);
    throw e;
  }
};

export const getEnabledNotificationApps = async () => {
  try {
    const json = await CampaignsModule.getEnabledNotificationApps();
    return JSON.parse(json || '[]'); // Array of app package names, e.g., ["com.whatsapp", "org.telegram.messenger"]
  } catch (e) {
    console.warn('getEnabledNotificationApps failed', e);
    return [];
  }
};

export const setEnabledNotificationApps = async apps => {
  // apps: array of package names
  const json = JSON.stringify(apps);
  try {
    await CampaignsModule.setEnabledNotificationApps(json);
    return true;
  } catch (e) {
    console.warn('setEnabledNotificationApps failed', e);
    throw e;
  }
};

export const getBackupPrivateOnly = async () => {
  try {
    return await CampaignsModule.getBackupPrivateOnly();
  } catch (e) {
    console.warn('getBackupPrivateOnly failed', e);
    return false;
  }
};

export const setBackupPrivateOnly = async enabled => {
  try {
    await CampaignsModule.setBackupPrivateOnly(enabled);
    return enabled;
  } catch (e) {
    console.warn('setBackupPrivateOnly failed', e);
    throw e;
  }
};
// Export native module in case you need raw calls
export default CampaignsModule;

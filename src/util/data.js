// src/util/data.js
import {NativeModules} from 'react-native';
const {CampaignsModule} = NativeModules;

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

export const deleteContacts = async ids =>
  CampaignsModule.deleteContactsNative(ids);

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

// Reserve points for messages (pass array of contact ids)
export const reservePointsForMessagesByIds = async ids =>
  CampaignsModule.reservePointsForMessagesByIds(ids);

// Export native module in case you need raw calls
export default CampaignsModule;

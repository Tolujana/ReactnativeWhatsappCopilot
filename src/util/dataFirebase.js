// db.js – React Native Firebase v22+ compatible
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import functions from '@react-native-firebase/functions';
import app from '@react-native-firebase/app';

/* ---------------- Helpers ---------------- */

const db = firestore();

/** ✅ Get current UID or throw */
const getUid = () => {
  const uid = auth().currentUser?.uid;
  if (!uid) throw new Error('No user signed in');
  return uid;
};

/** ✅ Ensure user is signed in & refresh ID token */
export const ensureAuthAndRefreshToken = async () => {
  if (!auth().currentUser) {
    await new Promise((resolve, reject) => {
      const unsubscribe = auth().onAuthStateChanged(user => {
        unsubscribe();
        user ? resolve() : reject(new Error('User must be signed in'));
      });
    });
  }
  const user = auth().currentUser;
  if (!user) throw new Error('User must be signed in');
  await user.getIdToken(true); // 🔄 Refresh token
  return user;
};

/* ---------------- Cloud Functions ---------------- */

/** ✅ Create campaign */
export const createCampaign = async ({
  name,
  description = '',
  extraFields = {},
}) => {
  await ensureAuthAndRefreshToken();
  try {
    const fn = functions().httpsCallable('createCampaign');
    const res = await fn({name, description, extraFields});
    return res.data;
  } catch (e) {
    console.error('🔥 createCampaign error:', e);
    throw e;
  }
};

/** ✅ Update campaign */
export const updateCampaign = async ({campaignId, name, description = ''}) => {
  await ensureAuthAndRefreshToken();
  const fn = functions().httpsCallable('updateCampaign');
  const res = await fn({campaignId, name, description});
  return res.data;
};

/** ✅ Delete campaign */
export const deleteCampaign = async ({campaignId}) => {
  await ensureAuthAndRefreshToken();
  const fn = functions().httpsCallable('deleteCampaign');
  const res = await fn({campaignId});
  return res.data;
};

/** ✅ Create contact */
export const createContact = async ({
  campaignId,
  name,
  phone,
  extraFields = {},
}) => {
  await ensureAuthAndRefreshToken();
  const fn = functions().httpsCallable('createContact');
  const res = await fn({campaignId, name, phone, extraFields});
  return res.data;
};

/** ✅ Update contact */
export const updateContact = async ({
  campaignId,
  contactId,
  name,
  phone,
  extraFields = {},
}) => {
  await ensureAuthAndRefreshToken();
  const fn = functions().httpsCallable('updateContact');
  const res = await fn({campaignId, contactId, name, phone, extraFields});
  return res.data;
};

/** ✅ Delete contacts */
export const deleteContacts = async ({campaignId, ids = []}) => {
  await ensureAuthAndRefreshToken();
  const fn = functions().httpsCallable('deleteContacts');
  const res = await fn({campaignId, ids});
  return res.data;
};

/** ✅ Send messages */
export const sendMessages = async ({
  campaignId,
  messages = [],
  recipients = [],
  metadata = {},
}) => {
  await ensureAuthAndRefreshToken();
  const fn = functions().httpsCallable('sendMessages');
  const res = await fn({campaignId, messages, recipients, metadata});
  return res.data;
};

/** ✅ Claim reward points */
export const claimRewardPoints = async () => {
  await ensureAuthAndRefreshToken();
  const fn = functions().httpsCallable('claimRewardPoints');
  const res = await fn();
  return res.data;
};

/* ---------------- Firestore Reads ---------------- */

/** ✅ Get user points */
export const getPoints = async () => {
  const uid = getUid();
  const userRef = db.collection('users').doc(uid);
  const snapshot = await userRef.get();
  return snapshot.exists ? snapshot.data().points || 0 : 0;
};

/** ✅ Check premium status */
export const isPremium = async () => {
  const uid = getUid();
  const userRef = db.collection('users').doc(uid);
  const snapshot = await userRef.get();
  return snapshot.exists ? !!snapshot.data().premium : false;
};

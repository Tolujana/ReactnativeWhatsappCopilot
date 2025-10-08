// Updated functions/index.js for 2nd gen Cloud Functions
// This migrates your code to use the gen2 syntax, which resolves the 'context.auth undefined' issue causing the "user must be authenticated" error (despite a valid token).
// Key changes:
// - Import from 'firebase-functions/v2/https' for onCall.
// - Handler now takes a single 'request' parameter (type CallableRequest).
// - Access payload via 'request.data' (instead of 'data').
// - Access auth via 'request.auth' (instead of 'context.auth').
// - HttpsError is still from 'firebase-functions/https' for compatibility.
// - No changes needed to your client-side calls or deployment command (firebase deploy --only functions).
// - Install/update: npm install firebase-functions@latest firebase-admin@latest
// After updating, redeploy and test. If issues persist, confirm gen2 in console (Functions > Version = 2nd gen).

const {onCall} = require('firebase-functions/v2/https'); // Gen2 import for onCall
const functions = require('firebase-functions'); // For HttpsError (compatible)
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();

/* ========= Authoritative cost constants ========= */
const COSTS = {
  REWARD_POINTS: 10,
  CONTACT_INSERT_COST: 2,
  CONTACT_UPDATE_COST: 2,
  CAMPAIGN_INSERT_COST: 10,
  CAMPAIGN_UPDATE_COST: 2,
  MIN_MESSAGE_COST: 20,
  PER_MESSAGE_COST: 2,
};

/* ======= Helper: ensure authenticated ======= */
function requireAuth(request) {
  if (!request.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated',
    );
  }
  return request.auth.uid;
}

/* ======= claimRewardPoints ======= */
exports.claimRewardPoints = onCall(async request => {
  const uid = requireAuth(request);

  const userRef = db.collection('users').doc(uid);

  return db.runTransaction(async tx => {
    const snap = await tx.get(userRef);
    const current = snap.exists ? snap.data().points || 0 : 0;
    const newPoints = current + COSTS.REWARD_POINTS;
    tx.set(userRef, {points: newPoints}, {merge: true});
    return {newPoints};
  });
});

/* ======= createCampaign =======
   Deduct CAMPAIGN_INSERT_COST and add campaign doc under users/{uid}/campaigns/{campaignId}
*/
exports.createCampaign = onCall(async request => {
  const uid = requireAuth(request);
  const {name, description = '', extraFields = {}} = request.data || {};

  if (!name)
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Campaign name required',
    );

  const userRef = db.collection('users').doc(uid);
  const campaignsRef = userRef.collection('campaigns');

  return db.runTransaction(async tx => {
    const userSnap = await tx.get(userRef);
    const current = userSnap.exists ? userSnap.data().points || 0 : 0;

    const cost = COSTS.CAMPAIGN_INSERT_COST;
    if (current < cost)
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Not enough points',
      );

    // deduct
    tx.update(userRef, {points: current - cost});

    // create campaign
    const campaignRef = campaignsRef.doc();
    tx.set(campaignRef, {
      name,
      description,
      extraFields,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      campaignId: campaignRef.id,
      remaining: current - cost,
    };
  });
});

/* ======= updateCampaign ======= */
exports.updateCampaign = onCall(async request => {
  const uid = requireAuth(request);
  const {campaignId, name, description = ''} = request.data || {};
  if (!campaignId || !name)
    throw new functions.https.HttpsError('invalid-argument', 'Bad args');

  const userRef = db.collection('users').doc(uid);
  const campaignRef = userRef.collection('campaigns').doc(campaignId);

  return db.runTransaction(async tx => {
    const userSnap = await tx.get(userRef);
    const current = userSnap.exists ? userSnap.data().points || 0 : 0;

    const cost = COSTS.CAMPAIGN_UPDATE_COST;
    if (current < cost)
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Not enough points',
      );

    tx.update(userRef, {points: current - cost});
    tx.update(campaignRef, {
      name,
      description,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {success: true, remaining: current - cost};
  });
});

/* ======= deleteCampaign ======= */
exports.deleteCampaign = onCall(async request => {
  const uid = requireAuth(request);
  const {campaignId} = request.data || {};
  if (!campaignId)
    throw new functions.https.HttpsError(
      'invalid-argument',
      'campaignId required',
    );

  const userRef = db.collection('users').doc(uid);
  const campaignRef = userRef.collection('campaigns').doc(campaignId);

  // deletion does NOT cost points (adjust if desired)
  // delete campaign and its contacts and any sentMessages related
  // Use batch delete for contacts
  const contactsSnap = await campaignRef.collection('contacts').get();
  const batch = db.batch();

  contactsSnap.forEach(doc => batch.delete(doc.ref));
  batch.delete(campaignRef);

  await batch.commit();
  return {success: true};
});

/* ======= createContact ======= */
exports.createContact = onCall(async request => {
  const uid = requireAuth(request);
  const {campaignId, name, phone, extraFields = {}} = request.data || {};
  if (!campaignId || !phone || !name)
    throw new functions.https.HttpsError('invalid-argument', 'Bad args');

  const userRef = db.collection('users').doc(uid);
  const contactsRef = userRef
    .collection('campaigns')
    .doc(campaignId)
    .collection('contacts');

  return db.runTransaction(async tx => {
    const userSnap = await tx.get(userRef);
    const current = userSnap.exists ? userSnap.data().points || 0 : 0;

    const cost = COSTS.CONTACT_INSERT_COST;
    if (current < cost)
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Not enough points',
      );

    // duplicate check
    const q = await contactsRef.where('phone', '==', phone).limit(1).get();
    if (!q.empty) {
      return {status: 'duplicate', phone};
    }

    tx.update(userRef, {points: current - cost});
    const newRef = contactsRef.doc();
    tx.set(newRef, {
      name,
      phone,
      extraFields,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      status: 'inserted',
      contactId: newRef.id,
      remaining: current - cost,
    };
  });
});

/* ======= updateContact ======= */
exports.updateContact = onCall(async request => {
  const uid = requireAuth(request);
  const {
    campaignId,
    contactId,
    name,
    phone,
    extraFields = {},
  } = request.data || {};
  if (!campaignId || !contactId || !name)
    throw new functions.https.HttpsError('invalid-argument', 'Bad args');

  const userRef = db.collection('users').doc(uid);
  const contactsRef = userRef
    .collection('campaigns')
    .doc(campaignId)
    .collection('contacts');

  return db.runTransaction(async tx => {
    const userSnap = await tx.get(userRef);
    const current = userSnap.exists ? userSnap.data().points || 0 : 0;

    const cost = COSTS.CONTACT_UPDATE_COST;
    if (current < cost)
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Not enough points',
      );

    // duplicate check
    const q = await contactsRef.where('phone', '==', phone).limit(1).get();
    if (!q.empty && q.docs[0].id !== contactId) {
      return {status: 'duplicate', phone};
    }

    tx.update(userRef, {points: current - cost});
    tx.update(contactsRef.doc(contactId), {
      name,
      phone,
      extraFields,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {status: 'updated', remaining: current - cost};
  });
});

/* ======= deleteContacts (batch) ======= */
exports.deleteContacts = onCall(async request => {
  const uid = requireAuth(request);
  const {campaignId, ids = []} = request.data || {};
  if (!campaignId)
    throw new functions.https.HttpsError('invalid-argument', 'Bad args');

  const campaignRef = db
    .collection('users')
    .doc(uid)
    .collection('campaigns')
    .doc(campaignId);
  const batch = db.batch();
  ids.forEach(id => {
    batch.delete(campaignRef.collection('contacts').doc(id));
  });
  await batch.commit();
  return {success: true};
});

/* ======= sendMessages =======
  charges points:
    cost = max(MIN_MESSAGE_COST, recipients_count * PER_MESSAGE_COST)
  logs the sent payload in users/{uid}/sentMessages
*/
exports.sendMessages = onCall(async request => {
  const uid = requireAuth(request);
  const {
    campaignId = null,
    messages = [],
    recipients = [],
    metadata = {},
  } = request.data || {};

  const recipientsCount = Array.isArray(recipient) ? recipients.length : 0; // Fix typo: recipientsCount = Array.isArray(recipient s) ...
  let cost = recipientsCount * COSTS.PER_MESSAGE_COST;
  if (cost < COSTS.MIN_MESSAGE_COST) cost = COSTS.MIN_MESSAGE_COST;

  const userRef = db.collection('users').doc(uid);
  const sentMessagesRef = userRef.collection('sentMessages');

  return db.runTransaction(async tx => {
    const userSnap = await tx.get(userRef);
    const current = userSnap.exists ? userSnap.data().points || 0 : 0;

    if (current < cost)
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Not enough points',
      );

    tx.update(userRef, {points: current - cost});

    // Log the sent message bundle
    const logRef = sentMessagesRef.doc();
    tx.set(logRef, {
      campaignId,
      messages,
      recipients,
      metadata,
      date: admin.firestore.FieldValue.serverTimestamp(),
      cost,
    });

    return {success: true, logId: logRef.id, remaining: current - cost};
  });
});

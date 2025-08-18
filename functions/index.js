const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();

const COSTS = {
  sendMessage: 2, // credits per message sent
  insertCampaign: 5, // example cost for inserting campaign
  insertContact: 2, // credits per contact inserted
};

// Helper: check credits, deduct, and run transactional writes
async function consumeCreditsAndRun(uid, totalCost, operationCallback) {
  const userRef = db.collection('users').doc(uid);
  return db.runTransaction(async transaction => {
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User not found.');
    }
    const user = userDoc.data();

    // Premium users bypass credit consumption
    if (!user.isPremium) {
      const currentCredits = user.rewards?.credits || 0;
      if (currentCredits < totalCost) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Not enough credits.',
        );
      }
      transaction.update(userRef, {
        'rewards.credits': currentCredits - totalCost,
      });
    }

    // Run the operation-specific writes (like inserting docs)
    await operationCallback(transaction);

    return {success: true, deductedCredits: totalCost};
  });
}

// 1.a Send Messages Function
exports.sendMessages = functions.https.onCall(async (data, context) => {
  const uid = context.auth?.uid;
  if (!uid)
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be logged in.',
    );

  const messages = data.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Messages array is required.',
    );
  }

  const totalCost = COSTS.sendMessage * messages.length;

  return consumeCreditsAndRun(uid, totalCost, async transaction => {
    const sentMessagesRef = db.collection('sentMessages').doc();
    transaction.set(sentMessagesRef, {
      ownerId: uid,
      date: admin.firestore.FieldValue.serverTimestamp(),
      data: messages,
    });
  });
});

// 1.b Insert Campaign Function
exports.insertCampaign = functions.https.onCall(async (data, context) => {
  const uid = context.auth?.uid;
  if (!uid)
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be logged in.',
    );

  const {name, description, extraFields = []} = data;
  if (!name || !description) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Name and description are required.',
    );
  }

  return consumeCreditsAndRun(uid, COSTS.insertCampaign, async transaction => {
    const campaignRef = db.collection('campaigns').doc();
    transaction.set(campaignRef, {
      ownerId: uid,
      name,
      description,
      extraFields,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
});

// 1.c Insert Contacts Batch Function
exports.insertContacts = functions.https.onCall(async (data, context) => {
  const uid = context.auth?.uid;
  if (!uid)
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be logged in.',
    );

  const {campaignId, contacts} = data;
  if (!campaignId || !Array.isArray(contacts) || contacts.length === 0) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Campaign ID and contacts array are required.',
    );
  }

  const totalCost = COSTS.insertContact * contacts.length;

  return consumeCreditsAndRun(uid, totalCost, async transaction => {
    const contactsCollection = db.collection('contacts');
    contacts.forEach(contact => {
      const contactRef = contactsCollection.doc();
      transaction.set(contactRef, {
        ownerId: uid,
        campaignId,
        name: contact.name,
        phone: contact.phone,
        extraField: contact.extraField || {},
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
  });
});

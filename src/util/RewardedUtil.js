// RewardUtils.js (UX-level)
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

export const consumeCredits = async (cost = 2, feature = 'campaignAccess') => {
  const uid = auth().currentUser?.uid;
  const userRef = firestore().collection('users').doc(uid);
  const userSnap = await userRef.get();
  const user = userSnap.data();

  if (user?.isPremium) return true;

  const featureUnlock = user?.rewards?.[feature] ?? {};
  const expiresAt = featureUnlock?.expiresAt?.toDate?.() ?? new Date(0);
  if (!featureUnlock?.unlocked || new Date() > expiresAt) {
    throw new Error('Ad reward expired. Please watch another ad.');
  }

  const credits = user?.rewards?.credits ?? 0;
  if (credits < cost) throw new Error('Not enough credits. Watch an ad.');

  // Mirror deduction for UX (client-side update)
  await userRef.update({
    'rewards.credits': firestore.FieldValue.increment(-cost),
  });

  return true;
};

// RewardAdManager.js (snippet)
import {
  RewardedAd,
  RewardedAdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

const adUnitId = __DEV__ ? TestIds.REWARDED : 'ca-app-pub-xxxxx/yyyyy';

export function showRewardedAd() {
  const ad = RewardedAd.createForAdRequest(adUnitId);
  ad.load();

  return new Promise((resolve, reject) => {
    const unsubscribe = ad.onAdEvent(async (type, error, reward) => {
      if (type === RewardedAdEventType.LOADED) {
        ad.show();
      } else if (type === RewardedAdEventType.EARNED_REWARD) {
        // add 10 credits + set campaignAccess unlocked and expiresAt (24h)
        const uid = auth().currentUser?.uid;
        if (!uid) {
          unsubscribe();
          return reject(new Error('No user'));
        }
        try {
          await firestore()
            .collection('users')
            .doc(uid)
            .set(
              {
                rewards: {
                  credits: firestore.FieldValue.increment(10),
                  campaignAccess: {
                    unlocked: true,
                    expiresAt: firestore.Timestamp.fromMillis(
                      Date.now() + 24 * 60 * 60 * 1000,
                    ),
                  },
                },
              },
              {merge: true},
            );
          resolve();
        } catch (e) {
          reject(e);
        } finally {
          unsubscribe();
        }
      } else if (type === RewardedAdEventType.CLOSED) {
        unsubscribe();
      } else if (error) {
        unsubscribe();
        reject(error);
      }
    });
  });
}

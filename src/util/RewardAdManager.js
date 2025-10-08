import {
  RewardedAd,
  RewardedAdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';
import functions from '@react-native-firebase/functions';

// 👇 Replace with your real ad unit ID from AdMob console
const adUnitId = __DEV__
  ? TestIds.REWARDED
  : 'ca-app-pub-xxxxxxxxxxxxxxxx/xxxxxxxxxx';

let rewardedAd = null;

export const preloadRewardedAd = () => {
  rewardedAd = RewardedAd.createForAdRequest(adUnitId, {
    requestNonPersonalizedAdsOnly: true,
  });

  rewardedAd.load();
};

export const showRewardedAd = () => {
  return new Promise((resolve, reject) => {
    if (!rewardedAd) {
      reject(new Error('Rewarded ad not loaded'));
      return;
    }

    const unsubscribe = rewardedAd.addAdEventListener(
      RewardedAdEventType.EARNED_REWARD,
      async reward => {
        console.log('🎉 User earned reward:', reward);

        try {
          // Call Firebase function to securely add points
          const result = await functions().httpsCallable('claimRewardPoints')({
            adType: 'rewarded',
          });

          console.log('✅ Points updated:', result.data.points);
          resolve(result.data.points);
        } catch (e) {
          console.error('❌ Failed to claim reward points:', e);
          reject(e);
        }
      },
    );

    rewardedAd.addAdEventListener(RewardedAdEventType.CLOSED, () => {
      unsubscribe();
      loadRewardedAd(); // preload next ad
    });

    rewardedAd.show().catch(err => {
      console.error('Ad failed to show:', err);
      reject(err);
    });
  });
};

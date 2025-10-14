import React, { useEffect, useState } from 'react';
import {
  Button,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import {Text, Surface, useTheme, IconButton} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Animated, {FadeInDown} from 'react-native-reanimated';
import {useNavigation} from '@react-navigation/native';
import {getAuth, signOut} from '@react-native-firebase/auth';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { getPoints, preloadRewardedAd, showRewardedAd } from '../util/data';

const MENU_ITEMS = {
  'Bulk Messaging': [
    {
      title: 'Msg unsaved contacts',
      icon: 'account-question',
      screen: 'SendMessageToNonContact',
    },
    {
      title: 'Create/edit campaign',
      icon: 'playlist-edit',
      screen: 'CreateCampaign',
    },
    {
      title: 'Send bulk messages',
      icon: 'send',
      screen: 'Campaign Selection',
    },
    {title: 'Message history', icon: 'history', screen: 'MessageReport'},
    {title: 'Settings', icon: 'cog', screen: 'SettingsScreen'},
  ],
  'Status Saver': [
    {title: 'Save status', icon: 'download', screen: 'StatusSaver'},
    {title: 'Settings', icon: 'cog-outline', screen: 'StatusSaver Settings'},
  ],
  'Messenger Cleanup': [
    {title: 'Clean up', icon: 'bin', screen: 'Messenger Cleanup'},
    {
      title: 'Settings',
      icon: 'cog-outline',
      screen: 'MessangerCleanup Settings',
    },
  ],
};

export const signOutAnonymous = async () => {
  try {
    const authInstance = getAuth();
    await signOut(authInstance);
    console.log('Anonymous user signed out successfully');
  } catch (error) {
    console.error('Error signing out anonymous user:', error.message);
    throw error;
  }
};

const MenuCard = ({title, icon, screen, cardWidth}) => {
  const navigation = useNavigation();
  const theme = useTheme();
  const handlePress = () => {
    navigation.navigate(screen);
  };

  return (
    <Animated.View entering={FadeInDown.springify()} style={{width: cardWidth}}>
      <Surface
        style={[
          styles.menuCard,
          {backgroundColor: theme.colors.elevation.level1},
        ]}
        elevation={2}
        onTouchEnd={() => navigation.navigate(screen)}>
        <Icon name={icon} size={30} color={theme.colors.primary} />
        <Text style={styles.menuCardText}>{title}</Text>
      </Surface>
    </Animated.View>
  );
};

const CategorySection = ({title, items, cardWidth}) => (
  <View style={styles.categorySection}>
    <Text style={styles.categorySectionTitle}>{title}</Text>
    <View style={styles.categorySectionItems}>
      {items.map((item, index) => (
        <MenuCard
          key={index}
          title={item.title}
          icon={item.icon}
          screen={item.screen}
          cardWidth={cardWidth}
        />
      ))}
    </View>
  </View>
);

export default function Home({toggleTheme}) {
  const {width} = useWindowDimensions();
  const cardWidth = (width - 48) / 3; // 3 items per row with spacing
  const theme = useTheme();
  const [points, setPoints] = useState(0);

  const fetchPoints = async () => {
    const currentPoints = await getPoints();
    setPoints(currentPoints);
  };

  const handleWatchAd = async () => {
    try {
      const reward = await showRewardedAd();
      setPoints(reward.balance);
    } catch (e) {
      console.warn('Failed to show rewarded ad', e);
    }
  };

  useEffect(() => {
    preloadRewardedAd();
    fetchPoints();
  }, []);

  return (
    <ScrollView
      style={[styles.container, {backgroundColor: theme.colors.background}]}>
      <View style={styles.header}>
        <Text style={styles.pointsText}>Points: {points}</Text>
        <View style={styles.headerButtons}>
          <IconButton icon="theme-light-dark" onPress={toggleTheme} />
          <IconButton icon="video" onPress={handleWatchAd} />
        </View>
      </View>
      <Button title="Sign Out" onPress={signOutAnonymous} color="#ff4444" />

      {Object.entries(MENU_ITEMS).map(([category, items], index) => (
        <View key={index}>
          <CategorySection
            title={category}
            items={items}
            cardWidth={cardWidth}
          />
          {index === 0 && (
            <View style={styles.bannerContainer}>
              <BannerAd
                unitId="ca-app-pub-3940256099942544/6300978111"
                size={BannerAdSize.BANNER}
              />
            </View>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  pointsText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerButtons: {
    flexDirection: 'row',
  },
  categorySection: {
    marginBottom: 24,
  },
  categorySectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  categorySectionItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  menuCard: {
    aspectRatio: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  menuCardText: {
    marginTop: 8,
    fontSize: 12,
    textAlign: 'center',
  },
  bannerContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
});
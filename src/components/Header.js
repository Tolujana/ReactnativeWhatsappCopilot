// src/components/Header.js
import React, {useCallback, useEffect, useState} from 'react';
import {View, StyleSheet} from 'react-native';
import {
  Text,
  IconButton,
  Button as PaperButton,
  useTheme,
} from 'react-native-paper';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {getPoints, preloadRewardedAd, showRewardedAd} from '../util/data';

const Header = ({toggleTheme, showBackButton = true}) => {
  const [points, setPoints] = useState(0);
  const navigation = useNavigation();
  const theme = useTheme();

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

  useFocusEffect(
    useCallback(() => {
      preloadRewardedAd();
      fetchPoints();
    }, []),
  );

  return (
    <View style={[styles.header, {backgroundColor: theme.colors.background}]}>
      <View style={styles.leftSection}>
        {showBackButton && (
          <IconButton
            icon="arrow-left"
            onPress={() => navigation.goBack()}
            iconColor={theme.colors.primary}
            style={styles.noSpaceButton}
          />
        )}
        <Text style={[styles.pointsText]}>Points: {points}</Text>
      </View>
      <View style={styles.headerButtons}>
        <IconButton
          icon="theme-light-dark"
          onPress={toggleTheme}
          iconColor={theme.colors.primary}
        />
        <PaperButton mode="outlined" compact onPress={handleWatchAd}>
          Watch Ads
        </PaperButton>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 4,
    paddingHorizontal: 6,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pointsText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 16,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  noSpaceButton: {
    margin: -8, // Pulls the button inward
    padding: 0,
    width: 24,
    height: 24,
  },
});

export default Header;
// File: src/components/Header.js

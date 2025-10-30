import React, {useState, useEffect} from 'react';
import {View, StyleSheet} from 'react-native';
import {
  PaperProvider,
  MD3LightTheme,
  MD3DarkTheme,
  ActivityIndicator,
} from 'react-native-paper';
import AppNavigator from './src/AppNavigator';
import mobileAds from 'react-native-google-mobile-ads';

import {get} from 'react-native/Libraries/TurboModule/TurboModuleRegistry';
import {scheduleDailyLowPointsCheck, createTables} from './src/util/data';
scheduleDailyLowPointsCheck();

const MainApp = ({toggleTheme}) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return user ? <AppNavigator toggleTheme={toggleTheme} /> : <LoginScreen />;
};

const App = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const theme = isDarkMode ? MD3DarkTheme : MD3LightTheme;

  useEffect(() => {
    // Initialize database and wildcards on app startup
    const initializeApp = async () => {
      try {
        console.log('Initializing database...');
        await createTables();
        console.log('Database initialized successfully');
      } catch (error) {
        console.error('Failed to initialize database:', error);
      }
    };

    initializeApp();
  }, []);

  useEffect(() => {
    const initAds = async () => {
      try {
        await mobileAds().initialize();
        console.log('AdMob SDK initialized successfully');
      } catch (error) {
        console.error('Error initializing AdMob:', error);
      }
    };

    initAds();
  }, []);

  return (
    <PaperProvider theme={theme}>
      <AppNavigator toggleTheme={() => setIsDarkMode(prev => !prev)} />
    </PaperProvider>
  );
};

const styles = StyleSheet.create({
  centered: {flex: 1, justifyContent: 'center', alignItems: 'center'},
});

export default App;

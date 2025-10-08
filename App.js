import React, {useState, useEffect} from 'react';
import {View, StyleSheet} from 'react-native';
import {
  PaperProvider,
  MD3LightTheme,
  MD3DarkTheme,
  ActivityIndicator,
} from 'react-native-paper';
import {getAuth, onAuthStateChanged} from '@react-native-firebase/auth'; // ✅ Import the default instance
import AppNavigator from './src/AppNavigator';
import LoginScreen from './src/screens/LoginScreen';
import {get} from 'react-native/Libraries/TurboModule/TurboModuleRegistry';

const MainApp = ({toggleTheme}) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, u => {
      setUser(u);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

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

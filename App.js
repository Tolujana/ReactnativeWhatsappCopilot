import React, {useEffect, useState} from 'react';
import {
  View,
  StyleSheet,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  PaperProvider,
  MD3LightTheme,
  MD3DarkTheme,
  Button,
  Text,
  TextInput,
  useTheme,
  ActivityIndicator,
} from 'react-native-paper';
import AppNavigator from './src/AppNavigator';
import {createTables} from './src/util/database';
import {
  signInAnonymously,
  signInWithEmail,
  signInWithGoogle,
} from './src/util/AuthManager';
import auth from '@react-native-firebase/auth';

const App = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const theme = isDarkMode ? MD3DarkTheme : MD3LightTheme;

  useEffect(() => {
    createTables();

    // Listen for authentication state changes
    // const unsubscribe = auth().onAuthStateChanged(u => {
    //   setUser(u);
    //   setLoading(false);
    // });

    // return unsubscribe;
  }, []);

  // const handleEmailLogin = async () => {
  //   try {
  //     await signInWithEmail(email, password);
  //   } catch (err) {
  //     console.error('Email login error:', err);
  //   }
  // };

  // if (loading) {
  //   return (
  //     <View style={styles.centered}>
  //       <ActivityIndicator size="large" />
  //     </View>
  //   );
  // }

  // if (!user) {
  //   return (
  //     <PaperProvider theme={theme}>
  //       <ImageBackground
  //         source={require('./assets/login-bg.jpg')}
  //         style={styles.background}>
  //         <KeyboardAvoidingView
  //           behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  //           style={styles.overlay}>
  //           <View style={styles.loginBox}>
  //             <Text variant="headlineLarge" style={styles.title}>
  //               Welcome to MyApp
  //             </Text>
  //             <Text style={styles.subtitle}>Sign in to continue</Text>

  //             <TextInput
  //               label="Email"
  //               value={email}
  //               onChangeText={setEmail}
  //               mode="outlined"
  //               style={styles.input}
  //               keyboardType="email-address"
  //               autoCapitalize="none"
  //             />
  //             <TextInput
  //               label="Password"
  //               value={password}
  //               onChangeText={setPassword}
  //               mode="outlined"
  //               secureTextEntry
  //               style={styles.input}
  //             />

  //             <Button
  //               mode="contained"
  //               onPress={handleEmailLogin}
  //               style={styles.button}>
  //               Sign in with Email
  //             </Button>

  //             <Button
  //               mode="outlined"
  //               icon="google"
  //               onPress={signInWithGoogle}
  //               style={styles.button}>
  //               Sign in with Google
  //             </Button>

  //             <Button
  //               mode="text"
  //               onPress={signInAnonymously}
  //               style={styles.button}>
  //               Continue as Guest
  //             </Button>
  //           </View>
  //         </KeyboardAvoidingView>
  //       </ImageBackground>
  //     </PaperProvider>
  //   );
  // }

  return (
    <PaperProvider theme={theme}>
      <AppNavigator toggleTheme={() => setIsDarkMode(prev => !prev)} />
    </PaperProvider>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
    justifyContent: 'center',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  loginBox: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    elevation: 4,
  },
  title: {
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 16,
    color: '#666',
  },
  input: {
    marginBottom: 12,
  },
  button: {
    marginVertical: 6,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default App;

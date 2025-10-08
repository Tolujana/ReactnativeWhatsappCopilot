import React, {useState} from 'react';
import {
  View,
  StyleSheet,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {Button, Text, TextInput} from 'react-native-paper';
import {
  signInAnonymously,
  signInWithEmail,
  signInWithGoogle,
} from '../util/AuthManager';

const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error('Google login error:', err);
    }
  };

  const handleEmailLogin = async () => {
    try {
      await signInWithEmail(email, password);
    } catch (err) {
      console.error('Email login error:', err);
    }
  };

  return (
    <ImageBackground
      source={require('../../assets/login-bg.jpg')}
      style={styles.background}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}>
        <View style={styles.loginBox}>
          <Text variant="headlineLarge" style={styles.title}>
            Welcome to MyApp
          </Text>
          <Text style={styles.subtitle}>Sign in to continue</Text>

          <TextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            mode="outlined"
            style={styles.input}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            mode="outlined"
            secureTextEntry
            style={styles.input}
          />

          <Button
            mode="contained"
            onPress={handleEmailLogin}
            style={styles.button}>
            Sign in with Email
          </Button>

          <Button
            mode="outlined"
            icon="google"
            onPress={handleGoogleLogin}
            style={styles.button}>
            Sign in with Google
          </Button>

          <Button mode="text" onPress={signInAnonymously} style={styles.button}>
            Continue as Guest
          </Button>
        </View>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: {flex: 1, justifyContent: 'center'},
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
  title: {fontWeight: 'bold', textAlign: 'center', marginBottom: 4},
  subtitle: {textAlign: 'center', marginBottom: 16, color: '#666'},
  input: {marginBottom: 12},
  button: {marginVertical: 6},
});

export default LoginScreen;

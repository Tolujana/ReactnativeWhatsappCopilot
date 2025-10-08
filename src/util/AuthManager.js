// src/AuthManager.js
import {getApp} from '@react-native-firebase/app'; // ✅ Add this for modular-safe app reference
import auth from '@react-native-firebase/auth';
import GoogleSignIn from './NativeSignin';

/**
 * ✅ Google Sign-In (Native, Recommended)
 *
 * - Opens the native Google Sign-In flow on Android
 * - Returns ID token & basic profile info
 * - Signs in to Firebase with the returned credential
 */
export const signInWithGoogle = async () => {
  try {
    console.log('Starting native Google Sign-In...');

    // 1️⃣ Configure the native sign-in client with your webClientId
    await GoogleSignIn.configure();

    // 2️⃣ Launch the native sign-in popup and get credential info
    const result = await GoogleSignIn.signIn();
    console.log('Google sign-in result:', result);

    // 3️⃣ ✅ Use GoogleAuthProvider from the correct namespace
    const googleCredential = auth.GoogleAuthProvider.credential(result.idToken);

    // 4️⃣ ✅ Sign in with credential on the specific app instance (avoid deprecated call)
    const firebaseUser = await auth(getApp()).signInWithCredential(
      googleCredential,
    );

    console.log('✅ Firebase sign-in successful:', firebaseUser.user?.email);
    return firebaseUser.user;
  } catch (error) {
    console.error('❌ Google Sign-In error:', error);
    throw error;
  }
};

/**
 * 🔑 Email & Password Sign-In
 */
export const signInWithEmail = async (email, password) => {
  try {
    return await auth().signInWithEmailAndPassword(email, password);
  } catch (err) {
    console.error('Email sign-in error:', err);
    throw err;
  }
};

/**
 * 🆕 Email & Password Sign-Up
 */
export const signUpWithEmail = async (email, password) => {
  try {
    return await auth().createUserWithEmailAndPassword(email, password);
  } catch (err) {
    console.error('Email sign-up error:', err);
    throw err;
  }
};

/**
 * 👤 Anonymous Sign-In
 */
export const signInAnonymously = async () => {
  try {
    return await auth().signInAnonymously();
  } catch (err) {
    console.error('Anonymous sign-in error:', err);
    throw err;
  }
};

/**
 * 🔓 Sign Out
 */
export const signOut = async () => {
  try {
    return await auth().signOut();
  } catch (err) {
    console.error('Sign out error:', err);
    throw err;
  }
};

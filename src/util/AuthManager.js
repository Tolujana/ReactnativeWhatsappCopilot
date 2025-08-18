// src/AuthManager.js
import auth from '@react-native-firebase/auth';
import {GoogleSignin} from '@react-native-google-signin/google-signin';

// 🔹 Google Sign-in
export const signInWithGoogle = async () => {
  await GoogleSignin.hasPlayServices({showPlayServicesUpdateDialog: true});
  const {idToken} = await GoogleSignin.signIn();
  const googleCredential = auth.GoogleAuthProvider.credential(idToken);
  return auth().signInWithCredential(googleCredential);
};

// 🔹 Email & Password
export const signInWithEmail = (email, password) => {
  return auth().signInWithEmailAndPassword(email, password);
};

export const signUpWithEmail = (email, password) => {
  return auth().createUserWithEmailAndPassword(email, password);
};

// 🔹 Anonymous Sign-in
export const signInAnonymously = () => {
  return auth().signInAnonymously();
};

// 🔹 Logout
export const signOut = () => {
  return auth().signOut();
};

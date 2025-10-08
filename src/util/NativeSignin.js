import {NativeModules} from 'react-native';
const {GoogleSignInModule} = NativeModules;

const GoogleSignIn = {
  configure() {
    // pass the same client ID hard-coded in Kotlin
    return GoogleSignInModule.configure(
      '563969099998-es1mllnbgqn0hbc60q2j6q46g7dq1itb.apps.googleusercontent.com',
    );
  },

  async signIn() {
    await GoogleSignInModule.configure(
      '563969099998-es1mllnbgqn0hbc60q2j6q46g7dq1itb.apps.googleusercontent.com',
    );
    return await GoogleSignInModule.signIn();
  },

  async signOut() {
    return await GoogleSignInModule.signOut();
  },
};

export default GoogleSignIn;

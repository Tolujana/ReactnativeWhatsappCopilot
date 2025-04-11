/**
 * @format
 */

import {AppRegistry} from 'react-native';
//import App from './App';

import {name as appName} from './app.json';
import AppNavigator from './src/AppNavigator';
import App from './App';

AppRegistry.registerComponent(appName, () => App);

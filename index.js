/**
 * @format
 */

import {AppRegistry} from 'react-native';
//import App from './App';
import './notifeeBackground';

import {name as appName} from './app.json';
import AppNavigator from './src/AppNavigator';
import App from './App';

AppRegistry.registerComponent(appName, () => App);

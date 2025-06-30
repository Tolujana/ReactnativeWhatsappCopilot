import React, {useEffect, useState} from 'react';
import {PaperProvider, MD3LightTheme, MD3DarkTheme} from 'react-native-paper';
import AppNavigator from './src/AppNavigator';
import {createTables} from './src/util/database';

const App = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  const theme = isDarkMode ? MD3DarkTheme : MD3LightTheme;

  useEffect(() => {
    createTables();
  }, []);

  return (
    <PaperProvider theme={theme}>
      <AppNavigator toggleTheme={() => setIsDarkMode(prev => !prev)} />
    </PaperProvider>
  );
};

export default App;

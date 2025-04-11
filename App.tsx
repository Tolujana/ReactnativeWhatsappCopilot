import {PaperProvider} from 'react-native-paper';
import AppNavigator from './src/AppNavigator';
import {useEffect} from 'react';
import {createTables} from './src/util/database';

const App = () => {
  useEffect(() => {
    createTables();
  }, []);
  return (
    <PaperProvider>
      <AppNavigator />
    </PaperProvider>
  );
};
export default App;

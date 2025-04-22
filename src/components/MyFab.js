import React from 'react';
import {FAB} from 'react-native-paper';
import {useNavigation} from '@react-navigation/native';

const MyFab = ({handleAddContacts, setFabOpen, styling}) => {
  const navigation = useNavigation();

  const handleContactSelect = () => {
    navigation.navigate('ContactSelectScreen', {
      onDone: handleAddContacts,
    });
    setFabOpen(false);
  };

  return (
    <FAB
      small
      icon="contacts"
      label="Import from Contacts"
      style={[styling, {bottom: 170}]}
      onPress={handleContactSelect}
    />
  );
};

export default MyFab;

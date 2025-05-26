import React from 'react';
import {FAB} from 'react-native-paper';
import {useNavigation} from '@react-navigation/native';

const MyFab = ({handleAddContacts, setFabOpen, styling, campaign}) => {
  const navigation = useNavigation();

  const handleContactSelect = () => {
    console.log('fab campagin', campaign);
    console.log('FAB was pressed');
    navigation.navigate('ContactSelectScreen', {
      onDone: handleAddContacts,
      campaign,
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

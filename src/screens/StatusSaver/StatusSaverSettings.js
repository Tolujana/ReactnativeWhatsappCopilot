import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet, Alert} from 'react-native';
import {NativeModules} from 'react-native';
import {useNavigation} from '@react-navigation/native';

const {StatusModule} = NativeModules;

export default function StatusSaverSettings() {
  const navigation = useNavigation();

  const handleChangeFolder = async () => {
    try {
      const all = await StatusModule.openStatusFolderPicker();
      if (!all || all.length === 0) {
        Alert.alert(
          'No statuses found',
          'View statuses first via WhatsApp, Telegram, etc.',
        );
        return;
      }
      Alert.alert('Folder Changed', 'Media folders were updated.');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      <TouchableOpacity style={styles.btn} onPress={handleChangeFolder}>
        <Text style={{color: '#fff'}}>Change Selected Folder</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  title: {fontSize: 24, marginBottom: 20},
  btn: {
    backgroundColor: '#1976d2',
    padding: 12,
    paddingHorizontal: 20,
    borderRadius: 6,
  },
});

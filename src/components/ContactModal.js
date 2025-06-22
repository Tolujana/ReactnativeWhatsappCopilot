import React, {useEffect, useState} from 'react';
import {View, StyleSheet} from 'react-native';
import {Modal, TextInput, Text, Button} from 'react-native-paper';

export default function ContactModal({
  visible,
  onDismiss,
  onSave,
  initialData = {},
  extraFieldsKeys = [],
  isEditMode = false,
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [extraFields, setExtraFields] = useState({});
  console.log('ContactModal rendered with initialData:', extraFieldsKeys);

  useEffect(() => {
    if (visible) {
      setName(initialData.name || '');
      setPhone(initialData.phone || '');

      // Parse `extra_field` if it exists and is a string
      let parsedExtraFields = {};
      if (typeof initialData.extra_field === 'string') {
        try {
          const parsed = JSON.parse(initialData.extra_field);
          // Force all keys to lowercase
          parsedExtraFields = Object.fromEntries(
            Object.entries(parsed).map(([k, v]) => [k.toLowerCase(), v]),
          );
        } catch (e) {
          console.warn('Invalid JSON in extra_field:', e);
        }
      }

      setExtraFields(parsedExtraFields);
    }
  }, [visible, initialData]);

  const handleSave = () => {
    onSave({name, phone, extraFields});
  };

  return (
    <Modal
      visible={visible}
      onDismiss={onDismiss}
      contentContainerStyle={styles.modalContainer}>
      <Text style={styles.title}>
        {isEditMode ? 'Edit Contact' : 'Add Contact'}
      </Text>
      <TextInput
        label="Name"
        value={name}
        onChangeText={setName}
        mode="outlined"
        style={styles.input}
      />
      <TextInput
        label="Phone"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        mode="outlined"
        style={styles.input}
      />

      {extraFieldsKeys.map(field => {
        const key = field.toLowerCase();
        return (
          <TextInput
            key={field}
            label={field}
            value={extraFields[key] || ''}
            onChangeText={text =>
              setExtraFields(prev => ({...prev, [key]: text}))
            }
            autoCapitalize="none"
            mode="outlined"
            style={styles.input}
          />
        );
      })}

      <Button mode="contained" onPress={handleSave}>
        Save
      </Button>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    backgroundColor: 'white',
    padding: 20,
    margin: 20,
    borderRadius: 8,
  },
  title: {
    marginBottom: 10,
    fontWeight: 'bold',
    fontSize: 18,
  },
  input: {
    marginBottom: 10,
  },
});

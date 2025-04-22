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

  useEffect(() => {
    if (visible) {
      setName(initialData.name || '');
      setPhone(initialData.phone || '');
      setExtraFields(initialData.extraFields || {});
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

      {extraFieldsKeys.map(field => (
        <TextInput
          key={field}
          label={field}
          value={extraFields[field] || ''}
          onChangeText={text =>
            setExtraFields(prev => ({...prev, [field]: text}))
          }
          mode="outlined"
          style={styles.input}
        />
      ))}

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

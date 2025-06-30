import React, {useState} from 'react';
import {View} from 'react-native';
import {Dialog, TextInput, Button, Text} from 'react-native-paper';

const CampaignDialog = ({visible, onDismiss, onSave}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [extraFields, setExtraFields] = useState([]);
  const [newField, setNewField] = useState('');

  const handleAddExtraField = () => {
    if (newField.trim()) {
      setExtraFields([...extraFields, newField.trim().toLowerCase()]);
      setNewField('');
    }
  };

  const handleSave = () => {
    onSave({name, description, extraFields});
    setName('');
    setDescription('');
    setExtraFields([]);
    setNewField('');
  };

  return (
    <Dialog visible={visible} onDismiss={onDismiss}>
      <Dialog.Title>Create Campaign</Dialog.Title>
      <Dialog.Content>
        <TextInput
          label="Name"
          value={name}
          onChangeText={setName}
          mode="outlined"
          style={{marginBottom: 10}}
        />
        <TextInput
          label="Description"
          value={description}
          onChangeText={setDescription}
          mode="outlined"
          multiline
          numberOfLines={3}
          style={{marginBottom: 10}}
        />
        <View style={{marginBottom: 10}}>
          <Text variant="titleMedium" style={{marginBottom: 6}}>
            Optional Fields (e.g. Age, Location)
          </Text>
          {extraFields.map((field, index) => (
            <Text key={index}>✔️ {field}</Text>
          ))}
        </View>

        <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
          <TextInput
            label="Add Field"
            value={newField}
            onChangeText={setNewField}
            mode="outlined"
            style={{flex: 1}}
          />
          <Button mode="contained" onPress={handleAddExtraField}>
            Add
          </Button>
        </View>
      </Dialog.Content>
      <Dialog.Actions>
        <Button onPress={onDismiss}>Cancel</Button>
        <Button onPress={handleSave}>Save</Button>
      </Dialog.Actions>
    </Dialog>
  );
};

export default CampaignDialog;

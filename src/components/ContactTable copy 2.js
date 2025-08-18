import React, {useEffect, useState} from 'react';
import {
  Alert,
  StyleSheet,
  ScrollView,
  View,
  Text,
  Dimensions,
  TextInput,
} from 'react-native';
import {
  DataTable,
  Checkbox,
  IconButton,
  FAB,
  ActivityIndicator,
  Button,
  Modal,
  Portal,
} from 'react-native-paper';
import {
  deleteContacts,
  updateContact,
  updateContactInDB,
} from '../util/database';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function ContactTable({
  contacts,
  selectedContacts,
  toggleSelectContact,
  openEditModal,
  fetchContacts,
  loading = false,
  extraFieldsKeys = [],
}) {
  const [invalidIds, setInvalidIds] = useState([]);
  const [visibleFields, setVisibleFields] = useState([]);
  const [showFieldSelector, setShowFieldSelector] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editableData, setEditableData] = useState([]);
  const [focusedField, setFocusedField] = useState(null); // rowId_fieldName

  useEffect(() => {
    if (Array.isArray(contacts)) {
      const parsed = contacts.map(contact => ({
        ...contact,
        extra_field: contact.extra_field ? JSON.parse(contact.extra_field) : {},
      }));
      setEditableData(parsed);
      setIsLoading(false);
    }
  }, [contacts]);

  const isAnySelected = Object.values(selectedContacts).some(v => v);
  const hasInvalidNumbers = invalidIds.length > 0;

  const handleDelete = () => {
    const idsToDelete = Object.entries(selectedContacts)
      .filter(([_, selected]) => selected)
      .map(([id]) => id);

    if (idsToDelete.length === 0) return;

    Alert.alert('Delete', `Delete ${idsToDelete.length} contact(s)?`, [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteContacts(idsToDelete, fetchContacts);
        },
      },
    ]);
  };

  const toggleField = field => {
    setVisibleFields(prev =>
      prev.includes(field) ? prev.filter(f => f !== field) : [...prev, field],
    );
  };

  const toggleEditMode = async () => {
    if (isEditing) {
      for (const contact of editableData) {
        await updateContact(
          contact.id,
          contact.name,
          contact.phone,
          contact.extra_field || {},
          true, // or false if you want to skip duplicate check
        );
      }
      fetchContacts();
    }
    setIsEditing(prev => !prev);
  };

  return (
    <View style={{flex: 1}}>
      {/* Modal for toggling field visibility */}
      <Portal>
        <Modal
          visible={showFieldSelector}
          onDismiss={() => setShowFieldSelector(false)}
          contentContainerStyle={styles.modal}>
          <Text style={styles.modalTitle}>Toggle Visible Fields</Text>

          {extraFieldsKeys.length === 0 ? (
            <Text>No extra fields to show</Text>
          ) : (
            extraFieldsKeys.map(field => (
              <View key={field} style={styles.checkboxRow}>
                <Checkbox
                  status={
                    visibleFields.includes(field) ? 'checked' : 'unchecked'
                  }
                  onPress={() => toggleField(field)}
                />
                <Text>{field}</Text>
              </View>
            ))
          )}

          <Button
            onPress={() => setShowFieldSelector(false)}
            mode="contained"
            style={{marginTop: 10}}>
            Done
          </Button>
        </Modal>
      </Portal>

      <View style={styles.actionsRow}>
        <Button
          icon="eye"
          mode="outlined"
          onPress={() => setShowFieldSelector(true)}>
          Columns
        </Button>
        <Button
          icon={isEditing ? 'content-save' : 'pencil'}
          mode="contained"
          onPress={toggleEditMode}
          style={{marginLeft: 10}}>
          {isEditing ? 'Save' : 'Edit All'}
        </Button>
      </View>

      {isLoading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator animating size="large" />
        </View>
      ) : (
        <>
          {hasInvalidNumbers && (
            <Text style={styles.warningText}>
              ⚠️ Warning: Some numbers are missing country codes – invalid
              format.
            </Text>
          )}

          <ScrollView
            style={{flexGrow: 0}}
            contentContainerStyle={{paddingBottom: 100}}>
            <DataTable style={styles.table}>
              <DataTable.Header style={styles.tableHeader}>
                <DataTable.Title style={{flex: 0.5}}>✔</DataTable.Title>
                <DataTable.Title style={{flex: 1}}>👤 Name</DataTable.Title>
                <DataTable.Title style={{flex: 2.5}}>📱 Number</DataTable.Title>
                {visibleFields.map(field => (
                  <DataTable.Title key={field}>{field}</DataTable.Title>
                ))}
                <DataTable.Title style={{flex: 1}}>✏️ Edit</DataTable.Title>
              </DataTable.Header>

              {editableData.map((item, index) => {
                const isInvalid = invalidIds.includes(item.id);
                const isChecked = selectedContacts[item.id];

                return (
                  <DataTable.Row
                    key={item.id}
                    style={[
                      isInvalid ? styles.invalidRow : null,
                      isEditing ? styles.editingRow : null,
                    ]}>
                    <DataTable.Cell style={{flex: 0.5}}>
                      <Checkbox
                        status={isChecked ? 'checked' : 'unchecked'}
                        onPress={() => toggleSelectContact(item.id)}
                      />
                    </DataTable.Cell>

                    <DataTable.Cell style={{flex: 1}}>
                      {isEditing ? (
                        <TextInput
                          value={item.name}
                          onChangeText={text => {
                            const updated = [...editableData];
                            updated[index].name = text;
                            setEditableData(updated);
                          }}
                        />
                      ) : (
                        item.name
                      )}
                    </DataTable.Cell>

                    <DataTable.Cell style={{flex: 2.5}}>
                      {isEditing ? (
                        <TextInput
                          value={item.phone}
                          keyboardType="phone-pad"
                          onChangeText={text => {
                            const updated = [...editableData];
                            updated[index].phone = text;
                            setEditableData(updated);
                          }}
                        />
                      ) : (
                        item.phone
                      )}
                    </DataTable.Cell>

                    {visibleFields.map(field => (
                      <DataTable.Cell key={field}>
                        {isEditing ? (
                          <TextInput
                            value={
                              item.extra_field?.[field.toLowerCase()] || ''
                            }
                            onChangeText={text => {
                              const updated = [...editableData];
                              updated[index].extra_field[field.toLowerCase()] =
                                text;
                              setEditableData(updated);
                            }}
                          />
                        ) : (
                          item.extra_field?.[field.toLowerCase()] || ''
                        )}
                      </DataTable.Cell>
                    ))}

                    <DataTable.Cell style={{flex: 1}}>
                      {!isEditing && (
                        <IconButton
                          icon="pencil"
                          size={20}
                          onPress={() => openEditModal(item)}
                        />
                      )}
                    </DataTable.Cell>
                  </DataTable.Row>
                );
              })}
            </DataTable>
          </ScrollView>
        </>
      )}

      {isAnySelected && (
        <FAB
          icon="delete"
          style={{
            position: 'absolute',
            left: 16,
            bottom: 16,
            backgroundColor: 'red',
          }}
          onPress={handleDelete}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  table: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    overflow: 'hidden',
    width: '98%',
    alignSelf: 'center',
  },
  tableHeader: {
    backgroundColor: '#e0e0e0',
  },
  invalidRow: {
    backgroundColor: '#ffe5e5',
  },
  warningText: {
    color: '#b00020',
    fontWeight: 'bold',
    marginVertical: 10,
    marginLeft: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 10,
  },
  modal: {
    backgroundColor: 'white',
    padding: 20,
    margin: 20,
    borderRadius: 10,
    width: SCREEN_WIDTH * 0.9,
    alignSelf: 'center',
  },
  modalTitle: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 10,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

// components/ContactTable.js
import React from 'react';
import {Alert, StyleSheet} from 'react-native';
import {DataTable, Checkbox, IconButton, FAB} from 'react-native-paper';
import {deleteContacts} from '../util/database';
//import {StyleSheet} from 'react-native-css-interop';
//import {deleteContacts} from '../util/database'; // Adjust path as needed

export default function ContactTable({
  contacts,
  selectedContacts,
  toggleSelectContact,
  openEditModal,
  fetchContacts,
}) {
  const isAnySelected = Object.values(selectedContacts).some(v => v);

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

  return (
    <>
      <DataTable style={styles.table}>
        <DataTable.Header style={styles.tableHeader}>
          <DataTable.Title style={{flex: 0.5}}>✔</DataTable.Title>
          <DataTable.Title style={{flex: 1}}>👤 Name</DataTable.Title>
          <DataTable.Title style={{flex: 2.5}}>📱 Number</DataTable.Title>
          <DataTable.Title style={{flex: 1}}>✏️ Edit</DataTable.Title>
        </DataTable.Header>

        {contacts.map(item => (
          <DataTable.Row key={item.id}>
            <DataTable.Cell style={{flex: 0.5}}>
              <Checkbox
                status={selectedContacts[item.id] ? 'checked' : 'unchecked'}
                onPress={() => toggleSelectContact(item.id)}
              />
            </DataTable.Cell>
            <DataTable.Cell style={{flex: 1}}>{item.name}</DataTable.Cell>
            <DataTable.Cell style={{flex: 2.5}}>{item.phone}</DataTable.Cell>
            <DataTable.Cell style={{flex: 1}}>
              <IconButton
                icon="pencil"
                size={20}
                onPress={() => openEditModal(item)}
              />
            </DataTable.Cell>
          </DataTable.Row>
        ))}
      </DataTable>

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
    </>
  );
}
const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#00000',
  },
  title: {
    fontSize: 22,
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 10,
    fontWeight: '500',
    color: '#444',
  },
  table: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableHeader: {
    backgroundColor: '#e0e0e0',
  },
  loadingContainer: {
    marginTop: 50,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#777',
  },
});

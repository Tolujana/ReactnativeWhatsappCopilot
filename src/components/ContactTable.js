import React, {useEffect, useState} from 'react';
import {
  Alert,
  StyleSheet,
  ScrollView,
  View,
  Dimensions,
  TextInput,
  TouchableOpacity,
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
  Text,
  useTheme,
} from 'react-native-paper';
import {deleteContacts, updateContact} from '../util/data';
import {BannerAd, BannerAdSize} from 'react-native-google-mobile-ads';

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
  const theme = useTheme();
  const [invalidIds, setInvalidIds] = useState([]);
  const [visibleFields, setVisibleFields] = useState([]);
  const [showFieldSelector, setShowFieldSelector] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editableData, setEditableData] = useState([]);
  const [focusedField, setFocusedField] = useState(null);

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
          true,
        );
      }
      fetchContacts();
    }
    setIsEditing(prev => !prev);
  };

  const styles = StyleSheet.create({
    table: {
      backgroundColor: theme.colors.surface,
      borderRadius: 8,
      overflow: 'hidden',
      width: '98%',
      alignSelf: 'center',
      minHeight: 200,
    },
    tableHeader: {
      backgroundColor: theme.colors.surfaceVariant,
    },
    invalidRow: {
      backgroundColor: theme.colors.errorContainer,
    },
    editingRow: {
      backgroundColor: theme.colors.secondaryContainer,
    },
    warningText: {
      color: theme.colors.error,
      fontWeight: 'bold',
      marginVertical: 10,
      marginLeft: 12,
    },
    actionsRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      padding: 10,
      backgroundColor: theme.colors.background,
    },
    modal: {
      backgroundColor: theme.colors.surface,
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
      color: theme.colors.onSurface,
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
      backgroundColor: theme.colors.background,
    },
    textInput: {
      backgroundColor: theme.colors.background,
      padding: 4,
      fontSize: 14,
      borderWidth: 1,
      borderColor: theme.colors.outline,
      borderRadius: 4,
      color: theme.colors.onSurface,
    },
    expandedInput: {
      minHeight: 80,
      textAlignVertical: 'top',
    },
    bannerContainer: {
      alignItems: 'center',
      marginVertical: 8,
      backgroundColor: theme.colors.surface,
    },
    cellText: {
      color: theme.colors.onSurface,
    },
  });

  return (
    <View style={{flex: 1, backgroundColor: theme.colors.background}}>
      <Portal>
        <Modal
          visible={showFieldSelector}
          onDismiss={() => setShowFieldSelector(false)}
          contentContainerStyle={styles.modal}>
          <Text style={styles.modalTitle}>Toggle Visible Fields</Text>

          {extraFieldsKeys.length === 0 ? (
            <Text style={{color: theme.colors.onSurface}}>
              No extra fields to show
            </Text>
          ) : (
            extraFieldsKeys.map(field => (
              <View key={field} style={styles.checkboxRow}>
                <Checkbox
                  status={
                    visibleFields.includes(field) ? 'checked' : 'unchecked'
                  }
                  onPress={() => toggleField(field)}
                  color={theme.colors.primary}
                />
                <Text style={{color: theme.colors.onSurface}}>{field}</Text>
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
          <ActivityIndicator
            animating
            size="large"
            color={theme.colors.primary}
          />
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
                <DataTable.Title style={{flex: 0.5}}>
                  <Text style={styles.cellText}>✔</Text>
                </DataTable.Title>
                <DataTable.Title style={{flex: 1}}>
                  <Text style={styles.cellText}>👤 Name</Text>
                </DataTable.Title>
                <DataTable.Title style={{flex: 2.5}}>
                  <Text style={styles.cellText}>📱 Number</Text>
                </DataTable.Title>
                {visibleFields.map(field => (
                  <DataTable.Title key={field}>
                    <Text style={styles.cellText}>{field}</Text>
                  </DataTable.Title>
                ))}
                <DataTable.Title style={{flex: 1}}>
                  <Text style={styles.cellText}>✏️ Edit</Text>
                </DataTable.Title>
              </DataTable.Header>

              {editableData.map((item, index) => {
                const isInvalid = invalidIds.includes(item.id);
                const isChecked = selectedContacts[item.id];
                const rowStyle = isEditing ? styles.editingRow : null;

                const renderInput = (value, onChange, fieldKey) => (
                  <TextInput
                    value={value}
                    multiline
                    numberOfLines={
                      focusedField === `${item.id}-${fieldKey}` ? 5 : 1
                    }
                    onFocus={() => setFocusedField(`${item.id}-${fieldKey}`)}
                    onBlur={() => setFocusedField(null)}
                    onChangeText={onChange}
                    style={[
                      styles.textInput,
                      focusedField === `${item.id}-${fieldKey}` &&
                        styles.expandedInput,
                    ]}
                  />
                );

                return (
                  <DataTable.Row
                    key={item.id}
                    style={[isInvalid ? styles.invalidRow : null, rowStyle]}>
                    <DataTable.Cell style={{flex: 0.5}}>
                      <Checkbox
                        status={isChecked ? 'checked' : 'unchecked'}
                        onPress={() => toggleSelectContact(item.id)}
                        color={theme.colors.primary}
                      />
                    </DataTable.Cell>

                    <DataTable.Cell style={{flex: 1}}>
                      {isEditing ? (
                        renderInput(
                          item.name,
                          text => {
                            const updated = [...editableData];
                            updated[index].name = text;
                            setEditableData(updated);
                          },
                          'name',
                        )
                      ) : (
                        <Text style={styles.cellText}>{item.name}</Text>
                      )}
                    </DataTable.Cell>

                    <DataTable.Cell style={{flex: 2.5}}>
                      {isEditing ? (
                        renderInput(
                          item.phone,
                          text => {
                            const updated = [...editableData];
                            updated[index].phone = text;
                            setEditableData(updated);
                          },
                          'phone',
                        )
                      ) : (
                        <Text style={styles.cellText}>{item.phone}</Text>
                      )}
                    </DataTable.Cell>

                    {visibleFields.map(field => (
                      <DataTable.Cell key={field}>
                        {isEditing ? (
                          renderInput(
                            item.extra_field?.[field.toLowerCase()] || '',
                            text => {
                              const updated = [...editableData];
                              updated[index].extra_field[field.toLowerCase()] =
                                text;
                              setEditableData(updated);
                            },
                            field.toLowerCase(),
                          )
                        ) : (
                          <Text style={styles.cellText}>
                            {item.extra_field?.[field.toLowerCase()] || ''}
                          </Text>
                        )}
                      </DataTable.Cell>
                    ))}

                    <DataTable.Cell style={{flex: 1}}>
                      {!isEditing && (
                        <IconButton
                          icon="pencil"
                          size={20}
                          onPress={() => openEditModal(item)}
                          iconColor={theme.colors.primary}
                        />
                      )}
                    </DataTable.Cell>
                  </DataTable.Row>
                );
              })}
            </DataTable>
          </ScrollView>
          <View style={styles.bannerContainer}>
            <BannerAd
              unitId="ca-app-pub-3940256099942544/6300978111"
              size={BannerAdSize.BANNER}
            />
          </View>
        </>
      )}
    </View>
  );
}

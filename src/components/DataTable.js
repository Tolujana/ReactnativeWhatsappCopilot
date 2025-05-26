import {StyleSheet, View, Text} from 'react-native';
import {Checkbox, DataTable, Button} from 'react-native-paper';

export function MyDataTable(
  updatedList,
  selectedItems,
  toggleSelectItem,
  handleViewMessage,
) {
  return (
    <DataTable style={styles.table}>
      <DataTable.Header style={styles.tableHeader}>
        <DataTable.Title style={{flex: 0.5}}>✔</DataTable.Title>
        <DataTable.Title style={{flex: 1}}>👤 Name</DataTable.Title>
        <DataTable.Title style={{flex: 2}}>📱 Number</DataTable.Title>
        <DataTable.Title style={{flex: 1.5}}>💬 Message</DataTable.Title>
      </DataTable.Header>

      {Array.isArray(updatedList) &&
        updatedList.map((item, index) => (
          <DataTable.Row
            key={index}
            style={{
              paddingVertical: 6,
              backgroundColor: item.exists ? '#bdf2cb' : '#f2c8bd',
            }}>
            <DataTable.Cell style={{flex: 0.5}}>
              <Checkbox
                status={selectedItems.includes(index) ? 'checked' : 'unchecked'}
                onPress={() => toggleSelectItem(index)}
              />
            </DataTable.Cell>
            <DataTable.Cell style={{flex: 1}}>
              <View style={{paddingRight: 1}}>
                <Text style={{flexWrap: 'wrap'}}>{item.name}</Text>
              </View>
            </DataTable.Cell>
            <DataTable.Cell style={{flex: 2}}>
              <View style={{paddingRight: 1}}>
                <Text style={{flexWrap: 'wrap'}}>{item.phone}</Text>
              </View>
            </DataTable.Cell>

            <DataTable.Cell style={{flex: 1.5}}>
              <Button
                contentStyle={{paddingVertical: 2, paddingHorizontal: 1}}
                mode="contained"
                onPress={() => handleViewMessage(item.message)}
                compact>
                View Message
              </Button>
            </DataTable.Cell>
          </DataTable.Row>
        ))}
    </DataTable>
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

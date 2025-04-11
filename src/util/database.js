import SQLite from 'react-native-sqlite-storage';

const db = SQLite.openDatabase(
  {name: 'campaigns.db', location: 'default'},
  () => {},
  error => {
    console.log('DB Error:', error);
  },
);

export const createTables = () => {
  db.transaction(tx => {
    tx.executeSql(
      `CREATE TABLE IF NOT EXISTS campaigns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        description TEXT
      );`,
    );
    tx.executeSql(
      `CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id INTEGER,
        name TEXT,
        phone TEXT
      );`,
    );
  });
};

export const insertCampaign = (name, description, callback) => {
  db.transaction(tx => {
    tx.executeSql(
      'INSERT INTO campaigns (name, description) VALUES (?, ?);',
      [name, description],
      (_, result) => {
        console.log('Inserted Campaign ID:', result.insertId);
        callback(result.insertId);
      },
      (_, error) => {
        console.error('Insert Error:', error);
        return true;
      },
    );
  });
};

export const getCampaigns = callback => {
  db.transaction(tx => {
    tx.executeSql(
      'SELECT * FROM campaigns;',
      [],
      (txObj, resultSet) => {
        const data = [];
        const rows = resultSet.rows;

        for (let i = 0; i < rows.length; i++) {
          data.push(rows.item(i));
        }

        console.log('✅ Campaigns fetched:', data);
        callback(data);
      },
      (txObj, error) => {
        console.error('❌ Failed to fetch campaigns:', error);
        callback([]); // fallback to empty array
        return true;
      },
    );
  });
};

export const updateCampaign = (id, name, description, callback) => {
  db.transaction(tx => {
    tx.executeSql(
      'UPDATE campaigns SET name = ?, description = ? WHERE id = ?',
      [name, description, id],
      () => callback(),
    );
  });
};
export const getContactsByCampaignId = (campaignId, callback) => {
  console.log('🔍 Fetching contacts for campaignId:', campaignId);

  db.transaction(tx => {
    tx.executeSql(
      'SELECT * FROM contacts WHERE campaign_id = ?',
      [campaignId],
      (_, {rows}) => {
        let contactsArray = [];
        for (let i = 0; i < rows.length; i++) {
          contactsArray.push(rows.item(i));
        }
        console.log('📋 Contacts as array:', contactsArray);
        callback(contactsArray);
      },
      (_, error) => {
        console.log('❌ Error fetching contacts for campaign:', error);
        return false;
      },
    );
  });
};

export const deleteContact = (id, callback) => {
  db.transaction(tx => {
    tx.executeSql('DELETE FROM contacts WHERE id = ?', [id], () => callback());
  });
};

export const insertContact2 = (campaignId, name, phone, callback) => {
  db.transaction(tx => {
    tx.executeSql(
      'INSERT INTO contacts (campaign_id, name, phone) VALUES (?, ?, ?)',
      [campaignId, name, phone],
      () => callback(),
    );
  });
};

export const insertContact = (campaignId, name, phone, callback) => {
  db.transaction(tx => {
    tx.executeSql(
      'INSERT INTO contacts (campaign_id, name, phone) VALUES (?, ?, ?)',
      [campaignId, name, phone],
      (_, result) => {
        console.log('Contact inserted:', result.insertId);
        if (callback) callback(result.insertId);
      },
      (_, error) => {
        console.log('Error inserting contact:', error);
        return false;
      },
    );
  });
};

export const getContactCountForCampaign = (campaignId, callback) => {
  console.log('🔢 Getting contact count for campaignId:', campaignId);

  db.transaction(tx => {
    tx.executeSql(
      'SELECT COUNT(*) as count FROM contacts WHERE campaign_id = ?',
      [campaignId],
      (_, {rows}) => {
        if (rows.length > 0) {
          const count = rows.item(0).count;
          console.log('✅ Contact count:', count);
          callback(count);
        } else {
          console.log('⚠️ No rows returned');
          callback(0);
        }
      },
      (_, error) => {
        console.log('❌ Error fetching contact count:', error);
        callback(0);
        return false;
      },
    );
  });
};

export const deleteCampaignById = id => {
  db.transaction(tx => {
    tx.executeSql('DELETE FROM campaigns WHERE id = ?', [id]);
    tx.executeSql('DELETE FROM contacts WHERE campaign_id = ?', [id]); // optional
  });
};

export default db;

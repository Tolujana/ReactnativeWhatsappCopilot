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
        extra_fields TEXT,
        description TEXT
      );`,
    );
    tx.executeSql(
      `CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER,
    name TEXT,
    phone TEXT,
    extra_field TEXT
  );`,
      [],
      () => console.log('Contacts table created successfully'),
      (txObj, error) => {
        console.log('Error creating contacts table', error);
        return true; // to indicate error handled
      },
    );

    tx.executeSql(
      `CREATE TABLE IF NOT EXISTS sentmessages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT,
    data TEXT
  );`,
    );
  });
};

export const insertSentMessage = (successList, date, callback) => {
  const stringifiedData = JSON.stringify(successList);

  db.transaction(tx => {
    tx.executeSql(
      'INSERT INTO sentmessages (date, data) VALUES (?, ?);',
      [date, stringifiedData],
      (_, result) => {
        console.log('✅ Sent message inserted:', result.insertId);
        if (callback) callback(result.insertId);
      },
      (_, error) => {
        console.error('❌ Insert sent message error:', error);
        return false;
      },
    );
  });
};

export const getMessageReport = callback => {
  db.transaction(tx => {
    tx.executeSql(
      'SELECT * FROM sentmessages ORDER BY date DESC;',
      [],
      (_, {rows}) => {
        const reportList = [];
        for (let i = 0; i < rows.length; i++) {
          const item = rows.item(i);
          reportList.push({
            id: item.id,
            date: item.date,
            data: JSON.parse(item.data),
          });
        }
        callback(reportList);
      },
      (_, error) => {
        console.error('❌ Error fetching message report:', error);
        callback([]);
        return false;
      },
    );
  });
};

export const insertCampaign = (
  name,
  description,
  extraFields = [],
  callback,
) => {
  const extraFieldsJSON = JSON.stringify(extraFields);

  db.transaction(tx => {
    tx.executeSql(
      'INSERT INTO campaigns (name, description, extra_fields) VALUES (?, ?, ?);',
      [name, description, extraFieldsJSON],
      (_, result) => {
        console.log('Inserted Campaign ID:', result.insertId);
        callback(result.insertId); // success
      },
      (_, error) => {
        console.error('Insert Error:', error || 'No error object provided');
        callback(null); // call callback with null or handle differently
        return false; // allow further propagation if needed
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

export const deleteContacts = (ids = [], callback) => {
  if (!ids.length) return;

  db.transaction(
    tx => {
      ids.forEach(id => {
        tx.executeSql('DELETE FROM contacts WHERE id = ?;', [id]);
      });
    },
    error => {
      console.error('Delete contacts error:', error);
    },
    () => {
      console.log('Deleted contacts:', ids);
      if (callback) callback(); // Fetch contacts or refresh list
    },
  );
};

export const updateContact1 = (
  contactId,
  name,
  phone,
  extraFields,
  callback,
) => {
  const extraFieldString = JSON.stringify(extraFields || {});

  db.transaction(tx => {
    tx.executeSql(
      `UPDATE contacts 
       SET name = ?, phone = ?, extra_field = ? 
       WHERE id = ?;`,
      [name, phone, extraFieldString, contactId],
      (_, result) => {
        console.log('Contact updated:', result.rowsAffected);
        if (callback) callback();
      },
      error => {
        console.error('Update contact error:', error);
        return true;
      },
    );
  });
};

export const updateContact3 = (contactId, name, phone, extraFields) => {
  const extraFieldString = JSON.stringify(extraFields || {});

  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `SELECT * FROM contacts WHERE phone = ? AND id != ?`,
        [phone, contactId],
        (_, {rows}) => {
          if (rows.length > 0) {
            resolve({status: 'duplicate', phone});
          } else {
            tx.executeSql(
              `UPDATE contacts 
               SET name = ?, phone = ?, extra_field = ? 
               WHERE id = ?`,
              [name, phone, extraFieldString, contactId],
              (_, result) => {
                resolve({status: 'updated', rowsAffected: result.rowsAffected});
              },
              error => {
                console.error('Update error:', error);
                reject(error);
              },
            );
          }
        },
        error => {
          console.error('Duplicate check error:', error);
          reject(error);
        },
      );
    });
  });
};

export const updateContact = (
  contactId,
  name,
  phone,
  extraFields,
  checkForDuplicate = true,
) => {
  const extraFieldString = JSON.stringify(extraFields || {});

  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      const updateQuery = () => {
        tx.executeSql(
          `UPDATE contacts 
           SET name = ?, phone = ?, extra_field = ? 
           WHERE id = ?`,
          [name, phone, extraFieldString, contactId],
          (_, result) => {
            resolve({status: 'updated', rowsAffected: result.rowsAffected});
          },
          error => {
            console.error('Update error:', error);
            reject(error);
          },
        );
      };

      if (!checkForDuplicate) {
        updateQuery();
        return;
      }

      tx.executeSql(
        `SELECT * FROM contacts WHERE phone = ? AND id != ?`,
        [phone, contactId],
        (_, {rows}) => {
          if (rows.length > 0) {
            resolve({status: 'duplicate', phone});
          } else {
            updateQuery();
          }
        },
        error => {
          console.error('Duplicate check error:', error);
          reject(error);
        },
      );
    });
  });
};

export const insertContact1 = (
  campaignId,
  name,
  phone,
  extraFields,
  callback,
) => {
  const extraFieldString = JSON.stringify(extraFields || {});

  db.transaction(tx => {
    tx.executeSql(
      `INSERT INTO contacts (campaign_id, name, phone, extra_field) VALUES (?, ?, ?, ?);`,
      [campaignId, name, phone, extraFieldString],
      (_, result) => {
        console.log('Contact inserted:', result.insertId);
        if (callback) callback(); // ✅ Callback should be called here
      },
      error => {
        console.error('Insert contact error:', error);
        return true; // Required to signal the error
      },
    );
  });
};

export const insertContact = (campaignId, name, phone, extraFields) => {
  const extraFieldString = JSON.stringify(extraFields || {});

  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `SELECT * FROM contacts WHERE campaign_id = ? AND phone = ?`,
        [campaignId, phone],
        (_, {rows}) => {
          if (rows.length > 0) {
            resolve({status: 'duplicate', phone});
          } else {
            tx.executeSql(
              `INSERT INTO contacts (campaign_id, name, phone, extra_field) VALUES (?, ?, ?, ?)`,
              [campaignId, name, phone, extraFieldString],
              (_, result) => {
                resolve({status: 'inserted', phone});
              },
              error => {
                console.error('Insert error:', error);
                reject(error);
              },
            );
          }
        },
        error => {
          console.error('Check duplicate error:', error);
          reject(error);
        },
      );
    });
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

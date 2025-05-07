package com.copilot3; // Ensure this is your correct package name

import android.Manifest;
import android.content.ContentResolver;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.os.Bundle;
import android.provider.ContactsContract;
import android.text.TextUtils;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import androidx.appcompat.widget.SearchView; // Use the correct import for SearchView

import java.util.ArrayList;
import java.util.List;

public class CustomContactPickerActivity extends AppCompatActivity {
    private static final int REQUEST_CODE_CONTACTS_PERMISSION = 100;
    private RecyclerView recyclerView;
    private ContactAdapter contactAdapter;
    private List<Contact> contacts = new ArrayList<>();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_contact_picker);

        // Initialize RecyclerView
        recyclerView = findViewById(R.id.contact_recycler_view);
        recyclerView.setLayoutManager(new LinearLayoutManager(this));

        // Set up the adapter
        contactAdapter = new ContactAdapter(this, contacts);
        recyclerView.setAdapter(contactAdapter);

        // Set up SearchView
        SearchView searchView = findViewById(R.id.contact_search);
        searchView.setOnQueryTextListener(new SearchView.OnQueryTextListener() {
            @Override
            public boolean onQueryTextSubmit(String query) {
                return false;
            }

            @Override
            public boolean onQueryTextChange(String newText) {
                contactAdapter.filter(newText);
                return true;
            }
        });

        // Request permission to read contacts
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.READ_CONTACTS) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.READ_CONTACTS}, REQUEST_CODE_CONTACTS_PERMISSION);
        } else {
            loadContacts();
        }
    }

    // Load contacts from the device
private void loadContacts() {
    new Thread(() -> {
        List<Contact> loadedContacts = new ArrayList<>();
        ContentResolver contentResolver = getContentResolver();

        Cursor cursor = contentResolver.query(
                ContactsContract.Contacts.CONTENT_URI,
                null,
                null,
                null,
                ContactsContract.Contacts.DISPLAY_NAME_PRIMARY + " ASC"
        );

        if (cursor != null && cursor.getCount() > 0) {
            while (cursor.moveToNext()) {
                String contactId = cursor.getString(cursor.getColumnIndex(ContactsContract.Contacts._ID));
                String contactName = cursor.getString(cursor.getColumnIndex(ContactsContract.Contacts.DISPLAY_NAME));

                List<String> phoneNumbers = new ArrayList<>();
                Cursor phoneCursor = contentResolver.query(
                        ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                        null,
                        ContactsContract.CommonDataKinds.Phone.CONTACT_ID + " = ?",
                        new String[]{contactId},
                        null
                );

                if (phoneCursor != null) {
                    while (phoneCursor.moveToNext()) {
                        String phoneNumber = phoneCursor.getString(phoneCursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER));
                        phoneNumbers.add(phoneNumber);
                    }
                    phoneCursor.close();
                }

                if (!TextUtils.isEmpty(contactName) && !phoneNumbers.isEmpty()) {
                    loadedContacts.add(new Contact(contactName, phoneNumbers));
                }
            }
            cursor.close();
        }

        runOnUiThread(() -> {
            contacts.clear();
            contacts.addAll(loadedContacts);
            contactAdapter.notifyDataSetChanged();
        });
    }).start();
}

    // Handle permission result
    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        if (requestCode == REQUEST_CODE_CONTACTS_PERMISSION) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                loadContacts();
            } else {
                Toast.makeText(this, "Permission denied to read contacts", Toast.LENGTH_SHORT).show();
            }
        }
    }
}

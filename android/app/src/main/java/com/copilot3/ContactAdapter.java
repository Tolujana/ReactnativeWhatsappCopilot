package com.copilot3;

import android.content.Context;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;
import com.copilot3.Contact;
import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import java.util.ArrayList;
import java.util.List;

public class ContactAdapter extends RecyclerView.Adapter<ContactAdapter.ContactViewHolder> {
    private List<Contact> contacts;
    private List<Contact> allContacts;
    private Context context;
    private LayoutInflater inflater;
    private List<Contact> selectedContacts;  // Track selected contacts

    public ContactAdapter(Context context, List<Contact> contacts) {
        this.context = context;
        this.contacts = new ArrayList<>(contacts);
        this.allContacts = new ArrayList<>(contacts);
        this.selectedContacts = new ArrayList<>();
        this.inflater = LayoutInflater.from(context);
    }

    @NonNull
    @Override
    public ContactViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = inflater.inflate(R.layout.contact_item, parent, false);
        return new ContactViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ContactViewHolder holder, int position) {
        Contact contact = contacts.get(position);
        holder.contactName.setText(contact.getName());
        holder.contactPhone.setText(contact.getPrimaryPhone());

        // Toggle selection visually and logically
        holder.itemView.setOnClickListener(v -> {
            if (selectedContacts.contains(contact)) {
                selectedContacts.remove(contact);
                holder.itemView.setAlpha(1.0f);  // Not selected
            } else {
                selectedContacts.add(contact);
                holder.itemView.setAlpha(0.5f);  // Selected visual feedback
            }
        });

        // Restore visual state
        holder.itemView.setAlpha(selectedContacts.contains(contact) ? 0.5f : 1.0f);
    }

    @Override
    public int getItemCount() {
        return contacts.size();
    }

    public void filter(String query) {
        contacts.clear();
        if (query.isEmpty()) {
            contacts.addAll(allContacts);
        } else {
            for (Contact contact : allContacts) {
                if (contact.getName().toLowerCase().contains(query.toLowerCase())) {
                    contacts.add(contact);
                }
            }
        }
        notifyDataSetChanged();
    }

    public List<Contact> getSelectedContacts() {
        return selectedContacts;
    }

    public static class ContactViewHolder extends RecyclerView.ViewHolder {
        TextView contactName;
        TextView contactPhone;

        public ContactViewHolder(View itemView) {
            super(itemView);
            contactName = itemView.findViewById(R.id.contact_name); // Corrected ID
            contactPhone = itemView.findViewById(R.id.contact_phone);
           
        }
    }
}

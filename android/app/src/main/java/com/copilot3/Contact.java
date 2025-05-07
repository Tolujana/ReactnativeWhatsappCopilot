package com.copilot3;
import java.util.List;

public class Contact {
    private String name;
    private List<String> phoneNumbers; // Store multiple phone numbers for each contact

    public Contact(String name, List<String> phoneNumbers) {
        this.name = name;
        this.phoneNumbers = phoneNumbers;
    }

    public String getName() {
        return name;
    }

    public List<String> getPhoneNumbers() {
        return phoneNumbers;
    }

    public String getPrimaryPhone() {
        return phoneNumbers.isEmpty() ? "" : phoneNumbers.get(0); // Get the first phone number as the primary
    }
}

// WhatsAppAccessibilityService.java

package com.copilot3;
import java.util.Random;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.util.Log;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import androidx.core.content.FileProvider;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.util.ArrayList;
import java.util.List;

public class AppAccessibilityService extends AccessibilityService {
    private static final String TAG = "WAService";

    private List<Contact> ListToSend = new ArrayList<>();
    private List<JSONObject> successfulContacts = new ArrayList<>();
    private int currentContactIndex = 0;
    private Handler handler = new Handler();
    //private String selectedWhatsAppPackage = "com.whatsapp";


    private String selectedWhatsAppPackage;

@Override
public int onStartCommand(Intent intent, int flags, int startId) {
    if (intent != null && intent.hasExtra("app_type")) {
        selectedWhatsAppPackage = intent.getStringExtra("app_type");

        Log.d(TAG, "Received package: " + selectedWhatsAppPackage);

        // Safely set AccessibilityServiceInfo here
        AccessibilityServiceInfo info = new AccessibilityServiceInfo();
        info.eventTypes = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED;
        info.feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC;
        info.notificationTimeout = 100;
        info.flags = AccessibilityServiceInfo.DEFAULT;

        if (selectedWhatsAppPackage != null) {
            info.packageNames = new String[]{selectedWhatsAppPackage};
        }

        setServiceInfo(info); // ✅ Set service info with user-selected package

        if ("START_SENDING_MESSAGES".equals(intent.getAction())) {
    String contactsJson = intent.getStringExtra("contacts_json");
    ListToSend = parseContacts(contactsJson);
    currentContactIndex = 0;
    successfulContacts.clear();
    openNextContact(); // <- Launch App for the first contact
}
    } else {
        Log.w(TAG, "Intent or app_type extra was null");
    }

    //return super.onStartCommand(intent, flags, startId);
    return START_STICKY;
    }

    @Override
    public void onServiceConnected() {
    super.onServiceConnected();
    Log.d(TAG, "Accessibility service connected");

    // We do NOT set service info here anymore. It's handled in onStartCommand()
    }

    // @Override
    // public void onServiceConnected() {
    //     AccessibilityServiceInfo info = new AccessibilityServiceInfo();
    //     info.eventTypes = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED |
    //                       AccessibilityEvent.TYPE_VIEW_CLICKED |
    //                       AccessibilityEvent.TYPE_VIEW_FOCUSED |
    //                       AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED;
    //     info.feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC;
    //     info.packageNames = new String[]{selectedWhatsAppPackage};
    //     info.flags = AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS;
    //     setServiceInfo(info);
    // }

    // @Override
    // public int onStartCommand(Intent intent, int flags, int startId) {
    //     if (intent != null && "START_SENDING_WHATSAPP".equals(intent.getAction())) {
    //         try {
    //             String contactsJson = intent.getStringExtra("contacts_json");
    //             selectedWhatsAppPackage = intent.getStringExtra("app_type");
    //             Log.d(TAG, "Selected WhatsApp package: " + selectedWhatsAppPackage);
    //             contactsToSend = parseContacts(contactsJson);
    //             currentContactIndex = 0;
    //             successfulContacts.clear();
    //             openNextContact();
    //         } catch (Exception e) {
    //             Log.e(TAG, "Error parsing message data", e);
    //         }
    //     }
    //     return START_STICKY;
    // }

    private List<Contact> parseContacts(String json) {
        List<Contact> list = new ArrayList<>();
        try {
            JSONArray arr = new JSONArray(json);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject obj = arr.getJSONObject(i);
                String phone = obj.getString("phone");
                String name = obj.getString("name");
                String mediaPath = obj.optString("mediaPath", null);
                List<String> messages = new ArrayList<>();

                Object messageObj = obj.get("message");
                if (messageObj instanceof JSONArray) {
                    JSONArray msgArray = (JSONArray) messageObj;
                    for (int j = 0; j < Math.min(3, msgArray.length()); j++) {
                        messages.add(msgArray.getString(j));
                    }
                } else {
                    messages.add(obj.getString("message"));
                }

                list.add(new Contact(phone, messages, name, mediaPath));
            }
        } catch (Exception e) {
            Log.e(TAG, "Error parsing contact JSON", e);
        }
        return list;
    }

    private void openNextContact() {
        if (currentContactIndex >= ListToSend.size()) {
            sendReportToApp();
            stopSelf();
            return;
        }

        final Contact contact = ListToSend.get(currentContactIndex);
        // Intent launchIntent = new Intent(Intent.ACTION_VIEW);
        // launchIntent.setData(Uri.parse("https://wa.me/" + contact.phone.replace("+", "")));
        // launchIntent.setPackage(selectedWhatsAppPackage);
        // launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        // startActivity(launchIntent);

        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setData(Uri.parse("whatsapp://send?phone=" + contact.phone.replace("+", "")));
        intent.setPackage(selectedWhatsAppPackage);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            startActivity(intent);
        } catch (Exception e) {
            Log.e(TAG, "Error launching App chat", e);
            currentContactIndex++;
            handler.postDelayed(this::openNextContact, 2000);
        }

        handler.postDelayed(() -> {
            if (contact.mediaPath != null && !contact.mediaPath.isEmpty()) {
                sendMediaWithCaption(contact);
            } else {
                sendMessagesSequentially(contact, 0);
            }
        }, 5000);
    }

    // IMPROVED sendMediaWithCaption() method for AppAccessibilityService.java
    // Replace your existing sendMediaWithCaption() method with this one

// ============================================
// SMARTEST SOLUTION - Waits for button to appear, then clicks
// ============================================
// This checks if send button is VISIBLE and ENABLED before clicking

private void sendMediaWithCaption(Contact contact) {
    try {
        if (contact.mediaPath == null || contact.mediaPath.isEmpty()) {
            Log.e(TAG, "Media path is null or empty");
            sendMessagesSequentially(contact, 0);
            return;
        }

        Log.d(TAG, "=== SMART AUTO MEDIA SEND ===");
        Log.d(TAG, "Contact: " + contact.name + " (" + contact.phone + ")");
        Log.d(TAG, "Media: " + contact.mediaPath);

        Uri mediaUri;
        
        if (contact.mediaPath.startsWith("content://")) {
            mediaUri = Uri.parse(contact.mediaPath);
        } else {
            String cleanPath = contact.mediaPath.replace("file://", "");
            File mediaFile = new File(cleanPath);
            
            if (!mediaFile.exists()) {
                Log.e(TAG, "File not found: " + cleanPath);
                sendMessagesSequentially(contact, 0);
                return;
            }
            
            mediaUri = FileProvider.getUriForFile(this, getPackageName() + ".provider", mediaFile);
        }

        String caption = contact.messages.isEmpty() ? "" : contact.messages.get(0);
        String mimeType = getMimeType(contact.mediaPath);

        Intent intent = new Intent(Intent.ACTION_SEND);
        intent.setType(mimeType);
        intent.setPackage(selectedWhatsAppPackage);
        intent.putExtra(Intent.EXTRA_STREAM, mediaUri);
        intent.putExtra(Intent.EXTRA_TEXT, caption);
        
        String cleanPhone = contact.phone.replace("+", "").replace(" ", "").replace("-", "");
        intent.putExtra("jid", cleanPhone + "@s.whatsapp.net");
        
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

        startActivity(intent);
        Log.d(TAG, "✅ WhatsApp media screen launched");

        // Wait 3 seconds for screen to stabilize, then start smart polling
        handler.postDelayed(() -> {
            smartPollForSendButton(contact, 0, System.currentTimeMillis());
        }, 3000);

    } catch (Exception e) {
        Log.e(TAG, "Error in sendMediaWithCaption", e);
        sendMessagesSequentially(contact, 0);
    }
}

// Smart polling: checks button state before clicking
private void smartPollForSendButton(Contact contact, int pollCount, long startTime) {
    long elapsed = System.currentTimeMillis() - startTime;
    
    // Timeout after 20 seconds
    if (elapsed > 20000) {
        Log.e(TAG, "Timeout waiting for send button");
        handlePostMediaSend(contact);
        return;
    }

    // Max 40 polls
    if (pollCount >= 40) {
        Log.e(TAG, "Max polls reached");
        handlePostMediaSend(contact);
        return;
    }

    AccessibilityNodeInfo root = getRootInActiveWindow();
    if (root == null) {
        Log.d(TAG, "Root null, retrying... (poll " + (pollCount + 1) + ")");
        handler.postDelayed(() -> {
            smartPollForSendButton(contact, pollCount + 1, startTime);
        }, 500);
        return;
    }

    // Find send button and check if it's ready
    SendButtonInfo buttonInfo = findAndAnalyzeSendButton(root);
    
    if (buttonInfo.found) {
        if (buttonInfo.enabled && buttonInfo.clickable) {
            Log.d(TAG, "✅ Send button READY - Clicking now!");
            boolean clicked = buttonInfo.node.performAction(AccessibilityNodeInfo.ACTION_CLICK);
            
            if (clicked) {
                Log.d(TAG, "✅✅ Click successful!");
                handler.postDelayed(() -> {
                    handlePostMediaSend(contact);
                }, 3000);
                return;
            } else {
                Log.e(TAG, "Click action returned false, retrying...");
            }
        } else {
            Log.d(TAG, "Send button found but not ready (enabled=" + buttonInfo.enabled + 
                       ", clickable=" + buttonInfo.clickable + "), waiting...");
        }
    } else {
        Log.d(TAG, "Send button not found yet (poll " + (pollCount + 1) + "), waiting...");
    }

    // Try again
    handler.postDelayed(() -> {
        smartPollForSendButton(contact, pollCount + 1, startTime);
    }, 500);
}

// Helper class to store button info
private static class SendButtonInfo {
    boolean found = false;
    boolean enabled = false;
    boolean clickable = false;
    AccessibilityNodeInfo node = null;
}

// Comprehensive button analysis
private SendButtonInfo findAndAnalyzeSendButton(AccessibilityNodeInfo root) {
    SendButtonInfo info = new SendButtonInfo();
    
    if (root == null) return info;

    // Try all possible IDs
    String[] possibleIds = {
        selectedWhatsAppPackage + ":id/send",
        selectedWhatsAppPackage + ":id/fab",
        selectedWhatsAppPackage + ":id/send_btn",
        selectedWhatsAppPackage + ":id/conversation_entry_action_button",
        selectedWhatsAppPackage + ":id/send_round"
    };

    for (String id : possibleIds) {
        AccessibilityNodeInfo node = findNodeByViewId(root, id);
        if (node != null) {
            info.found = true;
            info.enabled = node.isEnabled();
            info.clickable = node.isClickable();
            info.node = node;
            
            Log.d(TAG, "Button analysis - ID: " + id + 
                       ", Enabled: " + info.enabled + 
                       ", Clickable: " + info.clickable +
                       ", Visible: " + node.isVisibleToUser());
            
            if (info.enabled && info.clickable) {
                return info; // Found a good one
            }
        }
    }

    // Try by content description if not found by ID
    if (!info.found) {
        AccessibilityNodeInfo node = findNodeByContentDescription(root, "Send");
        if (node != null) {
            info.found = true;
            info.enabled = node.isEnabled();
            info.clickable = node.isClickable();
            info.node = node;
            Log.d(TAG, "Button found by content description");
        }
    }

    // Try finding FAB
    if (!info.found) {
        AccessibilityNodeInfo node = findFloatingActionButton(root);
        if (node != null) {
            info.found = true;
            info.enabled = node.isEnabled();
            info.clickable = node.isClickable();
            info.node = node;
            Log.d(TAG, "FAB found");
        }
    }

    return info;
}

private AccessibilityNodeInfo findFloatingActionButton(AccessibilityNodeInfo root) {
    if (root == null) return null;
    
    if (root.getClassName() != null && 
        root.getClassName().toString().contains("FloatingActionButton")) {
        return root;
    }
    
    for (int i = 0; i < root.getChildCount(); i++) {
        AccessibilityNodeInfo child = root.getChild(i);
        if (child != null) {
            AccessibilityNodeInfo result = findFloatingActionButton(child);
            if (result != null) {
                return result;
            }
        }
    }
    
    return null;
}

private AccessibilityNodeInfo findNodeByContentDescription(AccessibilityNodeInfo root, String description) {
    if (root == null) return null;
    
    if (root.getContentDescription() != null) {
        String contentDesc = root.getContentDescription().toString();
        if (contentDesc.equalsIgnoreCase(description) || contentDesc.contains(description)) {
            return root;
        }
    }
    
    for (int i = 0; i < root.getChildCount(); i++) {
        AccessibilityNodeInfo child = root.getChild(i);
        if (child != null) {
            AccessibilityNodeInfo result = findNodeByContentDescription(child, description);
            if (result != null) {
                return result;
            }
        }
    }
    
    return null;
}

private void handlePostMediaSend(Contact contact) {
    if (contact == null) return;

    Log.d(TAG, "Post-media processing for: " + contact.name);

    handler.postDelayed(() -> {
        if (contact.messages.size() > 1) {
            Log.d(TAG, "Sending remaining " + (contact.messages.size() - 1) + " messages");
            
            Intent chatIntent = new Intent(Intent.ACTION_VIEW);
            chatIntent.setData(Uri.parse("whatsapp://send?phone=" + contact.phone.replace("+", "")));
            chatIntent.setPackage(selectedWhatsAppPackage);
            chatIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(chatIntent);
            
            handler.postDelayed(() -> {
                sendMessagesSequentially(contact, 1);
            }, 4000);
        } else {
            Log.d(TAG, "✅ Contact complete");
            markContactSuccess(contact);
            currentContactIndex++;
            handler.postDelayed(this::openNextContact, 3000);
        }
    }, 2000);
}


    private void sendMessagesSequentially(Contact contact, int index) {
        if (index >= contact.messages.size()) {
            markContactSuccess(contact);
            currentContactIndex++;
            handler.postDelayed(this::openNextContact, 3000);
            return;
        }

        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) {
            Log.e(TAG, "Root window is null. Cannot send message.");

            currentContactIndex++;
            handler.postDelayed(this::openNextContact, 3000);
            return;
        }


        

        AccessibilityNodeInfo inputField = findNodeByViewId(root, selectedWhatsAppPackage + ":id/entry");
        if (inputField == null) {
           // inputField = findNodeByViewId(root, "com.whatsapp.w4b:id/entry");
             currentContactIndex++;
        handler.postDelayed(this::openNextContact, 2000);
            return;
        }

        if (inputField != null && inputField.isEditable()) {
            inputField.performAction(AccessibilityNodeInfo.ACTION_FOCUS);
            Bundle args = new Bundle();
            args.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, contact.messages.get(index));
            inputField.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args);

            AccessibilityNodeInfo sendButton = findNodeByViewId(root, selectedWhatsAppPackage + ":id/send");
            if (sendButton == null) {
                //sendButton = findNodeByViewId(root, "com.whatsapp.w4b:id/send");
                openNextContact();
                return;
            }

            if (sendButton != null && sendButton.isClickable()) {
                sendButton.performAction(AccessibilityNodeInfo.ACTION_CLICK);
            }

            handler.postDelayed(() -> sendMessagesSequentially(contact, index + 1),  randomDelay(1000, 3000));
        } else {
            Log.e(TAG, "Input field not found or not editable");
            openNextContact();
        }
    }

    private void markContactSuccess(Contact contact) {
        try {
            JSONObject obj = new JSONObject();
            obj.put("phone", contact.phone);
            obj.put("name", contact.name);
            obj.put("messages", new JSONArray(contact.messages));
            successfulContacts.add(obj);
        } catch (Exception e) {
            Log.e(TAG, "Error creating JSON object", e);
        }
    }

    private String getMimeType(String path) {
        if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".mp4")) return "video/mp4";
        return "*/*";
    }

    private AccessibilityNodeInfo findNodeByViewId(AccessibilityNodeInfo root, String viewId) {
        List<AccessibilityNodeInfo> nodes = root.findAccessibilityNodeInfosByViewId(viewId);
        return (nodes != null && !nodes.isEmpty()) ? nodes.get(0) : null;
    }

    private void sendReportToApp() {
        Intent resultIntent = new Intent("com.copilot3.WHATSAPP_RESULT");
        resultIntent.putExtra("success_list", new JSONArray(successfulContacts).toString());
        sendBroadcast(resultIntent);

        WritableMap params = Arguments.createMap();
        params.putString("success_list", new JSONArray(successfulContacts).toString());
        params.putInt("sent_count", successfulContacts.size());
        params.putInt("total", ListToSend.size());

        if (MainApplication.getReactContext() != null) {
            MainApplication.getReactContext()
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit("onMessageSendReport", params);
        }

        Intent launchIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (launchIntent != null) {
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(launchIntent);
        }
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {}

    @Override
    public void onInterrupt() {
        Log.d(TAG, "Accessibility service interrupted.");
    }

    static class Contact {
        String phone;
        List<String> messages;
        String name;
        String mediaPath;

        Contact(String phone, List<String> messages, String name, String mediaPath) {
            this.phone = phone;
            this.messages = messages;
            this.name = name;
            this.mediaPath = mediaPath;
        }
    }
      private int randomDelay(int minMillis, int maxMillis) {
        Random random = new Random();
        return random.nextInt(maxMillis - minMillis) + minMillis;
    }
}

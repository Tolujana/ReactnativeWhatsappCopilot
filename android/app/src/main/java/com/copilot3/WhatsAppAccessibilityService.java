package com.copilot3;
import com.facebook.react.bridge.Arguments;
import com.copilot3.MainApplication;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
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


public class WhatsAppAccessibilityService extends AccessibilityService {
private ReactApplicationContext reactContext;
    private static final String TAG = "WAService";
    private List<Contact> contactsToSend = new ArrayList<>();
    private int currentContactIndex = 0;
    private Handler handler = new Handler();
    //private List<String> successfulContacts = new ArrayList<>();
    private List<JSONObject> successfulContacts = new ArrayList<>();
    // <-- Added: to track sent contacts
     // ✅ Holds the currently selected WhatsApp package
    private String selectedWhatsAppPackage = "com.whatsapp";


    @Override
    public void onServiceConnected() {
        AccessibilityServiceInfo info = new AccessibilityServiceInfo();
        info.eventTypes = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED |
                          AccessibilityEvent.TYPE_VIEW_CLICKED |
                          AccessibilityEvent.TYPE_VIEW_FOCUSED |
                          AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED;
        info.feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC;
        info.packageNames = new String[]{"com.whatsapp", "com.whatsapp.w4b"};
        info.flags = AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS;
        setServiceInfo(info);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && "START_SENDING_WHATSAPP".equals(intent.getAction())) {
            try {
                String contactsJson = intent.getStringExtra("contacts_json");
                selectedWhatsAppPackage = intent.getStringExtra("whatsapp_type");
                  Log.d(TAG, "Selected WhatsApp package: " + selectedWhatsAppPackage);
                contactsToSend = parseContacts(contactsJson);
                currentContactIndex = 0;
                successfulContacts.clear(); // <-- Added: clear previous state
                openNextContact();
            } catch (Exception e) {
                Log.e(TAG, "Error parsing message data", e);
            }
        }
        return START_STICKY;
    }

    private List<Contact> parseContacts(String json) {
        List<Contact> list = new ArrayList<>();
        try {
            JSONArray arr = new JSONArray(json);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject obj = arr.getJSONObject(i);
                String phone = obj.getString("phone");
                String message = obj.getString("message");
                String name = obj.getString("name");
                String mediaPath = obj.optString("mediaPath", null);
                list.add(new Contact(phone, message,name, mediaPath));
            }
        } catch (Exception e) {
            Log.e(TAG, "Error parsing contact JSON", e);
        }
        return list;
    }

    private void openNextContact() {
        if (currentContactIndex >= contactsToSend.size()) {
             Log.d(TAG, "current index"+ currentContactIndex);
            sendReportToApp(); // <-- Added: send broadcast and return to app
            stopSelf();
            return;
        }
         Log.d(TAG, "current index"+ currentContactIndex);
        final Contact contact = contactsToSend.get(currentContactIndex);
        currentContactIndex++;
           
        Intent launchIntent = new Intent(Intent.ACTION_VIEW);
        launchIntent.setData(Uri.parse("https://wa.me/" + contact.phone.replace("+", "")));
        launchIntent.setPackage( selectedWhatsAppPackage);
       
        launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(launchIntent);

        handler.postDelayed(() -> {
            if (contact.mediaPath != null && !contact.mediaPath.isEmpty()) {
                sendMediaWithCaption(contact);
            } else {
                sendTextMessage(contact);
            }
        }, 5000);
    }

    private void sendMediaWithCaption(Contact contact) {
        try {
            File mediaFile = new File(contact.mediaPath);
            if (!mediaFile.exists()) {
                Log.e(TAG, "Media file does not exist: " + contact.mediaPath);
                sendTextMessage(contact);
                return;
            }

            Uri uri = FileProvider.getUriForFile(this, getPackageName() + ".provider", mediaFile);

            Intent sendIntent = new Intent();
            sendIntent.setAction(Intent.ACTION_SEND);
            sendIntent.putExtra(Intent.EXTRA_STREAM, uri);
            sendIntent.putExtra(Intent.EXTRA_TEXT, contact.message);
            sendIntent.setType(getMimeType(mediaFile.getAbsolutePath()));
            sendIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            sendIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(sendIntent);

            //successfulContacts.add(contact.phone); // <-- Added: mark as success
          
                try {
                JSONObject obj = new JSONObject();
                 obj.put("phone", contact.phone);
                 obj.put("name", contact.name);
                 obj.put("message", contact.message);
                successfulContacts.add(obj);
            } catch (Exception e) {
                Log.e(TAG, "Error creating JSON object", e);
            }
                
            handler.postDelayed(this::openNextContact, 8000);

        } catch (Exception e) {
            Log.e(TAG, "Error sending media", e);
            openNextContact();
        }
    }

    private void sendTextMessage(Contact contact) {
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) {
            Log.e(TAG, "Root window is null. Cannot send text message.");
            openNextContact();
            return;
        }

        AccessibilityNodeInfo inputField = findNodeByViewId(root, "com.whatsapp:id/entry");
        if (inputField == null) {
            inputField = findNodeByViewId(root, "com.whatsapp.w4b:id/entry");
        }

        if (inputField != null && inputField.isEditable()) {
            inputField.performAction(AccessibilityNodeInfo.ACTION_FOCUS);

            Bundle args = new Bundle();
            args.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, contact.message);
            inputField.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args);

            AccessibilityNodeInfo sendButton = findNodeByViewId(root, "com.whatsapp:id/send");
            if (sendButton == null) {
                sendButton = findNodeByViewId(root, "com.whatsapp.w4b:id/send");
            }
            if (sendButton != null && sendButton.isClickable()) {
                sendButton.performAction(AccessibilityNodeInfo.ACTION_CLICK);
            }

                try {
                JSONObject obj = new JSONObject();
                 obj.put("phone", contact.phone);
                 obj.put("name", contact.name);
                 obj.put("message", contact.message);
                successfulContacts.add(obj);
                } catch (Exception e) {
                 Log.e(TAG, "Error creating JSON object", e);
                }



            //successfulContacts.add(contact.phone); // <-- Added: mark as success
        } else {
            Log.e(TAG, "Input field not found or not editable");
        }

        handler.postDelayed(this::openNextContact, 5000);
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
    sendBroadcast(resultIntent); // <-- You can keep this if needed elsewhere
    Log.d(TAG, "successful:"+new JSONArray(successfulContacts).toString());
    // React Native event emit
    WritableMap params = Arguments.createMap();
    params.putString("success_list", new JSONArray(successfulContacts).toString());
    params.putInt("sent_count", successfulContacts.size());
    params.putInt("total", contactsToSend.size());

    if (MainApplication.getReactContext() != null) {
        MainApplication.getReactContext()
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
            .emit("onMessageSendReport", params);
    }

    // Optionally reopen app
    Intent launchIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
    if (launchIntent != null) {
        launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(launchIntent);
    }
}

  

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
    }

    @Override
    public void onInterrupt() {
        Log.d(TAG, "Accessibility service interrupted.");
    }

    static class Contact {
        String phone;
        String message;
        String name;
        String mediaPath;

        Contact(String phone, String message, String name,String mediaPath) {
            this.phone = phone;
            this.message = message;
            this.mediaPath = mediaPath;
            this.name = name;
        }
    }
}

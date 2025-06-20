package com.copilot3;

import android.app.Service;
import android.content.Intent;
import android.net.Uri;
import android.os.Handler;
import android.os.IBinder;
import android.util.Log;
import android.os.Looper;
import org.json.JSONArray;
import org.json.JSONObject;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import java.util.ArrayList;
import java.util.List;

public class ManualWhatsAppSendService extends Service {

    private static final String TAG = "ManualWASendService";

    private List<Contact> ListToSend = new ArrayList<>();
    private List<JSONObject> successfulContacts = new ArrayList<>();
    private int currentContactIndex = 0;
    private Handler handler = new Handler();
    private String selectedWhatsAppPackage;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        startService(new Intent(this, OverlayService.class));
        Log.d(TAG, "Service received intent: " + intent.getAction());
        selectedWhatsAppPackage = intent.getStringExtra("whatsapp_type");


        if ("START_SENDING_MESSAGES_MANUAL".equals(intent.getAction())) {
            String contactsJson = intent.getStringExtra("contacts_json");
            ListToSend = parseContacts(contactsJson);
            currentContactIndex = 0;
            successfulContacts.clear();
            openNextContact(); // Open WhatsApp for the first contact
        }

        return START_NOT_STICKY;
    }

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
        String fullMessage = String.join("\n\n", contact.messages);
        
        String url = "https://wa.me/" + contact.phone.replace("+", "") + "?text=" + Uri.encode(fullMessage);
        Log.d(TAG, "Opening URL: " + url);
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setData(Uri.parse(url));
        intent.setPackage(selectedWhatsAppPackage);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(intent);

        markContactSuccess(contact);

      
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

    private void sendReportToApp() {
        stopService(new Intent(this, OverlayService.class));
    
        Intent resultIntent = new Intent("com.copilot3.WHATSAPP_RESULT");
        resultIntent.putExtra("success_list", new JSONArray(successfulContacts).toString());
        sendBroadcast(resultIntent);
    
        // Send event to React Native
        if (MainApplication.getReactContext() != null) {
            WritableMap params = Arguments.createMap();
            params.putString("success_list", new JSONArray(successfulContacts).toString());
            params.putInt("sent_count", successfulContacts.size());
            params.putInt("total", ListToSend.size());
    
            MainApplication.getReactContext()
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit("onMessageSendReport", params);
        }
    
        // Relaunch the app
        Intent launchIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (launchIntent != null) {
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(launchIntent);
        }
    }
    

    @Override
    public IBinder onBind(Intent intent) {
        return null;
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

    public static ManualWhatsAppSendService instance;

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
    }

    public static void openNextFromOverlay() {
        if (instance != null) {
            instance.runOnMain(() -> {
                instance.currentContactIndex++;
                instance.openNextContact();
            });
        }
    }
    
    private void runOnMain(Runnable runnable) {
        new Handler(Looper.getMainLooper()).post(runnable);
    }
    
}

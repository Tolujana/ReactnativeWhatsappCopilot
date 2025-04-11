package com.copilot3;

import android.content.Intent;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;
import androidx.annotation.NonNull;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

public class WhatsappServiceModule extends ReactContextBaseJavaModule {

    private static ReactApplicationContext context;

    public WhatsappServiceModule(ReactApplicationContext reactContext) {
        super(reactContext);
        context = reactContext;
    }

    @NonNull
    @Override
    public String getName() {
        return "WhatsappServiceModule";
    }

    @ReactMethod
    public void startSendingMessages(String contactListJson, String whatsappType) {
        Intent intent = new Intent(context, WhatsAppAccessibilityService.class);
        intent.putExtra("contacts_json", contactListJson);
        intent.setAction("START_SENDING_WHATSAPP");
        intent.putExtra("whatsapp_type", whatsappType);
        context.startService(intent);

        // If accessibility not enabled, open settings
        if (!isAccessibilityServiceEnabled()) {
            Intent settingsIntent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
            settingsIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(settingsIntent);
        }
    }

    private boolean isAccessibilityServiceEnabled() {
        // Optional: check accessibility enabled
        return true; // assume enabled for now
    }

    public static void sendReportToJS(int sentCount, int total) {
    if (context != null) {
        WritableMap map = Arguments.createMap();
        map.putInt("sent_count", sentCount);
        map.putInt("total", total);

        context
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
            .emit("onMessageSendReport", map);
    } else {
        Log.e("WhatsappServiceModule", "ReactContext is null when trying to emit result.");
    }
}

}

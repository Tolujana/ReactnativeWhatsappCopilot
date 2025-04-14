package com.copilot3;

import android.content.Intent;
import android.os.Handler;
import android.os.Looper;
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

    private static final String TAG = "WhatsappServiceModule";
    private final ReactApplicationContext reactContext;

    public WhatsappServiceModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @NonNull
    @Override
    public String getName() {
        return "WhatsappServiceModule";
    }

    @ReactMethod
    public void startSendingMessages(String contactListJson, String whatsappType) {
        Intent intent = new Intent(reactContext, WhatsAppAccessibilityService.class);
        intent.putExtra("contacts_json", contactListJson);
        intent.setAction("START_SENDING_WHATSAPP");
        intent.putExtra("whatsapp_type", whatsappType);
        reactContext.startService(intent);

        if (!isAccessibilityServiceEnabled()) {
            Intent settingsIntent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
            settingsIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            reactContext.startActivity(settingsIntent);
        }
    }

    private boolean isAccessibilityServiceEnabled() {
        return true; // stub: replace with real check if needed
    }

    // Call this method from your Service when sending is complete
    public void sendReportToJS(int sentCount, int total) {
        WritableMap map = Arguments.createMap();
        map.putInt("sent_count", sentCount);
        map.putInt("total", total);

        new Handler(Looper.getMainLooper()).post(() -> {
            if (reactContext.hasActiveCatalystInstance()) {
                reactContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                    .emit("onMessageSendReport", map);
            } else {
                Log.e(TAG, "React context not ready to emit event.");
            }
        });
    }
}

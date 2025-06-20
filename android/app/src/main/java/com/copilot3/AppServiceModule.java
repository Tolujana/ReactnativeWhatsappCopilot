package com.copilot3;
import android.content.ComponentName;
import android.content.Intent;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.Log;

import androidx.annotation.NonNull;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

public class AppServiceModule extends ReactContextBaseJavaModule {

    private static final String TAG = "ServiceModule";
    private final ReactApplicationContext reactContext;

    public AppServiceModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @NonNull
    @Override
    public String getName() {
        return "AppServiceModule";
    }

    /**
     * Starts the service to send messages to  contacts.
     * If accessibility service is enabled, it uses automatic mode.
     * If accessibility service is disabled, it uses manual mode.
     *
     * @param contactListJson JSON string of contacts to send messages to.
     * @param whatsappType Type of WhatsApp (e.g., "whatsapp", "business").
     */
    
    @ReactMethod
    public void startSendingMessages(String contactListJson, String whatsappType) {
        if (isAccessibilityServiceEnabled()) {
            // Accessibility is enabled → use automatic mode
            Intent intent = new Intent(reactContext, AppAccessibilityService.class);
            intent.putExtra("contacts_json", contactListJson);
            intent.setAction("START_SENDING_MESSAGES");
            intent.putExtra("app_type", whatsappType);
            reactContext.startService(intent);
            Log.d(TAG, "Starting AppAccessibilityService (automatic mode)");
        } else {
            // Accessibility is disabled → use manual mode
            Intent intent = new Intent(reactContext, ManualWhatsAppSendService.class);
            intent.putExtra("contacts_json", contactListJson);
            intent.setAction("START_SENDING_MESSAGES_MANUAL");
            intent.putExtra("app_type", whatsappType);
            reactContext.startService(intent);
            Log.d(TAG, "Starting ManualWhatsAppSendService (manual mode)");

            // Optionally prompt user to enable accessibility if you still want
            // Intent settingsIntent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
            // settingsIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            // reactContext.startActivity(settingsIntent);
        }
    }



    private boolean isAccessibilityServiceEnabled() {
        ComponentName expectedComponent = new ComponentName(reactContext, AppAccessibilityService.class);
        String enabledServices = Settings.Secure.getString(reactContext.getContentResolver(),
                Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
        return enabledServices != null && enabledServices.contains(expectedComponent.flattenToString());
    }

    @ReactMethod
public void checkOverlayPermission(Promise promise) {
    boolean canDraw = Settings.canDrawOverlays(getReactApplicationContext());
    promise.resolve(canDraw);
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

package com.copilot3;

import android.app.Activity;
import android.content.Intent;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.bridge.ActivityEventListener;
import com.facebook.react.bridge.BaseActivityEventListener;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.Arguments;

import java.util.ArrayList;

public class ContactPickerModule extends ReactContextBaseJavaModule {

    private static final int REQUEST_CODE = 12345;
    private Promise pickerPromise;

    public ContactPickerModule(ReactApplicationContext reactContext) {
        super(reactContext);
        reactContext.addActivityEventListener(mActivityEventListener);
    }

    @NonNull
    @Override
    public String getName() {
        return "ContactPicker";
    }

    @ReactMethod
    public void openContactPicker(Promise promise) {
        Activity currentActivity = getCurrentActivity();
        if (currentActivity == null) {
            promise.reject("NO_ACTIVITY", "No activity found");
            return;
        }

        this.pickerPromise = promise;

        Intent intent = new Intent(currentActivity, CustomContactPickerActivity.class);
        currentActivity.startActivityForResult(intent, REQUEST_CODE);
    }

    private final ActivityEventListener mActivityEventListener = new BaseActivityEventListener() {
        @Override
        public void onActivityResult(Activity activity, int requestCode, int resultCode, @Nullable Intent data) {
            if (requestCode == REQUEST_CODE && pickerPromise != null) {
                if (resultCode == Activity.RESULT_OK && data != null) {
                    ArrayList<String> contacts = data.getStringArrayListExtra("selectedContacts");
                    WritableArray array = Arguments.createArray();
                    for (String contact : contacts) {
                        array.pushString(contact);
                    }
                    pickerPromise.resolve(array);
                } else {
                    pickerPromise.reject("CANCELLED", "User cancelled");
                }
                pickerPromise = null;
            }
        }
    };
}

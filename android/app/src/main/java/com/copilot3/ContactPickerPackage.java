package com.copilot3;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

public class ContactPickerPackage implements ReactPackage {
    @Override
    public List<NativeModule> createNativeModules(ReactApplicationContext reactContext) {
        return Arrays.asList(new ContactPickerModule(reactContext));
    }

    @Override
    public List createViewManagers(ReactApplicationContext reactContext) {
        return Collections.emptyList();
    }
}

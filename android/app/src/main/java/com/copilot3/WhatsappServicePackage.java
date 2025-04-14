  package com.copilot3;

  import com.facebook.react.ReactPackage;
  import com.facebook.react.bridge.NativeModule;
  import com.facebook.react.bridge.ReactApplicationContext;
  import com.facebook.react.uimanager.ViewManager;

  import java.util.ArrayList;
  import java.util.Collections;
  import java.util.List;

  public class WhatsappServicePackage implements ReactPackage {

    @Override
    public List<NativeModule> createNativeModules(ReactApplicationContext reactContext) {
      MainApplication.setReactContext(reactContext); // <--- ADD THIS LINE
      List<NativeModule> modules = new ArrayList<>();
      modules.add(new WhatsappServiceModule(reactContext));
      return modules;
    }

    @Override
    public List<ViewManager> createViewManagers(ReactApplicationContext reactContext) {
      return Collections.emptyList();
    }
  }

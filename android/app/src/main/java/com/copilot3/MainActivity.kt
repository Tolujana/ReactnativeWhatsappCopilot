package com.copilot3

import android.content.Intent
import android.os.Bundle // Add for onCreate
import android.util.Log // Add for logging
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.ReactApplication
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.google.android.gms.ads.MobileAds // Add for AdMob
// Add for splash screen (if used)

class MainActivity : ReactActivity() {

    override fun getMainComponentName(): String = "copilot3"

    override fun createReactActivityDelegate(): ReactActivityDelegate =
        DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

    override fun onCreate(savedInstanceState: Bundle?) {
         super.onCreate(savedInstanceState)  
        try {
            
            MobileAds.initialize(this) { initializationStatus ->
                Log.d("MainActivity", "AdMob initialized: $initializationStatus")
            }
        } catch (e: Exception) {
            Log.e("MainActivity", "Error in onCreate: ${e.message}")
            // Optionally, handle the error gracefully or rethrow for debugging
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        try {
            val reactInstanceManager = (application as ReactApplication)
                .reactNativeHost
                .reactInstanceManager
            reactInstanceManager.onActivityResult(this, requestCode, resultCode, data)
        } catch (e: Exception) {
            Log.e("MainActivity", "Error in onActivityResult: ${e.message}")
        }
    }
}
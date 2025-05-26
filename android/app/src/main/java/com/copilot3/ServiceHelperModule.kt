package com.copilot3 // 🔁 Replace with your actual package name

import android.content.Intent
import android.provider.Settings
import com.facebook.react.bridge.*
import com.facebook.react.module.annotations.ReactModule
import android.content.ComponentName
import android.content.Context
import android.view.accessibility.AccessibilityManager
import android.accessibilityservice.AccessibilityServiceInfo
import com.facebook.react.bridge.Promise

@ReactModule(name = ServiceHelperModule.NAME)
class ServiceHelperModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "AccessibilityHelper"
    }

    override fun getName(): String {
        return NAME
    }

    @ReactMethod
    fun openAccessibilitySettings() {
        val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
        reactContext.startActivity(intent)
    }

    @ReactMethod
    fun isAccessibilityServiceEnabled2(serviceId: String, promise: Promise) {
        try {
            val accessibilityEnabled = Settings.Secure.getInt(
                reactContext.contentResolver,
                Settings.Secure.ACCESSIBILITY_ENABLED
            ) == 1

            if (!accessibilityEnabled) {
                promise.resolve(false)
                return
            }

            val enabledServices = Settings.Secure.getString(
                reactContext.contentResolver,
                Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
            ) ?: ""

            val services = enabledServices.split(":")
            for (service in services) {
                if (service.equals(serviceId, ignoreCase = true)) {
                    promise.resolve(true)
                    return
                }
            }

            promise.resolve(false)
        } catch (e: Exception) {
            promise.reject("ACCESSIBILITY_CHECK_FAILED", e)
        }
    }
     @ReactMethod
    fun isAccessibilityServiceEnabled(serviceId: String, promise: Promise) {
    try {
        val am = reactContext.getSystemService(Context.ACCESSIBILITY_SERVICE) as AccessibilityManager

        val accessibilityEnabled = android.provider.Settings.Secure.getInt(
            reactContext.contentResolver,
            android.provider.Settings.Secure.ACCESSIBILITY_ENABLED,
            0
        ) == 1

        if (!accessibilityEnabled) {
            promise.resolve(false)
            return
        }

        val enabledServices = am.getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_ALL_MASK)

        for (serviceInfo in enabledServices) {
            if (serviceInfo.id.equals(serviceId, ignoreCase = true)) {
                promise.resolve(true)
                return
            }
        }

        promise.resolve(false)
    } catch (e: Exception) {
        promise.reject("ACCESSIBILITY_CHECK_FAILED", e)
    }
}



}

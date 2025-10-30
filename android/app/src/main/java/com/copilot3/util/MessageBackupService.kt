// src/util/MessageBackupService.kt
package com.copilot3.util

import android.content.Context
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import android.app.Notification
import org.json.JSONArray

class MessageBackupService : NotificationListenerService() {

    private val TAG = "MessageBackupService"

    private fun isAppEnabled(packageName: String): Boolean {
        val prefs = getSharedPreferences("app_prefs", Context.MODE_PRIVATE)
        val enabledJson = prefs.getString("enabled_notification_apps", "[]") ?: "[]"
        val enabledApps = JSONArray(enabledJson)
        for (i in 0 until enabledApps.length()) {
            if (enabledApps.getString(i) == packageName) {
                return true
            }
        }
        return false
    }

    private fun isPrivateChatOnly(text: String): Boolean {
        val prefs = getSharedPreferences("app_prefs", Context.MODE_PRIVATE)
        val privateOnly = prefs.getBoolean("backupPrivateOnly", false)
        if (!privateOnly) return true

        // Detect group: text starts with "Sender: message" pattern
        val parts = text.split(":", limit = 2)
        return parts.size < 2 || parts[0].trim().isEmpty()
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        super.onNotificationPosted(sbn)
        sbn ?: return

        val packageName = sbn.packageName
        if (!isAppEnabled(packageName)) return  // Skip if app not enabled

        val app = when (packageName) {
            "com.whatsapp" -> "whatsapp"
            "com.whatsapp.w4b" -> "whatsapp_business"
            "org.telegram.messenger" -> "telegram"
            else -> return
        }

        val extras = sbn.notification.extras ?: return
        val title = extras.getString(Notification.EXTRA_TITLE) ?: return  // Contact name or phone
        val text = extras.getString(Notification.EXTRA_TEXT) ?: return  // Message content

        if (!isPrivateChatOnly(text)) return  // Skip groups if private-only enabled

        // Use title as contact_identifier (name if saved, phone if unsaved)
        val contactIdentifier = title
        val name = title
        val timestamp = sbn.postTime.toString()

        // Check if enabled (specific or wildcard '*')
        var isEnabled = false
        val dbHelper = CampaignsDbHelper(this)
        val db = dbHelper.readableDatabase
        db.rawQuery(
            "SELECT 1 FROM enabled_backups WHERE app = ? AND contact_identifier IN (?, '*') LIMIT 1",
            arrayOf(app, contactIdentifier)
        ).use { cursor ->
            isEnabled = cursor.moveToFirst()
        }

        if (!isEnabled) return  // Skip if not enabled for this sender

        // Save message (deducts points if applicable)
        try {
            CampaignsModule.saveMessage(this, app, contactIdentifier, name, timestamp, text, false)
            // FIXED: Log to recent_chats ONLY after successful save
            val saveDb = dbHelper.writableDatabase
            saveDb.execSQL(
                "INSERT OR REPLACE INTO recent_chats (app, contact_identifier, name, last_timestamp) VALUES (?, ?, ?, ?)",
                arrayOf(app, contactIdentifier, name, timestamp)
            )
        } catch (e: Exception) {
            Log.e(TAG, "Failed to save message", e)
        }
    }
}
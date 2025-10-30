// LowPointsReceiver.kt updated to delete old messages if auto-delete set
package com.copilot3.util

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.app.NotificationManager
import android.app.NotificationChannel
import android.os.Build
import androidx.core.app.NotificationCompat
import android.graphics.Color

class LowPointsReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val dbHelper = CampaignsDbHelper(context)
        val db = dbHelper.writableDatabase
        var points = 0
        db.rawQuery("SELECT points FROM user_points WHERE id = 1", null).use { c ->
            if (c.moveToFirst()) points = c.getInt(0)
        }

        // Low points notification
        if (points < 20) {
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val channelId = "low_points_channel"
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val channel = NotificationChannel(
                    channelId,
                    "Low Points Alerts",
                    NotificationManager.IMPORTANCE_DEFAULT
                ).apply {
                    description = "Notifications for low points"
                    enableLights(true)
                    lightColor = Color.RED
                }
                notificationManager.createNotificationChannel(channel)
            }

            val builder = NotificationCompat.Builder(context, channelId)
                .setSmallIcon(android.R.drawable.ic_dialog_alert)  // Replace with your app's icon
                .setContentTitle("Low Points Alert")
                .setContentText("Your points are below 20. Watch a rewarded ad to earn more!")
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setAutoCancel(true)

            notificationManager.notify(999, builder.build())  // Unique ID
        }

        // Auto-delete old messages
        val prefs = context.getSharedPreferences("app_prefs", Context.MODE_PRIVATE)
        val autoDeleteDays = prefs.getInt("autoDeleteDays", 0)
        if (autoDeleteDays > 0) {
            val cutoff = System.currentTimeMillis() - (autoDeleteDays * 24L * 60 * 60 * 1000)
            db.execSQL("DELETE FROM messages WHERE timestamp < ?", arrayOf(cutoff.toString()))
        }
    }
}
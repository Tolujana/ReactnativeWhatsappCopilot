// Updated CampaignsModule.kt with new methods for notification access and auto-delete prefs
package com.copilot3.util
import org.json.JSONArray
import org.json.JSONObject
import android.util.Log
import android.app.AlarmManager
import android.app.PendingIntent
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import com.facebook.react.bridge.*
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.LoadAdError
import com.google.android.gms.ads.rewarded.RewardedAd
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback
import com.google.android.gms.ads.rewarded.RewardItem
import java.util.Calendar

class CampaignsModule(private val reactCtx: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactCtx) {

    private val dbHelper = CampaignsDbHelper(reactCtx)

    // ====== CONFIG: native-only values ======
    private val REWARD_POINTS = 10
    private val CONTACT_INSERT_COST = 2
    private val CAMPAIGN_INSERT_COST = 10
    private val MIN_MESSAGE_COST = 10
    private val PER_MESSAGE_COST = 2
    private val CHAT_VIEW_COST = 1
    private val MESSAGE_SAVE_COST = 1
    private val LOW_POINTS_THRESHOLD = 20
    private val PREFS = "app_prefs"
    private val KEY_PREMIUM = "isPremium"
    private val KEY_AUTO_DELETE_DAYS = "autoDeleteDays"

    // ====== ADS ======
    private var rewardedAd: RewardedAd? = null
    // test ad unit from AdMob (replace with yours)
    // this is test ad unit: "ca-app-pub-3940256099942544/5224354917"
    //real ad unit "ca-app-pub-7993847549836206/3324760857"
    private val rewardedUnitId = "ca-app-pub-3940256099942544/5224354917"

    override fun getName(): String = "CampaignsModule"

    // -------- Premium helpers --------
    private fun isPremium(): Boolean {
        val prefs = reactCtx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        return prefs.getBoolean(KEY_PREMIUM, false)
    }

    @ReactMethod
    fun setPremium(enabled: Boolean, promise: Promise) {
        val prefs = reactCtx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        prefs.edit().putBoolean(KEY_PREMIUM, enabled).apply()
        promise.resolve(enabled)
    }

    @ReactMethod
    fun isPremium(promise: Promise) {
        promise.resolve(isPremium())
    }

    // -------- Points helpers (DB-backed) --------
    private fun getPointsInternal(db: SQLiteDatabase): Int {
        db.rawQuery("SELECT points FROM user_points WHERE id = 1", null).use { c ->
            return if (c.moveToFirst()) c.getInt(0) else 0
        }
    }

    private fun setPointsInternal(db: SQLiteDatabase, newPoints: Int) {
        // Use execSQL with bind args for safety
        db.execSQL("UPDATE user_points SET points = ? WHERE id = 1", arrayOf(newPoints))
    }

    @ReactMethod
    fun getPoints(promise: Promise) {
        val db = dbHelper.readableDatabase
        promise.resolve(getPointsInternal(db))
    }
    // Updated CampaignsModule.kt - Add chat creation in getChatMessages if missing, and initial wildcard enable
// Insert this in getChatMessages, after transaction for points:
@ReactMethod
fun getChatMessages(app: String, contactIdentifier: String, promise: Promise) {
    val db = dbHelper.writableDatabase
    db.beginTransaction()
    try {
        if (!isPremium()) {
            val current = getPointsInternal(db)
            if (current < CHAT_VIEW_COST) {
                promise.reject("INSUFFICIENT_POINTS", "Need $CHAT_VIEW_COST points to view chat")
                return
            }
            setPointsInternal(db, current - CHAT_VIEW_COST)
        }
        db.setTransactionSuccessful()
    } finally {
        db.endTransaction()
    }

    val readDb = dbHelper.readableDatabase
    var cursor: Cursor? = null
    try {
        // Try to get chat_id; if not, create one
        var chatIdCursor = readDb.rawQuery(
            "SELECT id FROM chats WHERE app = ? AND contact_identifier = ?",
            arrayOf(app, contactIdentifier)
        )
        var chatId: Long = if (chatIdCursor.moveToFirst()) {
            chatIdCursor.getLong(0)
        } else {
            chatIdCursor.close()
            // Create chat if missing (for recent senders)
            val writableDb = dbHelper.writableDatabase
            val stmt = writableDb.compileStatement("INSERT INTO chats (app, contact_identifier, name) VALUES (?, ?, ?)")
            stmt.bindString(1, app)
            stmt.bindString(2, contactIdentifier)
            stmt.bindString(3, contactIdentifier) // Use identifier as name fallback
            val newId = stmt.executeInsert()
            newId
        }
        chatIdCursor.close()

        cursor = readDb.rawQuery(
            "SELECT timestamp, is_sent, content FROM messages WHERE chat_id = ? ORDER BY timestamp ASC",
            arrayOf(chatId.toString())
        )
        val arr = Arguments.createArray()
        cursor?.let { c ->
            while (c.moveToNext()) {
                val m = Arguments.createMap()
                m.putString("timestamp", c.getString(0))
                m.putBoolean("isSent", c.getInt(1) == 1)
                m.putString("content", c.getString(2))
                arr.pushMap(m)
            }
        }
        promise.resolve(arr)
    } catch (e: Exception) {
        promise.reject("GET_CHAT_MESSAGES_ERROR", e)
    } finally {
        cursor?.close()
    }
}

// Add initial wildcard enable in createTables (for default all)
@ReactMethod
fun createTables(promise: Promise) {
    try {
        dbHelper.writableDatabase // ensures onCreate runs
        // Default enable all for main apps
        val db = dbHelper.writableDatabase
        val apps = arrayOf("whatsapp", "whatsapp_business", "telegram")
        for (app in apps) {
            db.execSQL("INSERT OR IGNORE INTO enabled_backups (app, contact_identifier) VALUES (?, '*')", arrayOf(app))
        }
        promise.resolve(true)
    } catch (e: Exception) {
        promise.reject("CREATE_TABLES_ERROR", e)
    }
}


    // -------- Create tables (optional - DB helper already creates on first open) --------
    @ReactMethod
    fun createTables2(promise: Promise) {
        try {
            dbHelper.writableDatabase // ensures onCreate runs if needed
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CREATE_TABLES_ERROR", e)
        }
    }

    // -------- Rewarded ad helpers (UI-thread safe) --------
    @ReactMethod
    fun preloadRewardedAd(promise: Promise?) {
        Handler(Looper.getMainLooper()).post {
            try {
                val adRequest = AdRequest.Builder().build()
                RewardedAd.load(
                    reactCtx,
                    rewardedUnitId,
                    adRequest,
                    object : RewardedAdLoadCallback() {
                        override fun onAdFailedToLoad(error: LoadAdError) {
                            rewardedAd = null
                            promise?.reject("AD_LOAD_FAILED", error.message)
                        }

                        override fun onAdLoaded(ad: RewardedAd) {
                            rewardedAd = ad
                            promise?.resolve(true)
                        }
                    }
                )
            } catch (e: Exception) {
                promise?.reject("PRELOAD_FAILED", e)
            }
        }
    }

    @ReactMethod
    fun showRewardedAd(promise: Promise) {
        val activity = currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "No current activity")
            return
        }

        val ad = rewardedAd
        if (ad == null) {
            promise.reject("NO_AD", "No rewarded ad preloaded")
            return
        }

        Handler(Looper.getMainLooper()).post {
            ad.show(activity) { rewardItem: RewardItem? ->
                // rewardItem may be null depending on SDK; fall back to native REWARD_POINTS
                val rewardAmount = rewardItem?.amount ?: REWARD_POINTS
                val rewardType = rewardItem?.type ?: "points"

                val db = dbHelper.writableDatabase
                db.beginTransaction()
                try {
                    val current = getPointsInternal(db)
                    val newBalance = current + rewardAmount
                    setPointsInternal(db, newBalance)
                    db.setTransactionSuccessful()

                    val map = Arguments.createMap()
                    map.putString("type", rewardType)
                    map.putInt("amount", rewardAmount)
                    map.putInt("balance", newBalance)
                    promise.resolve(map)
                } catch (e: Exception) {
                    promise.reject("REWARD_SAVE_ERR", e)
                } finally {
                    db.endTransaction()
                }

                rewardedAd = null
                // auto-preload next ad
                preloadRewardedAd(null)
            }
        }
    }

    // -------- Campaigns (insert/get/update/delete) --------
    @ReactMethod
    fun insertCampaignNative(name: String, description: String, extraFieldsJson: String, promise: Promise) {
        val db = dbHelper.writableDatabase
        db.beginTransaction()
        try {
            if (!isPremium()) {
                val current = getPointsInternal(db)
                if (current < CAMPAIGN_INSERT_COST) {
                    promise.reject("INSUFFICIENT_POINTS", "Need $CAMPAIGN_INSERT_COST points")
                    return
                }
                setPointsInternal(db, current - CAMPAIGN_INSERT_COST)
            }

            val stmt = db.compileStatement("INSERT INTO campaigns (name, description, extra_fields) VALUES (?, ?, ?)")
            stmt.bindString(1, name)
            stmt.bindString(2, description)
            stmt.bindString(3, extraFieldsJson)
            val idLong = stmt.executeInsert()
            db.setTransactionSuccessful()
            // convert to Int for RN
            promise.resolve(idLong.toInt())
        } catch (e: Exception) {
            promise.reject("INSERT_CAMPAIGN_ERROR", e)
        } finally {
            db.endTransaction()
        }
    }

    @ReactMethod
    fun getCampaignsNative(promise: Promise) {
        val db = dbHelper.readableDatabase
        var cursor: Cursor? = null
        try {
            cursor = db.rawQuery("SELECT id, name, description, extra_fields FROM campaigns", null)
            val arr = Arguments.createArray()
            cursor?.let { c ->
                while (c.moveToNext()) {
                    val m = Arguments.createMap()
                    m.putInt("id", c.getInt(0))
                    m.putString("name", c.getString(1))
                    m.putString("description", c.getString(2))
                    m.putString("extra_fields", c.getString(3))
                    arr.pushMap(m)
                }
            }
            promise.resolve(arr)
        } catch (e: Exception) {
            promise.reject("GET_CAMPAIGNS_ERROR", e)
        } finally {
            cursor?.close()
        }
    }

    @ReactMethod
    fun updateCampaignNative(id: Int, name: String, description: String, promise: Promise) {
        val db = dbHelper.writableDatabase
        db.beginTransaction()
        try {
            val stmt = db.compileStatement("UPDATE campaigns SET name = ?, description = ? WHERE id = ?")
            stmt.bindString(1, name)
            stmt.bindString(2, description)
            stmt.bindLong(3, id.toLong())
            stmt.executeUpdateDelete()
            db.setTransactionSuccessful()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("UPDATE_CAMPAIGN_ERROR", e)
        } finally {
            db.endTransaction()
        }
    }

    @ReactMethod
    fun deleteCampaignByIdNative(id: Int, promise: Promise) {
        val db = dbHelper.writableDatabase
        db.beginTransaction()
        try {
            db.execSQL("DELETE FROM campaigns WHERE id = ?", arrayOf(id))
            db.execSQL("DELETE FROM contacts WHERE campaign_id = ?", arrayOf(id))
            db.setTransactionSuccessful()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("DELETE_CAMPAIGN_ERROR", e)
        } finally {
            db.endTransaction()
        }
    }


@ReactMethod
fun insertContactNoDeduction(
    campaignId: Int,
    name: String,
    phone: String,
    extraFieldsJson: String,
    promise: Promise
) {
    try {
        // 1) Quick duplicate check using readable DB (no transaction)
        val readDb = dbHelper.readableDatabase
        readDb.rawQuery(
            "SELECT id FROM contacts WHERE campaign_id = ? AND phone = ?",
            arrayOf(campaignId.toString(), phone)
        ).use { cursor ->
            if (cursor.moveToFirst()) {
                val existingId = cursor.getInt(0)
                val dupMap = Arguments.createMap().apply {
                    putString("status", "duplicate")
                    putString("phone", phone)
                    putInt("existing_id", existingId)
                }
                promise.resolve(dupMap)
                return
            }
        }

        // 2) Not a duplicate → insert inside a writable transaction (NO DEDUCTION)
        val db = dbHelper.writableDatabase
        db.beginTransaction()
        try {
            // FIXED: Removed points deduction logic (handled upfront in bulk reserve)

            val stmt = db.compileStatement(
                "INSERT INTO contacts (campaign_id, name, phone, extra_field) VALUES (?, ?, ?, ?)"
            )
            stmt.bindLong(1, campaignId.toLong())
            stmt.bindString(2, name)
            stmt.bindString(3, phone)
            stmt.bindString(4, extraFieldsJson)
            val rowId = stmt.executeInsert() // returns Long

            db.setTransactionSuccessful()

            val out = Arguments.createMap().apply {
                putString("status", "inserted")
                putString("phone", phone)
                // return id as integer for convenience - JS will see it as Number
                putInt("id", rowId.toInt())
            }
            promise.resolve(out)
        } finally {
            db.endTransaction()
        }
    } catch (e: Exception) {
        promise.reject("INSERT_CONTACT_ERROR", e)
    }
}


    // -------- Contacts (insert/get/count/delete/update) --------
    @ReactMethod
    fun insertContactNative(
        campaignId: Int,
        name: String,
        phone: String,
        extraFieldsJson: String,
        promise: Promise
    ) {
        try {
            // 1) Quick duplicate check using readable DB (no transaction)
            val readDb = dbHelper.readableDatabase
            readDb.rawQuery(
                "SELECT id FROM contacts WHERE campaign_id = ? AND phone = ?",
                arrayOf(campaignId.toString(), phone)
            ).use { cursor ->
                if (cursor.moveToFirst()) {
                    val existingId = cursor.getInt(0)
                    val dupMap = Arguments.createMap().apply {
                        putString("status", "duplicate")
                        putString("phone", phone)
                        putInt("existing_id", existingId)
                    }
                    promise.resolve(dupMap)
                    return
                }
            }

            // 2) Not a duplicate → perform deduction & insert inside a writable transaction
            val db = dbHelper.writableDatabase
            db.beginTransaction()
            try {
                if (!isPremium()) {
                    val current = getPointsInternal(db)
                    if (current < CONTACT_INSERT_COST) {
                        promise.reject("INSUFFICIENT_POINTS", "Need $CONTACT_INSERT_COST points")
                        return
                    }
                    setPointsInternal(db, current - CONTACT_INSERT_COST)
                }

                val stmt = db.compileStatement(
                    "INSERT INTO contacts (campaign_id, name, phone, extra_field) VALUES (?, ?, ?, ?)"
                )
                stmt.bindLong(1, campaignId.toLong())
                stmt.bindString(2, name)
                stmt.bindString(3, phone)
                stmt.bindString(4, extraFieldsJson)
                val rowId = stmt.executeInsert() // returns Long

                db.setTransactionSuccessful()

                val out = Arguments.createMap().apply {
                    putString("status", "inserted")
                    putString("phone", phone)
                    // return id as integer for convenience - JS will see it as Number
                    putInt("id", rowId.toInt())
                }
                promise.resolve(out)
            } finally {
                db.endTransaction()
            }
        } catch (e: Exception) {
            promise.reject("INSERT_CONTACT_ERROR", e)
        }
    }

    @ReactMethod
    fun getContactsByCampaignIdNative(campaignId: Int, promise: Promise) {
        val db = dbHelper.readableDatabase
        var cursor: Cursor? = null
        try {
            cursor = db.rawQuery("SELECT id, name, phone, extra_field FROM contacts WHERE campaign_id = ?", arrayOf(campaignId.toString()))
            val arr = Arguments.createArray()
            cursor?.let { c ->
                while (c.moveToNext()) {
                    val m = Arguments.createMap()
                    m.putInt("id", c.getInt(0))
                    m.putString("name", c.getString(1))
                    m.putString("phone", c.getString(2))
                    m.putString("extra_field", c.getString(3))
                    arr.pushMap(m)
                }
            }
            promise.resolve(arr)
        } catch (e: Exception) {
            promise.reject("GET_CONTACTS_ERROR", e)
        } finally {
            cursor?.close()
        }
    }

    @ReactMethod
    fun getContactCountForCampaignNative(campaignId: Int, promise: Promise) {
        val db = dbHelper.readableDatabase
        var cursor: Cursor? = null
        try {
            cursor = db.rawQuery("SELECT COUNT(*) FROM contacts WHERE campaign_id = ?", arrayOf(campaignId.toString()))
            val count = cursor?.let { if (it.moveToFirst()) it.getInt(0) else 0 } ?: 0
            promise.resolve(count)
        } catch (e: Exception) {
            promise.reject("CONTACT_COUNT_ERROR", e)
        } finally {
            cursor?.close()
        }
    }

    @ReactMethod
    fun deleteContactsNative(ids: ReadableArray, promise: Promise) {
        val db = dbHelper.writableDatabase
        db.beginTransaction()
        try {
            for (i in 0 until ids.size()) {
                val id = ids.getInt(i)
                db.execSQL("DELETE FROM contacts WHERE id = ?", arrayOf(id))
            }
            db.setTransactionSuccessful()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("DELETE_CONTACTS_ERROR", e)
        } finally {
            db.endTransaction()
        }
    }

    @ReactMethod
    fun updateContactNative(contactId: Int, name: String, phone: String, extraFieldsJson: String, promise: Promise) {
        val db = dbHelper.writableDatabase
        db.beginTransaction()
        try {
            val stmt = db.compileStatement("UPDATE contacts SET name = ?, phone = ?, extra_field = ? WHERE id = ?")
            stmt.bindString(1, name)
            stmt.bindString(2, phone)
            stmt.bindString(3, extraFieldsJson)
            stmt.bindLong(4, contactId.toLong())
            stmt.executeUpdateDelete()
            db.setTransactionSuccessful()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("UPDATE_CONTACT_ERROR", e)
        } finally {
            db.endTransaction()
        }
    }

    // -------- Sent messages (insert + report) --------
    @ReactMethod
    fun insertSentMessageNative(successListJson: String, date: String, promise: Promise) {
        val db = dbHelper.writableDatabase
        db.beginTransaction()
        try {
            val stmt = db.compileStatement("INSERT INTO sentmessages (date, data) VALUES (?, ?)")
            stmt.bindString(1, date)
            stmt.bindString(2, successListJson)
            val idLong = stmt.executeInsert()
            db.setTransactionSuccessful()
            promise.resolve(idLong.toInt())
        } catch (e: Exception) {
            promise.reject("INSERT_SENT_MSG_ERROR", e)
        } finally {
            db.endTransaction()
        }
    }

    @ReactMethod
    fun getMessageReportNative(promise: Promise) {
        val db = dbHelper.readableDatabase
        var cursor: Cursor? = null
        try {
            cursor = db.rawQuery("SELECT id, date, data FROM sentmessages ORDER BY date DESC", null)
            val arr = Arguments.createArray()
            cursor?.let { c ->
                while (c.moveToNext()) {
                    val m = Arguments.createMap()
                    m.putInt("id", c.getInt(0))
                    m.putString("date", c.getString(1))
                    m.putString("data", c.getString(2)) // JSON string; JS will parse
                    arr.pushMap(m)
                }
            }
            promise.resolve(arr)
        } catch (e: Exception) {
            promise.reject("GET_MESSAGE_REPORT_ERROR", e)
        } finally {
            cursor?.close()
        }
    }

    // -------- Reserve points for messages: secure rule --------
    @ReactMethod
    fun reservePointsForMessagesByIds(contactIds: ReadableArray, promise: Promise) {
        val db = dbHelper.writableDatabase
        db.beginTransaction()
        try {
            if (isPremium()) {
                db.setTransactionSuccessful()
                promise.resolve(getPointsInternal(db))
                return
            }

            val ids = mutableListOf<Long>()
            for (i in 0 until contactIds.size()) {
                // accept numbers or strings that can be converted
                val v = contactIds.getDouble(i)
                ids.add(v.toLong())
            }

            val actualCount = if (ids.isEmpty()) 0 else countExistingContacts(db, ids)
            val cost = if (actualCount <= 20) MIN_MESSAGE_COST else actualCount * PER_MESSAGE_COST

            val current = getPointsInternal(db)
            if (current < cost) {
                promise.reject("INSUFFICIENT_POINTS", "Need $cost points; you have $current")
                return
            }

            setPointsInternal(db, current - cost)
            db.setTransactionSuccessful()
            promise.resolve(current - cost)
        } catch (e: Exception) {
            promise.reject("RESERVE_MSG_ERROR", e)
        } finally {
            db.endTransaction()
        }
    }
@ReactMethod
fun checkDuplicatesAndReserveForImport(
  phonesJson: String, 
  campaignId: Double, 
  deduct: Boolean = true,  // NEW: Optional deduct flag (default true)
  promise: Promise
) {
  val db = dbHelper.writableDatabase
  db.beginTransaction()
  try {
    val phones = JSONArray(phonesJson).let { arr ->
      (0 until arr.length()).map { arr.getString(it) }
    }

    if (phones.isEmpty()) {
      promise.reject("EMPTY_PHONES", "No phones to import")
      return
    }

    val duplicates = countExistingContactsByPhones(db, phones, campaignId.toLong())
    val newCount = phones.size - duplicates
      val cost = if (newCount <= 0) {
            0
        } else {
            ((newCount + 9) / 10) * 10
        }

    val current = getPointsInternal(db)
    if (current < cost) {
      promise.reject("INSUFFICIENT_POINTS", "Need $cost points for $newCount new contacts; you have $current")
      return
    }

    // NEW: Only deduct if deduct=true; always return current for dry-run
    val finalBalance = if (deduct && !isPremium()) {
      setPointsInternal(db, current - cost)
      current - cost
    } else {
      current  // No deduct
    }

    val result = JSONObject().apply {
      put("currentBalance", current)  // Always return current for preview
      put("newBalance", finalBalance)
      put("newCount", newCount)
      put("cost", cost)
      put("duplicates", duplicates)
    }
    db.setTransactionSuccessful()
    promise.resolve(result.toString())
  } catch (e: Exception) {
    promise.reject("RESERVE_IMPORT_ERROR", e.message ?: "Unknown error")
  } finally {
    db.endTransaction()
  }
}

// NEW: Separate deduct method (call post-import)
@ReactMethod
fun deductPointsForImport(cost: Int, promise: Promise) {
  val db = dbHelper.writableDatabase
  db.beginTransaction()
  try {
    if (isPremium()) {
      promise.resolve(0)
      return
    }

    val current = getPointsInternal(db)
    if (current < cost) {
      promise.reject("INSUFFICIENT_POINTS", "Balance changed—insufficient points")
      return
    }

    setPointsInternal(db, current - cost)
    db.setTransactionSuccessful()
    promise.resolve(current - cost)
  } catch (e: Exception) {
    promise.reject("DEDUCT_IMPORT_ERROR", e)
  } finally {
    db.endTransaction()
  }
}

// Updated helper: Now takes campaignId
private fun countExistingContactsByPhones(db: SQLiteDatabase, phones: List<String>, campaignId: Long): Int {
    var count = 0
    for (phone in phones) {
        val cursor = db.rawQuery(
            "SELECT COUNT(*) FROM contacts WHERE phone = ? AND campaign_id = ?",
            arrayOf(phone, campaignId.toString())  // FIXED: Convert Long to String
        )
        if (cursor.moveToFirst()) {
            count += cursor.getInt(0)
        }
        cursor.close()
    }
    return count
}
    private fun countExistingContacts(db: SQLiteDatabase, ids: List<Long>): Int {
        if (ids.isEmpty()) return 0
        val placeholders = ids.joinToString(",") { "?" }
        val args = ids.map { it.toString() }.toTypedArray()
        db.rawQuery("SELECT COUNT(*) FROM contacts WHERE id IN ($placeholders)", args).use { c ->
            return if (c.moveToFirst()) c.getInt(0) else 0
        }
    }

    // -------- New: Chat backup methods --------
    @ReactMethod
    fun enableBackup(app: String, contactIdentifier: String, name: String?, promise: Promise) {
        val db = dbHelper.writableDatabase
        try {
            db.execSQL(
                "INSERT OR IGNORE INTO enabled_backups (app, contact_identifier) VALUES (?, ?)",
                arrayOf(app, contactIdentifier)
            )
            db.execSQL(
                "INSERT OR IGNORE INTO chats (app, contact_identifier, name) VALUES (?, ?, ?)",
                arrayOf(app, contactIdentifier, name ?: contactIdentifier)
            )
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ENABLE_BACKUP_ERROR", e)
        }
    }

    @ReactMethod
    fun disableBackup(app: String, contactIdentifier: String, promise: Promise) {
        val db = dbHelper.writableDatabase
        try {
            db.execSQL(
                "DELETE FROM enabled_backups WHERE app = ? AND contact_identifier = ?",
                arrayOf(app, contactIdentifier)
            )
            // Note: Keeping historical chats/messages; delete if needed
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("DISABLE_BACKUP_ERROR", e)
        }
    }

    @ReactMethod
    fun getEnabledBackups(promise: Promise) {
        val db = dbHelper.readableDatabase
        var cursor: Cursor? = null
        try {
            cursor = db.rawQuery(
                "SELECT e.app, e.contact_identifier, c.name FROM enabled_backups e LEFT JOIN chats c ON e.app = c.app AND e.contact_identifier = c.contact_identifier",
                null
            )
            val arr = Arguments.createArray()
            cursor?.let { c ->
                while (c.moveToNext()) {
                    val m = Arguments.createMap()
                    m.putString("app", c.getString(0))
                    m.putString("contact_identifier", c.getString(1))
                    m.putString("name", c.getString(2))
                    arr.pushMap(m)
                }
            }
            promise.resolve(arr)
        } catch (e: Exception) {
            promise.reject("GET_ENABLED_BACKUPS_ERROR", e)
        } finally {
            cursor?.close()
        }
    }

    @ReactMethod
    fun getChatMessages2(app: String, contactIdentifier: String, promise: Promise) {
        val db = dbHelper.writableDatabase
        db.beginTransaction()
        try {
            if (!isPremium()) {
                val current = getPointsInternal(db)
                if (current < CHAT_VIEW_COST) {
                    promise.reject("INSUFFICIENT_POINTS", "Need $CHAT_VIEW_COST points to view chat")
                    return
                }
                setPointsInternal(db, current - CHAT_VIEW_COST)
            }
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }

        val readDb = dbHelper.readableDatabase
        var cursor: Cursor? = null
        try {
            var chatIdCursor = readDb.rawQuery(
                "SELECT id FROM chats WHERE app = ? AND contact_identifier = ?",
                arrayOf(app, contactIdentifier)
            )
            if (!chatIdCursor.moveToFirst()) {
                promise.reject("CHAT_NOT_FOUND", "Chat not found")
                chatIdCursor.close()
                return
            }
            val chatId = chatIdCursor.getInt(0)
            chatIdCursor.close()

            cursor = readDb.rawQuery(
                "SELECT timestamp, is_sent, content FROM messages WHERE chat_id = ? ORDER BY timestamp ASC",
                arrayOf(chatId.toString())
            )
            val arr = Arguments.createArray()
            cursor?.let { c ->
                while (c.moveToNext()) {
                    val m = Arguments.createMap()
                    m.putString("timestamp", c.getString(0))
                    m.putBoolean("isSent", c.getInt(1) == 1)
                    m.putString("content", c.getString(2))
                    arr.pushMap(m)
                }
            }
            promise.resolve(arr)
        } catch (e: Exception) {
            promise.reject("GET_CHAT_MESSAGES_ERROR", e)
        } finally {
            cursor?.close()
        }
    }

    // -------- New: Schedule daily low points check --------
    @ReactMethod
    fun scheduleDailyLowPointsCheck(promise: Promise) {
        try {
            val alarmManager = reactCtx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val intent = Intent(reactCtx, LowPointsReceiver::class.java)
            val pendingIntent = PendingIntent.getBroadcast(
                reactCtx,
                0,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val calendar = Calendar.getInstance().apply {
                timeInMillis = System.currentTimeMillis()
                set(Calendar.HOUR_OF_DAY, 9)  // Set to 9 AM; adjust as needed
                set(Calendar.MINUTE, 0)
                set(Calendar.SECOND, 0)
                if (timeInMillis < System.currentTimeMillis()) {
                    add(Calendar.DAY_OF_YEAR, 1)
                }
            }

            alarmManager.setRepeating(
                AlarmManager.RTC_WAKEUP,
                calendar.timeInMillis,
                AlarmManager.INTERVAL_DAY,
                pendingIntent
            )
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SCHEDULE_LOW_POINTS_ERROR", e)
        }
    }

    // -------- New: Get recent chats from notifications --------
    @ReactMethod
fun getRecentChats(app: String?, promise: Promise) {
    val db = dbHelper.readableDatabase
    var cursor: Cursor? = null
    try {
        val whereClause = if (app != null) " WHERE app = ?" else ""
        val query = """
            SELECT app, contact_identifier, name, last_timestamp 
            FROM recent_chats
            $whereClause
            ORDER BY last_timestamp DESC 
            LIMIT 100
        """.trimIndent()

        val args = if (app != null) arrayOf(app) else null
        cursor = db.rawQuery(query, args)
        val arr = Arguments.createArray()
        cursor?.let { c ->
            while (c.moveToNext()) {
                val m = Arguments.createMap()
                m.putString("app", c.getString(0))
                m.putString("contact_identifier", c.getString(1))
                m.putString("name", c.getString(2))
                m.putString("last_timestamp", c.getString(3))
                arr.pushMap(m)
            }
        }
        promise.resolve(arr)
    } catch (e: Exception) {
        promise.reject("GET_RECENT_CHATS_ERROR", e)
    } finally {
        cursor?.close()
    }
}
@ReactMethod
fun getRecentChatsOld(app: String?, promise: Promise) {
    val db = dbHelper.readableDatabase
    var cursor: Cursor? = null
    try {
        val whereClause = if (app != null) " AND r.app = ?" else ""
        val query = """
            SELECT r.app, r.contact_identifier, r.name, r.last_timestamp 
            FROM recent_chats r 
            INNER JOIN chats c ON r.app = c.app AND r.contact_identifier = c.contact_identifier
            INNER JOIN messages m ON c.id = m.chat_id 
            GROUP BY r.app, r.contact_identifier 
            HAVING COUNT(m.id) > 0  -- FIXED: Only if has saved messages
            ORDER BY r.last_timestamp DESC LIMIT 100
        """.trimIndent() + whereClause

        val args = if (app != null) arrayOf(app) else null
        cursor = db.rawQuery(query, args)
        val arr = Arguments.createArray()
        cursor?.let { c ->
            while (c.moveToNext()) {
                val m = Arguments.createMap()
                m.putString("app", c.getString(0))
                m.putString("contact_identifier", c.getString(1))
                m.putString("name", c.getString(2))
                m.putString("last_timestamp", c.getString(3))
                arr.pushMap(m)
            }
        }
        promise.resolve(arr)
    } catch (e: Exception) {
        promise.reject("GET_RECENT_CHATS_ERROR", e)
    } finally {
        cursor?.close()
    }
}




   
    // -------- New: Notification access methods --------
    @ReactMethod
    
fun isNotificationAccessGranted(promise: Promise) {
    try {
        val cn = ComponentName(reactCtx, MessageBackupService::class.java)
        val flat = Settings.Secure.getString(reactCtx.contentResolver, "enabled_notification_listeners")
        val enabled = flat != null && flat.contains(cn.flattenToString())
        promise.resolve(enabled)
    } catch (e: Exception) {
        promise.reject("NOTIFICATION_ACCESS_ERROR", e)
    }
}

    @ReactMethod
    fun openNotificationAccessSettings(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactCtx.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("OPEN_SETTINGS_ERROR", e)
        }
    }

    // -------- New: Auto-delete days prefs --------
    @ReactMethod
    fun getAutoDeleteDays(promise: Promise) {
        val prefs = reactCtx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        promise.resolve(prefs.getInt(KEY_AUTO_DELETE_DAYS, 0))
    }

    @ReactMethod
    fun setAutoDeleteDays(days: Int, promise: Promise) {
        val prefs = reactCtx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        prefs.edit().putInt(KEY_AUTO_DELETE_DAYS, days).apply()
        promise.resolve(days)
    }
@ReactMethod
fun getEnabledNotificationApps(promise: Promise) {
    val prefs = reactCtx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val enabledJson = prefs.getString("enabled_notification_apps", "[]") ?: "[]"
    promise.resolve(enabledJson)  // JSON array string, parse in JS
}

@ReactMethod
fun setEnabledNotificationApps(appsJson: String, promise: Promise) {
    val prefs = reactCtx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    prefs.edit().putString("enabled_notification_apps", appsJson).apply()
    promise.resolve(true)
}

@ReactMethod
fun getBackupPrivateOnly(promise: Promise) {
    val prefs = reactCtx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    promise.resolve(prefs.getBoolean("backupPrivateOnly", false))
}

@ReactMethod
fun setBackupPrivateOnly(enabled: Boolean, promise: Promise) {
    val prefs = reactCtx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    prefs.edit().putBoolean("backupPrivateOnly", enabled).apply()
    promise.resolve(enabled)
}
    // Internal method for saving a message (called from NotificationListenerService)
    // Exposed as companion for access from service without instance
// Internal method for saving a message (called from NotificationListenerService)
// Exposed as companion for access from service without instance
// companion object {
//     fun saveMessage(context: Context, app: String, contactIdentifier: String, name: String, timestamp: String, content: String, isSent: Boolean) {
//         val dbHelper = CampaignsDbHelper(context)
//         val db = dbHelper.writableDatabase
//         db.beginTransaction()
//         try {
//             // DISABLED: No point deduction for saving messages (always save, even if points=0)
//             // val prefs = context.getSharedPreferences("app_prefs", Context.MODE_PRIVATE)
//             // val isPremium = prefs.getBoolean("isPremium", false)
//             // if (!isPremium) {
//             //     var current = 0
//             //     db.rawQuery("SELECT points FROM user_points WHERE id = 1", null).use { c ->
//             //         if (c.moveToFirst()) current = c.getInt(0)
//             //     }
//             //     if (current < 1) return  // Skip save if insufficient
//             //     db.execSQL("UPDATE user_points SET points = ? WHERE id = 1", arrayOf(current - 1))
//             // }

//             // Get or create chat_id
//             var chatId: Long? = null
//             db.rawQuery(
//                 "SELECT id FROM chats WHERE app = ? AND contact_identifier = ?",
//                 arrayOf(app, contactIdentifier)
//             ).use { c ->
//                 if (c.moveToFirst()) chatId = c.getLong(0)
//             }
//             if (chatId == null) {
//                 val stmt = db.compileStatement("INSERT INTO chats (app, contact_identifier, name) VALUES (?, ?, ?)")
//                 stmt.bindString(1, app)
//                 stmt.bindString(2, contactIdentifier)
//                 stmt.bindString(3, name)
//                 chatId = stmt.executeInsert()
//             }

//             // Insert message (assume received, is_sent = false for notifications)
//             val stmt = db.compileStatement("INSERT INTO messages (chat_id, timestamp, is_sent, content) VALUES (?, ?, ?, ?)")
//             stmt.bindLong(1, chatId!!)
//             stmt.bindString(2, timestamp)
//             stmt.bindLong(3, if (isSent) 1 else 0)
//             stmt.bindString(4, content)
//             stmt.executeInsert()

//             db.setTransactionSuccessful()
//         } finally {
//             db.endTransaction()
//         }
//     }
// } 
// Updated saveMessage with pre-check for dedup (no UNIQUE needed, matches old behavior)
// companion object {
//     fun saveMessage(context: Context, app: String, contactIdentifier: String, name: String, timestamp: String, content: String, isSent: Boolean) {
//         val dbHelper = CampaignsDbHelper(context)
//         val db = dbHelper.writableDatabase
//         db.beginTransaction()
//         try {
//             // No point deduction (as per your disable)

//             // Get or create chat_id
//             var chatId: Long? = null
//             db.rawQuery(
//                 "SELECT id FROM chats WHERE app = ? AND contact_identifier = ?",
//                 arrayOf(app, contactIdentifier)
//             ).use { c ->
//                 if (c.moveToFirst()) chatId = c.getLong(0)
//             }
//             if (chatId == null) {
//                 val stmt = db.compileStatement("INSERT INTO chats (app, contact_identifier, name) VALUES (?, ?, ?)")
//                 stmt.bindString(1, app)
//                 stmt.bindString(2, contactIdentifier)
//                 stmt.bindString(3, name)
//                 chatId = stmt.executeInsert()
//             }

//             // FIXED: Pre-check for duplicate (timestamp + content match)
//             var exists = false
//             db.rawQuery(
//                 "SELECT id FROM messages WHERE chat_id = ? AND timestamp = ? AND content = ?",
//                 arrayOf(chatId.toString(), timestamp, content)
//             ).use { c ->
//                 exists = c.moveToFirst()
//             }

//             if (!exists) {
//                 // Insert only if not duplicate
//                 val stmt = db.compileStatement("INSERT INTO messages (chat_id, timestamp, is_sent, content) VALUES (?, ?, ?, ?)")
//                 stmt.bindLong(1, chatId!!)
//                 stmt.bindString(2, timestamp)
//                 stmt.bindLong(3, if (isSent) 1 else 0)
//                 stmt.bindString(4, content)
//                 stmt.executeInsert()
//             }

//             // Log to recent_chats after (always, as notification is new)
//             db.execSQL(
//                 "INSERT OR REPLACE INTO recent_chats (app, contact_identifier, name, last_timestamp) VALUES (?, ?, ?, ?)",
//                 arrayOf(app, contactIdentifier, name, timestamp)
//             )

//             db.setTransactionSuccessful()
//         } finally {
//             db.endTransaction()
//         }
//     }
// }
// companion object {
//     private const val TAG = "CampaignsModule"

//     fun saveMessage(context: Context, app: String, contactIdentifier: String, name: String, timestamp: String, content: String, isSent: Boolean) {
//         if (app.isBlank() || contactIdentifier.isBlank() || content.isBlank()) {
//             Log.w(TAG, "Skipping invalid message: blank app/contact/content")
//             return
//         }

//         Log.d(TAG, "saveMessage called: app=$app, contact=$contactIdentifier, ts=$timestamp, isSent=$isSent")

//         val dbHelper = CampaignsDbHelper(context)
//         val db = dbHelper.writableDatabase
//         db.beginTransaction()
//         try {
//             // Get or create chat_id (with OR IGNORE for race safety)
//             var chatId: Long = -1L
//             var chatIdCursor = db.rawQuery(
//                 "SELECT id FROM chats WHERE app = ? AND contact_identifier = ?",
//                 arrayOf(app, contactIdentifier)
//             )
//             if (chatIdCursor.moveToFirst()) {
//                 chatId = chatIdCursor.getLong(0)
//                 Log.d(TAG, "Found existing chat_id: $chatId")
//             }
//             chatIdCursor.close()

//             if (chatId == -1L) {
//                 val stmt = db.compileStatement("INSERT OR IGNORE INTO chats (app, contact_identifier, name) VALUES (?, ?, ?)")
//                 stmt.bindString(1, app)
//                 stmt.bindString(2, contactIdentifier)
//                 stmt.bindString(3, name)
//                 val insertResult = stmt.executeInsert()
//                 if (insertResult != -1L) {
//                     chatId = insertResult
//                     Log.d(TAG, "Created new chat_id: $chatId")
//                 } else {
//                     // OR IGNORE failed? Requery to get the existing one
//                     db.rawQuery(
//                         "SELECT id FROM chats WHERE app = ? AND contact_identifier = ?",
//                         arrayOf(app, contactIdentifier)
//                     ).use { c ->
//                         if (c.moveToFirst()) chatId = c.getLong(0)
//                     }
//                     if (chatId == -1L) {
//                         Log.e(TAG, "Failed to create or find chat!")
//                         return
//                     }
//                     Log.d(TAG, "Used existing chat_id after conflict: $chatId")
//                 }
//             }

//             if (chatId == -1L) {
//                 Log.e(TAG, "No valid chat_id—aborting")
//                 return
//             }

//             // Dedup check: Skip if exact match exists
//             var exists = false
//             db.rawQuery(
//                 "SELECT id FROM messages WHERE chat_id = ? AND timestamp = ? AND content = ? AND is_sent = ?",
//                 arrayOf(chatId.toString(), timestamp, content, if (isSent) "1" else "0")
//             ).use { c ->
//                 exists = c.moveToFirst()
//             }
//             if (exists) {
//                 Log.d(TAG, "Skipping duplicate message")
//                 db.setTransactionSuccessful()
//                 return  // Early commit for dedup
//             }

//             // Insert message
//             val stmt = db.compileStatement("INSERT INTO messages (chat_id, timestamp, is_sent, content) VALUES (?, ?, ?, ?)")
//             stmt.bindLong(1, chatId)
//             stmt.bindString(2, timestamp)
//             stmt.bindLong(3, if (isSent) 1L else 0L)
//             stmt.bindString(4, content)
//             val messageId = stmt.executeInsert()
//             Log.d(TAG, "Inserted message id: $messageId")

//             if (messageId != -1L) {
//                 // Update recent_chats (key fix!)
//                 db.execSQL(
//                     "INSERT OR REPLACE INTO recent_chats (app, contact_identifier, name, last_timestamp) VALUES (?, ?, ?, ?)",
//                     arrayOf(app, contactIdentifier, name, timestamp)
//                 )
//                 Log.d(TAG, "Updated recent_chats with ts=$timestamp")
//             } else {
//                 Log.e(TAG, "Message insert failed—check DB logs")
//             }

//             db.setTransactionSuccessful()
//             Log.d(TAG, "Transaction committed")
//         } catch (e: Exception) {
//             Log.e(TAG, "Exception in saveMessage: ${e.message}", e)
//         } finally {
//             db.endTransaction()
//             Log.d(TAG, "Transaction ended")
//         }
//     }
// }
companion object {
    private const val TAG = "CampaignsModule"

    fun saveMessage(context: Context, app: String, contactIdentifier: String, name: String, timestamp: String, content: String, isSent: Boolean) {
        if (app.isBlank() || contactIdentifier.isBlank() || content.isBlank()) {
            Log.w(TAG, "Skipping invalid message: blank app/contact/content")
            return
        }

        Log.d(TAG, "saveMessage called: app=$app, contact=$contactIdentifier, ts=$timestamp, isSent=$isSent")

        val dbHelper = CampaignsDbHelper(context)
        val db = dbHelper.writableDatabase
        db.beginTransaction()
        try {
            // Get or create chat_id
            var chatId: Long = -1L
            var chatIdCursor = db.rawQuery(
                "SELECT id FROM chats WHERE app = ? AND contact_identifier = ?",
                arrayOf(app, contactIdentifier)
            )
            if (chatIdCursor.moveToFirst()) {
                chatId = chatIdCursor.getLong(0)
                Log.d(TAG, "Found existing chat_id: $chatId")
            }
            chatIdCursor.close()

            if (chatId == -1L) {
                val stmt = db.compileStatement("INSERT OR IGNORE INTO chats (app, contact_identifier, name) VALUES (?, ?, ?)")
                stmt.bindString(1, app)
                stmt.bindString(2, contactIdentifier)
                stmt.bindString(3, name)
                val insertResult = stmt.executeInsert()
                if (insertResult != -1L) {
                    chatId = insertResult
                    Log.d(TAG, "Created new chat_id: $chatId")
                } else {
                    db.rawQuery(
                        "SELECT id FROM chats WHERE app = ? AND contact_identifier = ?",
                        arrayOf(app, contactIdentifier)
                    ).use { c ->
                        if (c.moveToFirst()) chatId = c.getLong(0)
                    }
                    if (chatId == -1L) {
                        Log.e(TAG, "Failed to create or find chat!")
                        return
                    }
                    Log.d(TAG, "Used existing chat_id after conflict: $chatId")
                }
            }

            if (chatId == -1L) {
                Log.e(TAG, "No valid chat_id—aborting")
                return
            }

            // Dedup check: Skip message insert if exact match exists
            var exists = false
            db.rawQuery(
                "SELECT id FROM messages WHERE chat_id = ? AND timestamp = ? AND content = ? AND is_sent = ?",
                arrayOf(chatId.toString(), timestamp, content, if (isSent) "1" else "0")
            ).use { c ->
                exists = c.moveToFirst()
            }

            if (!exists) {
                // Insert message only if not duplicate
                val stmt = db.compileStatement("INSERT INTO messages (chat_id, timestamp, is_sent, content) VALUES (?, ?, ?, ?)")
                stmt.bindLong(1, chatId)
                stmt.bindString(2, timestamp)
                stmt.bindLong(3, if (isSent) 1L else 0L)
                stmt.bindString(4, content)
                val messageId = stmt.executeInsert()
                Log.d(TAG, "Inserted message id: $messageId")
            } else {
                Log.d(TAG, "Skipping duplicate message insert")
            }

            // CRITICAL FIX: ALWAYS update recent_chats, even for duplicates
            // This ensures the sender appears in the list
            db.execSQL(
                "INSERT OR REPLACE INTO recent_chats (app, contact_identifier, name, last_timestamp) VALUES (?, ?, ?, ?)",
                arrayOf(app, contactIdentifier, name, timestamp)
            )
            Log.d(TAG, "Updated recent_chats with ts=$timestamp")

            db.setTransactionSuccessful()
            Log.d(TAG, "Transaction committed")
        } catch (e: Exception) {
            Log.e(TAG, "Exception in saveMessage: ${e.message}", e)
        } finally {
            db.endTransaction()
            Log.d(TAG, "Transaction ended")
        }
    }
}

}// ← THIS CLOSING BRACE WAS MISSING
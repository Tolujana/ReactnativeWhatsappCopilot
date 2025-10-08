package com.copilot3.util

import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import android.os.Handler
import android.os.Looper
import com.facebook.react.bridge.*
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.LoadAdError
import com.google.android.gms.ads.rewarded.RewardedAd
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback
import com.google.android.gms.ads.rewarded.RewardItem

class CampaignsModule(private val reactCtx: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactCtx) {

    private val dbHelper = CampaignsDbHelper(reactCtx)

    // ====== CONFIG: native-only values ======
    private val REWARD_POINTS = 10
    private val CONTACT_INSERT_COST = 2
    private val CAMPAIGN_INSERT_COST = 10
    private val MIN_MESSAGE_COST = 20
    private val PER_MESSAGE_COST = 2
    private val PREFS = "app_prefs"
    private val KEY_PREMIUM = "isPremium"

    // ====== ADS ======
    private var rewardedAd: RewardedAd? = null
    // test ad unit from AdMob (replace with yours)
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

    // -------- Create tables (optional - DB helper already creates on first open) --------
    @ReactMethod
    fun createTables(promise: Promise) {
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

    @ReactMethod
    fun deleteSentMessagesNative(ids: ReadableArray, promise: Promise) {
        val db = dbHelper.writableDatabase
        db.beginTransaction()
        try {
            for (i in 0 until ids.size()) {
                val id = ids.getInt(i)
                db.execSQL("DELETE FROM sentmessages WHERE id = ?", arrayOf(id))
            }
            db.setTransactionSuccessful()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("DELETE_SENT_MESSAGES_ERROR", e)
        } finally {
            db.endTransaction()
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

    private fun countExistingContacts(db: SQLiteDatabase, ids: List<Long>): Int {
        if (ids.isEmpty()) return 0
        val placeholders = ids.joinToString(",") { "?" }
        val args = ids.map { it.toString() }.toTypedArray()
        db.rawQuery("SELECT COUNT(*) FROM contacts WHERE id IN ($placeholders)", args).use { c ->
            return if (c.moveToFirst()) c.getInt(0) else 0
        }
    }
}

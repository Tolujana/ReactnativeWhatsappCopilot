package com.copilot3.util

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import android.util.Log

class CampaignsDbHelper(context: Context) :
    SQLiteOpenHelper(context, "campaigns.db", null, 1) {

    companion object {
        private const val TAG = "CampaignsDbHelper"
    }

    override fun onCreate(db: SQLiteDatabase) {
        try {
            Log.d(TAG, "Creating database tables")
            db.execSQL("""
                CREATE TABLE IF NOT EXISTS campaigns (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  name TEXT,
                  extra_fields TEXT,
                  description TEXT
                )
            """.trimIndent())

            db.execSQL("""
                CREATE TABLE IF NOT EXISTS contacts (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  campaign_id INTEGER,
                  name TEXT,
                  phone TEXT,
                  extra_field TEXT,
                  FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
                )
            """.trimIndent())

            db.execSQL("""
                CREATE TABLE IF NOT EXISTS sentmessages (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  date TEXT,
                  data TEXT
                )
            """.trimIndent())

            db.execSQL("""
                CREATE TABLE IF NOT EXISTS user_points (
                  id INTEGER PRIMARY KEY,
                  points INTEGER NOT NULL
                )
            """.trimIndent())

            db.execSQL("INSERT OR IGNORE INTO user_points (id, points) VALUES (1, 0)")
            Log.d(TAG, "Database created successfully")
        } catch (e: Exception) {
            Log.e(TAG, "Error creating database: ${e.message}", e)
            throw e // Rethrow for debugging
        }
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        try {
            Log.d(TAG, "Upgrading database from $oldVersion to $newVersion")
            db.execSQL("DROP TABLE IF EXISTS campaigns")
            db.execSQL("DROP TABLE IF EXISTS contacts")
            db.execSQL("DROP TABLE IF EXISTS sentmessages")
            db.execSQL("DROP TABLE IF EXISTS user_points")
            onCreate(db)
        } catch (e: Exception) {
            Log.e(TAG, "Error upgrading database: ${e.message}", e)
            throw e
        }
    }
}
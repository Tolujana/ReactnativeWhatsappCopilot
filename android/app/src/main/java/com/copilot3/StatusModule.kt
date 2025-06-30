package com.copilot3

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import androidx.documentfile.provider.DocumentFile
import com.facebook.react.bridge.*
import com.facebook.react.module.annotations.ReactModule
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import androidx.core.content.FileProvider

@ReactModule(name = StatusModule.NAME)
class StatusModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  companion object {
    const val NAME = "StatusModule"
    private const val STATUS_FOLDER_REQUEST = 10001
    private const val PREFS_NAME = "StatusSaverPrefs"
    private const val KEY_URI = "persisted_uri"

    val APP_PATHS = mapOf(
      "whatsapp" to listOf("com.whatsapp", "WhatsApp", "Media", ".Statuses"),
      "business" to listOf("com.whatsapp.w4b", "WhatsApp Business", "Media", ".Statuses"),
      "telegram" to listOf("org.telegram.messenger", "Telegram", ".Statuses"),
      "tiktok" to listOf("com.zhiliaoapp.musically", ".Statuses"),
      "xender" to listOf("cn.xender", ".Statuses")
    )
  }

  private var statusPromise: Promise? = null

  init {
    reactContext.addActivityEventListener(object : BaseActivityEventListener() {
      override fun onActivityResult(activity: Activity?, requestCode: Int, resultCode: Int, data: Intent?) {
        handleActivityResult(requestCode, resultCode, data)
      }
    })
  }

  override fun getName(): String = NAME

  @ReactMethod
  fun openStatusFolderPicker(promise: Promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
      // Use legacy file access
      val result = loadFromLegacyStorage()
      promise.resolve(result)
      return
    }

    val activity = currentActivity
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "Activity is null")
      return
    }

    statusPromise = promise

    val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply {
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
    }

    activity.startActivityForResult(intent, STATUS_FOLDER_REQUEST)
  }

  private fun handleActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode == STATUS_FOLDER_REQUEST && resultCode == Activity.RESULT_OK && data != null) {
      val uri = data.data ?: run {
        statusPromise?.reject("INVALID_URI", "Selected folder URI is null")
        statusPromise = null
        return
      }

      try {
        val context = reactApplicationContext
        context.contentResolver.takePersistableUriPermission(
          uri, Intent.FLAG_GRANT_READ_URI_PERMISSION
        )

        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString(KEY_URI, uri.toString()).apply()

        val result = scanSAFUri(uri)
        statusPromise?.resolve(result)
      } catch (e: Exception) {
        statusPromise?.reject("PROCESS_FAILED", "Failed to process folder: ${e.message}")
      }
    } else {
      statusPromise?.reject("PICKER_CANCELLED", "User cancelled folder picking")
    }

    statusPromise = null
  }

  private fun scanSAFUri(rootUri: Uri): WritableArray {
    val context = reactApplicationContext
    val pickedDir = DocumentFile.fromTreeUri(context, rootUri)
    val resultArray = WritableNativeArray()

    if (pickedDir == null || !pickedDir.isDirectory) return resultArray

    for ((key, pathParts) in APP_PATHS) {
      val statusDir = findSubDirByPath(pickedDir, pathParts)
      statusDir?.listFiles()
        ?.filter { it.isFile && it.name?.matches(Regex(""".*\.(jpg|jpeg|png|webp|mp4)""", RegexOption.IGNORE_CASE)) == true }
        ?.forEach { file ->
          val map = WritableNativeMap().apply {
            putString("uri", file.uri.toString())
            putString("name", file.name)
            putString("app", key)
          }
          resultArray.pushMap(map)
        }
    }

    return resultArray
  }

  private fun loadFromLegacyStorage(): WritableArray {
    val resultArray = WritableNativeArray()
    val mediaRoot = File(Environment.getExternalStorageDirectory(), "Android/media")

    for ((key, parts) in APP_PATHS) {
      val dir = parts.fold(mediaRoot) { acc, part -> File(acc, part) }
      if (dir.exists() && dir.isDirectory) {
        dir.listFiles()?.filter {
          it.isFile && it.name?.matches(Regex(""".*\.(jpg|jpeg|png|webp|mp4)""", RegexOption.IGNORE_CASE)) == true
        }?.forEach { file ->
          val uri = Uri.fromFile(file)
          val map = WritableNativeMap().apply {
            putString("uri", uri.toString())
            putString("name", file.name)
            putString("app", key)
          }
          resultArray.pushMap(map)
        }
      }
    }

    return resultArray
  }

  private fun findSubDirByPath(root: DocumentFile, parts: List<String>): DocumentFile? {
    var current: DocumentFile? = root
    for (part in parts) {
      current = current?.listFiles()?.find { it.isDirectory && it.name == part }
      if (current == null) return null
    }
    return current
  }

  @ReactMethod
  fun refreshStatuses(promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
        val result = loadFromLegacyStorage()
        promise.resolve(result)
        return
      }

      val prefs = reactContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      val uriString = prefs.getString(KEY_URI, null)
      if (uriString == null) {
        promise.reject("NO_URI", "No folder previously picked")
        return
      }

      val uri = Uri.parse(uriString)
      val result = scanSAFUri(uri)
      promise.resolve(result)
    } catch (e: Exception) {
      promise.reject("REFRESH_FAILED", "Failed to refresh: ${e.message}")
    }
  }

  @ReactMethod
  fun copyFileToCache(uriString: String, promise: Promise) {
    try {
      val uri = Uri.parse(uriString)
      val input: InputStream = reactContext.contentResolver.openInputStream(uri)
        ?: throw Exception("Failed to open URI")
      val ext = uriString.substringAfterLast('.', "jpg").take(5)
      val fileName = "shared_${System.currentTimeMillis()}.$ext"
      val outFile = File(reactContext.cacheDir, fileName)
      val output = FileOutputStream(outFile)

      input.copyTo(output)
      input.close()
      output.close()

      val outUri = FileProvider.getUriForFile(
        reactContext,
        reactContext.packageName + ".provider",
        outFile
      )
      promise.resolve(outUri.toString())
    } catch (e: Exception) {
      promise.reject("SHARE_COPY_FAIL", "Failed to copy: ${e.message}")
    }
  }

  @ReactMethod
  fun postToWhatsappStatus(uriString: String, promise: Promise) {
    try {
      val uri = Uri.parse(uriString)
      val sendIntent = Intent("android.intent.action.SEND").apply {
        type = "image/*"
        putExtra(Intent.EXTRA_STREAM, uri)
        `package` = "com.whatsapp"
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }
      currentActivity?.startActivity(sendIntent)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("WHATSAPP_SHARE_FAILED", e.message)
    }
  }
}

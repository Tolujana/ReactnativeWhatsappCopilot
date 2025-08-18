package com.copilot3

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.DocumentsContract
import android.util.Log
import androidx.annotation.RequiresApi
import androidx.core.content.FileProvider
import androidx.documentfile.provider.DocumentFile
import com.facebook.react.bridge.*
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.modules.core.DeviceEventManagerModule
import kotlinx.coroutines.*
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.util.Stack  

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

    val CLEANUP_PATHS = mapOf(
      "whatsapp" to listOf("com.whatsapp", "WhatsApp", "Media"),
      "business" to listOf("com.whatsapp.w4b", "WhatsApp Business", "Media"),
      "telegram" to listOf("org.telegram.messenger", "Telegram"),
      "tiktok" to listOf("com.zhiliaoapp.musically"),
      "xender" to listOf("cn.xender")
    )
  }

  private var statusPromise: Promise? = null
  private var selectedScanMode: String = "status" 
  private var selectedFolderUri: Uri? = null

  init {
    reactContext.addActivityEventListener(object : BaseActivityEventListener() {
      override fun onActivityResult(activity: Activity?, requestCode: Int, resultCode: Int, data: Intent?) {
        handleActivityResult(requestCode, resultCode, data)
      }
    })
  }

  override fun getName(): String = NAME

  @ReactMethod
  fun openStatusFolderPicker(mode: String,promise: Promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
  val result = if (mode == "cleanup") loadLegacyCleanupMedia() else loadFromLegacyStorage()
  promise.resolve(result)
  return
}

    val activity = currentActivity
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "Activity is null")
      return
    }
    selectedScanMode = mode
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
      context.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)

      val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      prefs.edit().putString(KEY_URI, uri.toString()).apply()

      // 🔀 Choose scan type
      val result = when (selectedScanMode) {
        "cleanup" -> scanAllMediaExceptStatuses(uri)
        else -> scanStatusesOnly(uri)
      }

      statusPromise?.resolve(result)
    } catch (e: Exception) {
      statusPromise?.reject("PROCESS_FAILED", "Failed to process folder: ${e.message}")
    }
  } else {
    statusPromise?.reject("PICKER_CANCELLED", "User cancelled folder picking")
  }
  statusPromise = null
}


private fun loadLegacyCleanupMedia(): WritableArray {
  val resultArray = WritableNativeArray()
  val mediaRoot = File(Environment.getExternalStorageDirectory(), "Android/media")

  for ((key, parts) in CLEANUP_PATHS) {
    val dir = parts.fold(mediaRoot) { acc, part -> File(acc, part) }
    if (dir.exists() && dir.isDirectory) {
      dir.walkTopDown().filter {
        it.isFile && it.name.matches(Regex(""".*\.(jpg|jpeg|png|webp|mp4)""", RegexOption.IGNORE_CASE))
      }.forEach { file ->
        val uri = Uri.fromFile(file)
        val map = WritableNativeMap().apply {
          putString("uri", uri.toString())
          putString("name", file.name)
          putString("app", key)
          putDouble("timestamp", file.lastModified().toDouble())
        }
        resultArray.pushMap(map)
      }
    }
  }

  return resultArray
}


  private fun scanSAFUri(rootUri: Uri): WritableArray {
    val context = reactApplicationContext
    val pickedDir = DocumentFile.fromTreeUri(context, rootUri)
    val resultArray = WritableNativeArray()

    if (pickedDir == null || !pickedDir.isDirectory) return resultArray

    for ((key, pathParts) in APP_PATHS) {
      val statusDir = findSubDirByPath(pickedDir, pathParts)
      statusDir?.listFiles()?.filter {
        it.isFile && it.name?.matches(Regex(""".*\.(jpg|jpeg|png|webp|mp4)""", RegexOption.IGNORE_CASE)) == true
      }?.forEach { file ->
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

  private fun findSubDirByPath1(root: DocumentFile, parts: List<String>): DocumentFile? {
  var current: DocumentFile? = root
  for (part in parts) {
    Log.d("StatusModule", "🔍 Looking for: $part in ${current?.uri}")
    current = current?.listFiles()?.find { it.isDirectory && it.name == part }
    if (current == null) {
      Log.d("StatusModule", "❌ Missing subfolder: $part")
      return null
    }
  }
  Log.d("StatusModule", "✅ Found full path: ${current?.uri}")
  return current
}
fun findSubDirByPath(root: DocumentFile?, path: List<String>): DocumentFile? {
    var current = root
    for (segment in path) {
        current = current?.listFiles()?.firstOrNull {
            it.isDirectory && it.name.equals(segment, ignoreCase = true)
        }
    }
    return current
}



@ReactMethod
fun refreshStatuses(promise: Promise) {
  try {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
      promise.resolve(loadFromLegacyStorage())
      return
    }

    val prefs = reactContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val uriStr = prefs.getString(KEY_URI, null)

    if (uriStr == null) {
      promise.reject("NO_URI", "No SAF folder selected")
      return
    }

    val rootUri = Uri.parse(uriStr)
    val root = DocumentFile.fromTreeUri(reactContext, rootUri)

    if (root == null || !root.isDirectory) {
      promise.reject("INVALID_ROOT", "SAF root directory is invalid")
      return
    }

    promise.resolve(scanStatusesOnly(rootUri))
  } catch (e: Exception) {
    promise.reject("REFRESH_FAILED", "Failed to refresh: ${e.message}")
  }
}


  @ReactMethod
  fun saveToGalleryAndGetUri(uriString: String, promise: Promise) {
    try {
      val uri = Uri.parse(uriString)
      val input = reactContext.contentResolver.openInputStream(uri)
        ?: throw Exception("Failed to open input stream")

      val ext = uriString.substringAfterLast('.', "jpg").take(5).lowercase()
      val mime = when (ext) {
        "jpg", "jpeg" -> "image/jpeg"
        "png", "webp" -> "image/$ext"
        "mp4" -> "video/mp4"
        else -> "*/*"
      }

      val mediaDir = Environment.getExternalStoragePublicDirectory(
        if (mime.startsWith("video")) Environment.DIRECTORY_MOVIES else Environment.DIRECTORY_PICTURES
      )
      val subFolder = File(mediaDir, "StatusSaver").apply { mkdirs() }

      val fileName = "status_${System.currentTimeMillis()}.$ext"
      val outFile = File(subFolder, fileName)

      FileOutputStream(outFile).use { output -> input.copyTo(output) }

      MediaScannerConnection.scanFile(
        reactContext,
        arrayOf(outFile.absolutePath),
        arrayOf(mime),
        null
      )

      val outUri = FileProvider.getUriForFile(
        reactContext,
        "${reactContext.packageName}.provider",
        outFile
      )

      val map = WritableNativeMap().apply {
        putString("uri", outUri.toString())
        putString("mime", mime)
      }
      promise.resolve(map)
    } catch (e: Exception) {
      promise.reject("GALLERY_COPY_FAIL", "Failed to save: ${e.message}")
    }
  }

  @ReactMethod
  fun copyFileToCache(uriString: String, promise: Promise) {
    try {
      val uri = Uri.parse(uriString)
      val input = reactContext.contentResolver.openInputStream(uri)
        ?: throw Exception("Failed to open URI")

      val ext = uriString.substringAfterLast('.', "jpg").take(5)
      val fileName = "shared_${System.currentTimeMillis()}.$ext"
      val outFile = File(reactContext.cacheDir, fileName)

      FileOutputStream(outFile).use { output -> input.copyTo(output) }

      val outUri = FileProvider.getUriForFile(
        reactContext,
        "${reactContext.packageName}.provider",
        outFile
      )

      val mime = when (ext.lowercase()) {
        "jpg", "jpeg" -> "image/jpeg"
        "png" -> "image/png"
        "webp" -> "image/webp"
        "mp4" -> "video/mp4"
        else -> "*/*"
      }

      val result = WritableNativeMap().apply {
        putString("uri", outUri.toString())
        putString("mime", mime)
      }

      promise.resolve(result)
    } catch (e: Exception) {
      promise.reject("SHARE_COPY_FAIL", "Failed to copy: ${e.message}")
    }
  }

  @ReactMethod
  fun postToWhatsappStatus(uriString: String, promise: Promise) {
    try {
      val uri = Uri.parse(uriString)
      val sendIntent = Intent(Intent.ACTION_SEND).apply {
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

 
@ReactMethod
fun listCleanupMedia(promise: Promise) {
  Log.d("StatusModule", "⚡ listCleanupMedia() called")
  try {
    val context = reactApplicationContext
    val resultArray = WritableNativeArray()

    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
      val mediaRoot = File(Environment.getExternalStorageDirectory(), "Android/media")
      for ((key, parts) in CLEANUP_PATHS) {
        val dir = parts.fold(mediaRoot) { acc, part -> File(acc, part) }
        dir.walkTopDown().filter {
          it.isFile && it.name.matches(Regex(""".*\.(jpg|jpeg|png|webp|mp4)""", RegexOption.IGNORE_CASE))
        }.forEach { file ->
          val map = WritableNativeMap().apply {
            putString("app", key)
            putString("uri", Uri.fromFile(file).toString())
            putString("name", file.name)
            putDouble("timestamp", file.lastModified().toDouble())
          }
          resultArray.pushMap(map)
        }
      }
      promise.resolve(resultArray)
      return
    }

    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val uriStr = prefs.getString(KEY_URI, null)
    Log.d("StatusModule", "Retrieved URI from prefs: $uriStr")
    if (uriStr == null) {
      promise.reject("NO_URI", "No SAF folder selected")
      return
    }

    val root = DocumentFile.fromTreeUri(context, Uri.parse(uriStr))
    if (root == null || !root.isDirectory) {
      promise.reject("INVALID_ROOT", "SAF root directory is invalid")
      return
    }

    logDocumentTree(root)

    for ((appKey, parts) in CLEANUP_PATHS) {
      val mediaFolder = findSubDirByPath(root, parts.dropLast(1))
      if (mediaFolder == null || !mediaFolder.isDirectory) {
        Log.d("StatusModule", "❌ Media folder not found for $appKey")
        continue
      }

      Log.d("StatusModule", "📦 Found Media folder for $appKey: ${mediaFolder.uri}")
      collectMediaFilesRecursively(mediaFolder, appKey, resultArray)
    }

    // ✅ THIS IS MISSING — YOU MUST RESOLVE THE PROMISE
    Log.d("StatusModule", "✅ Resolving with ${resultArray.size()} items")
    promise.resolve(resultArray)

  } catch (e: Exception) {
    Log.e("StatusModule", "💥 Error in listCleanupMedia: ${e.message}", e)
    promise.reject("LOAD_FAILED", e.message)
  }
}




  @ReactMethod
  fun deleteMediaFiles(uriList: ReadableArray, promise: Promise) {
    try {
      var deletedCount = 0
      for (i in 0 until uriList.size()) {
        val uri = Uri.parse(uriList.getString(i))
        val file = DocumentFile.fromSingleUri(reactContext, uri)
        if (file != null && file.exists() && file.isFile && file.delete()) {
          deletedCount++
        }
      }
      promise.resolve(deletedCount)
    } catch (e: Exception) {
      promise.reject("DELETE_FAILED", "Failed to delete files: ${e.message}")
    }
  }



private fun collectMediaFilesRecursivelygoodbefore(
    dir: DocumentFile?,
    appKey: String,
    resultArray: WritableArray,
    currentFolder: String = ""
) {
    if (dir == null || !dir.isDirectory) return

    val files = dir.listFiles()
    Log.d("StatusModule", "📂 Entering ${dir.name} - ${files.size} items")

    for (file in files) {
        if (file.isDirectory) {
            collectMediaFilesRecursively(file, appKey, resultArray, "${currentFolder}/${file.name}")
        } else if (file.name?.matches(Regex(""".*\.(jpg|jpeg|png|webp|mp4|mov)""", RegexOption.IGNORE_CASE)) == true) {
            Log.d("StatusModule", "🖼️ Found: ${file.name} in $currentFolder")
            val map = WritableNativeMap().apply {
                putString("uri", file.uri.toString())
                putString("name", file.name)
                putString("app", appKey)
                putDouble("timestamp", file.lastModified().toDouble())
                putString("folder", currentFolder)
            }
            resultArray.pushMap(map)
        }
    }
}

@ReactMethod
fun listCleanupMediaPaged(startAt: Int, maxFiles: Int, promise: Promise) {
    Log.d("StatusModule", "⚡ listCleanupMediaPaged() called: startAt=$startAt, maxFiles=$maxFiles")
    try {
        val context = reactApplicationContext
        val resultArray = WritableNativeArray()
        val seen = intArrayOf(0)
        val collected = intArrayOf(0)

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            val mediaRoot = File(Environment.getExternalStorageDirectory(), "Android/media")
            for ((key, parts) in CLEANUP_PATHS) {
                val dir = parts.fold(mediaRoot) { acc, part -> File(acc, part) }
                dir.walkTopDown()
                    .filter {
                        it.isFile && it.name.matches(Regex(""".*\.(jpg|jpeg|png|webp|mp4)""", RegexOption.IGNORE_CASE))
                    }.forEach { file ->
                        seen[0]++
                        if (seen[0] <= startAt) return@forEach
                        if (collected[0] >= maxFiles) return@forEach

                        val map = WritableNativeMap().apply {
                            putString("app", key)
                            putString("uri", Uri.fromFile(file).toString())
                            putString("name", file.name)
                            putDouble("timestamp", file.lastModified().toDouble())
                            putString("folder", file.parentFile?.name ?: "Unknown")
                        }
                        resultArray.pushMap(map)
                        collected[0]++
                    }
            }
            Log.d("StatusModule", "✅ Legacy result: ${resultArray.size()} items")
            promise.resolve(resultArray)
            return
        }

        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val uriStr = prefs.getString(KEY_URI, null)
        Log.d("StatusModule", "📥 SAF URI from prefs: $uriStr")
        if (uriStr == null) {
            promise.reject("NO_URI", "No SAF folder selected")
            return
        }

        val root = DocumentFile.fromTreeUri(context, Uri.parse(uriStr))
        if (root == null || !root.isDirectory) {
            promise.reject("INVALID_ROOT", "SAF root directory is invalid")
            return
        }

        for ((appKey, parts) in CLEANUP_PATHS) {
            val mediaFolder = findSubDirByPath(root, parts.dropLast(1))
            if (mediaFolder == null || !mediaFolder.isDirectory) {
                Log.d("StatusModule", "❌ Media folder not found for $appKey")
                continue
            }

            Log.d("StatusModule", "📦 Found Media folder for $appKey: ${mediaFolder.uri}")
            collectMediaFilesRecursivelyPaged(
                dir = mediaFolder,
                appKey = appKey,
                resultArray = resultArray,
                currentFolder = "",
                startAt = startAt,
                maxFiles = maxFiles,
                count = collected,
                seen = seen
            )
        }

        Log.d("StatusModule", "✅ Collected ${resultArray.size()} items")
        promise.resolve(resultArray)

    } catch (e: Exception) {
        Log.e("StatusModule", "💥 Error in listCleanupMediaPaged: ${e.message}", e)
        promise.reject("LOAD_FAILED", e.message)
    }
}
private fun collectMediaFilesRecursivelyPaged(
    dir: DocumentFile?,
    appKey: String,
    resultArray: WritableArray,
    currentFolder: String = "",
    startAt: Int = 0,
    maxFiles: Int = 500,
    count: IntArray,
    seen: IntArray
) {
    if (dir == null || !dir.isDirectory) return

    val files = dir.listFiles()
    Log.d("StatusModule", "📂 Entering ${dir.name} - ${files.size} items")

    for (file in files) {
        if (count[0] >= maxFiles) return

        if (file.isDirectory) {
            collectMediaFilesRecursivelyPaged(file, appKey, resultArray, "$currentFolder/${file.name}", startAt, maxFiles, count, seen)
        } else if (file.name?.matches(Regex(""".*\.(jpg|jpeg|png|webp|mp4|mov)""", RegexOption.IGNORE_CASE)) == true) {
            seen[0]++
            if (seen[0] <= startAt) continue

            val map = WritableNativeMap().apply {
                putString("uri", file.uri.toString())
                putString("name", file.name)
                putString("app", appKey)
                putDouble("timestamp", file.lastModified().toDouble())
                putString("folder", currentFolder)
            }
            resultArray.pushMap(map)
            count[0]++
        }
    }
}


private fun collectMediaFilesRecursively(
    dir: DocumentFile?,
    appKey: String,
    resultArray: WritableArray,
    currentFolder: String = "",
    maxFiles: Int = 500,
    count: IntArray = intArrayOf(0) // mutable counter
) {
    if (dir == null || !dir.isDirectory) return

    val files = dir.listFiles()
    Log.d("StatusModule", "📂 Entering ${dir.name} - ${files.size} items")

    for (file in files) {
        if (count[0] >= maxFiles) {
            Log.w("StatusModule", "⚠️ Max file limit reached ($maxFiles)")
            return
        }

        if (file.isDirectory) {
            collectMediaFilesRecursively(file, appKey, resultArray, "$currentFolder/${file.name}", maxFiles, count)
        } else if (file.name?.matches(Regex(""".*\.(jpg|jpeg|png|webp|mp4|mov)""", RegexOption.IGNORE_CASE)) == true) {
            Log.d("StatusModule", "🖼️ Found: ${file.name} in $currentFolder")
            val map = WritableNativeMap().apply {
                putString("uri", file.uri.toString())
                putString("name", file.name)
                putString("app", appKey)
                putDouble("timestamp", file.lastModified().toDouble())
                putString("folder", currentFolder)
            }
            resultArray.pushMap(map)
            count[0] += 1
        }
    }
}


@ReactMethod
fun getMessengerMedia(uriString: String, messenger: String, promise: Promise) {
    val context = reactApplicationContext
    val contentResolver = context.contentResolver

    try {
        val rootUri = Uri.parse(uriString)
        val docId = DocumentsContract.getTreeDocumentId(rootUri)
        val baseUri = DocumentsContract.buildDocumentUriUsingTree(rootUri, docId)

        Log.d("StatusModule", "🔍 getMessengerMedia() called")
        Log.d("StatusModule", "  ↪️ Root URI: $uriString")
        Log.d("StatusModule", "  ↪️ Messenger: $messenger")

        val mediaList = mutableListOf<WritableMap>()

        val possiblePaths = listOf(
            "com.$messenger",
            messenger,
            "Android/media/com.$messenger",
            "Android/media/$messenger"
        )

        for (pathSuffix in possiblePaths) {
            val fullPath = "$docId/$pathSuffix"
            val testUri = DocumentsContract.buildChildDocumentsUriUsingTree(rootUri, fullPath)

            Log.d("StatusModule", "🔎 Trying: $fullPath")

            val stack = Stack<Uri>()
            stack.push(testUri)

            while (stack.isNotEmpty()) {
                val currentUri = stack.pop()

                val children = contentResolver.query(
                    currentUri,
                    arrayOf(
                        DocumentsContract.Document.COLUMN_DOCUMENT_ID,
                        DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                        DocumentsContract.Document.COLUMN_MIME_TYPE
                    ),
                    null,
                    null,
                    null
                )

                if (children != null) {
                    while (children.moveToNext()) {
                        val docIdChild = children.getString(0)
                        val displayName = children.getString(1)
                        val mimeType = children.getString(2)

                        val fileUri = DocumentsContract.buildDocumentUriUsingTree(rootUri, docIdChild)

                        if (mimeType == DocumentsContract.Document.MIME_TYPE_DIR) {
                            Log.d("StatusModule", "📁 Found folder: $displayName")
                            stack.push(fileUri)
                        } else if (mimeType.startsWith("image/") || mimeType.startsWith("video/")) {
                            Log.d("StatusModule", "🖼️ Matched media: $displayName [$mimeType]")
                            val map = Arguments.createMap().apply {
                                putString("uri", fileUri.toString())
                                putString("name", displayName)
                                putString("mime", mimeType)
                                putString("app", messenger)
                            }
                            mediaList.add(map)
                        } else {
                            Log.d("StatusModule", "📄 Ignored non-media: $displayName [$mimeType]")
                        }
                    }
                    children.close()
                }
            }
        }

        Log.d("StatusModule", "✅ getMessengerMedia: ${mediaList.size} media items found")
        promise.resolve(Arguments.makeNativeArray(mediaList))

    } catch (e: Exception) {
        Log.e("StatusModule", "💥 Error in getMessengerMedia: ${e.message}", e)
        promise.reject("MEDIA_FETCH_FAILED", e.message, e)
    }
}

@ReactMethod
fun getMessengerMediaInfo(uri: String, messenger: String, promise: Promise) {
    CoroutineScope(Dispatchers.IO).launch {
        try {
            val mediaFiles = getMediaFilesFromMessenger(reactContext, Uri.parse(uri), messenger)
            val totalSize = mediaFiles.sumOf { it.size }
            val response = Arguments.createMap().apply {
                putInt("count", mediaFiles.size)
                putDouble("totalSizeMb", totalSize / (1024.0 * 1024.0))
            }
            promise.resolve(response)
        } catch (e: Exception) {
            Log.e("StatusModule", "Failed to get media info", e)
            promise.reject("INFO_ERROR", e)
        }
    }
}

@ReactMethod
fun getMessengerMediaBatch(uri: String, messenger: String, offset: Int, limit: Int, promise: Promise) {
    CoroutineScope(Dispatchers.IO).launch {
        try {
            val allMedia = getMediaFilesFromMessenger(reactContext, Uri.parse(uri), messenger)
            val paged = allMedia.drop(offset).take(limit)
            promise.resolve(Arguments.makeNativeArray(paged))
        } catch (e: Exception) {
            Log.e("StatusModule", "Failed to load batch", e)
            promise.reject("BATCH_LOAD_ERROR", e)
        }
    }
}

// Helper function to list media files and their sizes from a folder Uri
private fun getMediaFilesFromMessenger(
    context: Context,
    treeUri: Uri,
    subFolderName: String
): List<MediaFile> {
    val result = mutableListOf<MediaFile>()
    val docUri = DocumentsContract.buildDocumentUriUsingTree(
        treeUri,
        DocumentsContract.getTreeDocumentId(treeUri)
    )

    val messengerUri = DocumentsContract.buildChildDocumentsUriUsingTree(
        treeUri,
        DocumentsContract.getTreeDocumentId(treeUri)
    )

    val children = context.contentResolver.query(
        messengerUri, arrayOf(
            DocumentsContract.Document.COLUMN_DOCUMENT_ID,
            DocumentsContract.Document.COLUMN_DISPLAY_NAME,
            DocumentsContract.Document.COLUMN_SIZE,
            DocumentsContract.Document.COLUMN_MIME_TYPE
        ),
        null,
        null,
        null
    )

    children?.use { cursor ->
        while (cursor.moveToNext()) {
            val docId = cursor.getString(0)
            val name = cursor.getString(1)
            val size = cursor.getLong(2)
            val mimeType = cursor.getString(3)

            val fileUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, docId)

            // Optional: Log for debug
            Log.d("StatusModule", "📄 File size: $name = $size")

            result.add(
                MediaFile(
                    name = name,
                    uri = fileUri.toString(),
                    mimeType = mimeType ?: "application/octet-stream",
                    size = size
                )
            )
        }
    }

    return result
}

@ReactMethod
fun getSavedTreeUri(promise: Promise) {
  try {
    val prefs = reactApplicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val uriStr = prefs.getString(KEY_URI, null)
    if (uriStr == null) {
      promise.reject("NO_URI", "No SAF folder selected")
    } else {
      promise.resolve(uriStr)
    }
  } catch (e: Exception) {
    promise.reject("GET_URI_FAILED", "Failed to retrieve saved URI: ${e.message}")
  }
}

  @ReactMethod
  fun setSavedTreeUri(uriString: String, promise: Promise) {
    try {
      val uri = Uri.parse(uriString)
      reactApplicationContext.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)

      val prefs = reactApplicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      prefs.edit().putString(KEY_URI, uri.toString()).apply()

      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("SAVE_URI_FAILED", "Failed to save folder URI: ${e.message}")
    }
  }

fun logDocumentTree(dir: DocumentFile, indent: String = "") {
  val TAG = "SAFTree"
  Log.d(TAG, "$indent📁 ${dir.name} [${dir.uri}]")

  for (file in dir.listFiles()) {
    if (file.isDirectory) {
      logDocumentTree(file, "$indent  ")
    } else {
      Log.d(TAG, "$indent📄 ${file.name} (${file.type})")
    }
  }
}


private fun scanAllMediaExceptStatuses(rootUri: Uri): WritableArray {
  val context = reactApplicationContext
  val root = DocumentFile.fromTreeUri(context, rootUri)
  val resultArray = WritableNativeArray()

  if (root == null || !root.isDirectory) return resultArray

  for ((key, parts) in CLEANUP_PATHS) {
    val mediaFolder = findSubDirByPath(root, parts)
    if (mediaFolder == null || !mediaFolder.isDirectory) {
      Log.d("StatusModule", "❌ Media folder not found for $key")
      continue
    }

    Log.d("StatusModule", "📦 Scanning media for cleanup ($key): ${mediaFolder.uri}")

    mediaFolder.listFiles().forEach { file ->
      if (file.isDirectory && file.name != ".Statuses") {
        collectMediaFilesRecursively(file, key, resultArray)
      }
    }
  }

  return resultArray
}

private fun scanStatusesOnly(rootUri: Uri): WritableArray {
  val context = reactApplicationContext
  val root = DocumentFile.fromTreeUri(context, rootUri)
  val resultArray = WritableNativeArray()

  if (root == null || !root.isDirectory) return resultArray

  for ((key, parts) in APP_PATHS) {
    val statusDir = findSubDirByPath(root, parts)
    statusDir?.listFiles()?.filter {
      it.isFile && it.name?.matches(Regex(""".*\.(jpg|jpeg|png|webp|mp4)""", RegexOption.IGNORE_CASE)) == true
    }?.forEach { file ->
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
@ReactMethod
fun getFolderContentRecursively2(appKey: String, promise: Promise) {
    try {
        val context = reactApplicationContext
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val uriStr = prefs.getString(KEY_URI, null)
        if (uriStr == null) {
            promise.reject("NO_URI", "No SAF folder selected")
            return
        }

        val root = DocumentFile.fromTreeUri(context, Uri.parse(uriStr))
        if (root == null || !root.isDirectory) {
            promise.reject("INVALID_ROOT", "Invalid SAF root directory")
            return
        }

        val path = CLEANUP_PATHS[appKey]
        if (path == null) {
            promise.reject("INVALID_APP", "Unknown app key")
            return
        }

        val appFolder = findSubDirByPath(root, path)
        if (appFolder == null || !appFolder.isDirectory) {
            promise.reject("FOLDER_NOT_FOUND", "App media folder not found")
            return
        }

        val items = appFolder.listFiles()
        val totalSize = items.sumOf { getRecursiveSize(it) }

        val resultArray = WritableNativeArray()
        for (item in items) {
            val size = getRecursiveSize(item)
            val map = WritableNativeMap().apply {
                putString("name", item.name ?: "Unnamed")
                putString("uri", item.uri.toString())
                putString("type", if (item.isDirectory) "folder" else "file")
                putDouble("size", size.toDouble())
                putDouble("percent", if (totalSize > 0) (size * 100.0 / totalSize) else 0.0)
                putString("app", appKey)
            }
            resultArray.pushMap(map)
        }

        promise.resolve(resultArray)
    } catch (e: Exception) {
        Log.e("StatusModule", "getFolderContentRecursively error", e)
        promise.reject("ERROR", e.message)
    }
}

private fun getRecursiveSize(file: DocumentFile?): Long {
    if (file == null) return 0
    if (file.isFile) return file.length()
    if (!file.isDirectory) return 0
    return file.listFiles().sumOf { getRecursiveSize(it) }
}
@RequiresApi(Build.VERSION_CODES.LOLLIPOP)
@ReactMethod
fun getFolderContentRecursively1(app: String, promise: Promise) {
    val context = reactApplicationContext
    val rootFolder = selectedFolderUri ?: return promise.reject("NO_FOLDER", "No folder selected")
    val result = Arguments.createArray()

    val mediaMimeTypes = listOf("image/", "video/", "audio/")
    val folderStats = mutableListOf<Bundle>()
    val mediaFiles = mutableListOf<Bundle>()
    val totalSize = longArrayOf(0)

    fun exploreFolder(uri: Uri): Long {
        var folderSize = 0L
        val children = DocumentFile.fromTreeUri(context, uri)?.listFiles() ?: return 0
        for (file in children) {
            if (file.isDirectory) {
                val subSize = exploreFolder(file.uri)
                folderStats.add(Bundle().apply {
                    putString("uri", file.uri.toString())
                    putString("name", file.name)
                    putDouble("size", subSize.toDouble())
                    putString("type", "folder")
                    putString("app", app)
                })
                folderSize += subSize
            } else if (file.isFile && mediaMimeTypes.any { file.type?.startsWith(it) == true }) {
                val size = file.length()
                mediaFiles.add(Bundle().apply {
                    putString("uri", file.uri.toString())
                    putString("name", file.name)
                    putDouble("size", size.toDouble())
                    putString("type", "file")
                    putString("app", app)
                })
                folderSize += size
                totalSize[0] += size
            }
        }
        return folderSize
    }

    val rootSize = exploreFolder(rootFolder)
    folderStats.forEach { folder ->
        val size = folder.getDouble("size")
        val percent = if (totalSize[0] > 0) (size / totalSize[0]) * 100 else 0.0
        folder.putDouble("percent", percent)
    }

    (folderStats + mediaFiles).forEach { result.pushMap(Arguments.makeNativeMap(it)) }
    promise.resolve(result)
}


@ReactMethod
fun getFolderAndMediaList2(appKey: String, folderPath: String?, promise: Promise) {
    CoroutineScope(Dispatchers.IO).launch {
        try {
            Log.d("StatusModule", "📂 getFolderAndMediaList() called")
            Log.d("StatusModule", "  ↪️ appKey: $appKey")
            Log.d("StatusModule", "  ↪️ folderPath: $folderPath")

            val rootUri = getSelectedFolderUri(appKey)
            Log.d("StatusModule", "  ↪️ rootUri: $rootUri")

            val rootDoc = DocumentFile.fromTreeUri(reactContext, rootUri)
            if (rootDoc == null || !rootDoc.isDirectory) {
                promise.reject("ROOT_ACCESS_ERROR", "Could not access base folder: $rootUri")
                return@launch
            }

            val targetDoc = if (folderPath != null) {
                DocumentFile.fromTreeUri(reactContext, Uri.parse(folderPath))
                    ?: throw IllegalArgumentException("Could not access subfolder path")
            } else {
                val subPath = listOf(appKeyToPackageFolder(appKey))
                findSubDirByPath(rootDoc, subPath)
                    ?: throw IllegalArgumentException("Subfolder for $appKey not found")
            }

            val cache = loadCache()
            val (items, totalSize) = scanFolderParallel(
                targetDoc,
                cache,
                ::sendScanProgress
            )
            saveCache(cache)

            val result = Arguments.createMap()
            result.putArray("items", Arguments.fromList(items))
            result.putDouble("totalSize", totalSize.toDouble())
            promise.resolve(result)
            Log.d("StatusModule", "✅ Folder scanned: ${items.size} items, totalSize=$totalSize bytes")

        } catch (e: Exception) {
            Log.e("StatusModule", "❌ Error in getFolderAndMediaList", e)
            promise.reject("FOLDER_LIST_ERROR", e.message, e)
        }
    }
}
@ReactMethod
fun getFolderAndMediaList(appKey: String, folderPath: String?, promise: Promise) {
    CoroutineScope(Dispatchers.IO).launch {
        try {
            Log.d("StatusModule", "📂 getFolderAndMediaList() called")
            Log.d("StatusModule", "  ↪️ appKey: $appKey")
            Log.d("StatusModule", "  ↪️ folderPath: $folderPath")

            val rootUri = getSelectedFolderUri(appKey)
            val rootDoc = DocumentFile.fromTreeUri(reactContext, rootUri)

            if (rootDoc == null || !rootDoc.isDirectory) {
                promise.reject("ROOT_ACCESS_ERROR", "Could not access base folder: $rootUri")
                return@launch
            }

            val targetDoc = if (folderPath != null) {
                DocumentFile.fromTreeUri(reactContext, Uri.parse(folderPath))
                    ?: throw IllegalArgumentException("Could not access subfolder path")
            } else {
                val subPath = listOf(appKeyToPackageFolder(appKey))
                findSubDirByPath(rootDoc, subPath)
                    ?: throw IllegalArgumentException("Subfolder for $appKey not found")
            }

            val children = targetDoc.listFiles()
            val items = WritableNativeArray()

            for (file in children) {
                val item = Arguments.createMap()
                item.putString("name", file.name ?: "unknown")
                item.putString("uri", file.uri.toString())
                item.putString("path", file.uri.toString())
                item.putBoolean("isDirectory", file.isDirectory)
                item.putDouble("timestamp", file.lastModified().toDouble())

                if (file.isDirectory) {
                    item.putDouble("size", -1.0)
                    item.putString("type", "folder")

                    // Start folder size scan in background
                    CoroutineScope(Dispatchers.IO).launch {
                        val size = getFolderSizeRecursive(file)
                        emitFolderSizeUpdate(file.uri.toString(), size)
                    }
                } else {
                    val size = file.length()
                    item.putDouble("size", size.toDouble())
                    item.putString("type", "file")
                    item.putString("mime", file.type ?: "")
                }

                items.pushMap(item)
            }

            val result = Arguments.createMap()
            result.putArray("items", items)
            result.putDouble("totalSize", -1.0) // totalSize can be calculated later
            promise.resolve(result)

            Log.d("StatusModule", "✅ Folder scanned: ${children.size} items")

        } catch (e: Exception) {
            Log.e("StatusModule", "❌ Error in getFolderAndMediaList", e)
            promise.reject("FOLDER_LIST_ERROR", e.message, e)
        }
    }
}

private fun emitFolderSizeUpdate(uri: String, size: Long) {
    val params = Arguments.createMap()
    params.putString("uri", uri)
    params.putDouble("size", size.toDouble())
    reactContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit("FolderSizeUpdate", params)
}
@ReactMethod
fun deleteMediaBatch(uris: ReadableArray) {
    CoroutineScope(Dispatchers.IO).launch {
        try {
            for (i in 0 until uris.size()) {
                val uriStr = uris.getString(i)
                val uri = Uri.parse(uriStr)
                val doc = DocumentFile.fromSingleUri(reactContext, uri)
                doc?.delete()
            }
        } catch (e: Exception) {
            Log.e("StatusModule", "❌ deleteMediaBatch failed", e)
        }
    }
}

@ReactMethod
fun getMediaInFolder(appKey: String, folderName: String, promise: Promise) {
    CoroutineScope(Dispatchers.IO).launch {
        try {
            val baseUri = getSelectedFolderUri(appKey)
            val baseDoc = DocumentFile.fromTreeUri(reactContext, baseUri)
            if (baseDoc == null || !baseDoc.isDirectory) {
                promise.reject("URI_ERROR", "Base folder not accessible")
                return@launch
            }

            val mediaPath = listOf(appKeyToPackageFolder(appKey), "WhatsApp", "Media", folderName)
            val folderDoc = findSubDirByPath(baseDoc, mediaPath)

            if (folderDoc == null || !folderDoc.isDirectory) {
                promise.reject("FOLDER_NOT_FOUND", "Could not find folder: $folderName")
                return@launch
            }

            val files = folderDoc.listFiles().filter { it.isFile }
            val items = Arguments.createArray()
            var totalSize = 0L

            for (file in files) {
                val map = Arguments.createMap()
                map.putString("name", file.name)
                map.putString("uri", file.uri.toString())
                map.putString("path", file.uri.toString())
                map.putBoolean("isDirectory", false)
                map.putString("mime", file.type ?: "")
                map.putDouble("timestamp", file.lastModified().toDouble())

                val size = file.length()
                map.putDouble("size", size.toDouble())
                totalSize += size

                items.pushMap(map)
            }

            val result = Arguments.createMap()
            result.putArray("items", items)
            result.putDouble("totalSize", totalSize.toDouble())
            promise.resolve(result)

        } catch (e: Exception) {
            Log.e("StatusModule", "❌ getMediaInFolder failed", e)
            promise.reject("FOLDER_LOAD_FAIL", e.message, e)
        }
    }
}


@ReactMethod
fun listMediaFolders(appKey: String, promise: Promise) {
    try {
        val rootUri = getSelectedFolderUri(appKey)
        val rootDoc = DocumentFile.fromTreeUri(reactContext, rootUri)

        if (rootDoc == null || !rootDoc.isDirectory) {
            promise.reject("ROOT_ACCESS_ERROR", "Could not access base folder: $rootUri")
            return
        }

        // Look for subfolder: com.whatsapp / WhatsApp / Media
        val mediaFolder = findSubDirByPath(
            rootDoc,
            listOf(appKeyToPackageFolder(appKey), "WhatsApp", "Media")
        )

        if (mediaFolder == null || !mediaFolder.isDirectory) {
            promise.reject("MEDIA_FOLDER_NOT_FOUND", "Media folder not found")
            return
        }

        val folderNames = mediaFolder.listFiles()
            .filter { it.isDirectory }
            .mapNotNull { it.name }

        promise.resolve(Arguments.fromList(folderNames))
    } catch (e: Exception) {
        Log.e("StatusModule", "❌ Failed to list media folders", e)
        promise.reject("LIST_ERROR", e.message, e)
    }
}
@ReactMethod
fun launchMessengerMedia(appKey: String) {
    val intent = Intent(reactApplicationContext, MessengerMediaActivity::class.java)
    intent.putExtra("appKey", appKey)
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    reactApplicationContext.startActivity(intent)
}

@ReactMethod
fun listMessengerMediaFolders(appKey: String, promise: Promise) {
    try {
        val baseUri = getSelectedFolderUri(appKey) // e.g. content://.../Android/media
        val baseDoc = DocumentFile.fromTreeUri(reactContext, baseUri)
        if (baseDoc == null || !baseDoc.isDirectory) {
            promise.reject("URI_ERROR", "Base folder not accessible")
            return
        }

        val target = findSubDirByPath(baseDoc, listOf(appKeyToPackageFolder(appKey), "WhatsApp", "Media"))
        if (target == null) {
            promise.reject("FOLDER_ERROR", "WhatsApp Media folder not found")
            return
        }

        val folders = target.listFiles().filter { it.isDirectory }.mapNotNull { it.name }
        promise.resolve(Arguments.fromList(folders))
    } catch (e: Exception) {
        Log.e("StatusModule", "❌ listMessengerMediaFolders failed", e)
        promise.reject("LIST_FOLDER_FAIL", e.message, e)
    }
}


@ReactMethod
fun getFolderAndMediaList1(appKey: String, folderPath: String?, promise: Promise) {
    CoroutineScope(Dispatchers.IO).launch {
        try {
            val rootUri = getSelectedFolderUri(appKey)
            val rootDoc = DocumentFile.fromTreeUri(reactContext, rootUri)

            Log.d("StatusModule", "📂 getFolderAndMediaList() called")
            Log.d("StatusModule", "  ↪️ appKey: $appKey")
            Log.d("StatusModule", "  ↪️ folderPath: $folderPath")
            Log.d("StatusModule", "  ↪️ rootUri: $rootUri")

            if (rootDoc == null || !rootDoc.isDirectory) {
                Log.e("StatusModule", "❌ Could not access base folder: $rootUri")
                promise.reject("ROOT_ACCESS_ERROR", "Could not access base folder: $rootUri")
                return@launch
            }

            val targetDoc = if (folderPath != null) {
                // Provided full folder URI
                DocumentFile.fromTreeUri(reactContext, Uri.parse(folderPath))
                    ?: throw IllegalArgumentException("Could not access subfolder path: $folderPath")
            } else {
                // Derive path from CLEANUP_PATHS
                val subPath = CLEANUP_PATHS[appKey]
                    ?: throw IllegalArgumentException("No cleanup path defined for $appKey")

                Log.d("StatusModule", "🔍 Traversing into subpath: $subPath")
                findSubDirByPath(rootDoc, subPath)
                    ?: throw IllegalArgumentException("Subfolder for $appKey not found at: $subPath")
            }

            val children = targetDoc.listFiles()
            Log.d("StatusModule", "📦 ${children.size} items found in: ${targetDoc.uri}")

            val items = mutableListOf<WritableMap>()
            var totalSize = 0L

            for (file in children) {
                val item = Arguments.createMap()
                item.putString("name", file.name)
                item.putString("path", file.uri.toString())
                item.putBoolean("isDirectory", file.isDirectory)
                item.putDouble("timestamp", file.lastModified().toDouble())

                if (file.isDirectory) {
                    val folderSize = getFolderSizeRecursive(file)
                    item.putDouble("size", folderSize.toDouble())
                    item.putString("type", "folder")
                    totalSize += folderSize
                } else {
                    val size = file.length()
                    item.putDouble("size", size.toDouble())
                    item.putString("type", "file")
                    item.putString("mime", file.type ?: "")
                    item.putString("uri", file.uri.toString())
                    totalSize += size
                }

                items.add(item)
            }

            val result = Arguments.createMap()
            result.putArray("items", Arguments.fromList(items))
            result.putDouble("totalSize", totalSize.toDouble())
            Log.d("StatusModule", "✅ Folder scanned: ${items.size} items, totalSize=$totalSize bytes")
            promise.resolve(result)

        } catch (e: Exception) {
            Log.e("StatusModule", "💥 getFolderAndMediaList failed", e)
            promise.reject("FOLDER_LIST_ERROR", e.message, e)
        }
    }
}

private fun appKeyToPackageFolder(appKey: String): String {
    return when (appKey.lowercase()) {
        "whatsapp" -> "com.whatsapp"
        "business" -> "com.whatsapp.w4b"
        "telegram" -> "org.telegram.messenger"
        "tiktok" -> "com.zhiliaoapp.musically"
        "xender" -> "cn.xender"
        else -> appKey
    }
}
private suspend fun scanFolderParallel(
    folder: DocumentFile,
    cache: JSONObject,
    emitProgress: (Int, Long) -> Unit
): Pair<List<WritableMap>, Long> {
    val items = mutableListOf<WritableMap>()
    var totalSize = 0L
    var scannedCount = 0

    val children = folder.listFiles()

    coroutineScope {
        val jobs = children.map { file ->
            async {
                val item = Arguments.createMap()
                item.putString("name", file.name)
                item.putString("path", file.uri.toString())
                item.putBoolean("isDirectory", file.isDirectory)
                item.putDouble("timestamp", file.lastModified().toDouble())

                if (file.isDirectory) {
                    val (subItems, subSize) = scanFolderParallel(file, cache, emitProgress)
                    totalSize += subSize
                    item.putDouble("size", subSize.toDouble())
                    item.putString("type", "folder")
                } else {
                    val cached = cache.optJSONObject(file.uri.toString())
                    val lastMod = file.lastModified()
                    val size = if (
                        cached != null && cached.optLong("lastModified") == lastMod
                    ) {
                        cached.optLong("size")
                    } else {
                        val newSize = file.length()
                        val json = JSONObject()
                        json.put("size", newSize)
                        json.put("lastModified", lastMod)
                        cache.put(file.uri.toString(), json)
                        newSize
                    }
                    item.putDouble("size", size.toDouble())
                    item.putString("type", "file")
                    item.putString("mime", file.type ?: "")
                    item.putString("uri", file.uri.toString())
                    totalSize += size
                }

                synchronized(items) {
                    items.add(item)
                    scannedCount++
                    emitProgress(scannedCount, totalSize)
                }
            }
        }
        jobs.awaitAll()
    }

    return Pair(items, totalSize)
}
private fun loadCache(): JSONObject {
    return try {
        val cacheFile = File(reactContext.cacheDir, "scan-cache.json")
        if (cacheFile.exists()) {
            JSONObject(cacheFile.readText())
        } else JSONObject()
    } catch (e: Exception) {
        JSONObject()
    }
}

private fun saveCache(cache: JSONObject) {
    try {
        val cacheFile = File(reactContext.cacheDir, "scan-cache.json")
        cacheFile.writeText(cache.toString())
    } catch (e: Exception) {
        Log.w("StatusModule", "⚠️ Failed to save cache: ${e.message}")
    }
}
private fun sendScanProgress(count: Int, size: Long) {
    val params = Arguments.createMap()
    params.putInt("count", count)
    params.putDouble("size", size.toDouble())
    reactContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit("ScanProgress", params)
}


private fun getFolderSizeRecursive(folder: DocumentFile?): Long {
    if (folder == null || !folder.isDirectory) return 0
    var size = 0L
    folder.listFiles().forEach { file ->
        size += if (file.isDirectory) {
            val subSize = getFolderSizeRecursive(file)
            Log.d("StatusModule", "📁 Subfolder size: ${file.name} = $subSize")
            subSize
        } else {
            val fileSize = file.length()
            Log.d("StatusModule", "📄 File size: ${file.name} = $fileSize")
            fileSize
        }
    }
    return size
}


private fun getSelectedFolderUri(appKey: String): Uri {
    val prefs = reactApplicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val uriStr = prefs.getString(KEY_URI, null)
        ?: throw IllegalStateException("No SAF folder selected")

    Log.d("StatusModule", "📥 Loaded persisted URI for app [$appKey]: $uriStr")
    return Uri.parse(uriStr)
}

data class MediaFile(
    val name: String,
    val uri: String,
    val mimeType: String,
    val size: Long
)



}

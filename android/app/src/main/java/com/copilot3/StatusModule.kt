package com.copilot3

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.DocumentsContract
import android.util.Log
import androidx.core.content.FileProvider
import androidx.documentfile.provider.DocumentFile
import com.facebook.react.bridge.*
import com.facebook.react.module.annotations.ReactModule
import kotlinx.coroutines.*
import java.io.File
import java.io.FileOutputStream

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

    init {
        reactContext.addActivityEventListener(object : BaseActivityEventListener() {
            override fun onActivityResult(activity: Activity?, requestCode: Int, resultCode: Int, data: Intent?) {
                handleActivityResult(requestCode, resultCode, data)
            }
        })
    }

    override fun getName(): String = NAME

    @ReactMethod
    fun openStatusFolderPicker(mode: String, promise: Promise) {
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
                val contentResolver = context.contentResolver
                contentResolver.takePersistableUriPermission(
                    uri,
                    Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                )

                val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                prefs.edit().putString(KEY_URI, uri.toString()).apply()
                Log.d("StatusModule", "✅ Persisted URI: ${uri.toString()}")

                val doc = DocumentFile.fromTreeUri(context, uri)
                if (doc == null || !doc.isDirectory || !doc.canRead()) {
                    Log.e("StatusModule", "❌ Selected URI is not a readable directory: ${uri.toString()}")
                    statusPromise?.reject("INVALID_URI", "Selected folder is not accessible")
                    statusPromise = null
                    return
                }

                val result = when (selectedScanMode) {
                    "cleanup" -> scanAllMediaExceptStatuses(uri)
                    else -> scanStatusesOnly(uri)
                }

                Log.d("StatusModule", "✅ Folder scan completed: ${result.size()} items")
                statusPromise?.resolve(result)
            } catch (e: Exception) {
                Log.e("StatusModule", "💥 Failed to process folder: ${e.message}", e)
                statusPromise?.reject("PROCESS_FAILED", "Failed to process folder: ${e.message}")
            }
        } else {
            Log.d("StatusModule", "❌ Folder picker cancelled or failed")
            statusPromise?.reject("PICKER_CANCELLED", "User cancelled folder picking")
        }
        statusPromise = null
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
                Log.d("StatusModule", "❌ No SAF folder selected")
                promise.reject("NO_URI", "No SAF folder selected")
                return
            }

            val rootUri = Uri.parse(uriStr)
            val contentResolver = reactContext.contentResolver
            val hasPermission = contentResolver.persistedUriPermissions
                .any { it.uri == rootUri && it.isReadPermission }
            if (!hasPermission) {
                Log.d("StatusModule", "❌ Permission revoked for URI: $uriStr, attempting to retake...")
                try {
                    contentResolver.takePersistableUriPermission(rootUri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    Log.d("StatusModule", "✅ Successfully retook permission for URI: $uriStr")
                } catch (e: Exception) {
                    Log.e("StatusModule", "💥 Failed to retake permission: ${e.message}")
                    promise.reject("PERMISSION_DENIED", "Permission for saved folder has been revoked")
                    return
                }
            }

            val root = DocumentFile.fromTreeUri(reactContext, rootUri)
            if (root == null || !root.isDirectory || !root.canRead()) {
                Log.d("StatusModule", "❌ SAF root directory is invalid or not readable: $uriStr")
                promise.reject("INVALID_ROOT", "SAF root directory is invalid or not readable")
                return
            }

            val files = scanStatusesOnly(rootUri)
            Log.d("StatusModule", "✅ Refreshed statuses: ${files.size()} items")
            promise.resolve(files)
        } catch (e: Exception) {
            Log.e("StatusModule", "💥 Failed to refresh statuses: ${e.message}", e)
            promise.reject("REFRESH_FAILED", "Failed to refresh: ${e.message}")
        }
    }

    @ReactMethod
    fun checkUriPermission(uriString: String, promise: Promise) {
        try {
            val uri = Uri.parse(uriString)
            val context = reactApplicationContext
            val contentResolver = context.contentResolver
            val persistedUris = contentResolver.persistedUriPermissions
            val hasPermission = persistedUris.any { it.uri == uri && it.isReadPermission }
            
            if (!hasPermission) {
                Log.d("StatusModule", "❌ No read permission for URI: $uriString, attempting to retake...")
                try {
                    contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    Log.d("StatusModule", "✅ Successfully retook permission for URI: $uriString")
                } catch (e: Exception) {
                    Log.e("StatusModule", "💥 Failed to retake permission for URI: $uriString, ${e.message}")
                    promise.resolve(false)
                    return
                }
            }

            val doc = DocumentFile.fromTreeUri(context, uri)
            if (doc == null || !doc.isDirectory || !doc.canRead()) {
                Log.d("StatusModule", "❌ URI is not a readable directory: $uriString")
                promise.resolve(false)
                return
            }

            try {
                val files = doc.listFiles()
                Log.d("StatusModule", "✅ URI is valid, found ${files.size} items: $uriString")
                promise.resolve(true)
            } catch (e: Exception) {
                Log.e("StatusModule", "💥 Failed to list files for URI: $uriString, ${e.message}")
                promise.resolve(false)
            }
        } catch (e: Exception) {
            Log.e("StatusModule", "💥 Failed to check URI permission: ${e.message}", e)
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun getMediaInFolderPaged(
        appKey: String,
        folderName: String,
        offset: Int,
        limit: Int,
        minDate: Double,
        maxDate: Double,
        minSize: Double,
        maxSize: Double,
        promise: Promise
    ) {
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

                val files = folderDoc.listFiles()
                    .filter { it.isFile }
                    .filter { minDate == 0.0 || it.lastModified().toDouble() >= minDate }
                    .filter { maxDate == 0.0 || it.lastModified().toDouble() <= maxDate }
                    .filter { minSize == 0.0 || it.length().toDouble() >= minSize }
                    .filter { maxSize == 0.0 || it.length().toDouble() <= maxSize }
                    .drop(offset)
                    .take(limit)
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
                Log.e("StatusModule", "❌ getMediaInFolderPaged failed", e)
                promise.reject("FOLDER_LOAD_FAIL", e.message, e)
            }
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

            Log.d("StatusModule", "✅ Resolving with ${resultArray.size()} items")
            promise.resolve(resultArray)
        } catch (e: Exception) {
            Log.e("StatusModule", "💥 Error in listCleanupMedia: ${e.message}", e)
            promise.reject("LOAD_FAILED", e.message)
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
        count: IntArray = intArrayOf(0)
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

    @ReactMethod
    fun getSavedTreeUri(promise: Promise) {
        try {
            val prefs = reactContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
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
            reactContext.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
            val prefs = reactContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().putString(KEY_URI, uri.toString()).apply()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SAVE_URI_FAILED", "Failed to save folder URI: ${e.message}")
        }
    }

    @ReactMethod
    fun clearSavedTreeUri(promise: Promise) {
        try {
            val prefs = reactContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().remove(KEY_URI).apply()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CLEAR_URI_FAILED", "Failed to clear saved URI: ${e.message}")
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
        val intent = Intent(reactContext, MessengerMediaActivity::class.java)
        intent.putExtra("appKey", appKey)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        reactContext.startActivity(intent)
    }

    @ReactMethod
    fun listMessengerMediaFolders(appKey: String, promise: Promise) {
        try {
            val baseUri = getSelectedFolderUri(appKey)
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

    private fun findSubDirByPath(root: DocumentFile?, path: List<String>): DocumentFile? {
        var current = root
        for (segment in path) {
            current = current?.listFiles()?.firstOrNull {
                it.isDirectory && it.name.equals(segment, ignoreCase = true)
            }
        }
        return current
    }

    private fun logDocumentTree(dir: DocumentFile, indent: String = "") {
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

    private fun getSelectedFolderUri(appKey: String): Uri {
        val prefs = reactApplicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val uriStr = prefs.getString(KEY_URI, null)
            ?: throw IllegalStateException("No SAF folder selected")
        Log.d("StatusModule", "📥 Loaded persisted URI for app [$appKey]: $uriStr")
        return Uri.parse(uriStr)
    }
}
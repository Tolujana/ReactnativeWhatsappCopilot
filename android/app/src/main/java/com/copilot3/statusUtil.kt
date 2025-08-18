package com.copilot3

import android.app.Activity
import android.content.ContentResolver
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.DocumentsContract
import android.util.Log
import androidx.documentfile.provider.DocumentFile
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object StatusUtil{

    private const val PREFS_NAME = "status_prefs"
    private const val KEY_TREE_URI = "tree_uri"

    fun saveTreeUri(context: Context, uri: Uri) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_TREE_URI, uri.toString())
            .apply()
    }

    fun getSavedTreeUri(context: Context): Uri? {
        val saved = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString(KEY_TREE_URI, null)
        return saved?.let { Uri.parse(it) }
    }

    fun openFolderPicker(activity: Activity, requestCode: Int) {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply {
            putExtra("android.content.extra.SHOW_ADVANCED", true)
        }
        activity.startActivityForResult(intent, requestCode)
    }

    fun listStatuses(context: Context): List<MediaItem> {
        val treeUri = getSavedTreeUri(context)
            ?: throw IllegalStateException("NO_URI")

        val root = DocumentFile.fromTreeUri(context, treeUri)
            ?: return emptyList()

        val result = mutableListOf<MediaItem>()

        fun scanDir(appName: String, folder: DocumentFile) {
            folder.listFiles().forEach { file ->
                if (file.isFile) {
                    val mime = file.type ?: ""
                    val name = file.name ?: ""
                    val size = file.length()
                    val ts = file.lastModified()

                    result.add(
                        MediaItem(
                            uri = file.uri.toString(),
                            name = name,
                            app = appName,
                            size = size,
                            timestamp = ts
                        )
                    )
                } else if (file.isDirectory) {
                    scanDir(appName, file)
                }
            }
        }

        val messengers = listOf(
            "com.whatsapp" to "WhatsApp",
            "com.whatsapp.w4b" to "WhatsApp Business",
            "org.telegram.messenger" to "Telegram"
        )

        messengers.forEach { (packageName, appName) ->
            val folder = root.findFile(packageName)
            folder?.listFiles()?.forEach { sub ->
                if (sub.name?.contains("Media") == true || sub.isDirectory) {
                    scanDir(appName, sub)
                }
            }
        }

        return result
    }

    fun saveFileToGallery(context: Context, sourceUri: Uri): Uri {
        val resolver = context.contentResolver
        val input = resolver.openInputStream(sourceUri) ?: return sourceUri

        val picturesDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES)
        val destDir = File(picturesDir, "StatusSaver").apply { mkdirs() }

        val fileName = "status_${System.currentTimeMillis()}.jpg"
        val outFile = File(destDir, fileName)

        input.use { inp ->
            FileOutputStream(outFile).use { out ->
                inp.copyTo(out)
            }
        }

        return Uri.fromFile(outFile)
    }

    fun deleteFiles(context: Context, uris: List<Uri>): Int {
        var count = 0
        val resolver = context.contentResolver
        uris.forEach { uri ->
            try {
                if (DocumentsContract.deleteDocument(resolver, uri)) {
                    count++
                }
            } catch (e: Exception) {
                Log.w("StatusModule", "Failed to delete $uri", e)
            }
        }
        return count
    }

    fun postToWhatsApp(context: Context, mediaUri: Uri) {
        val shareIntent = Intent().apply {
            action = Intent.ACTION_SEND
            putExtra(Intent.EXTRA_STREAM, mediaUri)
            type = "image/*"
            `package` = "com.whatsapp"
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }

        if (shareIntent.resolveActivity(context.packageManager) != null) {
            context.startActivity(shareIntent)
        } else {
            throw IllegalStateException("WhatsApp not installed")
        }
    }

    data class MediaItem(
        val uri: String,
        val name: String,
        val app: String,
        val size: Long,
        val timestamp: Long
    )
}

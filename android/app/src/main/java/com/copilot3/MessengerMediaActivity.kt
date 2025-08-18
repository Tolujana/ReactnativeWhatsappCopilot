package com.copilot3

import android.app.AlertDialog
import android.net.Uri
import android.os.Bundle
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.documentfile.provider.DocumentFile
import androidx.recyclerview.widget.GridLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.copilot3.MediaItemAdapter
import com.copilot3.model.MediaItem
import com.copilot3.util.AppUriStore

class MessengerMediaActivity : AppCompatActivity() {

    private lateinit var chipGroup: LinearLayout
    private lateinit var recyclerView: RecyclerView
    private lateinit var progressBar: ProgressBar
    private lateinit var deleteButton: ImageButton
    private lateinit var sortButton: ImageButton

    private lateinit var adapter: MediaItemAdapter
    private val allMedia = mutableListOf<MediaItem>()
    private val folders = mutableListOf<String>()
    private var selectedFolder: String? = null
    private var appKey: String = "whatsapp"
    private var sortBySize = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_messenger_media)

        appKey = intent.getStringExtra("appKey") ?: "whatsapp"

        chipGroup = findViewById(R.id.chipGroup)
        recyclerView = findViewById(R.id.recyclerView)
        progressBar = findViewById(R.id.progressBar)
        deleteButton = findViewById(R.id.deleteButton)
        sortButton = findViewById(R.id.sortButton)

        adapter = MediaItemAdapter(this, listOf(), mutableSetOf(), {}, {})
        recyclerView.layoutManager = GridLayoutManager(this, 3)
        recyclerView.adapter = adapter

        deleteButton.setOnClickListener { deleteSelectedItems() }
        sortButton.setOnClickListener {
            sortBySize = !sortBySize
            loadMedia(selectedFolder)
        }

        loadFoldersAndMedia()
    }

    private fun getBaseDir(): DocumentFile? {
        val uri = AppUriStore.getUriForAppKey(appKey)
        return uri?.let { DocumentFile.fromTreeUri(this, it) }
    }

    private fun loadFoldersAndMedia() {
        progressBar.visibility = ProgressBar.VISIBLE
        chipGroup.removeAllViews()
        folders.clear()

        val baseDir = getBaseDir()
        if (baseDir != null && baseDir.isDirectory) {
            baseDir.listFiles().forEach { file ->
                if (file.isDirectory) {
                    folders.add(file.name ?: "Unnamed")
                    val chip = layoutInflater.inflate(R.layout.item_folder_chip, chipGroup, false) as Button
                    chip.text = file.name
                    chip.setOnClickListener {
                        selectedFolder = file.name
                        loadMedia(selectedFolder)
                    }
                    chipGroup.addView(chip)
                }
            }
            if (folders.isNotEmpty()) {
                selectedFolder = folders[0]
                loadMedia(selectedFolder)
            }
        }

        progressBar.visibility = ProgressBar.GONE
    }

    private fun loadMedia(folderName: String?) {
        progressBar.visibility = ProgressBar.VISIBLE
        allMedia.clear()

        val baseDir = getBaseDir()
        val folder = baseDir?.listFiles()?.find { it.name == folderName }

        folder?.listFiles()?.forEach { file ->
            if (!file.isDirectory && file.uri != null && file.length() > 0) {
                allMedia.add(
                    MediaItem(
                        uri = file.uri.toString(),
                        name = file.name ?: "Unknown",
                        mime = file.type ?: "",
                        size = file.length(),
                        timestamp = file.lastModified()
                    )
                )
            }
        }

        val sorted = if (sortBySize) {
            allMedia.sortedByDescending { it.size }
        } else {
            allMedia.sortedByDescending { it.timestamp }
        }

        adapter.setItems(sorted)
        updateDeleteButtonVisibility()

        progressBar.visibility = ProgressBar.GONE
    }

    private fun deleteSelectedItems() {
        val selected = adapter.getSelectedItems()
        if (selected.isEmpty()) return

        AlertDialog.Builder(this)
            .setTitle("Delete")
            .setMessage("Delete ${selected.size} item(s)?")
            .setPositiveButton("Delete") { _, _ ->
                selected.forEach {
                    contentResolver.delete(Uri.parse(it.uri), null, null)
                }
                Toast.makeText(this, "${selected.size} items deleted", Toast.LENGTH_SHORT).show()
                loadMedia(selectedFolder)
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun updateDeleteButtonVisibility() {
        deleteButton.visibility =
            if (adapter.getSelectedItems().isNotEmpty()) ImageButton.VISIBLE else ImageButton.GONE
    }
}

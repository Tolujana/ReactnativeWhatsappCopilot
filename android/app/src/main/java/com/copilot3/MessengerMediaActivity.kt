package com.copilot3

import android.app.Activity
import kotlinx.coroutines.launch
import android.app.DatePickerDialog
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.LayoutInflater
import android.view.MenuItem
import android.view.View
import android.view.ViewGroup
import android.widget.*
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.documentfile.provider.DocumentFile
import androidx.lifecycle.lifecycleScope
import androidx.paging.Pager
import androidx.paging.PagingConfig
import androidx.paging.PagingDataAdapter
import androidx.paging.PagingSource
import androidx.paging.PagingState
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.GridLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.copilot3.databinding.ActivityMessengerMediaBinding
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.AdSize
import com.google.android.gms.ads.AdView
import kotlinx.coroutines.flow.collectLatest
import java.text.SimpleDateFormat
import java.util.*
import android.util.Log

data class MediaItem(
    val uri: String,
    val name: String,
    val size: Long,
    val timestamp: Long,
    val mimeType: String,
    val type: Int = TYPE_MEDIA
) {
    companion object {
        const val TYPE_MEDIA = 0
        const val TYPE_AD = 1
    }
}

class MessengerMediaActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMessengerMediaBinding
    private lateinit var adapter: MediaAdapter
    private var selectedUris = mutableListOf<String>()
    private var appKey: String = ""
    private var folderName: String = ""
    private var minDate: Long = 0
    private var maxDate: Long = Long.MAX_VALUE
    private var minSize: Long = 0
    private var maxSize: Long = Long.MAX_VALUE
    private var currentSort: Pair<String, Boolean> = Pair("date", true) // true=desc

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMessengerMediaBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Extract intent extras
        appKey = intent.getStringExtra("appKey") ?: ""
        folderName = intent.getStringExtra("folderName") ?: ""
        minDate = intent.getLongExtra("minDate", 0)
        maxDate = intent.getLongExtra("maxDate", Long.MAX_VALUE)
        minSize = intent.getLongExtra("minSize", 0)
        maxSize = intent.getLongExtra("maxSize", Long.MAX_VALUE)

        setupRecyclerView()
        setupToolbar()
        setupFab()
        setupEmptyView()
    }

    private fun setupRecyclerView() {
        adapter = MediaAdapter(
            onToggleSelect = { uri, isSelected ->
                if (isSelected) selectedUris.add(uri) else selectedUris.remove(uri)
                updateActionBar()
            },
            onLongPress = { uri ->
                showContextMenu(uri)
            }
        )
        binding.recyclerView.layoutManager = GridLayoutManager(this, 3).apply {
            spanSizeLookup = object : GridLayoutManager.SpanSizeLookup() {
                override fun getSpanSize(position: Int): Int {
                    return if (adapter.getItemViewType(position) == MediaItem.TYPE_AD) 3 else 1
                }
            }
        }
        binding.recyclerView.adapter = adapter

        val pager = Pager(
            config = PagingConfig(pageSize = 30, enablePlaceholders = false),
            pagingSourceFactory = { MediaPagingSource() }
        )
        lifecycleScope.launch {
            pager.flow.collectLatest { pagingData ->
                adapter.submitData(pagingData)
            }
        }
    }

    private fun setupToolbar() {
        binding.toolbar.title = "$folderName - Media"
        setSupportActionBar(binding.toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        binding.toolbar.setNavigationOnClickListener { finishWithResult() }

        // Sort spinner
        val sortSpinner = Spinner(this)
        val sortAdapter = ArrayAdapter.createFromResource(
            this,
            R.array.sort_options,
            android.R.layout.simple_spinner_dropdown_item
        )
        sortSpinner.adapter = sortAdapter
        sortSpinner.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
                when (parent?.getItemAtPosition(position).toString()) {
                    "Date: New-Old" -> currentSort = Pair("date", true)
                    "Date: Old-New" -> currentSort = Pair("date", false)
                    "Size: Big-Small" -> currentSort = Pair("size", true)
                    "Size: Small-Big" -> currentSort = Pair("size", false)
                }
                adapter.refresh()
            }
            override fun onNothingSelected(parent: AdapterView<*>?) {}
        }
        binding.toolbar.addView(sortSpinner, Toolbar.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT))

        binding.saveButton.setOnClickListener {
            finishWithResult()
        }
        binding.deleteButton.setOnClickListener {
            if (selectedUris.isNotEmpty()) {
                AlertDialog.Builder(this)
                    .setTitle("Delete Selected")
                    .setMessage("Delete ${selectedUris.size} item(s)?")
                    .setPositiveButton("Delete") { _, _ ->
                        val intent = Intent().apply {
                            putStringArrayListExtra("deletedUris", ArrayList(selectedUris))
                        }
                        setResult(Activity.RESULT_OK, intent)
                        finish()
                    }
                    .setNegativeButton("Cancel", null)
                    .show()
            }
        }
    }

    private fun setupFab() {
        binding.fab.setOnClickListener {
            showFilterDialog()
        }
    }

    private fun setupEmptyView() {
        binding.emptyView.visibility = View.GONE
        adapter.registerAdapterDataObserver(object : RecyclerView.AdapterDataObserver() {
            override fun onItemRangeInserted(positionStart: Int, itemCount: Int) {
                binding.emptyView.visibility = if (adapter.itemCount == 0) View.VISIBLE else View.GONE
            }
            override fun onItemRangeRemoved(positionStart: Int, itemCount: Int) {
                binding.emptyView.visibility = if (adapter.itemCount == 0) View.VISIBLE else View.GONE
            }
        })
    }

    private fun showFilterDialog() {
        val dialogView = LayoutInflater.from(this).inflate(R.layout.dialog_filter, null)
        val startDateEdit = dialogView.findViewById<TextView>(R.id.startDateEdit)
        val endDateEdit = dialogView.findViewById<TextView>(R.id.endDateEdit)
        val minSizeEdit = dialogView.findViewById<EditText>(R.id.minSizeEdit)
        val maxSizeEdit = dialogView.findViewById<EditText>(R.id.maxSizeEdit)

        startDateEdit.text = if (minDate > 0) SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date(minDate)) else "Select date"
        endDateEdit.text = if (maxDate < Long.MAX_VALUE) SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date(maxDate)) else "Select date"
        minSizeEdit.setText(if (minSize > 0) (minSize / (1024 * 1024)).toString() else "")
        maxSizeEdit.setText(if (maxSize < Long.MAX_VALUE) (maxSize / (1024 * 1024)).toString() else "")

        startDateEdit.setOnClickListener {
            val calendar = Calendar.getInstance()
            if (minDate > 0) calendar.timeInMillis = minDate
            DatePickerDialog(this, { _, year, month, day ->
                calendar.set(year, month, day)
                startDateEdit.text = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(calendar.time)
            }, calendar.get(Calendar.YEAR), calendar.get(Calendar.MONTH), calendar.get(Calendar.DAY_OF_MONTH)).show()
        }

        endDateEdit.setOnClickListener {
            val calendar = Calendar.getInstance()
            if (maxDate < Long.MAX_VALUE) calendar.timeInMillis = maxDate
            DatePickerDialog(this, { _, year, month, day ->
                calendar.set(year, month, day)
                endDateEdit.text = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(calendar.time)
            }, calendar.get(Calendar.YEAR), calendar.get(Calendar.MONTH), calendar.get(Calendar.DAY_OF_MONTH)).show()
        }

        AlertDialog.Builder(this)
            .setTitle("Filter Media")
            .setView(dialogView)
            .setPositiveButton("Apply") { _, _ ->
                minDate = if (startDateEdit.text != "Select date") {
                    SimpleDateFormat("yyyy-MM-dd", Locale.US).parse(startDateEdit.text.toString())?.time ?: 0
                } else 0
                maxDate = if (endDateEdit.text != "Select date") {
                    SimpleDateFormat("yyyy-MM-dd", Locale.US).parse(endDateEdit.text.toString())?.time ?: Long.MAX_VALUE
                } else Long.MAX_VALUE
                minSize = minSizeEdit.text.toString().toLongOrNull()?.times(1024 * 1024) ?: 0
                maxSize = maxSizeEdit.text.toString().toLongOrNull()?.times(1024 * 1024) ?: Long.MAX_VALUE
                adapter.refresh()
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun showContextMenu(uri: String) {
        AlertDialog.Builder(this)
            .setTitle("Action")
            .setItems(arrayOf("Save", "Delete")) { _, which ->
                when (which) {
                    0 -> {
                        val intent = Intent().apply {
                            putStringArrayListExtra("selectedUris", arrayListOf(uri))
                        }
                        setResult(Activity.RESULT_OK, intent)
                        finish()
                    }
                    1 -> {
                        AlertDialog.Builder(this)
                            .setTitle("Delete")
                            .setMessage("Delete this item?")
                            .setPositiveButton("Delete") { _, _ ->
                                val intent = Intent().apply {
                                    putStringArrayListExtra("deletedUris", arrayListOf(uri))
                                }
                                setResult(Activity.RESULT_OK, intent)
                                finish()
                            }
                            .setNegativeButton("Cancel", null)
                            .show()
                    }
                }
            }
            .show()
    }

    private fun finishWithResult() {
        val intent = Intent().apply {
            putStringArrayListExtra("selectedUris", ArrayList(selectedUris))
        }
        setResult(Activity.RESULT_OK, intent)
        finish()
    }

    override fun onOptionsItemSelected(item: MenuItem): Boolean {
        return when (item.itemId) {
            android.R.id.home -> {
                finishWithResult()
                true
            }
            else -> super.onOptionsItemSelected(item)
        }
    }

    private fun updateActionBar() {
        binding.saveButton.isEnabled = selectedUris.isNotEmpty()
        binding.deleteButton.isEnabled = selectedUris.isNotEmpty()
        binding.selectionCount.text = "${selectedUris.size} selected"
        binding.selectionCount.visibility = if (selectedUris.isNotEmpty()) View.VISIBLE else View.GONE
    }

    private fun getSelectedFolderUri(appKey: String): Uri {
        // Replace with your logic to get the base SAF Uri for the appKey
        // Example: Fetch from SharedPreferences or StatusModule
        return Uri.parse("content://com.android.externalstorage.documents/tree/primary%3AWhatsApp") // Placeholder
    }

    private fun appKeyToPackageFolder(appKey: String): String {
        // Map appKey to folder path (e.g., WhatsApp package)
        return when (appKey) {
            "whatsapp" -> "com.whatsapp"
            else -> appKey
        }
    }

    private fun findSubDirByPath(baseDoc: DocumentFile, path: List<String>): DocumentFile? {
        var currentDoc = baseDoc
        for (segment in path) {
            currentDoc = currentDoc.findFile(segment) ?: return null
            if (!currentDoc.isDirectory) return null
        }
        return currentDoc
    }

    inner class MediaPagingSource : PagingSource<Int, MediaItem>() {
        override fun getRefreshKey(state: PagingState<Int, MediaItem>): Int? {
            return state.anchorPosition?.let { anchorPosition ->
                state.closestPageToPosition(anchorPosition)?.prevKey?.plus(1)
                    ?: state.closestPageToPosition(anchorPosition)?.nextKey?.minus(1)
            }
        }

        override suspend fun load(params: LoadParams<Int>): LoadResult<Int, MediaItem> {
            val page = params.key ?: 0
            return try {
                val baseUri = getSelectedFolderUri(appKey)
                val baseDoc = DocumentFile.fromTreeUri(this@MessengerMediaActivity, baseUri)
                if (baseDoc == null || !baseDoc.isDirectory) {
                    return LoadResult.Error(Exception("Base folder not accessible"))
                }

                val mediaPath = listOf(appKeyToPackageFolder(appKey), "WhatsApp", "Media", folderName)
                val folderDoc = findSubDirByPath(baseDoc, mediaPath)
                if (folderDoc == null || !folderDoc.isDirectory) {
                    return LoadResult.Error(Exception("Folder not found"))
                }

                val files: List<DocumentFile> = folderDoc.listFiles().filter { doc: DocumentFile ->
                    doc.isFile
                }.filter { doc: DocumentFile ->
                    minDate == 0L || doc.lastModified() >= minDate
                }.filter { doc: DocumentFile ->
                    maxDate == Long.MAX_VALUE || doc.lastModified() <= maxDate
                }.filter { doc: DocumentFile ->
                    minSize == 0L || doc.length() >= minSize
                }.filter { doc: DocumentFile ->
                    maxSize == Long.MAX_VALUE || doc.length() <= maxSize
                }.sortedWith(Comparator { a: DocumentFile, b: DocumentFile ->
                    when (currentSort.first) {
                        "date" -> if (currentSort.second) b.lastModified().compareTo(a.lastModified()) else a.lastModified().compareTo(b.lastModified())
                        "size" -> if (currentSort.second) b.length().compareTo(a.length()) else a.length().compareTo(b.length())
                        else -> 0
                    }
                })

                val mediaItems: List<MediaItem> = files.mapIndexed { index: Int, doc: DocumentFile ->
                    if ((index + 1) % 18 == 0) {
                        listOf(
                            MediaItem("", "", 0, 0, "", MediaItem.TYPE_AD),
                            MediaItem(doc.uri.toString(), doc.name ?: "", doc.length(), doc.lastModified(), doc.type ?: "")
                        )
                    } else {
                        listOf(MediaItem(doc.uri.toString(), doc.name ?: "", doc.length(), doc.lastModified(), doc.type ?: ""))
                    }
                }.flatten().drop(page * 30).take(30)

                LoadResult.Page(
                    data = mediaItems,
                    prevKey = if (page == 0) null else page - 1,
                    nextKey = if (mediaItems.size < 30) null else page + 1
                )
            } catch (e: Exception) {
                Log.e("MediaPagingSource", "Load error", e)
                LoadResult.Error(e)
            }
        }
    }

    inner class MediaAdapter(
        private val onToggleSelect: (String, Boolean) -> Unit,
        private val onLongPress: (String) -> Unit
    ) : PagingDataAdapter<MediaItem, RecyclerView.ViewHolder>(DIFF_CALLBACK) {

        override fun getItemViewType(position: Int): Int {
            return getItem(position)?.type ?: MediaItem.TYPE_MEDIA
        }

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
            return if (viewType == MediaItem.TYPE_AD) {
                AdViewHolder(
                    AdView(parent.context).apply {
                        layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
                        setAdSize(AdSize.BANNER)
                        adUnitId = "ca-app-pub-3940256099942544/6300978111"
                        loadAd(AdRequest.Builder().build())
                    }
                )
            } else {
                MediaViewHolder(
                    LayoutInflater.from(parent.context).inflate(R.layout.item_media, parent, false)
                )
            }
        }

        override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
            if (holder is MediaViewHolder) {
                val item = getItem(position)
                if (item != null) {
                    holder.bind(item, selectedUris.contains(item.uri))
                }
            }
        }

        inner class MediaViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
            private val imageView: ImageView = itemView.findViewById(R.id.imageView)
            private val videoIcon: TextView = itemView.findViewById(R.id.videoIcon)
            private val sizeText: TextView = itemView.findViewById(R.id.sizeText)
            private val checkBox: CheckBox = itemView.findViewById(R.id.checkbox)

            fun bind(item: MediaItem, isSelected: Boolean) {
                sizeText.text = "${(item.size / (1024 * 1024)).toInt()} MB"

                if (item.mimeType.startsWith("image/")) {
                    Glide.with(imageView.context)
                        .load(item.uri)
                        .placeholder(R.drawable.ic_image_placeholder)
                        .into(imageView)
                    videoIcon.visibility = View.GONE
                } else if (item.mimeType.startsWith("video/")) {
                    imageView.setImageResource(R.drawable.ic_video_placeholder)
                    videoIcon.visibility = View.VISIBLE
                    videoIcon.text = "🎥"
                } else {
                    imageView.setImageResource(R.drawable.ic_image_placeholder)
                    videoIcon.visibility = View.VISIBLE
                    videoIcon.text = if (item.mimeType.startsWith("audio/")) "🎵" else "📄"
                }

                checkBox.isChecked = isSelected
                checkBox.setOnCheckedChangeListener { _, isChecked ->
                    onToggleSelect(item.uri, isChecked)
                }

                itemView.setOnClickListener {
                    if (selectedUris.isNotEmpty()) {
                        checkBox.isChecked = !checkBox.isChecked
                        onToggleSelect(item.uri, checkBox.isChecked)
                    } else {
                        val intent = Intent(Intent.ACTION_VIEW).apply {
                            setDataAndType(Uri.parse(item.uri), item.mimeType)
                            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                        }
                        startActivity(intent)
                    }
                }
                itemView.setOnLongClickListener {
                    onLongPress(item.uri)
                    true
                }
            }
        }

        inner class AdViewHolder(adView: AdView) : RecyclerView.ViewHolder(adView)
    }

    companion object {
        val DIFF_CALLBACK = object : DiffUtil.ItemCallback<MediaItem>() {
            override fun areItemsTheSame(oldItem: MediaItem, newItem: MediaItem): Boolean {
                return oldItem.uri == newItem.uri && oldItem.type == newItem.type
            }

            override fun areContentsTheSame(oldItem: MediaItem, newItem: MediaItem): Boolean {
                return oldItem == newItem
            }
        }
    }
}
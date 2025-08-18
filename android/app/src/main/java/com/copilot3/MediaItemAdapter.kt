package com.copilot3

import android.content.Context
import android.net.Uri
import android.view.*
import android.widget.*
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.copilot3.R
import com.copilot3.model.MediaItem

class MediaItemAdapter(
    private val context: Context,
    private var items: List<MediaItem>,
    private val selectedItems: MutableSet<String>,
    private val onItemClick: (MediaItem) -> Unit,
    private val onItemLongPress: (MediaItem) -> Unit
) : RecyclerView.Adapter<MediaItemAdapter.MediaViewHolder>() {

    fun setItems(newItems: List<MediaItem>) {
        items = newItems
        notifyDataSetChanged()
    }

    fun getSelectedItems(): List<MediaItem> {
        return items.filter { selectedItems.contains(it.uri) }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): MediaViewHolder {
        val view = LayoutInflater.from(context).inflate(R.layout.item_media_thumbnail, parent, false)
        return MediaViewHolder(view)
    }

    override fun onBindViewHolder(holder: MediaViewHolder, position: Int) {
        holder.bind(items[position])
    }

    override fun getItemCount(): Int = items.size

    inner class MediaViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        private val thumbnail: ImageView = view.findViewById(R.id.thumbnail)
        private val checkbox: CheckBox = view.findViewById(R.id.checkbox)
        private val overlayIcon: TextView = view.findViewById(R.id.overlayIcon)

        fun bind(item: MediaItem) {
            val uri = Uri.parse(item.uri)

            overlayIcon.text = when {
                item.isVideo -> "🎥"
                item.isAudio -> "🎵"
                else -> ""
            }

            Glide.with(context).load(uri).centerCrop().into(thumbnail)

            checkbox.isChecked = selectedItems.contains(item.uri)
            checkbox.setOnClickListener {
                if (checkbox.isChecked) selectedItems.add(item.uri)
                else selectedItems.remove(item.uri)
            }

            itemView.setOnClickListener { onItemClick(item) }
            itemView.setOnLongClickListener {
                onItemLongPress(item)
                true
            }
        }
    }
}

package com.copilot3s

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.copilot3.R
import com.copilot3.model.MediaGroup
import com.copilot3.model.MediaItem
import com.copilot3.MediaItemAdapter

class GroupedMediaAdapter(
    private val groups: List<MediaGroup>,
    private val selectedItems: MutableSet<String>,
    private val onItemClick: (MediaItem) -> Unit,
    private val onItemLongClick: (MediaItem) -> Unit
) : RecyclerView.Adapter<GroupedMediaAdapter.GroupViewHolder>() {

    inner class GroupViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val title: TextView = view.findViewById(R.id.groupTitle)
        val recyclerView: RecyclerView = view.findViewById(R.id.groupedRecyclerView)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): GroupViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_grouped_media, parent, false)
        return GroupViewHolder(view)
    }

    override fun onBindViewHolder(holder: GroupViewHolder, position: Int) {
        val group = groups[position]
        holder.title.text = group.title

        holder.recyclerView.layoutManager =
            LinearLayoutManager(holder.itemView.context, LinearLayoutManager.HORIZONTAL, false)

        holder.recyclerView.adapter = MediaItemAdapter(
            holder.itemView.context,
            group.items,
            selectedItems,
            onItemClick,
            onItemLongClick
        )
    }

    override fun getItemCount(): Int = groups.size
}

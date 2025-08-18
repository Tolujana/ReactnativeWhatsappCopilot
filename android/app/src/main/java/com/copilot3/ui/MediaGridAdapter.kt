package com.copilot3.ui

import android.content.Context
import android.net.Uri
import android.view.View
import android.view.ViewGroup
import android.widget.*
import com.bumptech.glide.Glide
import com.bumptech.glide.request.RequestOptions
import com.copilot3.StatusUtil

class MediaGridAdapter(
    private val context: Context,
    private val mediaItems: List<StatusUtil.MediaItem>,
    private val selected: MutableSet<Uri>
) : BaseAdapter() {

    override fun getCount(): Int = mediaItems.size

    override fun getItem(position: Int): Any = mediaItems[position]

    override fun getItemId(position: Int): Long = position.toLong()

    override fun getView(position: Int, convertView: View?, parent: ViewGroup): View {
        val view = convertView ?: LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = AbsListView.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
            setPadding(8, 8, 8, 8)

            val imageView = ImageView(context).apply {
                id = View.generateViewId()
                layoutParams = LinearLayout.LayoutParams(250, 250)
                scaleType = ImageView.ScaleType.CENTER_CROP
            }

            val checkBox = CheckBox(context).apply {
                id = View.generateViewId()
                text = ""
                isClickable = false
                layoutParams = LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                ).apply {
                    topMargin = 6
                    gravity = android.view.Gravity.CENTER_HORIZONTAL
                }
            }

            addView(imageView)
            addView(checkBox)
        }

        val item = mediaItems[position]
        val imageView = (view as LinearLayout).getChildAt(0) as ImageView
        val checkBox = view.getChildAt(1) as CheckBox
        val uri = Uri.parse(item.uri)

        Glide.with(context)
            .load(uri)
            .apply(
                RequestOptions()
                    .placeholder(android.R.drawable.ic_menu_gallery)
                    .centerCrop()
            )
            .into(imageView)

        checkBox.isChecked = selected.contains(uri)

        view.setOnClickListener {
            if (selected.contains(uri)) {
                selected.remove(uri)
            } else {
                selected.add(uri)
            }
            notifyDataSetChanged()
        }

        return view
    }
}

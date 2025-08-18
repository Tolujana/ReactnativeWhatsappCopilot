package com.copilot3.model

data class MediaGroup(
    val title: String,                    // e.g. "April 2024" or "50–100MB"
    val items: List<MediaItem>,          // List of media files in that group
    var collapsed: Boolean = false       // Whether this group is collapsed in UI
)

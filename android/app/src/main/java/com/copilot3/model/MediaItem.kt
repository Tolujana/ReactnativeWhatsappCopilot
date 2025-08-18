package com.copilot3.model

data class MediaItem(
    val uri: String,
    val name: String,
    val mime: String,
    val size: Long,
    val timestamp: Long,
    val isVideo: Boolean = false,
    val isImage: Boolean = false,
    val isAudio: Boolean = false
)

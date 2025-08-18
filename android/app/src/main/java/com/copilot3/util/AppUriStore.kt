package com.copilot3.util

import android.net.Uri

object AppUriStore {
    private val appUris = mapOf(
        "whatsapp" to "content://com.android.externalstorage.documents/tree/primary%3AAndroid%2Fmedia%2Fcom.whatsapp%2FWhatsApp%2FMedia",
        "telegram" to "content://com.android.externalstorage.documents/tree/primary%3AAndroid%2Fmedia%2Forg.telegram.messenger%2FTelegram",
        "business" to "content://com.android.externalstorage.documents/tree/primary%3AAndroid%2Fmedia%2Fcom.whatsapp.w4b%2FWhatsApp%20Business%2FMedia"
    )

    fun getUriForAppKey(appKey: String): Uri? {
        return appUris[appKey]?.let { Uri.parse(it) }
    }
}

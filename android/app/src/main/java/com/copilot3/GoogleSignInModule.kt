package com.copilot3

import android.app.Activity
import android.content.Intent
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInAccount
import com.google.android.gms.auth.api.signin.GoogleSignInClient
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException

class GoogleSignInModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext), ActivityEventListener {

    private var googleSignInClient: GoogleSignInClient? = null
    private var pendingPromise: Promise? = null
    private val RC_SIGN_IN = 9001

    override fun getName(): String { return "GoogleSignInModule" }

    init {
        reactContext.addActivityEventListener(this)
    }

    @ReactMethod
    fun configure(webClientId: String) {
        val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestIdToken(webClientId) // ID token for Firebase (JS) or backend verification
            .requestEmail()
            // note: requestServerAuthCode lets you exchange code on your server for access/refresh tokens
            .requestServerAuthCode(webClientId, true)
            .build()

        val activity: Activity? = currentActivity
        if (activity != null) {
            googleSignInClient = GoogleSignIn.getClient(activity, gso)
        }
    }

    @ReactMethod
    fun signIn(promise: Promise) {
        val activity = currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "Current activity is null")
            return
        }

        if (googleSignInClient == null) {
            promise.reject("NOT_CONFIGURED", "GoogleSignInModule not configured. Call configure(webClientId) first.")
            return
        }

        pendingPromise = promise
        val signInIntent: Intent = googleSignInClient!!.signInIntent
        activity.startActivityForResult(signInIntent, RC_SIGN_IN)
    }

    @ReactMethod
    fun signOut(promise: Promise) {
        if (googleSignInClient == null) {
            promise.reject("NOT_CONFIGURED", "GoogleSignInModule not configured. Call configure(webClientId) first.")
            return
        }
        googleSignInClient!!.signOut().addOnCompleteListener {
            promise.resolve(null)
        }.addOnFailureListener { e ->
            promise.reject("SIGNOUT_FAILED", e.message)
        }
    }

    // ActivityEventListener callbacks
    override fun onActivityResult(activity: Activity?, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode != RC_SIGN_IN) return

        val promise = pendingPromise ?: return
        try {
            val task = GoogleSignIn.getSignedInAccountFromIntent(data)
            val account: GoogleSignInAccount = task.getResult(ApiException::class.java)

            val map = WritableNativeMap().apply {
                putString("idToken", account.idToken)
                putString("serverAuthCode", account.serverAuthCode)
                putString("email", account.email)
                putString("displayName", account.displayName)
                putString("givenName", account.givenName)
                putString("familyName", account.familyName)
                putString("photo", account.photoUrl?.toString())
                putString("userId", account.id)
            }

            pendingPromise = null
            promise.resolve(map)
        } catch (e: ApiException) {
            pendingPromise = null
            val code = e.statusCode
            promise.reject("SIGNIN_FAILED", "Google sign-in failed: ${e.statusCode} - ${e.message}")
        } catch (e: Exception) {
            pendingPromise = null
            promise.reject("UNKNOWN_ERROR", e.message)
        }
    }

    override fun onNewIntent(intent: Intent?) {
        // no-op
    }
}
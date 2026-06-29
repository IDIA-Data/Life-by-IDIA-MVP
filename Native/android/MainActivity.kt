// Path: android/app/src/main/java/com/idia/life/MainActivity.kt
// Replaces: ContentView.swift
// Purpose: Primary WebView container. Registers native hardware plugins and routes
//          incoming idialife:// URIs to the WebView for ACA settlement and OAuth callbacks.
package com.idia.life

import android.content.Intent
import android.os.Bundle
import android.util.Log
import com.getcapacitor.BridgeActivity
import com.idia.life.plugins.health.IDIAHealthPlugin
import com.idia.life.plugins.nfc.IDIANFCPlugin

class MainActivity : BridgeActivity() {

    private val TAG = "IDIAMainActivity"

    override fun onCreate(savedInstanceState: Bundle?) {
        // Register Native Hardware Bridges
        registerPlugin(IDIAHealthPlugin::class.java)
        registerPlugin(IDIANFCPlugin::class.java)
        super.onCreate(savedInstanceState)
    }

    // Catch deep links while the app is active in memory
    // Capacitor's BridgeActivity automatically forwards the intent's data
    // to JavaScript via the appUrlOpen event when super.onNewIntent is called.
    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        if (intent != null) {
            setIntent(intent)
            handleDeepLink(intent)
        }
    }

    // Catch deep links on fresh cold boot
    override fun onResume() {
        super.onResume()
        handleDeepLink(intent)
    }

    private fun handleDeepLink(intent: Intent?) {
        val url = intent?.data ?: return
        Log.d(TAG, "[DEEPLINK_LOG] START: Processing URL: $url")

        if (url.scheme == "idialife") {
            when (url.host) {
                "auth-callback" -> {
                    // OAuth callback from Supabase. Capacitor's appUrlOpen event
                    // (fired automatically when super.onNewIntent runs) delivers
                    // the URL to JavaScript. The deep link listener in App.tsx
                    // extracts access_token/refresh_token from the URL fragment
                    // and calls supabase.auth.setSession() to log the user in.
                    Log.d(TAG, "[DEEPLINK_LOG] ACTION: OAuth auth-callback detected, forwarded to JS layer.")
                }
                "update-password" -> {
                    val fragment = url.fragment
                    if (fragment != null) {
                        val webTarget = "https://life.thebigidia.com/update-password#$fragment"
                        Log.d(TAG, "[DEEPLINK_LOG] ACTION: Redirecting to update-password target")
                        bridge.webView.evaluateJavascript("window.location.href = '$webTarget';", null)
                    }
                }
                // ACA TRANSACTIONAL GATEWAY (QR/URI Fallback for NFC)
                "aca-handshake" -> {
                    Log.d(TAG, "[DEEPLINK_LOG] ACTION: ACA Node Discovered via URI. Passing to Handshake Engine.")
                    bridge.webView.evaluateJavascript(
                        "if(window.onAcaHandshakeInterception){ window.onAcaHandshakeInterception('${url}'); }",
                        null
                    )
                }
            }
        }
        Log.d(TAG, "[DEEPLINK_LOG] END: Handled Deep Link")
    }
}

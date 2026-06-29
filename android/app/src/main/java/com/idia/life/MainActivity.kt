// Path: android/app/src/main/java/com/idia/life/MainActivity.kt
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
        registerPlugin(IDIAHealthPlugin::class.java)
        registerPlugin(IDIANFCPlugin::class.java)
        super.onCreate(savedInstanceState)
    }

    // Capacitor 8 uses non-nullable Intent in this signature
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleDeepLink(intent)
    }

    override fun onResume() {
        super.onResume()
        handleDeepLink(intent)
    }

    private fun handleDeepLink(intent: Intent?) {
        val url = intent?.data ?: return
        Log.d(TAG, "[DEEPLINK_LOG] START: Processing URL: $url")

        // ── ethereum: scheme (EIP-681 from NFC tags) ──
        if (url.scheme == "ethereum") {
            Log.d(TAG, "[DEEPLINK_LOG] ACTION: EIP-681 ethereum: URI detected.")
            val rawUri = intent.dataString ?: url.toString()
            val encodedUri = java.net.URLEncoder.encode(rawUri, "UTF-8")
            bridge.webView.evaluateJavascript(
                """
                (function() {
                    var uri = decodeURIComponent('$encodedUri');
                    console.log('[NFC] ethereum: URI forwarded to JS:', uri);
                    window.dispatchEvent(new CustomEvent('nfc-payment', { detail: uri }));
                })();
                """.trimIndent(),
                null
            )
            Log.d(TAG, "[DEEPLINK_LOG] END: Forwarded ethereum: URI to JS")
            return
        }

        // ── idialife:// scheme ──
        if (url.scheme == "idialife") {
            when (url.host) {
                "auth-callback" -> {
    Log.d(TAG, "[DEEPLINK_LOG] OAuth callback received")
    val fragment = url.fragment ?: ""
    val query = url.query ?: ""
    val fullUrl = intent?.dataString ?: url.toString()
    Log.d(TAG, "[DEEPLINK_LOG] Full URL: $fullUrl")
    Log.d(TAG, "[DEEPLINK_LOG] Fragment: $fragment")

    // Forward the full URL to JS so Capacitor App plugin and our custom handler both fire
    bridge.webView.evaluateJavascript(
        """
        (function() {
            console.log('[OAUTH] Deep link received in JS: $fullUrl');
            window.dispatchEvent(new CustomEvent('oauth-callback', { 
                detail: { url: '$fullUrl', fragment: '$fragment', query: '$query' }
            }));
        })();
        """.trimIndent(),
        null
    )
}
                "update-password" -> {
                    val fragment = url.fragment
                    if (fragment != null) {
                        val webTarget = "https://life.thebigidia.com/update-password#$fragment"
                        bridge.webView.evaluateJavascript("window.location.href = '$webTarget';", null)
                    }
                }
                "aca-handshake" -> {
                    bridge.webView.evaluateJavascript(
                        "if(window.onAcaHandshakeInterception){ window.onAcaHandshakeInterception('$url'); }",
                        null
                    )
                }
                "pay" -> {
                    Log.d(TAG, "[DEEPLINK_LOG] ACTION: NFC Payment URI detected. Forwarding to JS.")
                    val encodedUri = java.net.URLEncoder.encode(url.toString(), "UTF-8")
                    bridge.webView.evaluateJavascript(
                        """
                        (function() {
                            var uri = decodeURIComponent('$encodedUri');
                            console.log('[NFC] idialife://pay URI forwarded to JS:', uri);
                            window.dispatchEvent(new CustomEvent('nfc-payment', { detail: uri }));
                        })();
                        """.trimIndent(),
                        null
                    )
                }
            }
        }

        Log.d(TAG, "[DEEPLINK_LOG] END: Handled Deep Link")
    }
}
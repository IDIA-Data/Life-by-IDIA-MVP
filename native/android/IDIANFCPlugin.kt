//Path: android/app/src/main/java/com/idia/life/plugins/nfc/IDIANFCPlugin.kt
//Replaces: NFCManager.swift
//Purpose: This is the strictly-transactional terminal interface. It intercepts physical proximity interactions, extracts the payload, and signs it with the ACA Hash and Base Signature.
package com.idia.life.plugins.nfc

import android.nfc.NdefMessage
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.tech.Ndef
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.time.Instant

@CapacitorPlugin(name = "IDIANFC")
class IDIANFCPlugin : Plugin(), NfcAdapter.ReaderCallback {

    private val TAG = "IDIANFCPlugin"
    private var nfcAdapter: NfcAdapter? = null
    private var pendingCall: PluginCall? = null

    // Lineage-locked ACA and Payment Signature
    private var activeAcaHash: String = "NON_TRANSACTIONAL"
    private var activeBaseSignature: String = "pending_signature"

    override fun load() {
        super.load()
        nfcAdapter = NfcAdapter.getDefaultAdapter(context)
    }

    @PluginMethod
    fun beginHandshake(call: PluginCall) {
        Log.d(TAG, "\uD83D\uDFDC [BEGIN: NFCManager.beginHandshake] Activating CoreNFC Reader Session")

        val config = call.getObject("config", JSObject())
        activeAcaHash = config?.getString("aca_hash") ?: "NON_TRANSACTIONAL"
        activeBaseSignature = config?.getString("base_signature") ?: "pending_signature"

        Log.d(TAG, "\uD83D\uDFDC [PROCESS: NFCManager.beginHandshake] Transaction Lineage: [${activeAcaHash.take(12)}...]")

        if (nfcAdapter == null || !nfcAdapter!!.isEnabled) {
            Log.e(TAG, "\uD83D\uDEA8 [FAIL: NFCManager.beginHandshake] ERROR: Hardware unsupported or disabled.")
            return call.reject("NFC Hardware unsupported or disabled.")
        }

        pendingCall = call
        val flags = NfcAdapter.FLAG_READER_NFC_A or NfcAdapter.FLAG_READER_NFC_B or NfcAdapter.FLAG_READER_NFC_F or NfcAdapter.FLAG_READER_NFC_V
        activity.runOnUiThread { nfcAdapter?.enableReaderMode(activity, this, flags, null) }
    }

    override fun onTagDiscovered(tag: Tag?) {
        val ndef = Ndef.get(tag)
        if (ndef == null) {
            Log.e(TAG, "[FAIL: NFCManager.onTagDiscovered] ERROR: Tag is not NDEF formatted.")
            return
        }

        try {
            ndef.connect()
            val ndefMessage: NdefMessage? = ndef.ndefMessage
            if (ndefMessage == null || ndefMessage.records.isEmpty()) {
                Log.e(TAG, "\uD83D\uDEA8 [FAIL: NFCManager.onTagDiscovered] ERROR: Empty Payload.")
                return
            }

            // Extract terminal payload (skipping Android language codes)
            val payloadBytes = ndefMessage.records[0].payload
            val textEncoding = if ((payloadBytes[0].toInt() and 128) == 0) Charsets.UTF_8 else Charsets.UTF_16
            val languageCodeLength = (payloadBytes[0].toInt() and 51)
            val scannedPayload = String(payloadBytes, languageCodeLength + 1, payloadBytes.size - languageCodeLength - 1, textEncoding)

            Log.d(TAG, "\uD83D\uDFDC [PROCESS: NFCManager.onTagDiscovered] Terminal Payload Captured: $scannedPayload")

            val responseDict = JSObject().apply {
                put("scanned_intent", scannedPayload)
                put("aca_hash", activeAcaHash)
                put("base_signature", activeBaseSignature)
                put("timestamp", Instant.now().toString())
            }

            triggerHapticFeedback()

            activity.runOnUiThread {
                pendingCall?.resolve(JSObject().put("payload", responseDict.toString()))
                nfcAdapter?.disableReaderMode(activity)
                Log.d(TAG, "\uD83D\uDFDC [END: NFCManager.onTagDiscovered] Transmitting Omni-Payload to WebView Bridge.")
            }

        } catch (e: Exception) {
            Log.e(TAG, "\uD83D\uDEA8 [FAIL: NFCManager.onTagDiscovered] ERROR: ${e.message}")
            activity.runOnUiThread { pendingCall?.reject(e.message) }
        } finally {
            try { ndef.close() } catch (e: Exception) { }
        }
    }

    private fun triggerHapticFeedback() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vibratorManager = context.getSystemService(android.content.Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
            vibratorManager.defaultVibrator.vibrate(VibrationEffect.createPredefined(VibrationEffect.EFFECT_CLICK))
        } else {
            val vibrator = context.getSystemService(android.content.Context.VIBRATOR_SERVICE) as Vibrator
            vibrator.vibrate(VibrationEffect.createOneShot(50, VibrationEffect.DEFAULT_AMPLITUDE))
        }
    }
}
//Path: android/app/src/main/java/com/idia/life/plugins/health/IDIAHealthPlugin.kt
//Replaces: HealthKitManager.swift, IDIAHealthPlugin.swift, IDIAHealthPlugin.m
//Purpose: Handles background telemetry ingestion to the user's private vault (NO ACA REQUIRED) and executes the 40Hz / 100% brightness hardware overrides.
package com.idia.life.plugins.health

import android.content.Intent
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTrack
import android.net.Uri
import android.os.Build
import android.util.Log
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.*
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.temporal.ChronoUnit
import kotlin.math.sin

@CapacitorPlugin(name = "IDIAHealth")
class IDIAHealthPlugin : Plugin() {

    private val TAG = "IDIAHealthPlugin"
    private var healthClient: HealthConnectClient? = null
    private val scope = CoroutineScope(Dispatchers.IO)
    
    // Hardware State
    private var audioTrack: AudioTrack? = null
    private var originalBrightness: Float = -1.0f

    private val PERMISSIONS = setOf(
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.getReadPermission(HeartRateRecord::class),
        HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class),
        HealthPermission.getReadPermission(SleepSessionRecord::class),
        HealthPermission.getReadPermission(DistanceRecord::class),
        HealthPermission.getReadPermission(WeightRecord::class),
        HealthPermission.getReadPermission(HeightRecord::class),
    )

    override fun load() {
        super.load()
        try {
            val status = HealthConnectClient.getSdkStatus(context, "com.google.android.apps.healthdata")
            if (status == HealthConnectClient.SDK_AVAILABLE) {
                healthClient = HealthConnectClient.getOrCreate(context)
                Log.d(TAG, "Health Connect client initialized")
            }
        } catch (e: Exception) { Log.e(TAG, "Failed to init: ${e.message}") }
    }

    // ─── HARDWARE OVERRIDES (GAMMA & LIVENESS) ─────────────────────────────
    @PluginMethod
    fun triggerHardwareAction(call: PluginCall) {
        val action = call.getString("action") ?: return call.reject("Missing hardware action")

        activity.runOnUiThread {
            if (action == "CMD_INIT_FLASHBULB") {
                // Force 100% Brightness
                val window = activity.window
                val layoutParams = window.attributes
                originalBrightness = layoutParams.screenBrightness
                layoutParams.screenBrightness = 1.0f
                window.attributes = layoutParams

                setupAndStart40HzAudio()
                Log.d(TAG, "\uD83C\uDF4F [GAMMA_TRIGGER] 40Hz sequence initiated.")
                call.resolve(JSObject().put("status", "active"))
                
            } else if (action == "CMD_TERMINATE_FLASHBULB") {
                // Restore Brightness
                if (originalBrightness != -1.0f) {
                    val window = activity.window
                    val layoutParams = window.attributes
                    layoutParams.screenBrightness = originalBrightness
                    window.attributes = layoutParams
                }
                stopAudio()
                Log.d(TAG, "\uD83C\uDF4F [GAMMA_TRIGGER] Sequence terminated.")
                call.resolve(JSObject().put("status", "restored"))
            }
        }
    }

    private fun setupAndStart40HzAudio() {
        val sampleRate = 44100
        val frequency = 40.0
        val numSamples = sampleRate
        val generatedSnd = ByteArray(2 * numSamples)

        for (i in 0 until numSamples) {
            val dVal = sin(2.0 * Math.PI * i / (sampleRate / frequency))
            val valShort = (dVal * 32767).toInt().toShort()
            generatedSnd[2 * i] = (valShort.toInt() and 0x00ff).toByte()
            generatedSnd[2 * i + 1] = ((valShort.toInt() and 0xff00) ushr 8).toByte()
        }

        audioTrack = AudioTrack(
            AudioManager.STREAM_MUSIC, sampleRate, AudioFormat.CHANNEL_OUT_MONO,
            AudioFormat.ENCODING_PCM_16BIT, generatedSnd.size, AudioTrack.MODE_STATIC
        )
        audioTrack?.write(generatedSnd, 0, generatedSnd.size)
        // Loop the buffer indefinitely (loopCount = -1)
        audioTrack?.setLoopPoints(0, generatedSnd.size / 2, -1)
        audioTrack?.play()
    }

    private fun stopAudio() {
        audioTrack?.stop()
        audioTrack?.release()
        audioTrack = null
    }

    // ─── PASSIVE VAULT SYNC (NON-TRANSACTIONAL, NO ACA) ────────────────────
    @PluginMethod
    fun triggerHealthDataSync(call: PluginCall) {
        val config = call.getObject("config")
        val userId = config?.getString("user_id") ?: "unknown_principal"
        val sessionId = config?.getString("sync_session_id") ?: "manual_sync"
        
        Log.d(TAG, "🍏 [SYNC_TRACE] Initiating passive vault sync for: $userId")
        val client = healthClient ?: return call.reject("Health Connect not available")

        val startTime = try { Instant.parse(call.getString("startDate")) } catch (e: Exception) { Instant.now().minus(1, ChronoUnit.DAYS) }
        val endTime = try { Instant.parse(call.getString("endDate")) } catch (e: Exception) { Instant.now() }
        val timeRange = TimeRangeFilter.between(startTime, endTime)

        scope.launch {
            try {
                val payload = JSObject()
                payload.put("user_id", userId)
                payload.put("device_type", Build.MODEL)
                payload.put("source", "android_health_connect")
                payload.put("recorded_at", Instant.now().toString())
                
                val metrics = JSObject()

                try { val r = client.readRecords(ReadRecordsRequest(StepsRecord::class, timeRangeFilter = timeRange)); metrics.put("steps", r.records.sumOf { it.count }) } catch (e: Exception) {}
                try { val r = client.readRecords(ReadRecordsRequest(HeartRateRecord::class, timeRangeFilter = timeRange)); r.records.flatMap { it.samples }.maxByOrNull { it.time }?.let { metrics.put("heartRate", it.beatsPerMinute) } } catch (e: Exception) {}
                try { val r = client.readRecords(ReadRecordsRequest(ActiveCaloriesBurnedRecord::class, timeRangeFilter = timeRange)); metrics.put("calories", r.records.sumOf { it.energy.inKilocalories }.toInt()) } catch (e: Exception) {}
                try { val r = client.readRecords(ReadRecordsRequest(SleepSessionRecord::class, timeRangeFilter = timeRange)); metrics.put("sleepHours", Math.round(r.records.sumOf { it.endTime.toEpochMilli() - it.startTime.toEpochMilli() } / 3600000.0 * 10) / 10.0) } catch (e: Exception) {}
                
                payload.put("healthData", metrics)
                Log.d(TAG, "🍏 [SYNC_END] Telemetry collected. Returning to bridge.")
                
                call.resolve(payload)

                activity.runOnUiThread {
                    bridge.webView?.evaluateJavascript("if(window.onHealthDataSyncComplete){ window.onHealthDataSyncComplete({ sync_session_id: '$sessionId', status: 'vaulted' }); }", null)
                }
            } catch (e: Exception) {
                Log.e(TAG, "🚨 [SYNC_ERROR] ${e.message}")
                call.reject("Sync Failed: ${e.message}")
            }
        }
    }

    // Standard Permissions Boilerplate
    @PluginMethod
    override fun requestPermissions(call: PluginCall) {
        val client = healthClient ?: return call.resolve(JSObject().put("granted", false))
        scope.launch {
            try {
                val missing = PERMISSIONS - client.permissionController.getGrantedPermissions()
                if (missing.isEmpty()) call.resolve(JSObject().put("granted", true))
                else {
                    activity.runOnUiThread {
                        val intent = Intent("androidx.health.ACTION_MANAGE_HEALTH_PERMISSIONS")
                        intent.putExtra(Intent.EXTRA_PACKAGE_NAME, context.packageName)
                        activity.startActivity(intent)
                        call.resolve(JSObject().put("granted", true))
                    }
                }
            } catch (e: Exception) { call.resolve(JSObject().put("granted", false)) }
        }
    }

    @PluginMethod
    override fun checkPermissions(call: PluginCall) {
        val client = healthClient ?: return call.resolve(JSObject().put("granted", false))
        scope.launch {
            try {
                val granted = client.permissionController.getGrantedPermissions()
                call.resolve(JSObject().put("granted", granted.containsAll(PERMISSIONS)))
            } catch (e: Exception) { call.resolve(JSObject().put("granted", false)) }
        }
    }
}
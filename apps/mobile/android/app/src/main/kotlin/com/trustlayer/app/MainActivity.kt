package com.trustlayer.app

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import java.io.File
import java.io.FileOutputStream

/**
 * Host activity: wires the interception bridge to the Flutter engine and hands
 * over the ways a message or screenshot can arrive from outside the app UI.
 *
 *  * `ACTION_SEND` (`text/plain`) — the user shares suspicious text (WhatsApp,
 *    browser, SMS) straight into TrustLayer from any app's share sheet;
 *  * `ACTION_SEND` (`image/*`) — the user shares a suspicious screenshot or
 *    receipt image (e.g. EasyPaisa / JazzCash / bank alert) for RAM OCR;
 *  * notification tap — the user taps a TrustLayer warning to see the analysis.
 *
 * All are delivered to the running app when it exists, and otherwise held for
 * the app's first frame (see [InterceptionBridge.takePendingShare]).
 */
class MainActivity : FlutterActivity() {

    companion object {
        const val EXTRA_INTERCEPTED_TEXT = "intercepted_text"
        const val EXTRA_INTERCEPTED_SENDER = "intercepted_sender"
        private const val MAX_SHARED_IMAGE_BYTES = 8L * 1024L * 1024L
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        InterceptionBridge.attach(flutterEngine.dartExecutor.binaryMessenger)
            .setMethodCallHandler { call, result ->
                InterceptionBridge.handle(call, this, result)
            }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        handleIncomingIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleIncomingIntent(intent)
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        InterceptionBridge.notifyPermissionResult(this)
    }

    private fun handleIncomingIntent(intent: Intent?) {
        if (intent == null) return

        val tapped = intent.getStringExtra(EXTRA_INTERCEPTED_TEXT)
        if (!tapped.isNullOrBlank()) {
            deliver(tapped, intent.getStringExtra(EXTRA_INTERCEPTED_SENDER), "notification-tap")
            return
        }

        if (Intent.ACTION_SEND == intent.action) {
            val mime = intent.type ?: ""
            if (mime == "text/plain") {
                val shared = intent.getStringExtra(Intent.EXTRA_TEXT)
                if (!shared.isNullOrBlank()) deliver(shared, null, "share")
            } else if (mime.startsWith("image/")) {
                val streamUri: Uri? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
                } else {
                    @Suppress("DEPRECATION")
                    intent.getParcelableExtra(Intent.EXTRA_STREAM)
                }
                if (streamUri != null) {
                    val cachedPath = copySharedImageToCache(streamUri, mime)
                    if (cachedPath != null) {
                        deliverImage(cachedPath, "share-image")
                    }
                }
            }
        }
    }

    private fun copySharedImageToCache(uri: Uri, mime: String): String? {
        return try {
            val ext = when {
                mime.contains("png") -> "png"
                mime.contains("webp") -> "webp"
                else -> "jpg"
            }
            val outFile = File(cacheDir, "shared_scan_${System.currentTimeMillis()}.$ext")
            contentResolver.openInputStream(uri)?.use { input ->
                FileOutputStream(outFile).use { output ->
                    val buffer = ByteArray(8192)
                    var total = 0L
                    while (true) {
                        val read = input.read(buffer)
                        if (read <= 0) break
                        total += read
                        if (total > MAX_SHARED_IMAGE_BYTES) {
                            outFile.delete()
                            return null
                        }
                        output.write(buffer, 0, read)
                    }
                }
            } ?: return null
            outFile.absolutePath
        } catch (_: Exception) {
            null
        }
    }

    private fun deliver(text: String, sender: String?, source: String) {
        val payload = mapOf("text" to text, "sender" to sender, "source" to source)
        InterceptionBridge.setPendingShare(payload)
        InterceptionBridge.dispatch(
            context = this,
            event = "onSharedTextReceived",
            payload = payload,
            bufferOnFailure = false,
            onSuccess = { InterceptionBridge.clearPendingShare() },
        )
    }

    private fun deliverImage(imagePath: String, source: String) {
        val payload = mapOf(
            "text" to "",
            "imagePath" to imagePath,
            "sender" to null,
            "source" to source,
        )
        InterceptionBridge.setPendingShare(payload)
        InterceptionBridge.dispatch(
            context = this,
            event = "onSharedImageReceived",
            payload = payload,
            bufferOnFailure = false,
            onSuccess = { InterceptionBridge.clearPendingShare() },
        )
    }

    override fun onDestroy() {
        InterceptionBridge.detach()
        super.onDestroy()
    }
}

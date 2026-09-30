package com.trustlayer.app

import android.content.Intent
import android.os.Bundle
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine

/**
 * Host activity: wires the interception bridge to the Flutter engine and hands
 * over the two ways a message can arrive from outside the app UI.
 *
 *  * `ACTION_SEND` — the user shares suspicious text (WhatsApp, browser, SMS)
 *    straight into TrustLayer from any app's share sheet;
 *  * notification tap — the user taps a TrustLayer warning to see the analysis.
 *
 * Both are delivered to the running app when it exists, and otherwise held for
 * the app's first frame (see [InterceptionBridge.takePendingShare]).
 */
class MainActivity : FlutterActivity() {

    companion object {
        const val EXTRA_INTERCEPTED_TEXT = "intercepted_text"
        const val EXTRA_INTERCEPTED_SENDER = "intercepted_sender"
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
        // The user may have just granted SMS or notification access; the UI needs
        // to re-render its protection state immediately rather than on next launch.
        InterceptionBridge.notifyPermissionResult(this)
    }

    private fun handleIncomingIntent(intent: Intent?) {
        if (intent == null) return

        val tapped = intent.getStringExtra(EXTRA_INTERCEPTED_TEXT)
        if (!tapped.isNullOrBlank()) {
            deliver(tapped, intent.getStringExtra(EXTRA_INTERCEPTED_SENDER), "notification-tap")
            return
        }

        if (Intent.ACTION_SEND == intent.action && intent.type == "text/plain") {
            val shared = intent.getStringExtra(Intent.EXTRA_TEXT)
            if (!shared.isNullOrBlank()) deliver(shared, null, "share")
        }
    }

    private fun deliver(text: String, sender: String?, source: String) {
        val payload = mapOf("text" to text, "sender" to sender, "source" to source)
        // Held in memory until the app has actually consumed it, so a share that
        // arrives during cold start is never analysed twice nor silently lost.
        InterceptionBridge.setPendingShare(payload)
        InterceptionBridge.dispatch(
            context = this,
            event = "onSharedTextReceived",
            payload = payload,
            bufferOnFailure = false, // pendingShare already covers the cold start
            onSuccess = { InterceptionBridge.clearPendingShare() },
        )
    }

    override fun onDestroy() {
        InterceptionBridge.detach()
        super.onDestroy()
    }
}

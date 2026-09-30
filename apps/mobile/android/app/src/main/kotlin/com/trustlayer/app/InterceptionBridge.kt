package com.trustlayer.app

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel

/**
 * Bridge between the OS-level interceptors and the Flutter UI.
 *
 * Responsibilities:
 *  * push an intercepted message into the running app (so it can be analysed and
 *    shown), and fall back to the durable [InterceptionStore] when the app is not
 *    running — a broadcast receiver must never assume an engine exists;
 *  * expose the *real* protection state (runtime permissions, notification
 *    access) so the UI can tell the user the truth about whether they are
 *    protected, instead of showing a permanent "protected" badge.
 */
object InterceptionBridge {

    const val CHANNEL = "com.trustlayer.app/interception"

    private const val REQ_SMS_PERMISSION = 4101

    private var channel: MethodChannel? = null

    /** Share-target / notification-tap payload captured before Dart was ready. */
    private var pendingShare: Map<String, Any?>? = null

    fun attach(messenger: BinaryMessenger): MethodChannel {
        val created = MethodChannel(messenger, CHANNEL)
        channel = created
        return created
    }

    fun detach() {
        channel = null
    }

    fun setPendingShare(payload: Map<String, Any?>) {
        pendingShare = payload
    }

    fun clearPendingShare() {
        pendingShare = null
    }

    /** Hands the cold-start payload to the app exactly once. */
    fun takePendingShare(): Map<String, Any?>? {
        val value = pendingShare
        pendingShare = null
        return value
    }

    /**
     * Deliver an interception to the app.
     *
     * The Dart side answers with `true` once it has accepted the event. Any other
     * outcome (no engine, no registered handler, an error) means "nobody is
     * listening", so the message is buffered for the next app start instead of
     * being dropped — unless the caller already queued it elsewhere
     * (`bufferOnFailure = false`, used by activity intents whose payload is held
     * in [pendingShare] for the cold-start handshake instead).
     */
    fun dispatch(
        context: Context,
        event: String,
        payload: Map<String, Any?>,
        bufferOnFailure: Boolean = true,
        onSuccess: (() -> Unit)? = null,
        onUnhandled: (() -> Unit)? = null,
    ) {
        val ch = channel
        if (ch == null) {
            if (bufferOnFailure) buffer(context, payload)
            onUnhandled?.invoke()
            return
        }
        val appContext = context.applicationContext
        ch.invokeMethod(event, payload, object : MethodChannel.Result {
            override fun success(result: Any?) {
                if (result == true) {
                    onSuccess?.invoke()
                } else {
                    if (bufferOnFailure) buffer(appContext, payload)
                    onUnhandled?.invoke()
                }
            }

            override fun error(errorCode: String, errorMessage: String?, errorDetails: Any?) {
                if (bufferOnFailure) buffer(appContext, payload)
                onUnhandled?.invoke()
            }

            override fun notImplemented() {
                if (bufferOnFailure) buffer(appContext, payload)
                onUnhandled?.invoke()
            }
        })
    }

    private fun buffer(context: Context, payload: Map<String, Any?>) {
        InterceptionStore.enqueue(
            context,
            payload["text"] as? String ?: "",
            payload["sender"] as? String,
            payload["source"] as? String ?: "unknown",
        )
    }


    fun hasSmsPermission(context: Context): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.RECEIVE_SMS) ==
            PackageManager.PERMISSION_GRANTED

    private fun notificationsEnabled(context: Context): Boolean {
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(context, "android.permission.POST_NOTIFICATIONS") !=
            PackageManager.PERMISSION_GRANTED
        ) {
            return false
        }
        return NotificationManagerCompat.from(context).areNotificationsEnabled()
    }

    /** Notification access is granted in system settings, never by a dialog. */
    fun isNotificationListenerEnabled(context: Context): Boolean {
        val enabled = Settings.Secure.getString(
            context.contentResolver,
            "enabled_notification_listeners",
        ) ?: return false
        return enabled.split(":").any { it.contains(context.packageName) }
    }

    fun statusMap(context: Context): Map<String, Any?> = mapOf(
        "sms" to hasSmsPermission(context),
        "notifications" to notificationsEnabled(context),
        "notificationAccess" to isNotificationListenerEnabled(context),
        "quietMode" to InterceptionStore.isQuietModeEnabled(context),
        "pendingInterceptions" to InterceptionStore.pendingCount(context),
        "platformVersion" to Build.VERSION.SDK_INT,
    )


    /** Handles the Dart → platform commands used by the protection screens. */
    fun handle(call: MethodCall, activity: Activity?, result: MethodChannel.Result) {
        val context: Context? = activity
        when (call.method) {
            "getInitialInterceptedText" -> result.success(takePendingShare())

            "drainPendingInterceptions" -> {
                if (context == null) result.success(emptyList<Map<String, Any?>>())
                else result.success(InterceptionStore.drain(context))
            }

            "getProtectionStatus" -> {
                if (context == null) result.success(null) else result.success(statusMap(context))
            }

            "requestSmsPermission" -> {
                val granted = activity != null && hasSmsPermission(activity)
                if (!granted && activity != null) {
                    ActivityCompat.requestPermissions(
                        activity,
                        arrayOf(Manifest.permission.RECEIVE_SMS),
                        REQ_SMS_PERMISSION,
                    )
                }
                result.success(granted)
            }

            "requestNotificationPermission" -> {
                val needed = Build.VERSION.SDK_INT >= 33
                if (needed && activity != null &&
                    ContextCompat.checkSelfPermission(activity, "android.permission.POST_NOTIFICATIONS") !=
                    PackageManager.PERMISSION_GRANTED
                ) {
                    ActivityCompat.requestPermissions(
                        activity,
                        arrayOf("android.permission.POST_NOTIFICATIONS"),
                        REQ_SMS_PERMISSION + 1,
                    )
                }
                result.success(!needed)
            }

            "openNotificationListenerSettings" -> {
                startSafely(activity, Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
                result.success(true)
            }

            "openAppNotificationSettings" -> {
                val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                        .putExtra(Settings.EXTRA_APP_PACKAGE, context?.packageName)
                } else {
                    Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
                        .setData(Uri.fromParts("package", context?.packageName, null))
                }
                startSafely(activity, intent)
                result.success(true)
            }

            "openBatteryOptimizationSettings" -> {
                // Aggressive OEM power management can delay interception on some
                // devices; this lets the user exempt TrustLayer.
                startSafely(activity, Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
                result.success(true)
            }

            "setQuietMode" -> {
                val enabled = call.argument<Boolean>("enabled") ?: false
                if (context != null) InterceptionStore.setQuietMode(context, enabled)
                result.success(enabled)
            }

            "showTestAlert" -> {
                if (context == null) {
                    result.success(false)
                } else {
                    ThreatAlerts.show(
                        context,
                        sender = "+92 300 0000000",
                        preview = "Dear customer, your account will be blocked in 24 hours. " +
                            "Verify at http://verify-acct-alert.xyz and share your OTP.",
                        reasons = listOf(
                            "Claims your account, card or SIM is blocked/suspended",
                            "Asks you to share a PIN, OTP, password or card number",
                        ),
                        riskLevel = "HIGH",
                    )
                    result.success(true)
                }
            }

            else -> result.notImplemented()
        }
    }

    /** Reports the outcome of a runtime permission dialog straight back to Dart. */
    fun notifyPermissionResult(activity: Activity) {
        channel?.invokeMethod("onProtectionStatusChanged", statusMap(activity))
    }

    private fun startSafely(activity: Activity?, intent: Intent) {
        if (activity == null) return
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        try {
            activity.startActivity(intent)
        } catch (_: Exception) {
            // Some OEM ROMs remove these settings screens; failing to open a
            // settings page must never crash the app.
        }
    }
}

package com.trustlayer.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

/**
 * The user-facing warning shown when a scam message is intercepted.
 *
 * One place builds every alert so the SMS path and the notification path look and
 * behave identically: high-importance heads-up (so it interrupts the user *before*
 * they tap the link), vibration, the reason it was flagged, and a tap target that
 * opens the full analysis inside TrustLayer.
 */
object ThreatAlerts {

    const val CHANNEL_ID = "trustlayer_threat_channel"
    private const val CHANNEL_NAME = "TrustLayer Scam Alerts"
    private const val NOTIFICATION_ID_BASE = 9100

    fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (manager.getNotificationChannel(CHANNEL_ID) != null) return
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Warnings about scam messages and links TrustLayer intercepted on your device"
                enableVibration(true)
                setShowBadge(true)
            }
        )
    }

    /**
     * Post the interception warning.
     *
     * @param sender  who the message appeared to come from (already shortened)
     * @param preview message body preview shown inside the expanded alert
     * @param reasons why the on-device engine flagged it
     */
    fun show(
        context: Context,
        sender: String?,
        preview: String,
        reasons: List<String>,
        riskLevel: String,
    ) {
        // Notifications are a user-controlled channel: if they were denied (or the
        // user disabled them later) we must not throw, we just skip the alert.
        if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) return

        ensureChannel(context)

        val from = if (sender.isNullOrBlank()) "an unknown sender" else sender
        val title = when (riskLevel) {
            "CRITICAL" -> "Stop — likely scam from $from"
            "HIGH" -> "Warning — suspicious message from $from"
            else -> "Careful — message from $from may be a scam"
        }

        val why = reasons.take(3).joinToString("\n• ", prefix = "• ")
        val body = "Do not reply, click links or share OTPs/PINs.\n\nWhy:\n$why"

        val launchIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra(MainActivity.EXTRA_INTERCEPTED_TEXT, preview)
            putExtra(MainActivity.EXTRA_INTERCEPTED_SENDER, sender)
        }

        val flags = PendingIntent.FLAG_UPDATE_CURRENT or
            (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
        val pendingIntent = PendingIntent.getActivity(
            context,
            (System.currentTimeMillis() % 10_000).toInt(),
            launchIntent,
            flags
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_sys_warning)
            .setContentTitle(title)
            .setContentText("TrustLayer flagged this message before you opened it.")
            .setStyle(NotificationCompat.BigTextStyle().bigText("$body\n\n\"" + preview.take(160) + "\""))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        NotificationManagerCompat.from(context)
            .notify(NOTIFICATION_ID_BASE + (System.currentTimeMillis() % 1000).toInt(), notification)
    }
}

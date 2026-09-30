package com.trustlayer.app

import android.app.Notification
import android.content.Context
import android.os.Build
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

/**
 * Notification interception — layer 2 of 3.
 *
 * Most scams in the wild never arrive as an SMS: they come as a WhatsApp message
 * from an unknown number, a Telegram "investment group" invite, an Instagram DM
 * or a fake bank notification. Those never touch the SMS receiver, so a
 * notification listener is what production anti-scam apps rely on.
 *
 * Only the text of a notification is inspected, on-device, and only for apps in
 * [MONITORED_PACKAGES] — not every notification on the phone. Nothing is stored
 * or uploaded unless the on-device engine flags it as suspicious.
 *
 * Requires "Notification access", granted by the user in system settings (the
 * app sends them there from the protection screen).
 */
class NotificationInterceptorService : NotificationListenerService() {

    companion object {
        /**
         * Apps whose notifications are inspected — chat and SMS surfaces where
         * scam content actually arrives. Extend deliberately: every package added
         * is another source of personal text the engine may read.
         */
        val MONITORED_PACKAGES = setOf(
            "com.whatsapp", "com.whatsapp.w4b",
            "org.telegram.messenger", "org.telegram.plus", "org.thunderdog.challegram",
            "com.instagram.android", "com.facebook.katana", "com.facebook.orca",
            "com.viber.voip", "com.imo.android.imoim", "com.discord",
            "com.google.android.apps.messaging", "com.android.mms", "com.android.messaging",
            "com.samsung.android.messaging",
            "com.microsoft.teams", "com.slack", "com.linkedin.android",
        )

        private const val MAX_TEXT = 2000
        private const val DEDUPE_WINDOW_MS = 60_000L
    }

    /** Recently seen notifications, so the same message never alerts twice. */
    private val recentlySeen = LinkedHashMap<String, Long>()

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        val notification = sbn?.notification ?: return

        // Never analyse our own alerts (that would be a feedback loop).
        if (sbn.packageName == packageName) return
        if (sbn.packageName !in MONITORED_PACKAGES) return

        val extras = notification.extras ?: return
        // Ongoing (music, downloads, calls) and group summaries are not messages.
        if (notification.flags and Notification.FLAG_ONGOING_EVENT != 0) return
        if (notification.flags and Notification.FLAG_GROUP_SUMMARY != 0) return

        val sender = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()
            ?: extras.getCharSequence(Notification.EXTRA_CONVERSATION_TITLE)?.toString()

        val text = extractText(extras)?.trim()
        if (text.isNullOrEmpty()) return
        if (!markSeen(sbn.key, text)) return

        val assessment = ThreatHeuristics.assess(text, sender)
        if (!assessment.suspicious) return

        // Quiet mode goes one step further than warning: the original message
        // notification is withdrawn so the user cannot tap the scam link on habit.
        if (InterceptionStore.isQuietModeEnabled(this) && canCancel(sbn)) {
            try {
                cancelNotification(sbn.key)
            } catch (_: Exception) {
                // Cancelling is best-effort; the warning below still stands.
            }
        }

        val payload = mapOf(
            "text" to text.take(MAX_TEXT),
            "sender" to sender,
            "source" to sourceFor(sbn.packageName),
            "localRisk" to assessment.level,
            "localReasons" to assessment.reasons,
        )

        InterceptionBridge.dispatch(applicationContext, "onSmsIntercepted", payload) {
            ThreatAlerts.show(
                context = applicationContext,
                sender = sender ?: appLabel(sbn.packageName),
                preview = text,
                reasons = assessment.reasons,
                riskLevel = assessment.level,
            )
        }
    }

    /** Pull the message body out of the several shapes Android notifications use. */
    @Suppress("DEPRECATION")
    private fun extractText(extras: android.os.Bundle): String? {
        // Messaging apps publish a list of individual messages (Bubble/Inbox style).
        val messages = extras.getParcelableArray(Notification.EXTRA_MESSAGES)
        if (messages != null && messages.isNotEmpty()) {
            val joined = messages.mapNotNull { item ->
                (item as? android.os.Bundle)?.getCharSequence("text")?.toString()
            }.joinToString(" ")
            if (joined.isNotBlank()) return joined
        }
        val big = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString()
        if (!big.isNullOrBlank()) return big
        val body = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString()
        if (!body.isNullOrBlank()) return body
        return extras.getCharSequence(Notification.EXTRA_SUB_TEXT)?.toString()
    }

    /** Bounded, time-windowed dedupe: the same alert must not fire twice. */
    private fun markSeen(key: String?, text: String): Boolean {
        val now = System.currentTimeMillis()
        val fingerprint = "${key ?: ""}|${text.hashCode()}"
        val seenAt = recentlySeen[fingerprint]
        if (seenAt != null && now - seenAt < DEDUPE_WINDOW_MS) return false

        recentlySeen[fingerprint] = now
        if (recentlySeen.size > 100) {
            recentlySeen.entries.removeAll { it.value < now - DEDUPE_WINDOW_MS }
            if (recentlySeen.size > 200) recentlySeen.clear()
        }
        return true
    }

    /** Some system-owned notifications are not ours to remove. */
    private fun canCancel(sbn: StatusBarNotification): Boolean =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) sbn.isClearable else true

    private fun sourceFor(pkg: String): String = when (pkg) {
        "com.whatsapp", "com.whatsapp.w4b" -> "whatsapp"
        "org.telegram.messenger", "org.telegram.plus", "org.thunderdog.challegram" -> "telegram"
        "com.instagram.android" -> "instagram"
        "com.facebook.katana", "com.facebook.orca" -> "facebook"
        "com.google.android.apps.messaging", "com.android.mms", "com.android.messaging",
        "com.samsung.android.messaging" -> "sms"
        else -> "notification"
    }

    private fun appLabel(pkg: String): String = try {
        val info = packageManager.getApplicationInfo(pkg, 0)
        packageManager.getApplicationLabel(info).toString()
    } catch (_: Exception) {
        pkg
    }
}

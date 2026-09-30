package com.trustlayer.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Telephony
import android.telephony.SmsMessage

/**
 * SMS interception — layer 1 of 3.
 *
 * Runs the moment the OS delivers an incoming SMS, *before* the user opens the
 * messaging app (intent-filter priority 999), so a scam can be flagged while the
 * user is still deciding whether to tap the link.
 *
 * Privacy posture: the on-device engine decides first. Ordinary messages are
 * dropped here and never leave the phone; only messages that look like a scam are
 * handed to the app for full server-side analysis (ML + URL intelligence +
 * campaign correlation).
 *
 * Platform limitation worth knowing (Android behaviour, not a bug): only the
 * *default* SMS app may discard an SMS, so TrustLayer warns rather than silently
 * deleting — see the README section "What interception can and cannot do".
 */
class SmsInterceptor : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

        val bundle = intent.extras ?: return
        val pdus = bundle.get("pdus") as? Array<*> ?: return
        val format = bundle.getString("format")

        val body = StringBuilder()
        var sender: String? = null

        for (pdu in pdus) {
            val bytes = pdu as? ByteArray ?: continue
            val message = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                SmsMessage.createFromPdu(bytes, format)
            } else {
                @Suppress("DEPRECATION")
                SmsMessage.createFromPdu(bytes)
            } ?: continue
            message.displayOriginatingAddress?.let { sender = it }
            body.append(message.displayMessageBody)
        }

        val text = body.toString().trim()
        if (text.isEmpty()) return

        val assessment = ThreatHeuristics.assess(text, sender)
        if (!assessment.suspicious) return // ordinary message: nothing to report

        val payload = mapOf(
            "text" to text.take(2000),
            "sender" to sender,
            "source" to "sms",
            "localRisk" to assessment.level,
            "localReasons" to assessment.reasons,
        )

        // If the app is not there to receive it, the user still gets the warning:
        // silently swallowing a detection would be the worst possible failure.
        InterceptionBridge.dispatch(context, "onSmsIntercepted", payload) {
            ThreatAlerts.show(
                context = context,
                sender = sender,
                preview = text,
                reasons = assessment.reasons,
                riskLevel = assessment.level,
            )
        }
    }
}

package com.trustlayer.app

import android.util.Patterns

/**
 * On-device threat heuristics — the offline safety net.
 *
 * The backend Trust Engine is the authority, but a scam warning is worthless if
 * it only arrives when the phone has signal, the API is reachable and the user
 * has signed in. Real-world anti-scam apps therefore always keep a local
 * detector: it runs inside the interception receivers, so a suspicious message
 * raises an alert within milliseconds and never leaves the device to do it.
 *
 * The rules are deliberately explainable (a list of human-readable reasons), so
 * the notification can tell the user *why* something looks like a scam. This is
 * an intentionally conservative first-pass filter — it escalates to the full
 * server-side engine (ML + URL intelligence + campaign correlation) when the
 * app is able to reach it.
 */
object ThreatHeuristics {

    /** Below this score a message is treated as ordinary traffic. */
    const val SUSPICIOUS_THRESHOLD = 30

    data class Rule(val reason: String, val weight: Int, val test: (String) -> Boolean)

    data class Assessment(
        val score: Int,
        val level: String,
        val reasons: List<String>,
    ) {
        val suspicious: Boolean get() = level != "LOW"
    }

    private fun lc(text: String) = text.lowercase()

    private fun anyOf(text: String, vararg needles: String) = needles.any { text.contains(it) }

    private val CONTENT_RULES = listOf(
        Rule("Asks you to share a PIN, OTP, password or card number", 45) { t ->
            anyOf(t, "otp", "one time password", "pin code", "password", "cvv", "card number", "atm pin") &&
                anyOf(t, "share", "send", "enter", "provide", "confirm", "reply", "forward", "tell us")
        },
        Rule("Claims your account, card or SIM is blocked/suspended", 35) { t ->
            anyOf(t, "blocked", "suspended", "frozen", "deactivated", "block ho", "band ho") &&
                anyOf(t, "account", "card", "sim", "wallet", "atm", "khata")
        },
        Rule("Prize, lottery or government-grant lure", 30) { t ->
            anyOf(t, "prize", "lottery", "lucky draw", "inam", "jeet", "mubarak", "bisp", "ehsaas",
                "benazir", "grant", "reward", "cashback")
        },
        Rule("Unknown link in a message that wants you to act", 30) { t ->
            Patterns.WEB_URL.matcher(t).find() &&
                anyOf(t, "click", "verify", "confirm", "update", "login", "log in", "reactivate", "unlock")
        },
        Rule("Shortened link hides the real destination", 25) { t ->
            anyOf(t, "bit.ly", "tinyurl", "t.co/", "goo.gl", "cutt.ly", "is.gd", "rebrand.ly", "shorturl")
        },
        Rule("Pressures you with a deadline", 20) { t ->
            anyOf(t, "immediately", "urgent", "act now", "within 24 hours", "within 24 hrs", "expire",
                "last chance", "final notice", "today only", "foran")
        },
        Rule("Asks for a payment, fee or transfer", 28) { t ->
            anyOf(t, "send rs", "rs ", "transfer", "processing fee", "registration fee", "advance payment",
                "security deposit", "easypaisa", "jazzcash", "paid the amount") &&
                anyOf(t, "send", "transfer", "pay", "deposit", "bhej", "amount")
        },
        Rule("Job, task or easy-earning lure", 25) { t ->
            anyOf(t, "work from home", "daily income", "earn daily", "part time job", "task based",
                "per task", "online job", "ghar baithe", "commission")
        },
        Rule("Impersonates a bank, telecom or courier brand", 18) { t ->
            anyOf(t, "hbl", "ubl", "mcb", "meezan", "alfalah", "easypaisa", "jazzcash", "sadapay",
                "nayapay", "jazz", "telenor", "ufone", "zong", "leopards", "tcs", "daraz", "nadra", "pta")
        },
        Rule("Asks you to move the chat to WhatsApp/Telegram", 15) { t ->
            anyOf(t, "whatsapp", "wa.me", "telegram", "t.me", "imo ", "signal me")
        },
    )

    private val SENDER_RULES = listOf(
        Rule("Sender ID imitates a bank/telecom brand (spoofable)", 30) { s ->
            anyOf(s, "hbl", "ubl", "mcb", "meezan", "alfalah", "easypaisa", "jazzcash", "sadapay",
                "nayapay", "jazz", "telenor", "ufone", "zong", "nadra", "pta", "bisp", "fbr") &&
                anyOf(s, "-", "_", ".", "info", "alert", "update", "kyc")
        },
        Rule("Sender is a foreign number", 20) { s ->
            (s.startsWith("+") || s.startsWith("00")) && !s.startsWith("+92") && !s.startsWith("0092")
        },
        Rule("Sender is a bulk short code shared by many senders", 8) { s ->
            s.filter { it.isDigit() }.length in 4..6 && s.none { it.isLetter() }
        },
    )

    /**
     * Score one intercepted message.
     *
     * @param text   message body (SMS content or notification text)
     * @param sender originating address if known (MSISDN, short code, sender ID)
     */
    fun assess(text: String, sender: String? = null): Assessment {
        val body = lc(text)
        val from = lc(sender ?: "")

        val reasons = mutableListOf<String>()
        var score = 0

        for (rule in CONTENT_RULES) {
            if (rule.test(body)) {
                score += rule.weight
                reasons += rule.reason
            }
        }
        // Sender identity is corroborating evidence, so it counts for half —
        // a legitimate bank short code must not raise an alarm on its own.
        for (rule in SENDER_RULES) {
            if (from.isNotEmpty() && rule.test(from)) {
                score += rule.weight / 2
                reasons += rule.reason
            }
        }

        val capped = score.coerceAtMost(100)
        val level = when {
            capped >= 85 -> "CRITICAL"
            capped >= 60 -> "HIGH"
            capped >= SUSPICIOUS_THRESHOLD -> "MEDIUM"
            else -> "LOW"
        }
        return Assessment(score = capped, level = level, reasons = reasons)
    }
}

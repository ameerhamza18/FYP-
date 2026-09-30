package com.trustlayer.app

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject

/**
 * Durable local buffer for intercepted messages.
 *
 * Two things can be unavailable when a scam message lands: the Flutter engine
 * (app not running) and the network (no signal). Neither may cause a detection to
 * be silently lost, so every interception is appended here and replayed to the
 * app — which uploads it to the Trust Engine — as soon as both exist again.
 *
 * Stored in app-private SharedPreferences; nothing leaves the device until the
 * app (with the user signed in) drains it.
 */
object InterceptionStore {

    private const val PREFS = "trustlayer_interception"
    private const val KEY_QUEUE = "pending_queue"
    private const val KEY_QUIET_MODE = "quiet_mode"
    private const val MAX_QUEUED = 50

    private fun prefs(context: Context): SharedPreferences =
        context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    /** Quiet mode also hides the original message notification (see the listener). */
    fun isQuietModeEnabled(context: Context): Boolean = prefs(context).getBoolean(KEY_QUIET_MODE, false)

    fun setQuietMode(context: Context, enabled: Boolean) {
        prefs(context).edit().putBoolean(KEY_QUIET_MODE, enabled).apply()
    }

    fun enqueue(context: Context, text: String, sender: String?, source: String) {
        if (text.isBlank()) return
        val store = prefs(context)
        val queue = readArray(store.getString(KEY_QUEUE, null))
        queue.put(JSONObject().apply {
            put("text", text.take(2000))
            put("sender", sender ?: "")
            put("source", source)
            put("queued_at", System.currentTimeMillis())
        })
        // Keep the newest entries; an unbounded buffer would grow without limit.
        val trimmed = JSONArray()
        val start = maxOf(0, queue.length() - MAX_QUEUED)
        for (i in start until queue.length()) trimmed.put(queue.get(i))
        store.edit().putString(KEY_QUEUE, trimmed.toString()).apply()
    }

    fun pendingCount(context: Context): Int =
        readArray(prefs(context).getString(KEY_QUEUE, null)).length()

    /** Atomically hand the queue to the app and clear it. */
    fun drain(context: Context): List<Map<String, Any?>> {
        val store = prefs(context)
        val queue = readArray(store.getString(KEY_QUEUE, null))
        val items = (0 until queue.length()).mapNotNull { i ->
            queue.optJSONObject(i)?.let { obj ->
                if (obj.optString("text").isBlank()) null else mapOf(
                    "text" to obj.optString("text"),
                    "sender" to obj.optString("sender").ifBlank { null },
                    "source" to obj.optString("source", "unknown"),
                )
            }
        }
        store.edit().remove(KEY_QUEUE).apply()
        return items
    }

    private fun readArray(raw: String?): JSONArray =
        try {
            if (raw.isNullOrBlank()) JSONArray() else JSONArray(raw)
        } catch (_: Exception) {
            JSONArray() // corrupted buffer must never break interception
        }
}

import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

/// One intercepted message waiting for a working connection.
class QueuedAnalysis {
  final String text;
  final String? sender;
  final String source;
  final int queuedAt;

  const QueuedAnalysis({
    required this.text,
    required this.source,
    required this.queuedAt,
    this.sender,
  });

  Map<String, dynamic> toJson() => {
        'text': text,
        'sender': sender,
        'source': source,
        'queued_at': queuedAt,
      };

  static QueuedAnalysis? fromJson(Map<String, dynamic> json) {
    final text = (json['text'] ?? '').toString();
    if (text.trim().isEmpty) return null;
    return QueuedAnalysis(
      text: text,
      sender: json['sender']?.toString(),
      source: (json['source'] ?? 'unknown').toString(),
      queuedAt: (json['queued_at'] as num?)?.toInt() ?? 0,
    );
  }
}

/// Durable queue of analyses that could not reach the backend.
///
/// An interception happens exactly once: if the phone is offline at that moment
/// and the result is thrown away, the user loses the protection they were
/// promised. Failed uploads are therefore persisted here and replayed the next
/// time the app has both a session and a connection.
///
/// Bounded by design — the oldest entries are dropped so a long offline period
/// cannot grow the buffer without limit.
class AnalysisQueue {
  AnalysisQueue._();

  static const String _key = 'pending_analysis_queue';
  static const int _maxEntries = 25;

  static Future<List<QueuedAnalysis>> all() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key);
    if (raw == null || raw.isEmpty) return const [];
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! List) return const [];
      return decoded
          .whereType<Map>()
          .map((e) => QueuedAnalysis.fromJson(e.cast<String, dynamic>()))
          .whereType<QueuedAnalysis>()
          .toList();
    } catch (_) {
      // A corrupt buffer must never block the app; start clean.
      await prefs.remove(_key);
      return const [];
    }
  }

  static Future<int> length() async => (await all()).length;

  static Future<void> add({
    required String text,
    required String source,
    String? sender,
  }) async {
    if (text.trim().isEmpty) return;
    final prefs = await SharedPreferences.getInstance();
    final queue = [...await all(), QueuedAnalysis(
      text: text,
      source: source,
      sender: sender,
      queuedAt: DateTime.now().millisecondsSinceEpoch,
    )];
    final trimmed = queue.length > _maxEntries
        ? queue.sublist(queue.length - _maxEntries)
        : queue;
    await prefs.setString(_key, jsonEncode(trimmed.map((e) => e.toJson()).toList()));
  }

  static Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_key);
  }
}

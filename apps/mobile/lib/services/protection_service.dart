import 'dart:async';

import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// A message the OS-level interceptors pulled in from outside the app.
class InterceptedMessage {
  final String text;
  final String? sender;

  /// sms | whatsapp | telegram | instagram | facebook | notification | share
  final String source;

  /// Verdict of the on-device engine that caught it (CRITICAL/HIGH/MEDIUM).
  final String? localRisk;
  final List<String> localReasons;

  const InterceptedMessage({
    required this.text,
    required this.source,
    this.sender,
    this.localRisk,
    this.localReasons = const [],
  });

  factory InterceptedMessage.fromMap(Map<dynamic, dynamic> map) {
    final reasons = map['localReasons'];
    return InterceptedMessage(
      text: (map['text'] ?? '').toString(),
      source: (map['source'] ?? 'notification').toString(),
      sender: map['sender']?.toString(),
      localRisk: map['localRisk']?.toString(),
      localReasons: reasons is List ? reasons.map((e) => e.toString()).toList() : const [],
    );
  }
}

/// Real protection state as reported by Android — not what we wish were true.
class ProtectionStatus {
  final bool smsPermission;
  final bool notificationsEnabled;

  /// Notification access (needed for WhatsApp/Telegram interception) is granted
  /// in system settings; it can never be requested with a dialog.
  final bool notificationAccess;
  final bool quietMode;
  final int pendingInterceptions;
  final int platformVersion;

  const ProtectionStatus({
    required this.smsPermission,
    required this.notificationsEnabled,
    required this.notificationAccess,
    required this.quietMode,
    required this.pendingInterceptions,
    required this.platformVersion,
  });

  /// Used when the platform channel is unavailable (iOS, tests, engine gone).
  static const ProtectionStatus unknown = ProtectionStatus(
    smsPermission: false,
    notificationsEnabled: false,
    notificationAccess: false,
    quietMode: false,
    pendingInterceptions: 0,
    platformVersion: 0,
  );

  /// SMS is the only channel that protects without the user opening settings,
  /// so it is what the headline badge reflects.
  bool get automaticSmsProtection => smsPermission && notificationsEnabled;

  bool get fullyProtected =>
      automaticSmsProtection && notificationAccess;

  factory ProtectionStatus.fromMap(Map<dynamic, dynamic> map) => ProtectionStatus(
        smsPermission: map['sms'] == true,
        notificationsEnabled: map['notifications'] == true,
        notificationAccess: map['notificationAccess'] == true,
        quietMode: map['quietMode'] == true,
        pendingInterceptions: (map['pendingInterceptions'] as num?)?.toInt() ?? 0,
        platformVersion: (map['platformVersion'] as num?)?.toInt() ?? 0,
      );
}



/// Client for TrustLayer's OS-level interception layer.
///
/// Wraps the `com.trustlayer.app/interception` MethodChannel so the UI has one
/// place to ask "am I actually protected?", to request the permissions that
/// automatic interception needs, and to receive intercepted messages.
///
/// The Kotlin side answers an interception with `true` **only** when the app is
/// alive and has accepted it; otherwise it raises its own warning notification
/// and buffers the message for replay. That contract is what makes the app's
/// protection work while it is closed, so every handler here must return `true`.
class ProtectionService {
  ProtectionService._();

  static const MethodChannel _channel = MethodChannel('com.trustlayer.app/interception');

  /// Quiet mode is persisted in Dart (so it survives reinstalls of the setting
  /// UI) and mirrored to Kotlin, which needs it while the app is not running.
  static const String _quietModeKey = 'protection_quiet_mode';

  static final StreamController<ProtectionStatus> _statuses =
      StreamController<ProtectionStatus>.broadcast();

  /// Live protection status; the UI listens so permission changes made in system
  /// settings are reflected as soon as the user comes back.
  static Stream<ProtectionStatus> get statusStream => _statuses.stream;

  static void Function(InterceptedMessage message)? onIntercepted;

  static bool _handlerInstalled = false;

  /// Wires the channel and replays anything intercepted while the app was closed.
  /// Safe to call more than once.
  static Future<void> initialize({
    required void Function(InterceptedMessage message) onIntercepted,
  }) async {
    ProtectionService.onIntercepted = onIntercepted;
    if (!_handlerInstalled) {
      _channel.setMethodCallHandler(_handleCall);
      _handlerInstalled = true;
    }
    // Keep the platform copy of quiet mode in sync with the stored preference.
    await setQuietMode(await loadQuietMode());
  }

  static Future<dynamic> _handleCall(MethodCall call) async {
    switch (call.method) {
      case 'onSmsIntercepted':
        final args = call.arguments;
        if (args is Map) {
          final message = InterceptedMessage.fromMap(args);
          if (message.text.trim().isNotEmpty) {
            onIntercepted?.call(message);
            return true; // accepted: the platform must not double-alert
          }
        }
        return false;
      case 'onSharedTextReceived':
        final text = call.arguments?.toString() ?? '';
        if (text.trim().isEmpty) return false;
        onIntercepted?.call(InterceptedMessage(text: text, source: 'share'));
        return true;
      case 'onProtectionStatusChanged':
        final args = call.arguments;
        if (args is Map) _statuses.add(ProtectionStatus.fromMap(args));
        return true;
    }
    return null;
  }

  /// Current status, or [ProtectionStatus.unknown] when the platform channel is
  /// not available (older build, iOS, widget tests).
  static Future<ProtectionStatus> status() async {
    try {
      final result = await _channel.invokeMethod<dynamic>('getProtectionStatus');
      if (result is Map) {
        final status = ProtectionStatus.fromMap(result);
        if (!_statuses.isClosed) _statuses.add(status);
        return status;
      }
    } on MissingPluginException {
      // Not an Android build with the interception layer.
    } on PlatformException {
      // Treat as unknown rather than claiming protection we cannot verify.
    }
    return ProtectionStatus.unknown;
  }

  /// True when a runtime dialog was actually needed and shown.
  static Future<void> requestSmsPermission() =>
      _invoke('requestSmsPermission');

  static Future<void> requestNotificationPermission() =>
      _invoke('requestNotificationPermission');

  static Future<void> openNotificationListenerSettings() =>
      _invoke('openNotificationListenerSettings');

  static Future<void> openAppNotificationSettings() =>
      _invoke('openAppNotificationSettings');

  /// Reads and clears the cold-start payload (shared link / notification tap).
  static Future<InterceptedMessage?> takeInitialInterception() async {
    try {
      final result = await _channel.invokeMethod<dynamic>('getInitialInterceptedText');
      if (result is Map) {
        final message = InterceptedMessage.fromMap(result);
        if (message.text.trim().isNotEmpty) return message;
      }
    } on MissingPluginException {
      return null;
    } on PlatformException {
      return null;
    }
    return null;
  }

  /// Replays messages intercepted while the app was closed or the backend was
  /// unreachable. Returns them oldest-first and clears the on-device buffer.
  static Future<List<InterceptedMessage>> drainPendingInterceptions() async {
    try {
      final result = await _channel.invokeMethod<dynamic>('drainPendingInterceptions');
      if (result is List) {
        return result
            .whereType<Map>()
            .map(InterceptedMessage.fromMap)
            .where((m) => m.text.trim().isNotEmpty)
            .toList();
      }
    } on MissingPluginException {
      return const [];
    } on PlatformException {
      return const [];
    }
    return const [];
  }

  static Future<bool> loadQuietMode() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_quietModeKey) ?? false;
  }

  /// Quiet mode hides the original message notification for flagged content, so
  /// nothing about the scam is visible until the user reads TrustLayer's warning.
  static Future<void> setQuietMode(bool enabled) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_quietModeKey, enabled);
    try {
      await _channel.invokeMethod<dynamic>('setQuietMode', {'enabled': enabled});
    } on MissingPluginException {
      // Persisted locally; the platform copy is unavailable off-Android.
    } on PlatformException {
      // Non-fatal: the setting still applies the next time the app starts.
    }
  }

  static Future<void> _invoke(String method, [Map<String, dynamic>? args]) async {
    try {
      await _channel.invokeMethod<dynamic>(method, args);
    } on MissingPluginException {
      // Interception layer not present in this build/platform.
    } on PlatformException {
      // Settings screens are unavailable on some OEM ROMs; never crash the UI.
    }
  }
}


  static Future<void> openBatteryOptimizationSettings() =>
      _invoke('openBatteryOptimizationSettings');

  /// Posts a sample scam warning so the user can verify alerts really appear.
  static Future<void> showTestAlert() => _invoke('showTestAlert');

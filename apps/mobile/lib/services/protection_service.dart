import 'dart:async';

import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// A message or shared image the OS-level interceptors pulled in from outside the app.
class InterceptedMessage {
  final String text;
  final String? sender;
  final String? imagePath;

  /// sms | whatsapp | telegram | instagram | facebook | notification | share | share-image
  final String source;

  /// Verdict of the on-device engine that caught it (CRITICAL/HIGH/MEDIUM).
  final String? localRisk;
  final List<String> localReasons;

  const InterceptedMessage({
    required this.text,
    required this.source,
    this.sender,
    this.imagePath,
    this.localRisk,
    this.localReasons = const [],
  });

  bool get isImage => imagePath != null && imagePath!.trim().isNotEmpty;

  factory InterceptedMessage.fromMap(Map<dynamic, dynamic> map) {
    final reasons = map['localReasons'];
    return InterceptedMessage(
      text: (map['text'] ?? '').toString(),
      source: (map['source'] ?? 'notification').toString(),
      sender: map['sender']?.toString(),
      imagePath: map['imagePath']?.toString(),
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
class ProtectionService {
  ProtectionService._();

  static const MethodChannel _channel = MethodChannel('com.trustlayer.app/interception');

  static const String _quietModeKey = 'protection_quiet_mode';

  static final StreamController<ProtectionStatus> _statuses =
      StreamController<ProtectionStatus>.broadcast();

  static Stream<ProtectionStatus> get statusStream => _statuses.stream;

  static void Function(InterceptedMessage message)? onIntercepted;

  static bool _handlerInstalled = false;

  static Future<void> initialize({
    required void Function(InterceptedMessage message) onIntercepted,
  }) async {
    ProtectionService.onIntercepted = onIntercepted;
    if (!_handlerInstalled) {
      _channel.setMethodCallHandler(_handleCall);
      _handlerInstalled = true;
    }
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
            return true;
          }
        }
        return false;
      case 'onSharedTextReceived':
        final args = call.arguments;
        if (args is Map) {
          final message = InterceptedMessage.fromMap(args);
          if (message.text.trim().isNotEmpty) {
            onIntercepted?.call(message);
            return true;
          }
          return false;
        }
        final text = args?.toString() ?? '';
        if (text.trim().isEmpty) return false;
        onIntercepted?.call(InterceptedMessage(text: text, source: 'share'));
        return true;
      case 'onSharedImageReceived':
        final args = call.arguments;
        if (args is Map) {
          final message = InterceptedMessage.fromMap(args);
          if (message.isImage) {
            onIntercepted?.call(message);
            return true;
          }
        }
        return false;
      case 'onProtectionStatusChanged':
        final args = call.arguments;
        if (args is Map) _statuses.add(ProtectionStatus.fromMap(args));
        return true;
    }
    return null;
  }

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

  static Future<void> requestSmsPermission() =>
      _invoke('requestSmsPermission');

  static Future<void> requestNotificationPermission() =>
      _invoke('requestNotificationPermission');

  static Future<void> openNotificationListenerSettings() =>
      _invoke('openNotificationListenerSettings');

  static Future<void> openAppNotificationSettings() =>
      _invoke('openAppNotificationSettings');

  /// Reads and clears the cold-start payload (shared link / shared image / notification tap).
  static Future<InterceptedMessage?> takeInitialInterception() async {
    try {
      final result = await _channel.invokeMethod<dynamic>('getInitialInterceptedText');
      if (result is Map) {
        final message = InterceptedMessage.fromMap(result);
        if (message.text.trim().isNotEmpty || message.isImage) return message;
      }
    } on MissingPluginException {
      return null;
    } on PlatformException {
      return null;
    }
    return null;
  }

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

  static Future<void> openBatteryOptimizationSettings() =>
      _invoke('openBatteryOptimizationSettings');

  static Future<void> showTestAlert() => _invoke('showTestAlert');
}

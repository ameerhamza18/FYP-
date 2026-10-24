/// Secure JWT persistence using flutter_secure_storage (Encrypted Keystore/Keychain).
///
/// In release builds (`kReleaseMode`), tokens are stored strictly in the
/// hardware-backed Keystore/Keychain (`FlutterSecureStorage`). In debug and
/// widget-test environments where the native Keystore plugin is absent, a
/// `SharedPreferences` fallback is used so VM unit tests run without an emulator.
import 'package:flutter/foundation.dart' show kReleaseMode;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

class TokenStore {
  static const _key = 'trustlayer_jwt';
  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  static Future<void> save(String token) async {
    try {
      await _storage.write(key: _key, value: token);
      return;
    } catch (_) {
      if (kReleaseMode) rethrow;
    }
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, token);
  }

  static Future<String?> read() async {
    try {
      final token = await _storage.read(key: _key);
      if (token != null) return token;
      if (kReleaseMode) return null;
    } catch (_) {
      if (kReleaseMode) return null;
    }
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_key);
  }

  static Future<void> clear() async {
    try {
      await _storage.delete(key: _key);
    } catch (_) {
      // Fallback clear below
    }
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_key);
    } catch (_) {}
  }
}

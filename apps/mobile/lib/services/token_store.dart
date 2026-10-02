/// Secure JWT persistence using flutter_secure_storage (Encrypted Keystore/Keychain).
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
    } catch (_) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_key, token);
    }
  }

  static Future<String?> read() async {
    try {
      final token = await _storage.read(key: _key);
      if (token != null) return token;
    } catch (_) {
      // Fallback read below
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
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_key);
  }
}

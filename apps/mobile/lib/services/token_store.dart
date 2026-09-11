/// JWT persistence via SharedPreferences.
/// (For hardened builds swap for flutter_secure_storage — API-compatible.)
import 'package:shared_preferences/shared_preferences.dart';

class TokenStore {
  static const _key = 'trustlayer_jwt';

  static Future<void> save(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, token);
  }

  static Future<String?> read() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_key);
  }

  static Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_key);
  }
}

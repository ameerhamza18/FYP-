import 'dart:async';
import 'dart:convert';
import 'dart:io' show SocketException;

import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart' show MediaType;
import 'package:image_picker/image_picker.dart';

import '../models/analysis_result.dart';
import 'token_store.dart';

/// TrustLayer API client.
///
/// [ApiConfig.baseUrl] must point at the running backend. The Docker Compose
/// stack publishes the API on host port **8001** (see
/// infrastructure/docker/docker-compose.yml), so:
///
///   * Android emulator  -> http://10.0.2.2:8001
///   * iOS simulator     -> http://localhost:8001
///   * physical device   -> http://<your-LAN-ip>:8001
///
/// Override at build time without editing this file:
///   flutter run --dart-define=API_BASE_URL=http://192.168.1.10:8001
class ApiConfig {
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:8001',
  );
}

class ApiException implements Exception {
  final int? statusCode;
  final String message;
  ApiException(this.message, [this.statusCode]);

  @override
  String toString() => 'ApiException($statusCode): $message';
}

/// Raised when the server rejects our token (expired or revoked).
///
/// The UI must treat this as "sign the user out", not as a generic error, so
/// the refreshable HTTP client fires [TrustApiClient.onSessionExpired] and the
/// app returns to the login screen instead of retrying forever.
class SessionExpiredException extends ApiException {
  SessionExpiredException([String message = 'Your session expired. Please sign in again.'])
      : super(message, 401);
}

/// Raised when the device cannot reach the backend at all (no signal, airplane
/// mode, wrong Wi-Fi). Distinguished from a server error so the UI can offer
/// "check your connection" rather than a scary failure.
class NetworkException extends ApiException {
  NetworkException([String message = 'No connection to TrustLayer. Check your network.'])
      : super(message);
}

class TrustApiClient {
  /// Notified whenever the backend rejects our credentials, so the widget tree
  /// can pop back to the login screen exactly once (see main.dart).
  static void Function()? onSessionExpired;

  /// Connection/response budget. Mobile networks are slow, but an unbounded
  /// request leaves the UI spinning forever, so every call is bounded.
  static const Duration _timeout = Duration(seconds: 25);

  static bool _sessionExpiryNotified = false;

  void _notifySessionExpired() {
    if (_sessionExpiryNotified) return;
    _sessionExpiryNotified = true;
    onSessionExpired?.call();
    // Allow a later sign-in to raise the event again.
    Future<void>.delayed(const Duration(seconds: 2), () {
      _sessionExpiryNotified = false;
    });
  }

  Future<String> _token() async {
    final t = await TokenStore.read();
    if (t == null) throw SessionExpiredException('Not signed in');
    return t;
  }

  Map<String, String> _headers([String? token]) => {
        if (token != null) 'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      };

  /// Normalises transport-level failures into [NetworkException] and enforces
  /// the request timeout, so callers never see a raw SocketException.
  Future<http.Response> _send(Future<http.Response> Function() call) async {
    try {
      return await call().timeout(_timeout);
    } on TimeoutException {
      throw NetworkException('TrustLayer is taking too long to respond. Try again.');
    } on SocketException {
      throw NetworkException();
    } on http.ClientException {
      throw NetworkException();
    }
  }

  dynamic _decode(http.Response r) {
    dynamic body;
    try {
      body = jsonDecode(utf8.decode(r.bodyBytes));
    } catch (_) {
      body = r.body;
    }

    if (r.statusCode >= 400) {
      final detail = body is Map && body['detail'] != null ? body['detail'].toString() : null;

      if (r.statusCode == 401) {
        // Token expired or revoked: drop it so we don't keep replaying a dead
        // credential, then tell the UI to sign out.
        unawaited(TokenStore.clear());
        _notifySessionExpired();
        throw SessionExpiredException(detail ?? 'Your session expired. Please sign in again.');
      }
      if (r.statusCode == 429) {
        throw ApiException(
          detail ?? 'Too many scans in a row. Please wait a moment and try again.',
          429,
        );
      }
      if (r.statusCode >= 500) {
        throw ApiException(
          detail ?? 'TrustLayer had a server problem. Please try again shortly.',
          r.statusCode,
        );
      }
      throw ApiException(detail ?? 'Request failed (HTTP ${r.statusCode}).', r.statusCode);
    }
    return body;
  }

  // ------------------------------------------------------------------ auth
  /// Mirrors the server-side password policy (backend/app/security/validation.py)
  /// so users get instant feedback instead of a round-trip rejection.
  static const int minPasswordLength = 8;
  static const int maxUploadBytes = 8 * 1024 * 1024; // mirrors MAX_UPLOAD_SIZE_MB

  static final RegExp _emailRe = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');

  static void validateCredentials(String email, String password, {required bool isRegister}) {
    if (!_emailRe.hasMatch(email.trim())) {
      throw ApiException('Enter a valid email address.');
    }
    if (password.isEmpty) {
      throw ApiException('Enter your password.');
    }
    if (isRegister && password.length < minPasswordLength) {
      throw ApiException('Password must be at least $minPasswordLength characters.');
    }
  }

  Future<String> register(String email, String password) async {
    validateCredentials(email, password, isRegister: true);
    final r = await _send(() => http.post(
          Uri.parse('${ApiConfig.baseUrl}/api/auth/register'),
          headers: _headers(),
          body: jsonEncode({'email': email.trim(), 'password': password}),
        ));
    _decode(r);
    return login(email, password);
  }

  Future<String> login(String email, String password) async {
    validateCredentials(email, password, isRegister: false);
    final r = await _send(() => http.post(
          Uri.parse('${ApiConfig.baseUrl}/api/auth/login'),
          headers: _headers(),
          body: jsonEncode({'email': email.trim(), 'password': password}),
        ));
    final body = _decode(r) as Map<String, dynamic>;
    final token = body['access_token'] as String;
    await TokenStore.save(token);
    return token;
  }

  /// Verifies the stored token is still accepted. Used on cold start so an
  /// expired token lands the user on the login screen with an explanation,
  /// rather than on a home screen where every action fails.
  Future<void> me() async {
    final r = await _send(() => http.get(
          Uri.parse('${ApiConfig.baseUrl}/api/auth/me'),
          headers: _headers(await _token()),
        ));
    _decode(r);
  }

  /// Exchanges a still-valid token for a fresh one (sliding session).
  ///
  /// Called when the app returns to the foreground, so a user who spent an hour
  /// writing a message is not thrown back to the login screen the moment they
  /// tap "Analyze". Requires a currently valid token — an expired one gains
  /// nothing here and surfaces as [SessionExpiredException].
  Future<String> refreshSession() async {
    final r = await _send(() => http.post(
          Uri.parse('${ApiConfig.baseUrl}/api/auth/refresh'),
          headers: _headers(await _token()),
        ));
    final body = _decode(r) as Map<String, dynamic>;
    final token = body['access_token'] as String;
    await TokenStore.save(token);
    return token;
  }

  Future<void> logout() => TokenStore.clear();

  Future<void> deleteAccount() async {
    final r = await _send(() => http.delete(
          Uri.parse('${ApiConfig.baseUrl}/api/auth/me'),
          headers: _headers(await _token()),
        ));
    _decode(r);
    await TokenStore.clear();
  }

  // -------------------------------------------------------------- analysis

  /// Analyzes a message.
  ///
  /// [sender] is the originating address the OS interception layer observed
  /// (mobile number, short code or sender ID). Passing it lets the backend score
  /// sender reputation as well as the message body — spoofed brand sender IDs
  /// and foreign/premium numbers are among the strongest smishing signals.
  Future<AnalysisResult> analyzeText(
    String text, {
    String source = 'sms',
    String? sender,
  }) async {
    if (text.trim().isEmpty) {
      throw ApiException('Enter the message you want to check.');
    }
    final from = sender?.trim();
    final r = await _send(() => http.post(
          Uri.parse('${ApiConfig.baseUrl}/api/analyze/text'),
          headers: _headers(await _token()),
          body: jsonEncode({
            'text': text.trim(),
            'source': source,
            if (from != null && from.isNotEmpty) 'sender': from,
          }),
        ));
    return AnalysisResult.fromJson(_decode(r) as Map<String, dynamic>);
  }

  Future<AnalysisResult> analyzeUrl(String url) async {
    final trimmed = url.trim();
    if (trimmed.isEmpty) {
      throw ApiException('Enter the link you want to check.');
    }
    final r = await _send(() => http.post(
          Uri.parse('${ApiConfig.baseUrl}/api/analyze/url'),
          headers: _headers(await _token()),
          body: jsonEncode({'url': trimmed}),
        ));
    return AnalysisResult.fromJson(_decode(r) as Map<String, dynamic>);
  }

  Future<AnalysisResult> analyzeScreenshot(XFile image) async {
    // Fail fast on an oversized file instead of uploading 30 MB over mobile data
    // only to be rejected by the server.
    final length = await image.length();
    if (length > maxUploadBytes) {
      final mb = (length / 1024 / 1024).toStringAsFixed(1);
      throw ApiException('That image is $mb MB. The limit is 8 MB.');
    }

    final r = await _send(() async {
      final request = http.MultipartRequest(
        'POST',
        Uri.parse('${ApiConfig.baseUrl}/api/analyze/screenshot'),
      )..headers['Authorization'] = 'Bearer ${await _token()}';

      final path = image.path.toLowerCase();
      final ext = path.endsWith('.png') ? 'png' : (path.endsWith('.webp') ? 'webp' : 'jpeg');
      request.files.add(await http.MultipartFile.fromPath(
        'upload',
        image.path,
        contentType: MediaType('image', ext),
      ));

      return http.Response.fromStream(await request.send());
    });

    return AnalysisResult.fromJson(_decode(r) as Map<String, dynamic>);
  }

  Future<List<AnalysisResult>> history({int limit = 20}) async {
    final safeLimit = limit.clamp(1, 100);
    final r = await _send(() => http.get(
          Uri.parse('${ApiConfig.baseUrl}/api/analyze/history?limit=$safeLimit'),
          headers: _headers(await _token()),
        ));
    final list = _decode(r) as List<dynamic>;
    return list.map((e) => AnalysisResult.fromJson(e as Map<String, dynamic>)).toList();
  }
}


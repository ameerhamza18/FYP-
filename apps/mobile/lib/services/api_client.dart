import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart' show MediaType;
import 'package:image_picker/image_picker.dart';

import '../models/analysis_result.dart';
import 'token_store.dart';

/// TrustLayer API client.
/// Set [ApiConfig.baseUrl] to your backend, e.g. http://10.0.2.2:8000 for the
/// Android emulator against a local FastAPI server.
class ApiConfig {
  static const String baseUrl = 'http://10.0.2.2:8000';
}

class ApiException implements Exception {
  final int? statusCode;
  final String message;
  ApiException(this.message, [this.statusCode]);

  @override
  String toString() => 'ApiException($statusCode): $message';
}

class TrustApiClient {
  Future<String> _token() async {
    final t = await TokenStore.read();
    if (t == null) throw ApiException('Not signed in');
    return t;
  }

  Map<String, String> _headers([String? token]) => {
        if (token != null) 'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      };

  dynamic _decode(http.Response r) {
    dynamic body;
    try {
      body = jsonDecode(utf8.decode(r.bodyBytes));
    } catch (_) {
      body = r.body;
    }
    if (r.statusCode >= 400) {
      final msg = body is Map && body['detail'] != null
          ? body['detail'].toString()
          : 'HTTP ${r.statusCode}';
      throw ApiException(msg, r.statusCode);
    }
    return body;
  }

  // ------------------------------------------------------------------ auth
  Future<String> register(String email, String password) async {
    final r = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/api/auth/register'),
      headers: _headers(),
      body: jsonEncode({'email': email, 'password': password}),
    );
    _decode(r);
    return login(email, password);
  }

  Future<String> login(String email, String password) async {
    final r = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/api/auth/login'),
      headers: _headers(),
      body: jsonEncode({'email': email, 'password': password}),
    );
    final body = _decode(r) as Map<String, dynamic>;
    await TokenStore.save(body['access_token'] as String);
    return body['access_token'] as String;
  }

  Future<void> logout() => TokenStore.clear();

  // -------------------------------------------------------------- analysis
  Future<AnalysisResult> analyzeText(String text, {String source = 'sms'}) async {
    final r = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/api/analyze/text'),
      headers: _headers(await _token()),
      body: jsonEncode({'text': text, 'source': source}),
    );
    return AnalysisResult.fromJson(_decode(r) as Map<String, dynamic>);
  }

  Future<AnalysisResult> analyzeUrl(String url) async {
    final r = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/api/analyze/url'),
      headers: _headers(await _token()),
      body: jsonEncode({'url': url}),
    );
    return AnalysisResult.fromJson(_decode(r) as Map<String, dynamic>);
  }

  Future<AnalysisResult> analyzeScreenshot(XFile image) async {
    final request = http.MultipartRequest(
      'POST',
      Uri.parse('${ApiConfig.baseUrl}/api/analyze/screenshot'),
    )..headers['Authorization'] = 'Bearer ${await _token()}';

    final ext = image.path.toLowerCase().endsWith('.png') ? 'png' : 'jpeg';
    request.files.add(await http.MultipartFile.fromPath(
      'upload', image.path,
      contentType: MediaType('image', ext),
    ));

    final streamed = await request.send();
    final r = await http.Response.fromStream(streamed);
    return AnalysisResult.fromJson(_decode(r) as Map<String, dynamic>);
  }

  Future<List<AnalysisResult>> history({int limit = 20}) async {
    final r = await http.get(
      Uri.parse('${ApiConfig.baseUrl}/api/analyze/history?limit=$limit'),
      headers: _headers(await _token()),
    );
    final list = _decode(r) as List<dynamic>;
    return list.map((e) => AnalysisResult.fromJson(e as Map<String, dynamic>)).toList();
  }
}


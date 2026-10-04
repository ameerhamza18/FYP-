import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

import '../services/api_client.dart';
import '../main.dart';
import 'home_screen.dart';

class LoginScreen extends StatefulWidget {
  /// True when we arrived here because the backend rejected an expired token, so
  /// the user is told why instead of being silently dropped on a login form.
  final bool sessionExpired;
  const LoginScreen({super.key, this.sessionExpired = false});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _api = TrustApiClient();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  bool _obscure = true;
  String? _error;
  bool _isRegister = false;

  @override
  void initState() {
    super.initState();
    // Routing for a stored token is decided by SplashScreen._route, which also
    // verifies the token is still accepted before entering the app.
    if (widget.sessionExpired) {
      _error = 'Your session expired. Please sign in again.';
    }
  }

  Future<void> _goHome() async {
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const HomeScreen()),
    );
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    setState(() { _busy = true; _error = null; });
    try {
      // The client trims/validates these, so pass them through untouched.
      if (_isRegister) {
        await _api.register(_email.text, _password.text);
      } else {
        await _api.login(_email.text, _password.text);
      }
      await _goHome();
    } on NetworkException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'Something went wrong. Please try again.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: TrustLayerColors.background,
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Tactical Shield Orb
              Container(
                width: 76,
                height: 76,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: TrustLayerColors.surfaceElevated,
                  border: Border.all(
                    color: TrustLayerColors.primary.withOpacity(0.5),
                    width: 1.5,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: TrustLayerColors.primary.withOpacity(0.2),
                      blurRadius: 24,
                      spreadRadius: 2,
                    ),
                  ],
                ),
                child: const Center(
                  child: Icon(
                    Icons.shield_outlined,
                    size: 38,
                    color: TrustLayerColors.primary,
                  ),
                ),
              ),
              const SizedBox(height: 20),
              Text(
                'TRUSTLAYER',
                style: GoogleFonts.inter(
                  fontSize: 24,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 2.5,
                  color: TrustLayerColors.textPrimary,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'ENTERPRISE CYBER DEFENSE GATEWAY',
                style: GoogleFonts.jetBrainsMono(
                  fontSize: 9.5,
                  letterSpacing: 1.5,
                  fontWeight: FontWeight.w600,
                  color: TrustLayerColors.primary.withOpacity(0.8),
                ),
              ),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: TrustLayerColors.surfaceElevated,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: TrustLayerColors.surfaceBorder),
                ),
                child: Text(
                  'TLS 1.3 // ZERO-TRUST AUTHENTICATION',
                  style: GoogleFonts.jetBrainsMono(
                    fontSize: 8.5,
                    color: TrustLayerColors.textMuted,
                    letterSpacing: 1.0,
                  ),
                ),
              ),
              const SizedBox(height: 36),
              TextField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                style: const TextStyle(color: TrustLayerColors.textPrimary, fontSize: 13.5),
                decoration: InputDecoration(
                  labelText: 'Operator Identity (Email)',
                  labelStyle: TextStyle(color: TrustLayerColors.textSecondary, fontSize: 13),
                  prefixIcon: Icon(Icons.alternate_email_rounded, color: TrustLayerColors.textMuted, size: 20),
                  filled: true,
                  fillColor: TrustLayerColors.surface,
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: TrustLayerColors.surfaceBorder),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: TrustLayerColors.primary, width: 1.5),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _password,
                obscureText: _obscure,
                style: const TextStyle(color: TrustLayerColors.textPrimary, fontSize: 13.5),
                inputFormatters: [FilteringTextInputFormatter.singleLineFormatter],
                decoration: InputDecoration(
                  labelText: 'Passcode / Cryptographic Token',
                  labelStyle: TextStyle(color: TrustLayerColors.textSecondary, fontSize: 13),
                  prefixIcon: Icon(Icons.key_rounded, color: TrustLayerColors.textMuted, size: 20),
                  suffixIcon: IconButton(
                    icon: Icon(
                      _obscure ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                      color: TrustLayerColors.textMuted,
                      size: 20,
                    ),
                    tooltip: _obscure ? 'Show passcode' : 'Hide passcode',
                    onPressed: () => setState(() => _obscure = !_obscure),
                  ),
                  filled: true,
                  fillColor: TrustLayerColors.surface,
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: TrustLayerColors.surfaceBorder),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: TrustLayerColors.primary, width: 1.5),
                  ),
                ),
              ),
              const SizedBox(height: 20),
              if (_error != null)
                Container(
                  width: double.infinity,
                  margin: const EdgeInsets.only(bottom: 16),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: TrustLayerColors.critical.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: TrustLayerColors.critical.withOpacity(0.4)),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.error_outline_rounded,
                          color: TrustLayerColors.critical, size: 18),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          _error!,
                          style: const TextStyle(color: TrustLayerColors.critical, fontSize: 12),
                        ),
                      ),
                    ],
                  ),
                ),
              SizedBox(
                width: double.infinity,
                height: 50,
                child: FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: TrustLayerColors.primary,
                    foregroundColor: const Color(0xFF040711),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    elevation: 0,
                  ),
                  onPressed: _busy ? null : _submit,
                  child: _busy
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF040711)),
                        )
                      : Text(
                          _isRegister ? 'INITIALIZE CREDENTIALS' : 'AUTHENTICATE & ENTER',
                          style: GoogleFonts.jetBrainsMono(
                            fontSize: 13,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 1.2,
                          ),
                        ),
                ),
              ),
              const SizedBox(height: 20),
              TextButton(
                onPressed: () => setState(() { _isRegister = !_isRegister; _error = null; }),
                child: Text(
                  _isRegister
                      ? 'EXISTING OPERATOR? PROCEED TO SIGN IN'
                      : 'NEW OPERATOR? REQUEST CREDENTIALS',
                  style: GoogleFonts.jetBrainsMono(
                    fontSize: 11,
                    letterSpacing: 0.8,
                    fontWeight: FontWeight.w600,
                    color: TrustLayerColors.textSecondary,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }
}

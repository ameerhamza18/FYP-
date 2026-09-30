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
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.shield, size: 80, color: TrustLayerColors.primary),
              const SizedBox(height: 16),
              Text('TrustLayer',
                  style: GoogleFonts.inter(
                    fontSize: 32,
                    fontWeight: FontWeight.bold,
                    color: TrustLayerColors.textPrimary
                  )),
              Text('Advanced AI Scam Detection',
                  style: GoogleFonts.inter(
                    fontSize: 16,
                    color: TrustLayerColors.textSecondary
                  )),
              const SizedBox(height: 48),
              TextField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                style: TextStyle(color: TrustLayerColors.textPrimary),
                decoration: InputDecoration(
                  labelText: 'Email',
                  labelStyle: TextStyle(color: TrustLayerColors.textSecondary),
                  prefixIcon: Icon(Icons.email_outlined, color: TrustLayerColors.textSecondary),
                  filled: true,
                  fillColor: TrustLayerColors.surface,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide.none,
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: TrustLayerColors.primary, width: 2),
                  ),
                ),
              ),
              const SizedBox(height: 20),
              TextField(
                controller: _password,
                obscureText: _obscure,
                style: TextStyle(color: TrustLayerColors.textPrimary),
                inputFormatters: [FilteringTextInputFormatter.singleLineFormatter],
                decoration: InputDecoration(
                  labelText: 'Password',
                  labelStyle: TextStyle(color: TrustLayerColors.textSecondary),
                  prefixIcon: Icon(Icons.lock_outline, color: TrustLayerColors.textSecondary),
                  suffixIcon: IconButton(
                    icon: Icon(
                      _obscure ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                      color: TrustLayerColors.textSecondary,
                    ),
                    tooltip: _obscure ? 'Show password' : 'Hide password',
                    onPressed: () => setState(() => _obscure = !_obscure),
                  ),
                  filled: true,
                  fillColor: TrustLayerColors.surface,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide.none,
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: TrustLayerColors.primary, width: 2),
                  ),
                ),
              ),
              const SizedBox(height: 24),
              if (_error != null)
                Container(
                  width: double.infinity,
                  margin: const EdgeInsets.only(bottom: 16),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: TrustLayerColors.critical.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: TrustLayerColors.critical.withOpacity(0.5)),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.error_outline,
                          color: TrustLayerColors.critical, size: 20),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(_error!,
                            style: const TextStyle(
                                color: TrustLayerColors.critical, fontSize: 13)),
                      ),
                    ],
                  ),
                ),
              SizedBox(
                width: double.infinity,
                height: 54,
                child: FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: TrustLayerColors.primary,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  onPressed: _busy ? null : _submit,
                  child: _busy
                      ? const SizedBox(height: 24, width: 24,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : Text(_isRegister ? 'Create account' : 'Sign in',
                          style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w600)),
                ),
              ),
              const SizedBox(height: 16),
              TextButton(
                onPressed: () => setState(() { _isRegister = !_isRegister; _error = null; }),
                child: Text(_isRegister
                    ? 'Already have an account? Sign in'
                    : 'New here? Create an account',
                    style: TextStyle(color: TrustLayerColors.textSecondary)),
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

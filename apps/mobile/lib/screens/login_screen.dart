import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

import '../services/api_client.dart';
import '../services/token_store.dart';
import '../main.dart';
import 'home_screen.dart';

class LoginScreen extends StatefulWidget {
  final bool hasToken;
  const LoginScreen({super.key, this.hasToken = false});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _api = TrustApiClient();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  String? _error;
  bool _isRegister = false;

  @override
  void initState() {
    super.initState();
    if (widget.hasToken) _goHome();
  }

  Future<void> _goHome() async {
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const HomeScreen()),
    );
  }

  Future<void> _submit() async {
    setState(() { _busy = true; _error = null; });
    try {
      if (_isRegister) {
        await _api.register(_email.text.trim(), _password.text);
      } else {
        await _api.login(_email.text.trim(), _password.text);
      }
      await _goHome();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (_) {
      setState(() => _error = 'Cannot reach TrustLayer server. Check ApiConfig.baseUrl.');
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
                obscureText: true,
                style: TextStyle(color: TrustLayerColors.textPrimary),
                inputFormatters: [FilteringTextInputFormatter.singleLineFormatter],
                decoration: InputDecoration(
                  labelText: 'Password',
                  labelStyle: TextStyle(color: TrustLayerColors.textSecondary),
                  prefixIcon: Icon(Icons.lock_outline, color: TrustLayerColors.textSecondary),
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
                Padding(
                  padding: const EdgeInsets.only(bottom: 16),
                  child: Text(_error!,
                      style: TextStyle(color: TrustLayerColors.critical, fontSize: 14)),
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

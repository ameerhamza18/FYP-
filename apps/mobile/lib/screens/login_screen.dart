import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

import '../main.dart';
import '../services/api_client.dart';
import 'home_screen.dart';

class LoginScreen extends StatefulWidget {
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

  Future<void> _configureServerUrl() async {
    final controller = TextEditingController(text: ApiConfig.baseUrl);
    final saved = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: TrustLayerColors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(26)),
        title: Text(
          'API Server URL',
          style: GoogleFonts.plusJakartaSans(
            fontSize: 17,
            fontWeight: FontWeight.w800,
            color: TrustLayerColors.textPrimary,
          ),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Enter your PC Wi-Fi IP running TrustLayer on port 8001\n(e.g. http://192.168.1.15:8001):',
              style: GoogleFonts.plusJakartaSans(
                color: TrustLayerColors.textSecondary,
                fontSize: 12.5,
              ),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: controller,
              keyboardType: TextInputType.url,
              style: GoogleFonts.plusJakartaSans(
                color: TrustLayerColors.textPrimary,
                fontSize: 13.5,
              ),
              decoration: InputDecoration(
                hintText: 'http://192.168.1.15:8001',
                hintStyle: const TextStyle(color: TrustLayerColors.textMuted),
                filled: true,
                fillColor: TrustLayerColors.surfaceElevated,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(''),
            child: const Text(
              'Reset Default',
              style: TextStyle(color: TrustLayerColors.textSecondary),
            ),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: TrustLayerColors.primary,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(20),
              ),
            ),
            onPressed: () => Navigator.of(ctx).pop(controller.text.trim()),
            child: const Text('Save'),
          ),
        ],
      ),
    );
    if (saved != null) {
      await ApiConfig.setOverride(saved.isEmpty ? null : saved);
      if (mounted) setState(() {});
    }
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
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
      if (mounted) {
        setState(() => _error = 'Something went wrong. Please try again.');
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: TrustLayerColors.background,
      body: SafeArea(
        child: SingleChildScrollView(
          child: Column(
            children: [
              // Warm Cream Header Block (Shieldly AI Top Sheet)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.fromLTRB(24, 28, 24, 28),
                decoration: const BoxDecoration(
                  color: TrustLayerColors.headerWarm,
                  borderRadius: BorderRadius.vertical(
                    bottom: Radius.circular(36),
                  ),
                ),
                child: Column(
                  children: [
                    Container(
                      width: 66,
                      height: 66,
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        color: Colors.white,
                      ),
                      child: const Center(
                        child: Icon(
                          Icons.auto_awesome_rounded,
                          size: 30,
                          color: TrustLayerColors.textPrimary,
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'TrustLayer AI',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 26,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.5,
                        color: TrustLayerColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Instant protection against scams, links & phishing',
                      textAlign: TextAlign.center,
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        color: TrustLayerColors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 18),
                    // Sign In / Register Pill Switcher
                    Container(
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.75),
                        borderRadius: BorderRadius.circular(28),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: GestureDetector(
                              onTap: () => setState(() {
                                _isRegister = false;
                                _error = null;
                              }),
                              child: Container(
                                padding:
                                    const EdgeInsets.symmetric(vertical: 11),
                                decoration: BoxDecoration(
                                  color: !_isRegister
                                      ? TrustLayerColors.primary
                                      : Colors.transparent,
                                  borderRadius: BorderRadius.circular(24),
                                ),
                                child: Center(
                                  child: Text(
                                    'Sign In',
                                    style: GoogleFonts.plusJakartaSans(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w700,
                                      color: !_isRegister
                                          ? Colors.white
                                          : TrustLayerColors.textPrimary,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ),
                          Expanded(
                            child: GestureDetector(
                              onTap: () => setState(() {
                                _isRegister = true;
                                _error = null;
                              }),
                              child: Container(
                                padding:
                                    const EdgeInsets.symmetric(vertical: 11),
                                decoration: BoxDecoration(
                                  color: _isRegister
                                      ? TrustLayerColors.primary
                                      : Colors.transparent,
                                  borderRadius: BorderRadius.circular(24),
                                ),
                                child: Center(
                                  child: Text(
                                    'Register',
                                    style: GoogleFonts.plusJakartaSans(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w700,
                                      color: _isRegister
                                          ? Colors.white
                                          : TrustLayerColors.textPrimary,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              // Crisp White Auth Card
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 22, 20, 24),
                child: Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: TrustLayerColors.surface,
                    borderRadius: BorderRadius.circular(28),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF16161A).withOpacity(0.04),
                        blurRadius: 20,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _isRegister ? 'Create your account' : 'Welcome back',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          color: TrustLayerColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        _isRegister
                            ? 'Start scanning messages, links & screenshots.'
                            : 'Sign in to view your scan history & live guard.',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 12.5,
                          color: TrustLayerColors.textSecondary,
                        ),
                      ),
                      const SizedBox(height: 20),
                      TextField(
                        controller: _email,
                        keyboardType: TextInputType.emailAddress,
                        style: GoogleFonts.plusJakartaSans(
                          color: TrustLayerColors.textPrimary,
                          fontSize: 14,
                        ),
                        decoration: InputDecoration(
                          labelText: 'Email address',
                          labelStyle: const TextStyle(
                            color: TrustLayerColors.textSecondary,
                            fontSize: 13,
                          ),
                          prefixIcon: const Icon(
                            Icons.mail_outline_rounded,
                            color: TrustLayerColors.textSecondary,
                            size: 20,
                          ),
                          filled: true,
                          fillColor: TrustLayerColors.surfaceElevated,
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(18),
                            borderSide: BorderSide.none,
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(18),
                            borderSide: const BorderSide(
                              color: TrustLayerColors.primary,
                              width: 1.4,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 14),
                      TextField(
                        controller: _password,
                        obscureText: _obscure,
                        style: GoogleFonts.plusJakartaSans(
                          color: TrustLayerColors.textPrimary,
                          fontSize: 14,
                        ),
                        inputFormatters: [
                          FilteringTextInputFormatter.singleLineFormatter,
                        ],
                        decoration: InputDecoration(
                          labelText: 'Password',
                          labelStyle: const TextStyle(
                            color: TrustLayerColors.textSecondary,
                            fontSize: 13,
                          ),
                          prefixIcon: const Icon(
                            Icons.lock_outline_rounded,
                            color: TrustLayerColors.textSecondary,
                            size: 20,
                          ),
                          suffixIcon: IconButton(
                            icon: Icon(
                              _obscure
                                  ? Icons.visibility_off_outlined
                                  : Icons.visibility_outlined,
                              color: TrustLayerColors.textSecondary,
                              size: 20,
                            ),
                            tooltip:
                                _obscure ? 'Show password' : 'Hide password',
                            onPressed: () =>
                                setState(() => _obscure = !_obscure),
                          ),
                          filled: true,
                          fillColor: TrustLayerColors.surfaceElevated,
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(18),
                            borderSide: BorderSide.none,
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(18),
                            borderSide: const BorderSide(
                              color: TrustLayerColors.primary,
                              width: 1.4,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 18),
                      if (_error != null)
                        Container(
                          width: double.infinity,
                          margin: const EdgeInsets.only(bottom: 16),
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: TrustLayerColors.pillScamBg,
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Icon(
                                Icons.error_outline_rounded,
                                color: TrustLayerColors.critical,
                                size: 18,
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  _error!,
                                  style: GoogleFonts.plusJakartaSans(
                                    color: TrustLayerColors.critical,
                                    fontSize: 12.5,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      SizedBox(
                        width: double.infinity,
                        height: 52,
                        child: FilledButton(
                          style: FilledButton.styleFrom(
                            backgroundColor: TrustLayerColors.primary,
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(26),
                            ),
                            elevation: 0,
                          ),
                          onPressed: _busy ? null : _submit,
                          child: _busy
                              ? const SizedBox(
                                  height: 20,
                                  width: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: Colors.white,
                                  ),
                                )
                              : Text(
                                  _isRegister ? 'Create Account' : 'Sign In',
                                  style: GoogleFonts.plusJakartaSans(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              TextButton.icon(
                onPressed: _configureServerUrl,
                icon: const Icon(
                  Icons.tune_rounded,
                  size: 15,
                  color: TrustLayerColors.textMuted,
                ),
                label: Text(
                  'Server: ${ApiConfig.baseUrl}',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w600,
                    color: TrustLayerColors.textMuted,
                  ),
                ),
              ),
              const SizedBox(height: 16),
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

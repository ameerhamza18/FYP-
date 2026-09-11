import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../services/api_client.dart';
import '../services/token_store.dart';
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
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(28),
          child: Column(
            children: [
              const Icon(Icons.shield, size: 64, color: Color(0xFF2563EB)),
              const SizedBox(height: 8),
              const Text('TrustLayer', style: TextStyle(fontSize: 26, fontWeight: FontWeight.bold)),
              const Text('Stay Safe Online', style: TextStyle(color: Colors.grey)),
              const SizedBox(height: 32),
              TextField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(
                  labelText: 'Email', prefixIcon: Icon(Icons.email_outlined),
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 14),
              TextField(
                controller: _password,
                obscureText: true,
                inputFormatters: [FilteringTextInputFormatter.singleLineFormatter],
                decoration: const InputDecoration(
                  labelText: 'Password', prefixIcon: Icon(Icons.lock_outline),
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 18),
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Text(_error!, style: const TextStyle(color: Colors.red)),
                ),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: _busy ? null : _submit,
                  child: _busy
                      ? const SizedBox(height: 18, width: 18,
                          child: CircularProgressIndicator(strokeWidth: 2))
                      : Text(_isRegister ? 'Create account' : 'Sign in'),
                ),
              ),
              TextButton(
                onPressed: () => setState(() { _isRegister = !_isRegister; _error = null; }),
                child: Text(_isRegister
                    ? 'Already have an account? Sign in'
                    : 'New here? Create an account'),
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

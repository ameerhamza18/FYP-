import 'package:flutter/material.dart';

import 'screens/login_screen.dart';
import 'services/token_store.dart';

void main() {
  runApp(const TrustLayerApp());
}

class TrustLayerApp extends StatelessWidget {
  const TrustLayerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'TrustLayer',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF2563EB),
          brightness: Brightness.light,
        ),
        useMaterial3: true,
      ),
      darkTheme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF2563EB),
          brightness: Brightness.dark,
        ),
        useMaterial3: true,
      ),
      home: const SplashScreen(),
    );
  }
}

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _route();
  }

  Future<void> _route() async {
    final token = await TokenStore.read();
    if (!mounted) return;
    Navigator.of(context).pushReplacement(MaterialPageRoute(
      builder: (_) => LoginScreen(hasToken: token != null),
    ));
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.shield, size: 72, color: Color(0xFF2563EB)),
            SizedBox(height: 12),
            Text('TrustLayer',
                style: TextStyle(fontSize: 26, fontWeight: FontWeight.bold)),
            Text('Stay Safe Online',
                style: TextStyle(color: Colors.grey)),
          ],
        ),
      ),
    );
  }
}

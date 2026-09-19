import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'screens/login_screen.dart';
import 'services/token_store.dart';

class TrustLayerColors {
  static const Color primary = Color(0xFF3B82F6); // Electric Blue
  static const Color background = Color(0xFF0F172A); // Slate-900
  static const Color surface = Color(0xFF1E293B); // Slate-800
  static const Color textPrimary = Color(0xFFF8FAFC); // Slate-50
  static const Color textSecondary = Color(0xFF94A3B8); // Slate-400
  static const Color critical = Color(0xFFEF4444); // Red-500
  static const Color high = Color(0xFFF59E0B); // Amber-500
  static const Color medium = Color(0xFFEAB308); // Yellow-500
  static const Color low = Color(0xFF10B981); // Emerald-500
}

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
      themeMode: ThemeMode.dark,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: TrustLayerColors.primary,
          brightness: Brightness.light,
        ),
        useMaterial3: true,
      ),
      darkTheme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: TrustLayerColors.background,
        colorScheme: ColorScheme.dark(
          primary: TrustLayerColors.primary,
          surface: TrustLayerColors.surface,
          background: TrustLayerColors.background,
          onPrimary: Colors.white,
          onSurface: TrustLayerColors.textPrimary,
          onBackground: TrustLayerColors.textPrimary,
        ),
        textTheme: GoogleFonts.interTextTheme(
          ThemeData.dark().textTheme,
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
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.shield, size: 72, color: TrustLayerColors.primary),
            const SizedBox(height: 12),
            Text('TrustLayer',
                style: GoogleFonts.inter(
                  fontSize: 26,
                  fontWeight: FontWeight.bold,
                  color: TrustLayerColors.textPrimary
                )),
            Text('Stay Safe Online',
                style: TextStyle(color: TrustLayerColors.textSecondary)),
          ],
        ),
      ),
    );
  }
}

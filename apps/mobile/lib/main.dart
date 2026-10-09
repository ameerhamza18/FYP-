import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'screens/home_screen.dart';
import 'screens/login_screen.dart';
import 'services/api_client.dart';
import 'services/token_store.dart';

class TrustLayerColors {
  static const Color primary = Color(0xFF38BDF8); // Cyan-400
  static const Color primaryDark = Color(0xFF0284C7); // Sky-600
  static const Color accent = Color(0xFF3B82F6); // Electric Blue
  static const Color background = Color(0xFF040711); // Deep Obsidian
  static const Color surface = Color(0xFF0A1122); // Carbon Surface
  static const Color surfaceElevated = Color(0xFF101C36); // Elevated Card
  static const Color surfaceBorder = Color(0xFF1E2D4A); // Tactical Hairline Border
  static const Color textPrimary = Color(0xFFF1F5F9); // Slate-100
  static const Color textSecondary = Color(0xFF94A3B8); // Slate-400
  static const Color textMuted = Color(0xFF64748B); // Slate-500
  static const Color critical = Color(0xFFEF4444); // Crimson Alert
  static const Color high = Color(0xFFF97316); // High Warning Orange
  static const Color medium = Color(0xFFFBBF24); // Medium Caution Amber
  static const Color low = Color(0xFF10B981); // Verified Emerald
}

void main() {
  // Required before touching platform channels (SharedPreferences) from startup.
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const TrustLayerApp());
}

/// Global navigator handle so an expired JWT surfacing from *any* API call can
/// still route the user back to sign-in, even without a BuildContext.
final GlobalKey<NavigatorState> tlNavigatorKey = GlobalKey<NavigatorState>();

class TrustLayerApp extends StatefulWidget {
  const TrustLayerApp({super.key});

  @override
  State<TrustLayerApp> createState() => _TrustLayerAppState();
}

class _TrustLayerAppState extends State<TrustLayerApp> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // Fired once when the backend rejects our token (see TrustApiClient._decode).
    TrustApiClient.onSessionExpired = _handleSessionExpired;
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    TrustApiClient.onSessionExpired = null;
    super.dispose();
  }

  /// Sliding sessions: returning to the foreground renews the token, so someone
  /// who spent 20 minutes carefully wording a message is not logged out the
  /// moment they hit "Analyze" because the access token expired in the
  /// background. Failures are ignored — the user keeps working with the current
  /// token, and the global handler intervenes only if it is actually rejected.
  Future<void> _refreshSession() async {
    final token = await TokenStore.read();
    if (token == null) return; // not signed in yet

    try {
      await TrustApiClient().refreshSession();
    } on SessionExpiredException {
      _handleSessionExpired();
    } catch (_) {
      // Offline: harmless; the existing token may still be accepted.
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _refreshSession();
  }

  void _handleSessionExpired() {
    tlNavigatorKey.currentState?.pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginScreen(sessionExpired: true)),
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'TrustLayer',
      navigatorKey: tlNavigatorKey,
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
        colorScheme: const ColorScheme.dark(
          primary: TrustLayerColors.primary,
          surface: TrustLayerColors.surface,
          onPrimary: Color(0xFF040711),
          onSurface: TrustLayerColors.textPrimary,
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: TrustLayerColors.background,
          elevation: 0,
          scrolledUnderElevation: 0,
          centerTitle: false,
        ),
        cardTheme: CardTheme(
          color: TrustLayerColors.surface,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: const BorderSide(color: TrustLayerColors.surfaceBorder, width: 1),
          ),
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

import 'screens/onboarding_screen.dart';
import 'widgets/cyber_shield_3d.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with SingleTickerProviderStateMixin {
  late final AnimationController _pulseController;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat(reverse: true);
    _route();
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  /// Cold-start routing. A stored token is *verified*, never trusted: an expired
  /// JWT must land the user on sign-in, not on a home screen where every action
  /// fails with 401. If no token, user enters the Onboarding Tour.
  Future<void> _route() async {
    // Artificial 1-second delay so splash renders smoothly
    await Future.delayed(const Duration(milliseconds: 1200));
    final token = await TokenStore.read();
    if (!mounted) return;

    if (token == null) {
      _go(const OnboardingScreen());
      return;
    }

    try {
      await TrustApiClient().me();
      _go(const HomeScreen());
    } on SessionExpiredException {
      await TokenStore.clear();
      _go(const LoginScreen(sessionExpired: true));
    } catch (_) {
      // Offline / server unreachable: keep the user signed in optimistically
      _go(const HomeScreen());
    }
  }

  void _go(Widget screen) {
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => screen),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: TrustLayerColors.background,
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AnimatedBuilder(
              animation: _pulseController,
              builder: (context, child) {
                final scale = 1.0 + (_pulseController.value * 0.05);
                return Transform.scale(
                  scale: scale,
                  child: const CyberShield3D(
                    size: 130,
                    glowColor: TrustLayerColors.primary,
                  ),
                );
              },
            ),
            const SizedBox(height: 28),
            Text(
              'TRUSTLAYER',
              style: GoogleFonts.inter(
                fontSize: 22,
                fontWeight: FontWeight.w800,
                letterSpacing: 3.5,
                color: TrustLayerColors.textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'AUTONOMOUS CYBER DEFENSE CORE',
              style: GoogleFonts.jetBrainsMono(
                fontSize: 9.5,
                letterSpacing: 2.2,
                fontWeight: FontWeight.w600,
                color: TrustLayerColors.primary.withOpacity(0.85),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

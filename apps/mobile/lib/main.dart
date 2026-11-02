import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'screens/home_screen.dart';
import 'screens/login_screen.dart';
import 'screens/onboarding_screen.dart';
import 'services/api_client.dart';
import 'services/token_store.dart';
import 'widgets/cyber_shield_3d.dart';

/// Shieldly AI-inspired soft pastel & warm editorial color system.
class TrustLayerColors {
  // Primary Jet-Black Pill & Active Dock Accent
  static const Color primary = Color(0xFF16161A);
  static const Color primaryDark = Color(0xFF0E0E11);
  static const Color accent = Color(0xFF6D5DFB);

  // Warm Cream Header & Cool Alabaster Body
  static const Color background = Color(0xFFF6F6F9);
  static const Color headerWarm = Color(0xFFF5EBE2);
  static const Color headerButton = Color(0xFFEADDD1);

  // Crisp White Sheets & Soft Pill Rows
  static const Color surface = Color(0xFFFFFFFF);
  static const Color surfaceElevated = Color(0xFFF3F4F8);
  static const Color surfaceBorder = Color(0xFFE8E6E1);

  // Typography
  static const Color textPrimary = Color(0xFF16161A);
  static const Color textSecondary = Color(0xFF6B6B76);
  static const Color textMuted = Color(0xFF9A9AA6);

  // Signature Pastel Card Surfaces (Shieldly AI)
  static const Color periwinkle = Color(0xFFC8D2FA);
  static const Color sage = Color(0xFFCBE3DF);
  static const Color sand = Color(0xFFEBDDD3);
  static const Color butter = Color(0xFFE5D283);

  // Semantic Risk Text & Soft Pill Backgrounds
  static const Color critical = Color(0xFFD9383A);
  static const Color high = Color(0xFFD95D1E);
  static const Color medium = Color(0xFF9A6B00);
  static const Color low = Color(0xFF158067);

  static const Color pillSafeBg = Color(0xFFD8F1EA);
  static const Color pillScamBg = Color(0xFFFADBD8);
  static const Color pillRiskyBg = Color(0xFFFCF3CF);
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
    final baseLight = ThemeData.light(useMaterial3: true);
    return MaterialApp(
      title: 'TrustLayer',
      navigatorKey: tlNavigatorKey,
      debugShowCheckedModeBanner: false,
      themeMode: ThemeMode.light,
      theme: baseLight.copyWith(
        scaffoldBackgroundColor: TrustLayerColors.background,
        colorScheme: const ColorScheme.light(
          primary: TrustLayerColors.primary,
          secondary: TrustLayerColors.accent,
          surface: TrustLayerColors.surface,
          onPrimary: Colors.white,
          onSurface: TrustLayerColors.textPrimary,
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: TrustLayerColors.headerWarm,
          foregroundColor: TrustLayerColors.textPrimary,
          elevation: 0,
          scrolledUnderElevation: 0,
          centerTitle: true,
        ),
        snackBarTheme: SnackBarThemeData(
          backgroundColor: TrustLayerColors.primary,
          contentTextStyle: GoogleFonts.plusJakartaSans(
            color: Colors.white,
            fontSize: 13,
            fontWeight: FontWeight.w500,
          ),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        ),
        textTheme: GoogleFonts.plusJakartaSansTextTheme(baseLight.textTheme),
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

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
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
    await ApiConfig.loadOverride();
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
      backgroundColor: TrustLayerColors.headerWarm,
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AnimatedBuilder(
              animation: _pulseController,
              builder: (context, child) {
                final scale = 1.0 + (_pulseController.value * 0.045);
                return Transform.scale(
                  scale: scale,
                  child: Container(
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: Colors.white,
                      boxShadow: [
                        BoxShadow(
                          color: TrustLayerColors.periwinkle.withOpacity(0.55),
                          blurRadius: 36,
                          spreadRadius: 4,
                        ),
                      ],
                    ),
                    child: const CyberShield3D(
                      size: 112,
                      glowColor: TrustLayerColors.accent,
                    ),
                  ),
                );
              },
            ),
            const SizedBox(height: 26),
            Text(
              'TrustLayer AI',
              style: GoogleFonts.plusJakartaSans(
                fontSize: 26,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.5,
                color: TrustLayerColors.textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.85),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                'Instant Scam & Fraud Protection',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: TrustLayerColors.textSecondary,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'screens/home_screen.dart';
import 'screens/login_screen.dart';
import 'services/api_client.dart';
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

  /// Cold-start routing. A stored token is *verified*, never trusted: an expired
  /// JWT must land the user on sign-in, not on a home screen where every action
  /// fails with 401 (the previous behaviour).
  Future<void> _route() async {
    final token = await TokenStore.read();
    if (!mounted) return;

    if (token == null) {
      _go(const LoginScreen());
      return;
    }

    try {
      await TrustApiClient().me();
      _go(const HomeScreen());
    } on SessionExpiredException {
      await TokenStore.clear();
      _go(const LoginScreen(sessionExpired: true));
    } catch (_) {
      // Offline / server unreachable: keep the user signed in optimistically and
      // let the home screen show the connection error with a Retry button.
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

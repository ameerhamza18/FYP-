import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../main.dart';
import '../services/api_client.dart';
import '../services/token_store.dart';
import '../widgets/cyber_shield_3d.dart';
import 'home_screen.dart';
import 'login_screen.dart';

/// Premium Onboarding Screen matching Screen 1 from `mobile-app.jpg`.
///
/// Features:
/// - Brand Header: TrustLayer 3D badge with cyan shield icon
/// - Center: High-fidelity 3D metallic chrome shield with soft cyan ambient aura
/// - Typography: "TrustLayer." and "AI Protection Against Social Engineering."
/// - Page Indicators: 3 futuristic pagination dots
/// - Action Button: "Get Started" tactical glow pill
class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _floatController;
  int _currentPage = 0;

  @override
  void initState() {
    super.initState();
    _floatController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 3000),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _floatController.dispose();
    super.dispose();
  }

  Future<void> _onGetStarted() async {
    final token = await TokenStore.read();
    if (!mounted) return;

    if (token == null) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const LoginScreen()),
      );
      return;
    }

    try {
      await TrustApiClient().me();
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const HomeScreen()),
      );
    } catch (_) {
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const HomeScreen()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: TrustLayerColors.background,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 20),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // Top Brand Pill: "TrustLayer 3D"
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                    decoration: BoxDecoration(
                      color: TrustLayerColors.surfaceElevated,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: TrustLayerColors.primary.withOpacity(0.35),
                        width: 1.2,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: TrustLayerColors.primary.withOpacity(0.12),
                          blurRadius: 16,
                          spreadRadius: 1,
                        ),
                      ],
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.shield_rounded,
                          size: 16,
                          color: TrustLayerColors.primary,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          'TrustLayer',
                          style: GoogleFonts.inter(
                            color: TrustLayerColors.textPrimary,
                            fontWeight: FontWeight.w700,
                            fontSize: 13.5,
                            letterSpacing: 0.5,
                          ),
                        ),
                        const SizedBox(width: 4),
                        Text(
                          '3D',
                          style: GoogleFonts.jetBrainsMono(
                            color: TrustLayerColors.primary,
                            fontWeight: FontWeight.w800,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),

              // Center: Floating 3D Chrome Shield & Circuit Traces
              AnimatedBuilder(
                animation: _floatController,
                builder: (context, child) {
                  final translateY = (_floatController.value - 0.5) * 14.0;
                  return Transform.translate(
                    offset: Offset(0, translateY),
                    child: child,
                  );
                },
                child: const CyberShield3D(
                  size: 240,
                  glowColor: Color(0xFF38BDF8),
                ),
              ),

              // Bottom Section: Title, Subtitle, Dots, & CTA
              Column(
                children: [
                  Text(
                    'TrustLayer.',
                    style: GoogleFonts.inter(
                      fontSize: 32,
                      fontWeight: FontWeight.w900,
                      color: TrustLayerColors.textPrimary,
                      letterSpacing: -0.5,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    'AI Protection Against\nSocial Engineering.',
                    textAlign: TextAlign.center,
                    style: GoogleFonts.inter(
                      fontSize: 16,
                      height: 1.4,
                      fontWeight: FontWeight.w400,
                      color: TrustLayerColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 24),

                  // 3-dots page indicator
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Container(
                        width: 18,
                        height: 5,
                        decoration: BoxDecoration(
                          color: TrustLayerColors.primary,
                          borderRadius: BorderRadius.circular(4),
                          boxShadow: [
                            BoxShadow(
                              color: TrustLayerColors.primary.withOpacity(0.6),
                              blurRadius: 6,
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 6),
                      Container(
                        width: 6,
                        height: 5,
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.2),
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ),
                      const SizedBox(width: 6),
                      Container(
                        width: 6,
                        height: 5,
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.2),
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 28),

                  // "Get Started" CTA Button
                  SizedBox(
                    width: double.infinity,
                    height: 54,
                    child: ElevatedButton(
                      onPressed: _onGetStarted,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF0C172B),
                        foregroundColor: Colors.white,
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(28),
                          side: BorderSide(
                            color: TrustLayerColors.primary.withOpacity(0.6),
                            width: 1.4,
                          ),
                        ),
                        shadowColor: TrustLayerColors.primary.withOpacity(0.3),
                      ),
                      child: Container(
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(28),
                          boxShadow: [
                            BoxShadow(
                              color: TrustLayerColors.primary.withOpacity(0.18),
                              blurRadius: 20,
                              spreadRadius: 1,
                            ),
                          ],
                        ),
                        child: Center(
                          child: Text(
                            'Get Started',
                            style: GoogleFonts.inter(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.5,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

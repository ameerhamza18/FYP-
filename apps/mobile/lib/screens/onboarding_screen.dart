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
  late final PageController _pageController;
  int _currentPage = 0;

  final List<Map<String, dynamic>> _pages = [
    {
      'title': 'TrustLayer.',
      'subtitle': 'AI Protection Against\nSocial Engineering.',
      'glow': const Color(0xFF38BDF8),
    },
    {
      'title': 'Real-time SMS & URL Scanning',
      'subtitle': 'Intercept threats before they reach you.',
      'glow': const Color(0xFF10B981),
    },
    {
      'title': 'Instant AI Verdicts',
      'subtitle': 'Get detailed threat analysis in milliseconds.',
      'glow': const Color(0xFFF43F5E),
    },
  ];

  @override
  void initState() {
    super.initState();
    _pageController = PageController();
    _floatController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 3000),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _pageController.dispose();
    _floatController.dispose();
    super.dispose();
  }

  Future<void> _onGetStarted() async {
    if (_currentPage < _pages.length - 1) {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 400),
        curve: Curves.easeInOut,
      );
      return;
    }

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

              // Center: PageView with Floating 3D Chrome Shield & Content
              Expanded(
                child: PageView.builder(
                  controller: _pageController,
                  onPageChanged: (index) {
                    setState(() {
                      _currentPage = index;
                    });
                  },
                  itemCount: _pages.length,
                  itemBuilder: (context, index) {
                    final page = _pages[index];
                    return Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        AnimatedBuilder(
                          animation: _floatController,
                          builder: (context, child) {
                            final translateY = (_floatController.value - 0.5) * 14.0;
                            return Transform.translate(
                              offset: Offset(0, translateY),
                              child: child,
                            );
                          },
                          child: CyberShield3D(
                            size: 240,
                            glowColor: page['glow'] as Color,
                          ),
                        ),
                        const SizedBox(height: 48),
                        Text(
                          page['title'] as String,
                          textAlign: TextAlign.center,
                          style: GoogleFonts.inter(
                            fontSize: 28,
                            fontWeight: FontWeight.w900,
                            color: TrustLayerColors.textPrimary,
                            letterSpacing: -0.5,
                          ),
                        ),
                        const SizedBox(height: 10),
                        Text(
                          page['subtitle'] as String,
                          textAlign: TextAlign.center,
                          style: GoogleFonts.inter(
                            fontSize: 16,
                            height: 1.4,
                            fontWeight: FontWeight.w400,
                            color: TrustLayerColors.textSecondary,
                          ),
                        ),
                      ],
                    );
                  },
                ),
              ),

              // Bottom Section: Dots, & CTA
              Column(
                children: [
                  // 3-dots page indicator
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: List.generate(
                      _pages.length,
                      (index) {
                        final isActive = _currentPage == index;
                        return AnimatedContainer(
                          duration: const Duration(milliseconds: 300),
                          margin: const EdgeInsets.symmetric(horizontal: 3),
                          width: isActive ? 18 : 6,
                          height: 5,
                          decoration: BoxDecoration(
                            color: isActive
                                ? TrustLayerColors.primary
                                : Colors.white.withOpacity(0.2),
                            borderRadius: BorderRadius.circular(4),
                            boxShadow: isActive
                                ? [
                                    BoxShadow(
                                      color: TrustLayerColors.primary.withOpacity(0.6),
                                      blurRadius: 6,
                                    ),
                                  ]
                                : null,
                          ),
                        );
                      },
                    ),
                  ),

                  const SizedBox(height: 28),

                  // "Get Started" or "Next" CTA Button
                  AnimatedSwitcher(
                    duration: const Duration(milliseconds: 300),
                    child: SizedBox(
                      key: ValueKey<int>(_currentPage),
                      width: double.infinity,
                      height: 54,
                      child: ElevatedButton(
                        onPressed: _onGetStarted,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: _currentPage == _pages.length - 1
                              ? const Color(0xFF0C172B)
                              : TrustLayerColors.surfaceElevated,
                          foregroundColor: Colors.white,
                          elevation: 0,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(28),
                            side: BorderSide(
                              color: _currentPage == _pages.length - 1
                                  ? TrustLayerColors.primary.withOpacity(0.6)
                                  : TrustLayerColors.textSecondary.withOpacity(0.2),
                              width: 1.4,
                            ),
                          ),
                          shadowColor: _currentPage == _pages.length - 1
                              ? TrustLayerColors.primary.withOpacity(0.3)
                              : Colors.transparent,
                        ),
                        child: Container(
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(28),
                            boxShadow: _currentPage == _pages.length - 1
                                ? [
                                    BoxShadow(
                                      color: TrustLayerColors.primary.withOpacity(0.18),
                                      blurRadius: 20,
                                      spreadRadius: 1,
                                    ),
                                  ]
                                : null,
                          ),
                          child: Center(
                            child: Text(
                              _currentPage == _pages.length - 1 ? 'Get Started' : 'Next',
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

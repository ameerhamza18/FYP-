import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../main.dart';
import '../services/api_client.dart';
import '../services/token_store.dart';
import '../widgets/cyber_shield_3d.dart';
import 'home_screen.dart';
import 'login_screen.dart';

/// Soft pastel Onboarding Tour styled after Shieldly AI.
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
      'title': 'Meet TrustLayer AI',
      'subtitle':
          'Paste suspicious texts, links, or screenshots and get instant forensic answers.',
      'cardBg': TrustLayerColors.periwinkle,
      'glow': const Color(0xFF6D5DFB),
      'pill': '• Multimodal AI',
    },
    {
      'title': 'Live SMS & Chat Guard',
      'subtitle':
          'Automatically checks incoming SMS and chat notifications before you tap risky links.',
      'cardBg': TrustLayerColors.sage,
      'glow': const Color(0xFF158067),
      'pill': '• Real-time Shield',
    },
    {
      'title': 'Clear, Honest Verdicts',
      'subtitle':
          'See exact 0–100 risk scores, manipulation tactics, and step-by-step safety guidance.',
      'cardBg': TrustLayerColors.butter,
      'glow': const Color(0xFF9A6B00),
      'pill': '• Zero-Disk Privacy',
    },
  ];

  @override
  void initState() {
    super.initState();
    _pageController = PageController();
    _floatController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2800),
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
        duration: const Duration(milliseconds: 350),
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
          padding: const EdgeInsets.fromLTRB(22, 16, 22, 22),
          child: Column(
            children: [
              // Top Brand Header
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    decoration: BoxDecoration(
                      color: TrustLayerColors.headerWarm,
                      borderRadius: BorderRadius.circular(22),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.auto_awesome_rounded,
                          size: 16,
                          color: TrustLayerColors.textPrimary,
                        ),
                        const SizedBox(width: 7),
                        Text(
                          'TrustLayer AI',
                          style: GoogleFonts.plusJakartaSans(
                            color: TrustLayerColors.textPrimary,
                            fontWeight: FontWeight.w800,
                            fontSize: 13.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                  TextButton(
                    onPressed: () {
                      Navigator.of(context).pushReplacement(
                        MaterialPageRoute(builder: (_) => const LoginScreen()),
                      );
                    },
                    child: Text(
                      'Skip',
                      style: GoogleFonts.plusJakartaSans(
                        color: TrustLayerColors.textSecondary,
                        fontWeight: FontWeight.w600,
                        fontSize: 13,
                      ),
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 16),

              // PageView with Pastel Cards
              Expanded(
                child: PageView.builder(
                  controller: _pageController,
                  onPageChanged: (index) {
                    setState(() => _currentPage = index);
                  },
                  itemCount: _pages.length,
                  itemBuilder: (context, index) {
                    final page = _pages[index];
                    return Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.symmetric(
                            horizontal: 24,
                            vertical: 34,
                          ),
                          decoration: BoxDecoration(
                            color: page['cardBg'] as Color,
                            borderRadius: BorderRadius.circular(34),
                          ),
                          child: Column(
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 12,
                                  vertical: 5,
                                ),
                                decoration: BoxDecoration(
                                  color: Colors.white.withOpacity(0.85),
                                  borderRadius: BorderRadius.circular(20),
                                ),
                                child: Text(
                                  page['pill'] as String,
                                  style: GoogleFonts.plusJakartaSans(
                                    fontSize: 11.5,
                                    fontWeight: FontWeight.w700,
                                    color: TrustLayerColors.textPrimary,
                                  ),
                                ),
                              ),
                              const SizedBox(height: 22),
                              AnimatedBuilder(
                                animation: _floatController,
                                builder: (context, child) {
                                  final translateY =
                                      (_floatController.value - 0.5) * 10.0;
                                  return Transform.translate(
                                    offset: Offset(0, translateY),
                                    child: child,
                                  );
                                },
                                child: CyberShield3D(
                                  size: 195,
                                  glowColor: page['glow'] as Color,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 32),
                        Text(
                          page['title'] as String,
                          textAlign: TextAlign.center,
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 27,
                            fontWeight: FontWeight.w800,
                            color: TrustLayerColors.textPrimary,
                            letterSpacing: -0.5,
                          ),
                        ),
                        const SizedBox(height: 10),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 10),
                          child: Text(
                            page['subtitle'] as String,
                            textAlign: TextAlign.center,
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 14.5,
                              height: 1.5,
                              color: TrustLayerColors.textSecondary,
                            ),
                          ),
                        ),
                      ],
                    );
                  },
                ),
              ),

              // Dots & Jet-Black Pill CTA
              Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: List.generate(_pages.length, (index) {
                      final isActive = _currentPage == index;
                      return AnimatedContainer(
                        duration: const Duration(milliseconds: 250),
                        margin: const EdgeInsets.symmetric(horizontal: 3.5),
                        width: isActive ? 22 : 7,
                        height: 7,
                        decoration: BoxDecoration(
                          color: isActive
                              ? TrustLayerColors.primary
                              : TrustLayerColors.surfaceBorder,
                          borderRadius: BorderRadius.circular(4),
                        ),
                      );
                    }),
                  ),
                  const SizedBox(height: 24),
                  SizedBox(
                    width: double.infinity,
                    height: 56,
                    child: FilledButton(
                      onPressed: _onGetStarted,
                      style: FilledButton.styleFrom(
                        backgroundColor: TrustLayerColors.primary,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(28),
                        ),
                        elevation: 0,
                      ),
                      child: Text(
                        _currentPage == _pages.length - 1
                            ? 'Get Started'
                            : 'Continue',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

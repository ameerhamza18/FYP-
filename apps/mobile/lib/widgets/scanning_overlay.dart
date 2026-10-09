import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../main.dart';
import 'cyber_shield_3d.dart';

/// Animated Scanning State overlay matching Screen 3 from `mobile-app.jpg`.
///
/// Features:
/// - Expanding concentric radar pulse waves
/// - Floating 3D holographic shield at center
/// - Pulsing status text: "TrustLayer AI is actively scanning..."
/// - Subtitle: "detecting anomalies."
/// - 3 animated pulsing pagination dots
class ScanningOverlay extends StatefulWidget {
  const ScanningOverlay({
    super.key,
    this.message = 'TrustLayer AI is actively scanning…',
    this.submessage = 'detecting anomalies.',
  });

  final String message;
  final String submessage;

  @override
  State<ScanningOverlay> createState() => _ScanningOverlayState();
}

class _ScanningOverlayState extends State<ScanningOverlay>
    with TickerProviderStateMixin {
  late final AnimationController _waveController;
  late final AnimationController _dotsController;

  @override
  void initState() {
    super.initState();
    _waveController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2200),
    )..repeat();

    _dotsController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat();
  }

  @override
  void dispose() {
    _waveController.dispose();
    _dotsController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      color: TrustLayerColors.background.withOpacity(0.92),
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Center scanning radar waves with 3D Shield
            SizedBox(
              width: 260,
              height: 260,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  // Animated expanding concentric wave circles
                  AnimatedBuilder(
                    animation: _waveController,
                    builder: (context, child) {
                      return CustomPaint(
                        size: const Size(260, 260),
                        painter: _RadarWavesPainter(
                          progress: _waveController.value,
                          glowColor: TrustLayerColors.primary,
                        ),
                      );
                    },
                  ),

                  // Floating 3D Crystal Shield
                  const CyberShield3D(
                    size: 190,
                    glowColor: TrustLayerColors.primary,
                  ),
                ],
              ),
            ),

            const SizedBox(height: 38),

            // Scanning Status Text
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 36),
              child: Column(
                children: [
                  Text(
                    widget.message,
                    textAlign: TextAlign.center,
                    style: GoogleFonts.inter(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: TrustLayerColors.textPrimary,
                      letterSpacing: 0.3,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    widget.submessage,
                    textAlign: TextAlign.center,
                    style: GoogleFonts.inter(
                      fontSize: 13,
                      fontWeight: FontWeight.w400,
                      color: TrustLayerColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 24),

                  // 3 Animated Glowing Pulsing Dots
                  AnimatedBuilder(
                    animation: _dotsController,
                    builder: (context, child) {
                      final val = _dotsController.value;
                      return Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: List.generate(3, (index) {
                          final phase = (val + (index * 0.33)) % 1.0;
                          final isActive = phase > 0.4 && phase < 0.8;
                          return Container(
                            margin: const EdgeInsets.symmetric(horizontal: 4),
                            width: isActive ? 16 : 6,
                            height: 6,
                            decoration: BoxDecoration(
                              color: isActive
                                  ? TrustLayerColors.primary
                                  : Colors.white.withOpacity(0.2),
                              borderRadius: BorderRadius.circular(3),
                              boxShadow: isActive
                                  ? [
                                      BoxShadow(
                                        color: TrustLayerColors.primary.withOpacity(0.6),
                                        blurRadius: 8,
                                      ),
                                    ]
                                  : null,
                            ),
                          );
                        }),
                      );
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RadarWavesPainter extends CustomPainter {
  _RadarWavesPainter({
    required this.progress,
    required this.glowColor,
  });

  final double progress;
  final Color glowColor;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final maxRadius = size.width / 2;

    // 3 progressive wave rings
    for (int i = 0; i < 3; i++) {
      final waveProgress = (progress + (i / 3.0)) % 1.0;
      final radius = maxRadius * (0.45 + waveProgress * 0.55);
      final opacity = (1.0 - waveProgress) * 0.4;

      final wavePaint = Paint()
        ..color = glowColor.withOpacity(opacity.clamp(0.0, 1.0))
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.6;

      canvas.drawCircle(center, radius, wavePaint);
    }
  }

  @override
  bool shouldRepaint(covariant _RadarWavesPainter oldDelegate) =>
      oldDelegate.progress != progress;
}

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../main.dart';
import 'cyber_shield_3d.dart';

/// Soft pastel scanning overlay matching Shieldly AI's clean, calm aesthetic.
class ScanningOverlay extends StatefulWidget {
  const ScanningOverlay({
    super.key,
    this.message = 'TrustLayer AI is actively scanning…',
    this.submessage = 'Inspecting signals across 4 forensic engines.',
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
      color: TrustLayerColors.background.withOpacity(0.94),
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            SizedBox(
              width: 240,
              height: 240,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  AnimatedBuilder(
                    animation: _waveController,
                    builder: (context, child) {
                      return CustomPaint(
                        size: const Size(240, 240),
                        painter: _RadarWavesPainter(
                          progress: _waveController.value,
                          glowColor: TrustLayerColors.accent,
                        ),
                      );
                    },
                  ),
                  Container(
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: TrustLayerColors.periwinkle.withOpacity(0.7),
                          blurRadius: 32,
                          spreadRadius: 4,
                        ),
                      ],
                    ),
                    child: const CyberShield3D(
                      size: 132,
                      glowColor: TrustLayerColors.accent,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 32),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 36),
              child: Column(
                children: [
                  Text(
                    widget.message,
                    textAlign: TextAlign.center,
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 17,
                      fontWeight: FontWeight.w700,
                      color: TrustLayerColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    widget.submessage,
                    textAlign: TextAlign.center,
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: TrustLayerColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 24),
                  AnimatedBuilder(
                    animation: _dotsController,
                    builder: (context, child) {
                      final val = _dotsController.value;
                      return Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: List.generate(3, (index) {
                          final phase = (val + (index * 0.33)) % 1.0;
                          final isActive = phase > 0.4 && phase < 0.8;
                          return AnimatedContainer(
                            duration: const Duration(milliseconds: 180),
                            margin: const EdgeInsets.symmetric(horizontal: 4),
                            width: isActive ? 18 : 7,
                            height: 7,
                            decoration: BoxDecoration(
                              color: isActive
                                  ? TrustLayerColors.primary
                                  : TrustLayerColors.periwinkle,
                              borderRadius: BorderRadius.circular(4),
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

    for (int i = 0; i < 3; i++) {
      final waveProgress = (progress + (i / 3.0)) % 1.0;
      final radius = maxRadius * (0.42 + waveProgress * 0.56);
      final opacity = (1.0 - waveProgress) * 0.35;

      final wavePaint = Paint()
        ..color = glowColor.withOpacity(opacity.clamp(0.0, 1.0))
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.0;

      canvas.drawCircle(center, radius, wavePaint);
    }
  }

  @override
  bool shouldRepaint(covariant _RadarWavesPainter oldDelegate) =>
      oldDelegate.progress != progress;
}

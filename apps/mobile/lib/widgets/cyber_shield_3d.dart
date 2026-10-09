import 'dart:math' as math;
import 'package:flutter/material.dart';

/// Ultra-premium 3D metallic/chrome cybersecurity shield widget.
///
/// Faithfully renders the 3D faceted metallic shield from `mobile-app.jpg`:
/// - Multi-layered beveled chrome rim with specular lighting
/// - Faceted left/right halves with contrasting light/shadow gradients
/// - Inner cyber-glass panel with subtle reflections
/// - Circuit board etched traces and glowing node junctions behind the shield
/// - Concentric holographic radar rings and ambient cyan glow halo
class CyberShield3D extends StatelessWidget {
  const CyberShield3D({
    super.key,
    this.size = 180,
    this.glowColor = const Color(0xFF38BDF8),
    this.isPulsing = true,
    this.statusText,
  });

  final double size;
  final Color glowColor;
  final bool isPulsing;
  final String? statusText;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Background ambient circular glow
          Container(
            width: size * 0.85,
            height: size * 0.85,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: glowColor.withOpacity(0.28),
                  blurRadius: size * 0.35,
                  spreadRadius: size * 0.05,
                ),
              ],
            ),
          ),
          // Custom painted 3D Shield with circuit traces and holographic accents
          CustomPaint(
            size: Size(size, size),
            painter: _CyberShieldPainter(
              glowColor: glowColor,
            ),
          ),
        ],
      ),
    );
  }
}

class _CyberShieldPainter extends CustomPainter {
  _CyberShieldPainter({
    required this.glowColor,
  });

  final Color glowColor;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final w = size.width;
    final h = size.height;

    // 1. Draw subtle circuit traces behind the shield
    _drawCircuitTraces(canvas, size, center);

    // 2. Draw holographic calibrated arcs
    _drawHoloRings(canvas, size, center);

    // 3. Define 3D Shield geometry
    // Dimensions relative to canvas center
    final shieldWidth = w * 0.58;
    final shieldHeight = h * 0.72;
    final shieldTop = (h - shieldHeight) / 2;
    final shieldLeft = (w - shieldWidth) / 2;
    final rect = Rect.fromLTWH(shieldLeft, shieldTop, shieldWidth, shieldHeight);

    // Base shield path
    final shieldPath = _createShieldPath(rect);

    // 4. Outer Metallic Bevel Shadow / Glow
    final shadowPaint = Paint()
      ..color = Colors.black.withOpacity(0.65)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 12);
    canvas.drawPath(shieldPath, shadowPaint);

    // 5. Outer Bezel (Chrome / Dark Titanium Gradient)
    final bezelPaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          const Color(0xFFE2E8F0), // Chrome specular highlight
          const Color(0xFF64748B), // Slate metallic
          const Color(0xFF1E293B), // Dark Titanium
          const Color(0xFF0F172A), // Shadowed base
        ],
        stops: const [0.0, 0.35, 0.7, 1.0],
      ).createShader(rect);
    canvas.drawPath(shieldPath, bezelPaint);

    // 6. Outer Bezel Rim Stroke
    final rimPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.0
      ..shader = LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          Colors.white.withOpacity(0.9),
          glowColor.withOpacity(0.8),
          const Color(0xFF0284C7).withOpacity(0.3),
          Colors.white.withOpacity(0.1),
        ],
        stops: const [0.0, 0.3, 0.7, 1.0],
      ).createShader(rect);
    canvas.drawPath(shieldPath, rimPaint);

    // 7. Inner Recessed Glass Facet (Left Half & Right Half for 3D depth)
    final innerRect = Rect.fromLTWH(
      shieldLeft + shieldWidth * 0.08,
      shieldTop + shieldHeight * 0.08,
      shieldWidth * 0.84,
      shieldHeight * 0.84,
    );

    final leftHalfPath = _createLeftHalfShieldPath(innerRect);
    final rightHalfPath = _createRightHalfShieldPath(innerRect);

    // Left Half: Lit side (reflects ambient cyber cyan & soft chrome light)
    final leftFacetPaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          glowColor.withOpacity(0.35),
          const Color(0xFF0E2338),
          const Color(0xFF060D1A),
        ],
        stops: const [0.0, 0.5, 1.0],
      ).createShader(innerRect);
    canvas.drawPath(leftHalfPath, leftFacetPaint);

    // Right Half: Shadowed side (deep obsidian & navy reflections)
    final rightFacetPaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topRight,
        end: Alignment.bottomLeft,
        colors: [
          const Color(0xFF1E2D44),
          const Color(0xFF08101E),
          const Color(0xFF020610),
        ],
        stops: const [0.0, 0.45, 1.0],
      ).createShader(innerRect);
    canvas.drawPath(rightHalfPath, rightFacetPaint);

    // 8. Central 3D Ridge Highlight Line
    final centerRidgePaint = Paint()
      ..color = Colors.white.withOpacity(0.7)
      ..strokeWidth = 1.2
      ..style = PaintingStyle.stroke;
    canvas.drawLine(
      Offset(innerRect.center.dx, innerRect.top + 2),
      Offset(innerRect.center.dx, innerRect.bottom - 4),
      centerRidgePaint,
    );

    // 9. Diagonal Specular Glass Glare across left facet
    final glarePath = Path();
    glarePath.moveTo(innerRect.left + innerRect.width * 0.1, innerRect.top + innerRect.height * 0.2);
    glarePath.lineTo(innerRect.center.dx, innerRect.top + 4);
    glarePath.lineTo(innerRect.center.dx, innerRect.top + innerRect.height * 0.45);
    glarePath.lineTo(innerRect.left + innerRect.width * 0.05, innerRect.top + innerRect.height * 0.55);
    glarePath.close();

    final glarePaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          Colors.white.withOpacity(0.25),
          Colors.white.withOpacity(0.0),
        ],
      ).createShader(innerRect);
    canvas.drawPath(glarePath, glarePaint);

    // 10. Center glowing diamond / core node
    final corePaint = Paint()
      ..color = glowColor
      ..maskFilter = const MaskFilter.blur(BlurStyle.solid, 4);
    canvas.drawCircle(Offset(innerRect.center.dx, innerRect.center.dy - 6), 3.5, corePaint);
  }

  void _drawCircuitTraces(Canvas canvas, Size size, Offset center) {
    final tracePaint = Paint()
      ..color = glowColor.withOpacity(0.22)
      ..strokeWidth = 1.2
      ..style = PaintingStyle.stroke;

    final dotPaint = Paint()
      ..color = glowColor.withOpacity(0.4)
      ..style = PaintingStyle.fill;

    final w = size.width;
    final h = size.height;

    // Left circuit trace
    final pathL = Path();
    pathL.moveTo(w * 0.04, h * 0.42);
    pathL.lineTo(w * 0.16, h * 0.42);
    pathL.lineTo(w * 0.22, h * 0.34);
    pathL.lineTo(w * 0.28, h * 0.34);
    canvas.drawPath(pathL, tracePaint);
    canvas.drawCircle(Offset(w * 0.04, h * 0.42), 2.5, dotPaint);
    canvas.drawCircle(Offset(w * 0.28, h * 0.34), 2.0, dotPaint);

    // Right circuit trace
    final pathR = Path();
    pathR.moveTo(w * 0.96, h * 0.52);
    pathR.lineTo(w * 0.84, h * 0.52);
    pathR.lineTo(w * 0.78, h * 0.60);
    pathR.lineTo(w * 0.72, h * 0.60);
    canvas.drawPath(pathR, tracePaint);
    canvas.drawCircle(Offset(w * 0.96, h * 0.52), 2.5, dotPaint);
    canvas.drawCircle(Offset(w * 0.72, h * 0.60), 2.0, dotPaint);
  }

  void _drawHoloRings(Canvas canvas, Size size, Offset center) {
    final ringPaint = Paint()
      ..color = glowColor.withOpacity(0.12)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.0;

    final radius = size.width * 0.44;
    canvas.drawCircle(center, radius, ringPaint);
    canvas.drawCircle(center, radius * 0.82, ringPaint);

    // Segmented outer arc
    final arcPaint = Paint()
      ..color = glowColor.withOpacity(0.35)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.0;

    final arcRect = Rect.fromCircle(center: center, radius: radius);
    canvas.drawArc(arcRect, -math.pi / 4, math.pi / 2, false, arcPaint);
    canvas.drawArc(arcRect, 3 * math.pi / 4, math.pi / 2, false, arcPaint);
  }

  Path _createShieldPath(Rect rect) {
    final path = Path();
    final topCenter = Offset(rect.center.dx, rect.top);
    final bottomTip = Offset(rect.center.dx, rect.bottom);
    final leftShoulder = Offset(rect.left, rect.top + rect.height * 0.35);
    final rightShoulder = Offset(rect.right, rect.top + rect.height * 0.35);

    path.moveTo(topCenter.dx, topCenter.dy);
    // Top right curve to shoulder
    path.cubicTo(
      rect.left + rect.width * 0.85, rect.top,
      rightShoulder.dx, rect.top + rect.height * 0.08,
      rightShoulder.dx, rightShoulder.dy,
    );
    // Right shoulder to bottom tip
    path.cubicTo(
      rightShoulder.dx, rect.top + rect.height * 0.68,
      rect.left + rect.width * 0.75, rect.bottom - rect.height * 0.12,
      bottomTip.dx, bottomTip.dy,
    );
    // Bottom tip to left shoulder
    path.cubicTo(
      rect.left + rect.width * 0.25, rect.bottom - rect.height * 0.12,
      leftShoulder.dx, rect.top + rect.height * 0.68,
      leftShoulder.dx, leftShoulder.dy,
    );
    // Left shoulder to top center
    path.cubicTo(
      leftShoulder.dx, rect.top + rect.height * 0.08,
      rect.left + rect.width * 0.15, rect.top,
      topCenter.dx, topCenter.dy,
    );
    path.close();
    return path;
  }

  Path _createLeftHalfShieldPath(Rect rect) {
    final path = Path();
    final topCenter = Offset(rect.center.dx, rect.top);
    final bottomTip = Offset(rect.center.dx, rect.bottom);
    final leftShoulder = Offset(rect.left, rect.top + rect.height * 0.35);

    path.moveTo(topCenter.dx, topCenter.dy);
    path.lineTo(bottomTip.dx, bottomTip.dy);
    path.cubicTo(
      rect.left + rect.width * 0.25, rect.bottom - rect.height * 0.12,
      leftShoulder.dx, rect.top + rect.height * 0.68,
      leftShoulder.dx, leftShoulder.dy,
    );
    path.cubicTo(
      leftShoulder.dx, rect.top + rect.height * 0.08,
      rect.left + rect.width * 0.15, rect.top,
      topCenter.dx, topCenter.dy,
    );
    path.close();
    return path;
  }

  Path _createRightHalfShieldPath(Rect rect) {
    final path = Path();
    final topCenter = Offset(rect.center.dx, rect.top);
    final bottomTip = Offset(rect.center.dx, rect.bottom);
    final rightShoulder = Offset(rect.right, rect.top + rect.height * 0.35);

    path.moveTo(topCenter.dx, topCenter.dy);
    path.cubicTo(
      rect.left + rect.width * 0.85, rect.top,
      rightShoulder.dx, rect.top + rect.height * 0.08,
      rightShoulder.dx, rightShoulder.dy,
    );
    path.cubicTo(
      rightShoulder.dx, rect.top + rect.height * 0.68,
      rect.left + rect.width * 0.75, rect.bottom - rect.height * 0.12,
      bottomTip.dx, bottomTip.dy,
    );
    path.lineTo(topCenter.dx, topCenter.dy);
    path.close();
    return path;
  }

  @override
  bool shouldRepaint(covariant _CyberShieldPainter oldDelegate) =>
      oldDelegate.glowColor != glowColor;
}

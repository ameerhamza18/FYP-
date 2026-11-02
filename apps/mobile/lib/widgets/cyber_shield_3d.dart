import 'dart:math' as math;
import 'package:flutter/material.dart';

/// Soft ceramic & pastel glass 3D shield emblem styled for the Shieldly AI light theme.
class CyberShield3D extends StatelessWidget {
  const CyberShield3D({
    super.key,
    this.size = 180,
    this.glowColor = const Color(0xFF6D5DFB),
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
          Container(
            width: size * 0.78,
            height: size * 0.78,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: glowColor.withOpacity(0.18),
                  blurRadius: size * 0.28,
                  spreadRadius: size * 0.04,
                ),
              ],
            ),
          ),
          CustomPaint(
            size: Size(size, size),
            painter: _CyberShieldPainter(glowColor: glowColor),
          ),
        ],
      ),
    );
  }
}

class _CyberShieldPainter extends CustomPainter {
  _CyberShieldPainter({required this.glowColor});

  final Color glowColor;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final w = size.width;
    final h = size.height;

    _drawSoftRings(canvas, size, center);

    final shieldWidth = w * 0.56;
    final shieldHeight = h * 0.70;
    final shieldTop = (h - shieldHeight) / 2;
    final shieldLeft = (w - shieldWidth) / 2;
    final rect = Rect.fromLTWH(shieldLeft, shieldTop, shieldWidth, shieldHeight);

    final shieldPath = _createShieldPath(rect);

    // Soft elevated ceramic shadow
    final shadowPaint = Paint()
      ..color = const Color(0xFF16161A).withOpacity(0.12)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 12);
    canvas.drawPath(shieldPath.shift(const Offset(0, 6)), shadowPaint);

    // Outer Ceramic Bezel (Warm pearl -> periwinkle tint)
    final bezelPaint = Paint()
      ..shader = const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          Color(0xFFFFFFFF),
          Color(0xFFEEF1FE),
          Color(0xFFD5DDFB),
          Color(0xFFC3CEF8),
        ],
        stops: [0.0, 0.4, 0.75, 1.0],
      ).createShader(rect);
    canvas.drawPath(shieldPath, bezelPaint);

    // Outer Crisp Specular Rim
    final rimPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.0
      ..shader = LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          Colors.white,
          glowColor.withOpacity(0.45),
          glowColor.withOpacity(0.25),
        ],
      ).createShader(rect);
    canvas.drawPath(shieldPath, rimPaint);

    // Inner Faceted Halves
    final innerRect = Rect.fromLTWH(
      shieldLeft + shieldWidth * 0.09,
      shieldTop + shieldHeight * 0.09,
      shieldWidth * 0.82,
      shieldHeight * 0.82,
    );

    final leftHalfPath = _createLeftHalfShieldPath(innerRect);
    final rightHalfPath = _createRightHalfShieldPath(innerRect);

    final leftFacetPaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          glowColor.withOpacity(0.88),
          glowColor,
        ],
      ).createShader(innerRect);
    canvas.drawPath(leftHalfPath, leftFacetPaint);

    final rightFacetPaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topRight,
        end: Alignment.bottomLeft,
        colors: [
          Color.lerp(glowColor, const Color(0xFF16161A), 0.18)!,
          Color.lerp(glowColor, const Color(0xFF16161A), 0.32)!,
        ],
      ).createShader(innerRect);
    canvas.drawPath(rightHalfPath, rightFacetPaint);

    // Central Ridge Highlight
    final centerRidgePaint = Paint()
      ..color = Colors.white.withOpacity(0.55)
      ..strokeWidth = 1.2
      ..style = PaintingStyle.stroke;
    canvas.drawLine(
      Offset(innerRect.center.dx, innerRect.top + 3),
      Offset(innerRect.center.dx, innerRect.bottom - 5),
      centerRidgePaint,
    );

    // Center Sparkle Star (Shieldly AI signature motif)
    _drawSparkle(
      canvas,
      Offset(innerRect.center.dx, innerRect.center.dy - 2),
      innerRect.width * 0.20,
    );
  }

  void _drawSparkle(Canvas canvas, Offset c, double r) {
    final path = Path()
      ..moveTo(c.dx, c.dy - r)
      ..quadraticBezierTo(c.dx, c.dy, c.dx + r, c.dy)
      ..quadraticBezierTo(c.dx, c.dy, c.dx, c.dy + r)
      ..quadraticBezierTo(c.dx, c.dy, c.dx - r, c.dy)
      ..quadraticBezierTo(c.dx, c.dy, c.dx, c.dy - r)
      ..close();
    final paint = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.fill;
    canvas.drawPath(path, paint);
  }

  void _drawSoftRings(Canvas canvas, Size size, Offset center) {
    final ringPaint = Paint()
      ..color = glowColor.withOpacity(0.14)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2;

    final radius = size.width * 0.44;
    canvas.drawCircle(center, radius, ringPaint);
    canvas.drawCircle(center, radius * 0.84, ringPaint);

    final arcPaint = Paint()
      ..color = glowColor.withOpacity(0.32)
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeWidth = 2.2;

    final arcRect = Rect.fromCircle(center: center, radius: radius);
    canvas.drawArc(arcRect, -math.pi / 4, math.pi / 2.4, false, arcPaint);
    canvas.drawArc(arcRect, 3 * math.pi / 4, math.pi / 2.4, false, arcPaint);
  }

  Path _createShieldPath(Rect rect) {
    final path = Path();
    final topCenter = Offset(rect.center.dx, rect.top);
    final bottomTip = Offset(rect.center.dx, rect.bottom);
    final leftShoulder = Offset(rect.left, rect.top + rect.height * 0.35);
    final rightShoulder = Offset(rect.right, rect.top + rect.height * 0.35);

    path.moveTo(topCenter.dx, topCenter.dy);
    path.cubicTo(
      rect.left + rect.width * 0.85,
      rect.top,
      rightShoulder.dx,
      rect.top + rect.height * 0.08,
      rightShoulder.dx,
      rightShoulder.dy,
    );
    path.cubicTo(
      rightShoulder.dx,
      rect.top + rect.height * 0.68,
      rect.left + rect.width * 0.75,
      rect.bottom - rect.height * 0.12,
      bottomTip.dx,
      bottomTip.dy,
    );
    path.cubicTo(
      rect.left + rect.width * 0.25,
      rect.bottom - rect.height * 0.12,
      leftShoulder.dx,
      rect.top + rect.height * 0.68,
      leftShoulder.dx,
      leftShoulder.dy,
    );
    path.cubicTo(
      leftShoulder.dx,
      rect.top + rect.height * 0.08,
      rect.left + rect.width * 0.15,
      rect.top,
      topCenter.dx,
      topCenter.dy,
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
      rect.left + rect.width * 0.25,
      rect.bottom - rect.height * 0.12,
      leftShoulder.dx,
      rect.top + rect.height * 0.68,
      leftShoulder.dx,
      leftShoulder.dy,
    );
    path.cubicTo(
      leftShoulder.dx,
      rect.top + rect.height * 0.08,
      rect.left + rect.width * 0.15,
      rect.top,
      topCenter.dx,
      topCenter.dy,
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
      rect.left + rect.width * 0.85,
      rect.top,
      rightShoulder.dx,
      rect.top + rect.height * 0.08,
      rightShoulder.dx,
      rightShoulder.dy,
    );
    path.cubicTo(
      rightShoulder.dx,
      rect.top + rect.height * 0.68,
      rect.left + rect.width * 0.75,
      rect.bottom - rect.height * 0.12,
      bottomTip.dx,
      bottomTip.dy,
    );
    path.lineTo(topCenter.dx, topCenter.dy);
    path.close();
    return path;
  }

  @override
  bool shouldRepaint(covariant _CyberShieldPainter oldDelegate) =>
      oldDelegate.glowColor != glowColor;
}

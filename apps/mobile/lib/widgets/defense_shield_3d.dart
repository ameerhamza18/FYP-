import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../main.dart';

/// Interactive 3D Perspective Defense Shield.
///
/// Implements tactile gyroscopic/touch tilt using Matrix4 3D perspective transforms,
/// layered holographic radar arcs, and real-time status pulses.
class DefenseShield3D extends StatefulWidget {
  const DefenseShield3D({
    super.key,
    required this.isProtected,
    this.onTap,
  });

  final bool isProtected;
  final VoidCallback? onTap;

  @override
  State<DefenseShield3D> createState() => _DefenseShield3DState();
}

class _DefenseShield3DState extends State<DefenseShield3D>
    with TickerProviderStateMixin {
  late final AnimationController _rotationController;
  late final AnimationController _tiltSpringController;

  double _tiltX = 0.0;
  double _tiltY = 0.0;
  double _prevTiltX = 0.0;
  double _prevTiltY = 0.0;

  @override
  void initState() {
    super.initState();
    // Continuous subtle holographic sweep rotation
    _rotationController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 8),
    )..repeat();

    // Spring-back animation on touch release
    _tiltSpringController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    )..addListener(() {
        setState(() {
          _tiltX = (1.0 - _tiltSpringController.value) * _prevTiltX;
          _tiltY = (1.0 - _tiltSpringController.value) * _prevTiltY;
        });
      });
  }

  @override
  void dispose() {
    _rotationController.dispose();
    _tiltSpringController.dispose();
    super.dispose();
  }

  void _onPanUpdate(DragUpdateDetails details) {
    _tiltSpringController.stop();
    setState(() {
      // Clamp tilt to max +/- 0.35 radians (~20 degrees)
      _tiltX = (_tiltX - details.delta.dy * 0.005).clamp(-0.35, 0.35);
      _tiltY = (_tiltY + details.delta.dx * 0.005).clamp(-0.35, 0.35);
    });
  }

  void _onPanEnd(DragEndDetails details) {
    _prevTiltX = _tiltX;
    _prevTiltY = _tiltY;
    _tiltSpringController.forward(from: 0.0);
  }

  @override
  Widget build(BuildContext context) {
    final statusColor = widget.isProtected
        ? TrustLayerColors.low
        : const Color(0xFFF59E0B); // Emerald / Amber

    final statusText = widget.isProtected
        ? 'SYSTEM PROTECTED'
        : 'PROTECTION REQUIRED';

    final subtext = widget.isProtected
        ? 'Real-time SMS & message interception active'
        : 'Action needed to activate hardware sensor guards';

    return GestureDetector(
      onPanUpdate: _onPanUpdate,
      onPanEnd: _onPanEnd,
      onTap: widget.onTap,
      child: Transform(
        alignment: Alignment.center,
        transform: Matrix4.identity()
          ..setEntry(3, 2, 0.0018) // 3D Perspective depth factor
          ..rotateX(_tiltX)
          ..rotateY(_tiltY),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(28),
            // Multi-layered titanium / deep obsidian gradient
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Color(0xFF131B2E),
                Color(0xFF090D17),
              ],
            ),
            border: Border.all(
              color: statusColor.withOpacity(0.35),
              width: 1.5,
            ),
            boxShadow: [
              BoxShadow(
                color: statusColor.withOpacity(0.12),
                blurRadius: 30,
                spreadRadius: 2,
                offset: const Offset(0, 10),
              ),
              const BoxShadow(
                color: Colors.black54,
                blurRadius: 20,
                offset: Offset(0, 6),
              ),
            ],
          ),
          child: Column(
            children: [
              // Top Monospace Telemetry Header
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 7,
                        height: 7,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: statusColor,
                          boxShadow: [
                            BoxShadow(
                              color: statusColor.withOpacity(0.8),
                              blurRadius: 6,
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        'TRUST CORE // 3D SENSOR',
                        style: GoogleFonts.jetBrainsMono(
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 1.2,
                          color: Colors.white70,
                        ),
                      ),
                    ],
                  ),
                  Text(
                    widget.isProtected ? 'ONLINE' : 'ATTENTION',
                    style: GoogleFonts.jetBrainsMono(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 1.0,
                      color: statusColor,
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 22),

              // 3D Holographic Concentric Shield Core
              SizedBox(
                width: 160,
                height: 160,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    // Outer rotating radar sweep ring
                    AnimatedBuilder(
                      animation: _rotationController,
                      builder: (context, child) {
                        return Transform.rotate(
                          angle: _rotationController.value * 2 * math.pi,
                          child: CustomPaint(
                            size: const Size(160, 160),
                            painter: _RadarSweepPainter(accentColor: statusColor),
                          ),
                        );
                      },
                    ),

                    // Inner frosted glass badge
                    Container(
                      width: 90,
                      height: 90,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: const Color(0xFF0F172A).withOpacity(0.9),
                        border: Border.all(
                          color: statusColor.withOpacity(0.5),
                          width: 2.0,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: statusColor.withOpacity(0.3),
                            blurRadius: 18,
                            spreadRadius: 2,
                          ),
                        ],
                      ),
                      child: Icon(
                        widget.isProtected
                            ? Icons.verified_user_rounded
                            : Icons.security_update_warning_rounded,
                        color: statusColor,
                        size: 46,
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 20),

              // Status Headline
              Text(
                statusText,
                style: GoogleFonts.inter(
                  fontSize: 17,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 0.8,
                  color: Colors.white,
                ),
              ),

              const SizedBox(height: 6),

              // Status Subtext
              Text(
                subtext,
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(
                  fontSize: 12,
                  height: 1.4,
                  color: Colors.white60,
                ),
              ),

              const SizedBox(height: 14),

              // Touch Interaction Hint
              Text(
                '✦ DRAG TO TILT 3D PERSPECTIVE',
                style: GoogleFonts.jetBrainsMono(
                  fontSize: 9,
                  fontWeight: FontWeight.w500,
                  letterSpacing: 1.5,
                  color: Colors.white30,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Custom painter for holographic radar rings and rotating radar sweep
class _RadarSweepPainter extends CustomPainter {
  _RadarSweepPainter({required this.accentColor});

  final Color accentColor;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2;

    // 1. Concentric reference grid rings
    final ringPaint = Paint()
      ..color = accentColor.withOpacity(0.18)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.0;

    canvas.drawCircle(center, radius * 0.72, ringPaint);
    canvas.drawCircle(center, radius * 0.95, ringPaint);

    // 2. Rotating radar gradient arc
    final sweepPaint = Paint()
      ..shader = SweepGradient(
        colors: [
          accentColor.withOpacity(0.0),
          accentColor.withOpacity(0.28),
        ],
        stops: const [0.65, 1.0],
      ).createShader(Rect.fromCircle(center: center, radius: radius))
      ..style = PaintingStyle.fill;

    canvas.drawCircle(center, radius * 0.95, sweepPaint);

    // 3. Four cardinal crosshairs
    final crossPaint = Paint()
      ..color = accentColor.withOpacity(0.35)
      ..strokeWidth = 1.5;

    canvas.drawLine(Offset(center.dx, 0), Offset(center.dx, 8), crossPaint);
    canvas.drawLine(
        Offset(center.dx, size.height - 8), Offset(center.dx, size.height), crossPaint);
    canvas.drawLine(Offset(0, center.dy), Offset(8, center.dy), crossPaint);
    canvas.drawLine(
        Offset(size.width - 8, center.dy), Offset(size.width, center.dy), crossPaint);
  }

  @override
  bool shouldRepaint(covariant _RadarSweepPainter oldDelegate) =>
      oldDelegate.accentColor != accentColor;
}

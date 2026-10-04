import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../main.dart';

/// Interactive 3D Perspective Defense Shield.
///
/// Implements tactile gyroscopic/touch tilt using Matrix4 3D perspective transforms,
/// layered holographic radar arcs, calibrated tick rings, and real-time status pulses.
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
  late final AnimationController _reverseRotationController;
  late final AnimationController _pulseController;
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
      duration: const Duration(seconds: 10),
    )..repeat();

    // Reverse rotating outer calibrated ring
    _reverseRotationController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 16),
    )..repeat(reverse: false);

    // Subtle breathing pulse for core glow
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2200),
    )..repeat(reverse: true);

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
    _reverseRotationController.dispose();
    _pulseController.dispose();
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
        ? 'SENTINEL CORE ARMED'
        : 'PROTECTION STANDBY';

    final subtext = widget.isProtected
        ? 'Autonomous neural interception & heuristic screening active'
        : 'Action required to arm background SMS & chat sensors';

    return GestureDetector(
      onPanUpdate: _onPanUpdate,
      onPanEnd: _onPanEnd,
      onTap: widget.onTap,
      child: Transform(
        alignment: Alignment.center,
        transform: Matrix4.identity()
          ..setEntry(3, 2, 0.0016) // 3D Perspective depth factor
          ..rotateX(_tiltX)
          ..rotateY(_tiltY),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 26),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(24),
            // Multi-layered obsidian gradient
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Color(0xFF0F1829),
                Color(0xFF060913),
              ],
            ),
            border: Border.all(
              color: statusColor.withOpacity(0.32),
              width: 1.2,
            ),
            boxShadow: [
              BoxShadow(
                color: statusColor.withOpacity(0.14),
                blurRadius: 36,
                spreadRadius: 2,
                offset: const Offset(0, 12),
              ),
              const BoxShadow(
                color: Colors.black87,
                blurRadius: 24,
                offset: Offset(0, 8),
              ),
            ],
          ),
          child: Stack(
            children: [
              // Reticle corner accents
              Positioned.fill(
                child: CustomPaint(
                  painter: _TacticalCornersPainter(accentColor: statusColor),
                ),
              ),
              Column(
                children: [
                  // Top Monospace Telemetry Header
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          AnimatedBuilder(
                            animation: _pulseController,
                            builder: (context, child) {
                              return Container(
                                width: 8,
                                height: 8,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: statusColor,
                                  boxShadow: [
                                    BoxShadow(
                                      color: statusColor.withOpacity(0.5 + (_pulseController.value * 0.5)),
                                      blurRadius: 8,
                                      spreadRadius: 1,
                                    ),
                                  ],
                                ),
                              );
                            },
                          ),
                          const SizedBox(width: 8),
                          Text(
                            'SENTINEL // 3D DEFENSE MATRIX',
                            style: GoogleFonts.jetBrainsMono(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 1.2,
                              color: Colors.white70,
                            ),
                          ),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: statusColor.withOpacity(0.12),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: statusColor.withOpacity(0.35)),
                        ),
                        child: Text(
                          widget.isProtected ? 'ONLINE · ARMED' : 'ATTENTION',
                          style: GoogleFonts.jetBrainsMono(
                            fontSize: 9,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 1.0,
                            color: statusColor,
                          ),
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 24),

                  // 3D Holographic Concentric Shield Core
                  SizedBox(
                    width: 170,
                    height: 170,
                    child: Stack(
                      alignment: Alignment.center,
                      children: [
                        // Outer reverse rotating calibrated ring
                        AnimatedBuilder(
                          animation: _reverseRotationController,
                          builder: (context, child) {
                            return Transform.rotate(
                              angle: -_reverseRotationController.value * 2 * math.pi,
                              child: CustomPaint(
                                size: const Size(170, 170),
                                painter: _OuterGimbalPainter(accentColor: statusColor),
                              ),
                            );
                          },
                        ),

                        // Inner rotating radar sweep ring
                        AnimatedBuilder(
                          animation: _rotationController,
                          builder: (context, child) {
                            return Transform.rotate(
                              angle: _rotationController.value * 2 * math.pi,
                              child: CustomPaint(
                                size: const Size(140, 140),
                                painter: _RadarSweepPainter(accentColor: statusColor),
                              ),
                            );
                          },
                        ),

                        // Core pulsing halo
                        AnimatedBuilder(
                          animation: _pulseController,
                          builder: (context, child) {
                            final scale = 0.96 + (_pulseController.value * 0.08);
                            return Transform.scale(
                              scale: scale,
                              child: Container(
                                width: 84,
                                height: 84,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  gradient: RadialGradient(
                                    colors: [
                                      statusColor.withOpacity(0.25),
                                      const Color(0xFF040711).withOpacity(0.9),
                                    ],
                                  ),
                                  border: Border.all(
                                    color: statusColor.withOpacity(0.6),
                                    width: 1.8,
                                  ),
                                  boxShadow: [
                                    BoxShadow(
                                      color: statusColor.withOpacity(0.35),
                                      blurRadius: 20,
                                      spreadRadius: 2,
                                    ),
                                  ],
                                ),
                                child: Icon(
                                  widget.isProtected
                                      ? Icons.security_rounded
                                      : Icons.gpp_maybe_rounded,
                                  color: statusColor,
                                  size: 42,
                                ),
                              ),
                            );
                          },
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 22),

                  // Status Headline
                  Text(
                    statusText,
                    style: GoogleFonts.inter(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1.0,
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
                      color: TrustLayerColors.textSecondary,
                    ),
                  ),

                  const SizedBox(height: 16),

                  // Micro Telemetry Readout Strip
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: const Color(0xFF040711),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.white.withOpacity(0.08)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          'SENSORS: 4/4',
                          style: GoogleFonts.jetBrainsMono(
                            fontSize: 9,
                            fontWeight: FontWeight.w600,
                            color: Colors.white54,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Container(width: 3, height: 3, decoration: const BoxDecoration(shape: BoxShape.circle, color: Colors.white30)),
                        const SizedBox(width: 10),
                        Text(
                          'LATENCY: 14ms',
                          style: GoogleFonts.jetBrainsMono(
                            fontSize: 9,
                            fontWeight: FontWeight.w600,
                            color: Colors.white54,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Container(width: 3, height: 3, decoration: const BoxDecoration(shape: BoxShape.circle, color: Colors.white30)),
                        const SizedBox(width: 10),
                        Text(
                          'INTEGRITY: 100%',
                          style: GoogleFonts.jetBrainsMono(
                            fontSize: 9,
                            fontWeight: FontWeight.w600,
                            color: statusColor,
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 12),

                  // Touch Interaction Hint
                  Text(
                    '✦ DRAG TO TILT 3D PERSPECTIVE',
                    style: GoogleFonts.jetBrainsMono(
                      fontSize: 8.5,
                      fontWeight: FontWeight.w500,
                      letterSpacing: 1.5,
                      color: Colors.white30,
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

/// Tactical corner reticle painter
class _TacticalCornersPainter extends CustomPainter {
  _TacticalCornersPainter({required this.accentColor});
  final Color accentColor;

  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..color = accentColor.withOpacity(0.28)
      ..strokeWidth = 1.4
      ..style = PaintingStyle.stroke;

    const len = 12.0;

    // Top-Left
    canvas.drawLine(const Offset(0, 0), const Offset(len, 0), p);
    canvas.drawLine(const Offset(0, 0), const Offset(0, len), p);

    // Top-Right
    canvas.drawLine(Offset(size.width, 0), Offset(size.width - len, 0), p);
    canvas.drawLine(Offset(size.width, 0), Offset(size.width, len), p);

    // Bottom-Left
    canvas.drawLine(Offset(0, size.height), Offset(len, size.height), p);
    canvas.drawLine(Offset(0, size.height), Offset(0, size.height - len), p);

    // Bottom-Right
    canvas.drawLine(Offset(size.width, size.height), Offset(size.width - len, size.height), p);
    canvas.drawLine(Offset(size.width, size.height), Offset(size.width, size.height - len), p);
  }

  @override
  bool shouldRepaint(covariant _TacticalCornersPainter old) => old.accentColor != accentColor;
}

/// Custom painter for holographic outer calibrated gimbal ring
class _OuterGimbalPainter extends CustomPainter {
  _OuterGimbalPainter({required this.accentColor});
  final Color accentColor;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2;

    final tickPaint = Paint()
      ..color = accentColor.withOpacity(0.25)
      ..strokeWidth = 1.0;

    // Outer circle
    final ringPaint = Paint()
      ..color = accentColor.withOpacity(0.15)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.0;
    canvas.drawCircle(center, radius - 2, ringPaint);

    // 16 calibrated tick marks around circumference
    for (int i = 0; i < 16; i++) {
      final angle = (i * 2 * math.pi) / 16;
      final isMajor = i % 4 == 0;
      final tickLen = isMajor ? 6.0 : 3.5;
      final p1 = Offset(
        center.dx + (radius - 2) * math.cos(angle),
        center.dy + (radius - 2) * math.sin(angle),
      );
      final p2 = Offset(
        center.dx + (radius - 2 - tickLen) * math.cos(angle),
        center.dy + (radius - 2 - tickLen) * math.sin(angle),
      );
      canvas.drawLine(p1, p2, tickPaint);
    }
  }

  @override
  bool shouldRepaint(covariant _OuterGimbalPainter old) => old.accentColor != accentColor;
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
          accentColor.withOpacity(0.3),
        ],
        stops: const [0.65, 1.0],
      ).createShader(Rect.fromCircle(center: center, radius: radius))
      ..style = PaintingStyle.fill;

    canvas.drawCircle(center, radius * 0.95, sweepPaint);

    // 3. Four cardinal crosshairs
    final crossPaint = Paint()
      ..color = accentColor.withOpacity(0.4)
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

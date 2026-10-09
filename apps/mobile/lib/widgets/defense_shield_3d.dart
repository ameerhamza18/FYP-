import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../main.dart';
import 'cyber_shield_3d.dart';

/// Interactive 3D Perspective Defense Shield Card.
///
/// Features:
/// - Exact visual styling from Screen 2 of `mobile-app.jpg`:
///   - Beveled 3D Chrome Cyber Shield (`CyberShield3D`)
///   - Top/center label: "3D SHIELD"
///   - Status badge: "SYSTEM SECURE" (in glowing emerald) or "PROTECTION STANDBY"
///   - 4 pagination dots carousel indicator
/// - Matrix4 3D tilt perspective responding smoothly to finger drags
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
  late final AnimationController _pulseController;
  late final AnimationController _tiltSpringController;

  double _tiltX = 0.0;
  double _tiltY = 0.0;
  double _prevTiltX = 0.0;
  double _prevTiltY = 0.0;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    )..repeat(reverse: true);

    _tiltSpringController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 350),
    )..addListener(() {
        setState(() {
          _tiltX = (1.0 - _tiltSpringController.value) * _prevTiltX;
          _tiltY = (1.0 - _tiltSpringController.value) * _prevTiltY;
        });
      });
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _tiltSpringController.dispose();
    super.dispose();
  }

  void _onPanUpdate(DragUpdateDetails details) {
    _tiltSpringController.stop();
    setState(() {
      _tiltX = (_tiltX - details.delta.dy * 0.005).clamp(-0.25, 0.25);
      _tiltY = (_tiltY + details.delta.dx * 0.005).clamp(-0.25, 0.25);
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
        ? 'SYSTEM SECURE'
        : 'PROTECTION STANDBY';

    return GestureDetector(
      onPanUpdate: _onPanUpdate,
      onPanEnd: _onPanEnd,
      onTap: widget.onTap,
      child: Transform(
        alignment: Alignment.center,
        transform: Matrix4.identity()
          ..setEntry(3, 2, 0.0015) // Perspective depth
          ..rotateX(_tiltX)
          ..rotateY(_tiltY),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 22),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(24),
            // Multi-layered obsidian glass gradient
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Color(0xFF0D1726),
                Color(0xFF050812),
              ],
            ),
            border: Border.all(
              color: statusColor.withOpacity(0.35),
              width: 1.2,
            ),
            boxShadow: [
              BoxShadow(
                color: statusColor.withOpacity(0.12),
                blurRadius: 32,
                spreadRadius: 1,
                offset: const Offset(0, 10),
              ),
              const BoxShadow(
                color: Colors.black87,
                blurRadius: 20,
                offset: Offset(0, 8),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Header Badge & Title
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(5),
                        decoration: BoxDecoration(
                          color: statusColor.withOpacity(0.12),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Icon(
                          Icons.radar_rounded,
                          size: 14,
                          color: statusColor,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        'SENTINEL SHIELD MATRIX',
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
                      border: Border.all(color: statusColor.withOpacity(0.4)),
                    ),
                    child: Text(
                      widget.isProtected ? 'ONLINE' : 'ARM SENSORS',
                      style: GoogleFonts.jetBrainsMono(
                        fontSize: 9,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 0.8,
                        color: statusColor,
                      ),
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 18),

              // Center 3D Chrome Shield with circuit background
              Stack(
                alignment: Alignment.center,
                children: [
                  CyberShield3D(
                    size: 190,
                    glowColor: statusColor,
                  ),
                  // "3D SHIELD" badge overlay matching mobile-app.jpg
                  Positioned(
                    top: 56,
                    child: Column(
                      children: [
                        Text(
                          '3D',
                          style: GoogleFonts.jetBrainsMono(
                            fontSize: 18,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 1.5,
                            color: Colors.white.withOpacity(0.9),
                            shadows: [
                              Shadow(
                                color: Colors.black.withOpacity(0.8),
                                blurRadius: 8,
                              ),
                            ],
                          ),
                        ),
                        Text(
                          'SHIELD',
                          style: GoogleFonts.inter(
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 2.0,
                            color: TrustLayerColors.primary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 16),

              // Status Headline ("SYSTEM SECURE")
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  AnimatedBuilder(
                    animation: _pulseController,
                    builder: (context, child) {
                      return Container(
                        width: 7,
                        height: 7,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: statusColor,
                          boxShadow: [
                            BoxShadow(
                              color: statusColor.withOpacity(
                                  0.4 + (_pulseController.value * 0.5)),
                              blurRadius: 8,
                              spreadRadius: 2,
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                  const SizedBox(width: 8),
                  Text(
                    statusText,
                    style: GoogleFonts.inter(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1.5,
                      color: statusColor,
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 12),

              // 4 Pagination Dots underneath (matching mobile-app.jpg)
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    width: 14,
                    height: 4,
                    decoration: BoxDecoration(
                      color: statusColor,
                      borderRadius: BorderRadius.circular(3),
                    ),
                  ),
                  const SizedBox(width: 5),
                  Container(
                    width: 4,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.2),
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 5),
                  Container(
                    width: 4,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.2),
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 5),
                  Container(
                    width: 4,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.2),
                      shape: BoxShape.circle,
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

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../main.dart';
import 'cyber_shield_3d.dart';

/// Interactive 3D Perspective Defense Shield Card in Shieldly AI soft pastel style.
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
      _tiltX = (_tiltX - details.delta.dy * 0.005).clamp(-0.22, 0.22);
      _tiltY = (_tiltY + details.delta.dx * 0.005).clamp(-0.22, 0.22);
    });
  }

  void _onPanEnd(DragEndDetails details) {
    _prevTiltX = _tiltX;
    _prevTiltY = _tiltY;
    _tiltSpringController.forward(from: 0.0);
  }

  @override
  Widget build(BuildContext context) {
    final statusColor =
        widget.isProtected ? TrustLayerColors.low : TrustLayerColors.medium;
    final pillBg = widget.isProtected
        ? TrustLayerColors.pillSafeBg
        : TrustLayerColors.pillRiskyBg;
    final cardTint = widget.isProtected
        ? const [Color(0xFFD5EDE8), Color(0xFFCBE3DF)]
        : const [Color(0xFFD2DAFC), Color(0xFFC8D2FA)];

    return GestureDetector(
      onPanUpdate: _onPanUpdate,
      onPanEnd: _onPanEnd,
      onTap: widget.onTap,
      child: Transform(
        alignment: Alignment.center,
        transform: Matrix4.identity()
          ..setEntry(3, 2, 0.0015)
          ..rotateX(_tiltX)
          ..rotateY(_tiltY),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(28),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: cardTint,
            ),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF16161A).withOpacity(0.05),
                blurRadius: 20,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 32,
                        height: 32,
                        decoration: const BoxDecoration(
                          color: Colors.white,
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          Icons.shield_outlined,
                          size: 17,
                          color: TrustLayerColors.textPrimary,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Text(
                        'Live Defense Shield',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 13.5,
                          fontWeight: FontWeight.w700,
                          color: TrustLayerColors.textPrimary,
                        ),
                      ),
                    ],
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                    decoration: BoxDecoration(
                      color: pillBg,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      widget.isProtected ? '• Active' : '• Standby',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w700,
                        color: statusColor,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              CyberShield3D(
                size: 155,
                glowColor: widget.isProtected
                    ? TrustLayerColors.low
                    : TrustLayerColors.accent,
              ),
              const SizedBox(height: 8),
              AnimatedBuilder(
                animation: _pulseController,
                builder: (context, child) {
                  return Opacity(
                    opacity: 0.85 + (_pulseController.value * 0.15),
                    child: child,
                  );
                },
                child: Text(
                  widget.isProtected
                      ? 'Automatic SMS & Alert Guard Enabled'
                      : 'Tap to scan or grant OS sensors below',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: TrustLayerColors.textPrimary.withOpacity(0.8),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

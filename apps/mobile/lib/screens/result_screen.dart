import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../main.dart';
import '../models/analysis_result.dart';

/// Screen 4 ("Risk Result Screen") and Screen 5 ("Threat Analysis Breakdown")
/// from `mobile-app.jpg`.
///
/// Features:
/// - 3D Speedometer/Radial Gauge with calibrated tick marks, glowing arc, and numeric score (e.g. 88)
/// - Alert Badge: "CRITICAL THREAT DETECTED" / "VERIFIED SECURE"
/// - Social-Engineering Techniques Breakdown with dynamic colored bars:
///   - Authority (Blue), Urgency (Cyan), Fear (Amber), Financial Pressure (Red/Orange)
/// - AI Explanation card with forensic synthesis
/// - Safety Recommendation card with glowing alert border
/// - Technical Telemetry & Forensic Indicators drawer
class ResultScreen extends StatefulWidget {
  final AnalysisResult result;
  const ResultScreen({super.key, required this.result});

  @override
  State<ResultScreen> createState() => _ResultScreenState();
}

class _ResultScreenState extends State<ResultScreen> {
  int _viewMode = 0; // 0 = Speedometer Gauge Screen, 1 = Threat Analysis Breakdown

  Color get _levelColor {
    switch (widget.result.riskLevel) {
      case 'CRITICAL':
        return TrustLayerColors.critical;
      case 'HIGH':
        return TrustLayerColors.high;
      case 'MEDIUM':
        return TrustLayerColors.medium;
      default:
        return TrustLayerColors.low;
    }
  }

  String get _alertTitle {
    switch (widget.result.riskLevel) {
      case 'CRITICAL':
        return 'CRITICAL THREAT DETECTED';
      case 'HIGH':
        return 'HIGH RISK DETECTED';
      case 'MEDIUM':
        return 'SUSPICIOUS ACTIVITY';
      default:
        return 'NO THREAT DETECTED · SAFE';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: TrustLayerColors.background,
      appBar: AppBar(
        backgroundColor: TrustLayerColors.background,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18, color: Colors.white70),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          _viewMode == 0 ? 'Risk Result' : 'Threat Analysis',
          style: GoogleFonts.inter(
            color: TrustLayerColors.textPrimary,
            fontWeight: FontWeight.w700,
            fontSize: 16,
            letterSpacing: 0.5,
          ),
        ),
        actions: [
          // Toggle between Gauge & Full Breakdown
          TextButton.icon(
            onPressed: () {
              setState(() {
                _viewMode = _viewMode == 0 ? 1 : 0;
              });
            },
            icon: Icon(
              _viewMode == 0 ? Icons.analytics_outlined : Icons.speed_rounded,
              size: 16,
              color: TrustLayerColors.primary,
            ),
            label: Text(
              _viewMode == 0 ? 'Breakdown' : 'Gauge',
              style: GoogleFonts.jetBrainsMono(
                fontSize: 11,
                fontWeight: FontWeight.bold,
                color: TrustLayerColors.primary,
              ),
            ),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: SafeArea(
        child: AnimatedSwitcher(
          duration: const Duration(milliseconds: 300),
          child: _viewMode == 0
              ? _buildRiskResultScreen()
              : _buildThreatAnalysisBreakdown(),
        ),
      ),
    );
  }

  /// Screen 4: Risk Result Screen
  Widget _buildRiskResultScreen() {
    final score = widget.result.riskScore;

    return SingleChildScrollView(
      key: const ValueKey('gauge_screen'),
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
      child: Column(
        children: [
          const SizedBox(height: 12),

          // 3D Speedometer Radial Gauge Dial
          Center(
            child: SizedBox(
              width: 250,
              height: 250,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  CustomPaint(
                    size: const Size(250, 250),
                    painter: _SpeedometerGaugePainter(
                      score: score,
                      accentColor: _levelColor,
                    ),
                  ),
                  Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        '$score',
                        style: GoogleFonts.jetBrainsMono(
                          fontSize: 52,
                          fontWeight: FontWeight.w900,
                          color: Colors.white,
                          letterSpacing: -1,
                          shadows: [
                            Shadow(
                              color: _levelColor.withOpacity(0.6),
                              blurRadius: 16,
                            ),
                          ],
                        ),
                      ),
                      Text(
                        'RISK SCORE',
                        style: GoogleFonts.jetBrainsMono(
                          fontSize: 9.5,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 2.0,
                          color: _levelColor,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 36),

          // Alert Badge Icon & Headline
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: _levelColor.withOpacity(0.14),
              border: Border.all(color: _levelColor.withOpacity(0.4), width: 1.5),
              boxShadow: [
                BoxShadow(
                  color: _levelColor.withOpacity(0.2),
                  blurRadius: 18,
                  spreadRadius: 1,
                ),
              ],
            ),
            child: Icon(
              widget.result.riskLevel == 'LOW'
                  ? Icons.verified_user_rounded
                  : Icons.priority_high_rounded,
              color: _levelColor,
              size: 26,
            ),
          ),

          const SizedBox(height: 16),

          Text(
            _alertTitle,
            textAlign: TextAlign.center,
            style: GoogleFonts.inter(
              fontSize: 18,
              fontWeight: FontWeight.w900,
              letterSpacing: 1.2,
              color: _levelColor,
            ),
          ),

          const SizedBox(height: 10),

          // Description subtext
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Text(
              widget.result.threatType.isNotEmpty
                  ? 'TrustLayer AI identified signature: ${widget.result.threatType}.'
                  : 'TrustLayer AI is actively scanning, detecting anomalies for financial fraud.',
              textAlign: TextAlign.center,
              style: GoogleFonts.inter(
                fontSize: 13,
                height: 1.45,
                color: TrustLayerColors.textSecondary,
              ),
            ),
          ),

          const SizedBox(height: 36),

          // Action CTA "Continue / Threat Analysis" Button
          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton(
              onPressed: () {
                setState(() => _viewMode = 1);
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0C172B),
                foregroundColor: Colors.white,
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(26),
                  side: BorderSide(
                    color: TrustLayerColors.primary.withOpacity(0.6),
                    width: 1.4,
                  ),
                ),
                shadowColor: TrustLayerColors.primary.withOpacity(0.3),
              ),
              child: Text(
                'Continue',
                style: GoogleFonts.inter(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.5,
                  color: Colors.white,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Screen 5: Threat Analysis Breakdown
  Widget _buildThreatAnalysisBreakdown() {
    return ListView(
      key: const ValueKey('analysis_screen'),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      children: [
        // 1. Social-Engineering Techniques Card
        _buildSocialEngineeringCard(),

        const SizedBox(height: 16),

        // 2. AI Explanation Card
        _buildExplanationCard(),

        const SizedBox(height: 16),

        // 3. Safety Recommendation Card (with glowing alert border)
        _buildRecommendationCard(),

        const SizedBox(height: 16),

        // 4. Forensics & Indicators List
        if (widget.result.indicators.isNotEmpty) _buildIndicatorsCard(),

        const SizedBox(height: 24),
      ],
    );
  }

  Widget _buildSocialEngineeringCard() {
    // If API provided specific techniques, map them; otherwise synthesize standard dimensions
    final techniques = widget.result.seTechniques.isNotEmpty
        ? widget.result.seTechniques.map((t) {
            int pct = 20;
            if (t.intensity == 'HIGH') pct = 75;
            if (t.intensity == 'MEDIUM') pct = 45;
            if (t.intensity == 'LOW') pct = 25;
            return {'name': t.technique, 'pct': pct, 'intensity': t.intensity};
          }).toList()
        : [
            {'name': 'Authority', 'pct': widget.result.riskScore > 50 ? 30 : 10, 'intensity': 'LOW'},
            {'name': 'Urgency', 'pct': widget.result.riskScore > 60 ? 40 : 15, 'intensity': 'MEDIUM'},
            {'name': 'Fear', 'pct': widget.result.riskScore > 75 ? 20 : 5, 'intensity': 'LOW'},
            {'name': 'Financial Pressure', 'pct': widget.result.riskScore > 70 ? 10 : 5, 'intensity': 'LOW'},
          ];

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: TrustLayerColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: TrustLayerColors.surfaceBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Social-Engineering Techniques',
                style: GoogleFonts.inter(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: TrustLayerColors.textPrimary,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                decoration: BoxDecoration(
                  color: TrustLayerColors.surfaceElevated,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  'NLP VECTOR',
                  style: GoogleFonts.jetBrainsMono(
                    fontSize: 8.5,
                    fontWeight: FontWeight.bold,
                    color: TrustLayerColors.primary,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          ...techniques.asMap().entries.map((entry) {
            final idx = entry.key;
            final t = entry.value;
            Color barColor = const Color(0xFF38BDF8); // Cyan
            if (idx == 0) barColor = const Color(0xFF3B82F6); // Blue Authority
            if (idx == 1) barColor = const Color(0xFF06B6D4); // Cyan Urgency
            if (idx == 2) barColor = const Color(0xFFF59E0B); // Amber Fear
            if (idx >= 3) barColor = const Color(0xFFEF4444); // Red Financial Pressure

            final pct = t['pct'] as int;

            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        t['name'] as String,
                        style: GoogleFonts.inter(
                          fontSize: 12,
                          color: TrustLayerColors.textSecondary,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      Text(
                        '$pct%',
                        style: GoogleFonts.jetBrainsMono(
                          fontSize: 11.5,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: pct / 100.0,
                      minHeight: 5.5,
                      backgroundColor: const Color(0xFF0B1322),
                      valueColor: AlwaysStoppedAnimation<Color>(barColor),
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _buildExplanationCard() {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: TrustLayerColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: TrustLayerColors.surfaceBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.psychology_outlined, size: 18, color: TrustLayerColors.primary),
              const SizedBox(width: 8),
              Text(
                'AI Explanation',
                style: GoogleFonts.inter(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: TrustLayerColors.textPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            widget.result.explanation.isNotEmpty
                ? widget.result.explanation
                : 'Highly deceptive message using artificial urgency and impersonation to harvest credentials for financial fraud.',
            style: GoogleFonts.inter(
              fontSize: 12.5,
              height: 1.5,
              color: TrustLayerColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRecommendationCard() {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFF140D0E),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFF97316).withOpacity(0.6), width: 1.2),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFF97316).withOpacity(0.1),
            blurRadius: 18,
            spreadRadius: 1,
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.shield_outlined, size: 18, color: Color(0xFFF97316)),
              const SizedBox(width: 8),
              Text(
                'Safety Recommendation',
                style: GoogleFonts.inter(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: const Color(0xFFF97316),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            widget.result.recommendation.isNotEmpty
                ? widget.result.recommendation
                : 'Do NOT click. This is a scam. Block the sender and delete the message.',
            style: GoogleFonts.inter(
              fontSize: 12.5,
              height: 1.45,
              color: Colors.white.withOpacity(0.9),
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildIndicatorsCard() {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: TrustLayerColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: TrustLayerColors.surfaceBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Forensic Telemetry Indicators',
            style: GoogleFonts.inter(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: TrustLayerColors.textPrimary,
            ),
          ),
          const SizedBox(height: 12),
          ...widget.result.indicators.map((ind) {
            Color sevColor = TrustLayerColors.low;
            if (ind.severity == 'CRITICAL') sevColor = TrustLayerColors.critical;
            if (ind.severity == 'HIGH') sevColor = TrustLayerColors.high;
            if (ind.severity == 'MEDIUM') sevColor = TrustLayerColors.medium;

            return Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    margin: const EdgeInsets.only(top: 4),
                    width: 6,
                    height: 6,
                    decoration: BoxDecoration(shape: BoxShape.circle, color: sevColor),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          ind.title,
                          style: GoogleFonts.inter(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: Colors.white,
                          ),
                        ),
                        if (ind.detail != null)
                          Text(
                            ind.detail!,
                            style: GoogleFonts.inter(
                              fontSize: 11,
                              color: TrustLayerColors.textMuted,
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }
}

/// Custom painter for the 3D Speedometer Gauge Dial
class _SpeedometerGaugePainter extends CustomPainter {
  _SpeedometerGaugePainter({
    required this.score,
    required this.accentColor,
  });

  final int score;
  final Color accentColor;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2 - 10;

    // 1. Outer Dark Chrome Bezel Ring
    final bezelPaint = Paint()
      ..color = const Color(0xFF1E293B)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3.5;
    canvas.drawCircle(center, radius, bezelPaint);

    // 2. Calibrated Tick Marks
    final totalTicks = 36;
    for (int i = 0; i <= totalTicks; i++) {
      // Gauge covers 240 degrees (from 150 deg to 390 deg)
      final angle = (150 + (i / totalTicks) * 240) * (math.pi / 180);
      final isMajor = i % 6 == 0;
      final tickLen = isMajor ? 8.0 : 4.0;
      final p1 = Offset(
        center.dx + (radius - 4) * math.cos(angle),
        center.dy + (radius - 4) * math.sin(angle),
      );
      final p2 = Offset(
        center.dx + (radius - 4 - tickLen) * math.cos(angle),
        center.dy + (radius - 4 - tickLen) * math.sin(angle),
      );

      final tickPaint = Paint()
        ..color = isMajor ? Colors.white70 : Colors.white24
        ..strokeWidth = isMajor ? 1.5 : 1.0;
      canvas.drawLine(p1, p2, tickPaint);
    }

    // 3. Track Arc Background
    final trackRect = Rect.fromCircle(center: center, radius: radius - 18);
    final startAngle = 150 * (math.pi / 180);
    final sweepAngle = 240 * (math.pi / 180);

    final trackPaint = Paint()
      ..color = Colors.white.withOpacity(0.08)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 12
      ..strokeCap = StrokeCap.round;
    canvas.drawArc(trackRect, startAngle, sweepAngle, false, trackPaint);

    // 4. Active Glowing Risk Score Arc
    final activeSweep = sweepAngle * (score / 100.0).clamp(0.02, 1.0);

    // Glow shadow
    final glowPaint = Paint()
      ..color = accentColor.withOpacity(0.4)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 16
      ..strokeCap = StrokeCap.round
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 8);
    canvas.drawArc(trackRect, startAngle, activeSweep, false, glowPaint);

    // Sharp colored stroke
    final activePaint = Paint()
      ..color = accentColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = 10
      ..strokeCap = StrokeCap.round;
    canvas.drawArc(trackRect, startAngle, activeSweep, false, activePaint);
  }

  @override
  bool shouldRepaint(covariant _SpeedometerGaugePainter old) =>
      old.score != score || old.accentColor != accentColor;
}

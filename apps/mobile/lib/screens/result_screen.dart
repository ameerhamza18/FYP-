import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../models/analysis_result.dart';
import '../main.dart';

class ResultScreen extends StatelessWidget {
  final AnalysisResult result;
  const ResultScreen({super.key, required this.result});

  Color get _levelColor {
    switch (result.riskLevel) {
      case 'CRITICAL': return TrustLayerColors.critical;
      case 'HIGH': return TrustLayerColors.high;
      case 'MEDIUM': return TrustLayerColors.medium;
      default: return TrustLayerColors.low;
    }
  }

  IconData get _levelIcon {
    switch (result.riskLevel) {
      case 'CRITICAL':
      case 'HIGH': return Icons.gpp_bad_rounded;
      case 'MEDIUM': return Icons.warning_amber_rounded;
      default: return Icons.verified_user_rounded;
    }
  }

  Color _sevColor(String s) {
    switch (s) {
      case 'CRITICAL': return TrustLayerColors.critical;
      case 'HIGH': return TrustLayerColors.high;
      case 'MEDIUM': return TrustLayerColors.medium;
      case 'LOW': return TrustLayerColors.low;
      default: return TrustLayerColors.textSecondary;
    }
  }

  Color _intensityColor(String s) =>
      s == 'HIGH' ? TrustLayerColors.critical : (s == 'MEDIUM' ? TrustLayerColors.high : TrustLayerColors.medium);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: TrustLayerColors.background,
      appBar: AppBar(
        backgroundColor: TrustLayerColors.background,
        elevation: 0,
        title: Row(
          children: [
            Text(
              'FORENSIC DOSSIER',
              style: GoogleFonts.inter(
                color: TrustLayerColors.textPrimary,
                fontWeight: FontWeight.w800,
                fontSize: 15,
                letterSpacing: 1.2,
              ),
            ),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: _levelColor.withOpacity(0.15),
                borderRadius: BorderRadius.circular(4),
                border: Border.all(color: _levelColor.withOpacity(0.4)),
              ),
              child: Text(
                result.riskLevel,
                style: GoogleFonts.jetBrainsMono(
                  fontSize: 9,
                  fontWeight: FontWeight.bold,
                  color: _levelColor,
                ),
              ),
            ),
          ],
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          // Tactical 3D-Style Radial Risk Gauge Card
          Container(
            padding: const EdgeInsets.symmetric(vertical: 28, horizontal: 20),
            decoration: BoxDecoration(
              color: TrustLayerColors.surface,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: _levelColor.withOpacity(0.35), width: 1.2),
              boxShadow: [
                BoxShadow(
                  color: _levelColor.withOpacity(0.12),
                  blurRadius: 30,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: Column(
              children: [
                Stack(
                  alignment: Alignment.center,
                  children: [
                    // Outer track
                    SizedBox(
                      width: 150,
                      height: 150,
                      child: CircularProgressIndicator(
                        value: 1.0,
                        strokeWidth: 4,
                        color: Colors.white.withOpacity(0.06),
                      ),
                    ),
                    // Active risk score arc
                    SizedBox(
                      width: 150,
                      height: 150,
                      child: CircularProgressIndicator(
                        value: (result.riskScore / 100).clamp(0.02, 1.0),
                        strokeWidth: 12,
                        strokeCap: StrokeCap.round,
                        backgroundColor: Colors.transparent,
                        valueColor: AlwaysStoppedAnimation(_levelColor),
                      ),
                    ),
                    Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          '${result.riskScore}',
                          style: GoogleFonts.jetBrainsMono(
                            fontSize: 44,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -1.0,
                            color: _levelColor,
                          ),
                        ),
                        Text(
                          'INDEX / 100',
                          style: GoogleFonts.jetBrainsMono(
                            color: TrustLayerColors.textMuted,
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 1.2,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(_levelIcon, color: _levelColor, size: 22),
                    const SizedBox(width: 8),
                    Text(
                      '${result.riskLevel} RISK CLASSIFICATION',
                      style: GoogleFonts.inter(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.8,
                        color: _levelColor,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  result.threatType,
                  textAlign: TextAlign.center,
                  style: GoogleFonts.inter(
                    color: TrustLayerColors.textPrimary,
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 14),
                // Telemetry meta chip
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: const Color(0xFF040711),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: TrustLayerColors.surfaceBorder),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        'INPUT: ${result.inputType.toUpperCase()}',
                        style: GoogleFonts.jetBrainsMono(fontSize: 9.5, color: Colors.white70, fontWeight: FontWeight.w600),
                      ),
                      if (result.latencyMs != null) ...[
                        const SizedBox(width: 10),
                        Container(width: 3, height: 3, decoration: const BoxDecoration(shape: BoxShape.circle, color: Colors.white30)),
                        const SizedBox(width: 10),
                        Text(
                          'LATENCY: ${result.latencyMs!.toStringAsFixed(1)}ms',
                          style: GoogleFonts.jetBrainsMono(fontSize: 9.5, color: Colors.white70, fontWeight: FontWeight.w600),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),

          if (result.campaignFlagged)
            Container(
              margin: const EdgeInsets.only(top: 18),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: TrustLayerColors.critical.withOpacity(0.12),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: TrustLayerColors.critical.withOpacity(0.5)),
              ),
              child: const Row(
                children: [
                  Icon(Icons.campaign_rounded, color: TrustLayerColors.critical, size: 24),
                  SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'Coordinated threat campaign flagged. Signature linked to active malicious clusters.',
                      style: TextStyle(color: TrustLayerColors.critical, fontWeight: FontWeight.w600, fontSize: 13),
                    ),
                  ),
                ],
              ),
            ),

          const SizedBox(height: 28),

          // Tactical Forensic Indicators
          if (result.indicators.isNotEmpty) ...[
            _sectionHeader('FORENSIC HEURISTIC SIGNATURES', '${result.indicators.length} FOUND'),
            const SizedBox(height: 12),
            ...result.indicators.map((i) => _indicatorTile(i)),
            const SizedBox(height: 24),
          ],

          // Social Engineering Manipulation
          _buildSETechniques(context),

          const SizedBox(height: 24),
          _buildExplanation(context),

          const SizedBox(height: 24),
          _buildRecommendation(context),
        ],
      ),
    );
  }

  Widget _sectionHeader(String title, [String? badge]) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          title,
          style: GoogleFonts.inter(
            fontSize: 12.5,
            fontWeight: FontWeight.w800,
            letterSpacing: 1.0,
            color: TrustLayerColors.textPrimary,
          ),
        ),
        if (badge != null)
          Text(
            badge,
            style: GoogleFonts.jetBrainsMono(
              fontSize: 10,
              fontWeight: FontWeight.bold,
              color: TrustLayerColors.textMuted,
            ),
          ),
      ],
    );
  }

  Widget _indicatorTile(dynamic i) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: TrustLayerColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: TrustLayerColors.surfaceBorder),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            margin: const EdgeInsets.only(top: 3),
            width: 8,
            height: 8,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: _sevColor(i.severity),
              boxShadow: [
                BoxShadow(color: _sevColor(i.severity).withOpacity(0.6), blurRadius: 4),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  i.title,
                  style: GoogleFonts.inter(
                    color: TrustLayerColors.textPrimary,
                    fontWeight: FontWeight.w700,
                    fontSize: 13.5,
                  ),
                ),
                if (i.detail != null) ...[
                  const SizedBox(height: 3),
                  Text(
                    i.detail!,
                    style: TextStyle(color: TrustLayerColors.textSecondary, fontSize: 12),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: _sevColor(i.severity).withOpacity(0.12),
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(
              i.severity,
              style: GoogleFonts.jetBrainsMono(
                fontSize: 9.5,
                fontWeight: FontWeight.bold,
                color: _sevColor(i.severity),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSETechniques(BuildContext context) {
    if (result.seTechniques.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionHeader('PSYCHOLOGICAL MANIPULATION TECHNIQUES', '${result.seTechniques.length} FLAGGED'),
        const SizedBox(height: 12),
        ...result.seTechniques.map((t) => Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: TrustLayerColors.surface,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: TrustLayerColors.surfaceBorder),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: _intensityColor(t.intensity).withOpacity(0.12),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(Icons.psychology_alt_rounded, color: _intensityColor(t.intensity), size: 18),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          t.technique,
                          style: GoogleFonts.inter(
                            color: TrustLayerColors.textPrimary,
                            fontWeight: FontWeight.w700,
                            fontSize: 13.5,
                          ),
                        ),
                        if (t.evidence != null) ...[
                          const SizedBox(height: 4),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: const Color(0xFF040711),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              '"${t.evidence}"',
                              style: GoogleFonts.jetBrainsMono(
                                color: TrustLayerColors.textSecondary,
                                fontSize: 11,
                                fontStyle: FontStyle.italic,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: _intensityColor(t.intensity).withOpacity(0.15),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      t.intensity,
                      style: GoogleFonts.jetBrainsMono(
                        fontSize: 9.5,
                        fontWeight: FontWeight.bold,
                        color: _intensityColor(t.intensity),
                      ),
                    ),
                  ),
                ],
              ),
            )),
      ],
    );
  }

  Widget _buildExplanation(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: TrustLayerColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: TrustLayerColors.primary.withOpacity(0.35)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.auto_awesome_rounded, size: 18, color: TrustLayerColors.primary),
              const SizedBox(width: 8),
              Text(
                'NEURAL SYNTHESIS ENGINE',
                style: GoogleFonts.jetBrainsMono(
                  fontWeight: FontWeight.w800,
                  fontSize: 11,
                  letterSpacing: 1.0,
                  color: TrustLayerColors.primary,
                ),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: TrustLayerColors.primary.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  result.explanationSource == 'llm' ? 'GEMINI CORE' : 'HEURISTIC RULESET',
                  style: GoogleFonts.jetBrainsMono(fontSize: 9, color: TrustLayerColors.primary, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            result.explanation,
            style: GoogleFonts.inter(
              color: TrustLayerColors.textPrimary,
              fontSize: 13.5,
              height: 1.5,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRecommendation(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _levelColor.withOpacity(0.08),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: _levelColor.withOpacity(0.35), width: 1.2),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: _levelColor.withOpacity(0.15),
              shape: BoxShape.circle,
            ),
            child: Icon(Icons.shield_outlined, color: _levelColor, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'DEFENSE PROTOCOL RECOMMENDATION',
                  style: GoogleFonts.jetBrainsMono(
                    color: _levelColor,
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.8,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  result.recommendation,
                  style: GoogleFonts.inter(
                    color: TrustLayerColors.textPrimary,
                    fontSize: 13,
                    height: 1.45,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

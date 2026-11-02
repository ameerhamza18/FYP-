import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../main.dart';
import '../models/analysis_result.dart';

/// Shieldly AI-styled Analysis Report screen.
///
/// Combines warm cream header blocks, soft pastel status pills, crisp white
/// 28px cards, and full forensic telemetry (score gauge, recommendation,
/// explanation, campaign alert, indicators, social-engineering techniques,
/// and 8-category taxonomy bars).
class ResultScreen extends StatelessWidget {
  final AnalysisResult result;
  const ResultScreen({super.key, required this.result});

  Color get _levelColor {
    switch (result.riskLevel.toUpperCase()) {
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

  Color get _levelPillBg {
    switch (result.riskLevel.toUpperCase()) {
      case 'CRITICAL':
      case 'HIGH':
        return TrustLayerColors.pillScamBg;
      case 'MEDIUM':
        return TrustLayerColors.pillRiskyBg;
      default:
        return TrustLayerColors.pillSafeBg;
    }
  }

  Color get _heroCardBg {
    switch (result.riskLevel.toUpperCase()) {
      case 'CRITICAL':
      case 'HIGH':
        return TrustLayerColors.sand;
      case 'MEDIUM':
        return TrustLayerColors.butter;
      default:
        return TrustLayerColors.sage;
    }
  }

  Color _severityColor(String sev) {
    switch (sev.toUpperCase()) {
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

  Color _severityBg(String sev) {
    switch (sev.toUpperCase()) {
      case 'CRITICAL':
      case 'HIGH':
        return TrustLayerColors.pillScamBg;
      case 'MEDIUM':
        return TrustLayerColors.pillRiskyBg;
      default:
        return TrustLayerColors.pillSafeBg;
    }
  }

  int _intensityToPct(String intensity) {
    switch (intensity.toUpperCase()) {
      case 'HIGH':
        return 85;
      case 'MEDIUM':
        return 55;
      case 'LOW':
        return 25;
      default:
        return 0;
    }
  }

  @override
  Widget build(BuildContext context) {
    final score = result.riskScore.clamp(0, 100);
    final levelUpper = result.riskLevel.toUpperCase();

    return Scaffold(
      backgroundColor: TrustLayerColors.background,
      appBar: AppBar(
        backgroundColor: TrustLayerColors.headerWarm,
        elevation: 0,
        leading: Padding(
          padding: const EdgeInsets.only(left: 12),
          child: Center(
            child: InkWell(
              borderRadius: BorderRadius.circular(22),
              onTap: () => Navigator.maybePop(context),
              child: Container(
                width: 40,
                height: 40,
                decoration: const BoxDecoration(
                  color: TrustLayerColors.headerButton,
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.arrow_back_rounded,
                  size: 20,
                  color: TrustLayerColors.textPrimary,
                ),
              ),
            ),
          ),
        ),
        title: Text(
          'Analysis Report',
          style: GoogleFonts.plusJakartaSans(
            color: TrustLayerColors.textPrimary,
            fontWeight: FontWeight.w700,
            fontSize: 17,
          ),
        ),
        centerTitle: true,
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(18, 0, 18, 28),
          children: [
            // Warm Cream Top Header Extension with Verdict Card
            Container(
              padding: const EdgeInsets.fromLTRB(18, 14, 18, 20),
              decoration: const BoxDecoration(
                color: TrustLayerColors.headerWarm,
                borderRadius: BorderRadius.vertical(
                  bottom: Radius.circular(32),
                  top: Radius.circular(24),
                ),
              ),
              child: Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: _heroCardBg,
                  borderRadius: BorderRadius.circular(26),
                ),
                child: Column(
                  children: [
                    Row(
                      children: [
                        // Calibrated Circular Score Gauge
                        SizedBox(
                          width: 108,
                          height: 108,
                          child: Stack(
                            alignment: Alignment.center,
                            children: [
                              Container(
                                width: 96,
                                height: 96,
                                decoration: BoxDecoration(
                                  color: Colors.white.withOpacity(0.88),
                                  shape: BoxShape.circle,
                                ),
                              ),
                              SizedBox(
                                width: 98,
                                height: 98,
                                child: CircularProgressIndicator(
                                  value: score / 100.0,
                                  strokeWidth: 8,
                                  backgroundColor: Colors.white.withOpacity(0.6),
                                  valueColor:
                                      AlwaysStoppedAnimation<Color>(_levelColor),
                                ),
                              ),
                              Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    '${result.riskScore}',
                                    style: GoogleFonts.plusJakartaSans(
                                      fontSize: 30,
                                      fontWeight: FontWeight.w800,
                                      height: 1.0,
                                      color: TrustLayerColors.textPrimary,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    '/ 100',
                                    style: GoogleFonts.plusJakartaSans(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w600,
                                      color: TrustLayerColors.textSecondary,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 18),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 12,
                                  vertical: 5,
                                ),
                                decoration: BoxDecoration(
                                  color: _levelPillBg,
                                  borderRadius: BorderRadius.circular(20),
                                ),
                                child: Text(
                                  '$levelUpper RISK',
                                  style: GoogleFonts.plusJakartaSans(
                                    fontSize: 11.5,
                                    fontWeight: FontWeight.w800,
                                    color: _levelColor,
                                    letterSpacing: 0.3,
                                  ),
                                ),
                              ),
                              const SizedBox(height: 10),
                              if (result.threatType.isNotEmpty)
                                Text(
                                  result.threatType,
                                  style: GoogleFonts.plusJakartaSans(
                                    fontSize: 18,
                                    fontWeight: FontWeight.w800,
                                    color: TrustLayerColors.textPrimary,
                                  ),
                                ),
                              const SizedBox(height: 4),
                              Text(
                                'Channel: ${result.inputType.toUpperCase()}',
                                style: GoogleFonts.plusJakartaSans(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: TrustLayerColors.textPrimary.withOpacity(0.65),
                                ),
                              ),
                              if (result.latencyMs != null) ...[
                                const SizedBox(height: 3),
                                Text(
                                  'Analyzed in ${result.latencyMs!.toStringAsFixed(1)} ms',
                                  style: GoogleFonts.plusJakartaSans(
                                    fontSize: 11.5,
                                    fontWeight: FontWeight.w500,
                                    color:
                                        TrustLayerColors.textPrimary.withOpacity(0.6),
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),

            // Conditional Coordinated Campaign Alert Banner
            if (result.campaignFlagged) ...[
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                decoration: BoxDecoration(
                  color: TrustLayerColors.pillScamBg,
                  borderRadius: BorderRadius.circular(22),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.campaign_rounded,
                      color: TrustLayerColors.critical,
                      size: 22,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Part of a possible coordinated campaign detected',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: TrustLayerColors.critical,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],

            const SizedBox(height: 16),

            // Safety Recommendation Card (Periwinkle Pastel Highlight)
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: TrustLayerColors.periwinkle,
                borderRadius: BorderRadius.circular(26),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: const BoxDecoration(
                      color: Colors.white,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.shield_outlined,
                      size: 20,
                      color: TrustLayerColors.textPrimary,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Recommended Action',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: TrustLayerColors.textPrimary.withOpacity(0.65),
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          result.recommendation.isNotEmpty
                              ? result.recommendation
                              : 'Proceed with caution and verify the sender independently.',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 14,
                            height: 1.4,
                            fontWeight: FontWeight.w700,
                            color: TrustLayerColors.textPrimary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 14),

            // AI Explanation Card
            _whiteCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 34,
                        height: 34,
                        decoration: BoxDecoration(
                          color: TrustLayerColors.surfaceElevated,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(
                          Icons.auto_awesome_outlined,
                          size: 18,
                          color: TrustLayerColors.textPrimary,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Text(
                        'AI Forensic Summary',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: TrustLayerColors.textPrimary,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text(
                    result.explanation.isNotEmpty
                        ? result.explanation
                        : 'Fused multi-engine inspection completed.',
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 13.5,
                      height: 1.55,
                      color: TrustLayerColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),

            // Multi-Channel Scores (when present)
            if (result.mlScore != null ||
                result.ruleScore != null ||
                result.intelScore != null ||
                result.urlScore != null) ...[
              const SizedBox(height: 14),
              _buildChannelBreakdownCard(),
            ],

            // Conditional Detection Indicators Section
            if (result.indicators.isNotEmpty) ...[
              const SizedBox(height: 14),
              _whiteCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Indicators',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: TrustLayerColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 12),
                    ...result.indicators.map((ind) {
                      final sevUpper = ind.severity.toUpperCase();
                      return Container(
                        margin: const EdgeInsets.only(bottom: 10),
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: TrustLayerColors.surfaceElevated,
                          borderRadius: BorderRadius.circular(18),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Expanded(
                                  child: Text(
                                    ind.title,
                                    style: GoogleFonts.plusJakartaSans(
                                      fontSize: 13.5,
                                      fontWeight: FontWeight.w700,
                                      color: TrustLayerColors.textPrimary,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 10,
                                    vertical: 4,
                                  ),
                                  decoration: BoxDecoration(
                                    color: _severityBg(sevUpper),
                                    borderRadius: BorderRadius.circular(14),
                                  ),
                                  child: Text(
                                    sevUpper,
                                    style: GoogleFonts.plusJakartaSans(
                                      fontSize: 10.5,
                                      fontWeight: FontWeight.w800,
                                      color: _severityColor(sevUpper),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            if (ind.detail != null && ind.detail!.isNotEmpty) ...[
                              const SizedBox(height: 5),
                              Text(
                                ind.detail!,
                                style: GoogleFonts.plusJakartaSans(
                                  fontSize: 12,
                                  color: TrustLayerColors.textSecondary,
                                ),
                              ),
                            ],
                          ],
                        ),
                      );
                    }),
                  ],
                ),
              ),
            ],

            // Conditional Social Engineering Techniques Section
            if (result.seTechniques.isNotEmpty) ...[
              const SizedBox(height: 14),
              _whiteCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Social Engineering Techniques',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: TrustLayerColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 12),
                    ...result.seTechniques.map((t) {
                      final intensityUpper = t.intensity.toUpperCase();
                      return Container(
                        margin: const EdgeInsets.only(bottom: 10),
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: TrustLayerColors.surfaceElevated,
                          borderRadius: BorderRadius.circular(18),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Expanded(
                                  child: Text(
                                    t.technique,
                                    style: GoogleFonts.plusJakartaSans(
                                      fontSize: 13.5,
                                      fontWeight: FontWeight.w700,
                                      color: TrustLayerColors.textPrimary,
                                    ),
                                  ),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 10,
                                    vertical: 4,
                                  ),
                                  decoration: BoxDecoration(
                                    color: _severityBg(intensityUpper),
                                    borderRadius: BorderRadius.circular(14),
                                  ),
                                  child: Text(
                                    intensityUpper,
                                    style: GoogleFonts.plusJakartaSans(
                                      fontSize: 10.5,
                                      fontWeight: FontWeight.w700,
                                      color: _severityColor(intensityUpper),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            if (t.evidence != null && t.evidence!.isNotEmpty) ...[
                              const SizedBox(height: 6),
                              Text(
                                '"${t.evidence}"',
                                style: GoogleFonts.plusJakartaSans(
                                  fontSize: 12,
                                  fontStyle: FontStyle.italic,
                                  color: TrustLayerColors.textSecondary,
                                ),
                              ),
                            ],
                          ],
                        ),
                      );
                    }),
                  ],
                ),
              ),
            ],

            // 8-Category SE Taxonomy Bars (FR-05 when returned by backend)
            if (result.seTaxonomy.isNotEmpty) ...[
              const SizedBox(height: 14),
              _buildTaxonomyCard(),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildChannelBreakdownCard() {
    final channels = <Map<String, dynamic>>[
      if (result.mlScore != null)
        {
          'label': 'Neural Classifier',
          'pct': (result.mlScore! <= 1.0 ? result.mlScore! * 100 : result.mlScore!)
              .round()
              .clamp(0, 100),
        },
      if (result.ruleScore != null)
        {
          'label': 'Heuristic Rules',
          'pct': result.ruleScore!.round().clamp(0, 100),
        },
      if (result.intelScore != null)
        {
          'label': 'Threat Intel (IOC)',
          'pct': result.intelScore!.round().clamp(0, 100),
        },
      if (result.urlScore != null)
        {
          'label': 'URL Forensics',
          'pct': result.urlScore!.round().clamp(0, 100),
        },
    ];

    return _whiteCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Engine Confidence',
            style: GoogleFonts.plusJakartaSans(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: TrustLayerColors.textPrimary,
            ),
          ),
          const SizedBox(height: 12),
          ...channels.map((ch) {
            final pct = ch['pct'] as int;
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        ch['label'] as String,
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
                          color: TrustLayerColors.textSecondary,
                        ),
                      ),
                      Text(
                        '$pct%',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w700,
                          color: TrustLayerColors.textPrimary,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 5),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(6),
                    child: LinearProgressIndicator(
                      value: pct / 100.0,
                      minHeight: 6,
                      backgroundColor: TrustLayerColors.surfaceElevated,
                      valueColor: AlwaysStoppedAnimation<Color>(_levelColor),
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

  Widget _buildTaxonomyCard() {
    return _whiteCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Manipulation Taxonomy',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: TrustLayerColors.textPrimary,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: TrustLayerColors.surfaceElevated,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Text(
                  '8 Vectors',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: TrustLayerColors.textSecondary,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          ...result.seTaxonomy.map((item) {
            final intensity = item.intensity.toUpperCase();
            final pct = _intensityToPct(intensity);
            final barColor = intensity == 'HIGH'
                ? TrustLayerColors.critical
                : intensity == 'MEDIUM'
                    ? TrustLayerColors.medium
                    : intensity == 'LOW'
                        ? TrustLayerColors.accent
                        : TrustLayerColors.surfaceBorder;
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        item.technique,
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
                          color: TrustLayerColors.textPrimary,
                        ),
                      ),
                      Text(
                        intensity,
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: intensity == 'NONE'
                              ? TrustLayerColors.textMuted
                              : barColor,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 5),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(6),
                    child: LinearProgressIndicator(
                      value: pct / 100.0,
                      minHeight: 5.5,
                      backgroundColor: TrustLayerColors.surfaceElevated,
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

  Widget _whiteCard({required Widget child}) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: TrustLayerColors.surface,
        borderRadius: BorderRadius.circular(28),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF16161A).withOpacity(0.04),
            blurRadius: 18,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: child,
    );
  }
}

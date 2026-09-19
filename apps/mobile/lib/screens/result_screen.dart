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
      case 'HIGH': return Icons.dangerous;
      case 'MEDIUM': return Icons.warning_amber;
      default: return Icons.verified_user;
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
        title: Text('Analysis Report',
            style: GoogleFonts.inter(color: TrustLayerColors.textPrimary, fontWeight: FontWeight.bold)),
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          // Risk Gauge Section
          Center(
            child: Column(children: [
              Stack(alignment: Alignment.center, children: [
                SizedBox(
                  width: 160,
                  height: 160,
                  child: CircularProgressIndicator(
                    value: result.riskScore / 100,
                    strokeWidth: 16,
                    backgroundColor: TrustLayerColors.surface,
                    valueColor: AlwaysStoppedAnimation(_levelColor),
                  ),
                ),
                Column(children: [
                  Text('${result.riskScore}',
                      style: GoogleFonts.jetBrainsMono(
                          fontSize: 48, fontWeight: FontWeight.bold, color: _levelColor)),
                  Text('/ 100',
                      style: GoogleFonts.inter(color: TrustLayerColors.textSecondary, fontSize: 14)),
                ]),
              ]),
              const SizedBox(height: 20),
              Row(mainAxisSize: MainAxisSize.min, children: [
                Icon(_levelIcon, color: _levelColor, size: 24),
                const SizedBox(width: 8),
                Text('${result.riskLevel} RISK',
                    style: GoogleFonts.inter(
                        fontSize: 22, fontWeight: FontWeight.bold, color: _levelColor)),
              ]),
              Text(result.threatType,
                  style: GoogleFonts.inter(color: TrustLayerColors.textSecondary, fontSize: 16)),
            ]),
          ),
          if (result.campaignFlagged)
            Container(
              margin: const EdgeInsets.only(top: 24),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: TrustLayerColors.critical.withOpacity(0.1),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: TrustLayerColors.critical.withOpacity(0.5)),
              ),
              child: const Row(children: [
                Icon(Icons.campaign, color: TrustLayerColors.critical),
                SizedBox(width: 12),
                Expanded(child: Text('Part of a possible coordinated campaign detected',
                    style: TextStyle(color: TrustLayerColors.critical, fontWeight: FontWeight.w600))),
              ]),
            ),
          const SizedBox(height: 32),
          if (result.indicators.isNotEmpty) ...[
            _sectionHeader('Indicators'),
            const SizedBox(height: 12),
            ...result.indicators.map((i) => _indicatorTile(i)),
            const SizedBox(height: 24),
          ],
          _buildSETechniques(context),
          const SizedBox(height: 24),
          _buildExplanation(context),
          const SizedBox(height: 24),
          _buildRecommendation(context),
          if (result.latencyMs != null)
            Padding(
              padding: const EdgeInsets.only(top: 24),
              child: Center(
                child: Text('Analyzed in ${result.latencyMs!.toStringAsFixed(1)} ms',
                    style: GoogleFonts.inter(fontSize: 12, color: TrustLayerColors.textSecondary)),
              ),
            ),
        ],
      ),
    );
  }

  Widget _sectionHeader(String title) {
    return Text(title,
        style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.bold, color: TrustLayerColors.textPrimary));
  }

  Widget _indicatorTile(dynamic i) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: TrustLayerColors.surface,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(children: [
        Icon(Icons.circle, size: 10, color: _sevColor(i.severity)),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(i.title,
                style: GoogleFonts.inter(color: TrustLayerColors.textPrimary, fontWeight: FontWeight.w600, fontSize: 14)),
            if (i.detail != null)
              Text(i.detail!,
                  style: GoogleFonts.inter(color: TrustLayerColors.textSecondary, fontSize: 12)),
          ]),
        ),
        Text(i.severity,
            style: GoogleFonts.inter(
                fontSize: 11,
                fontWeight: FontWeight.bold,
                color: _sevColor(i.severity))),
      ]),
    );
  }

  Widget _buildSETechniques(BuildContext context) {
    if (result.seTechniques.isEmpty) return const SizedBox.shrink();
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _sectionHeader('Social Engineering Techniques'),
      const SizedBox(height: 12),
      ...result.seTechniques.map((t) => Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: TrustLayerColors.surface,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(children: [
              Icon(Icons.psychology, color: _intensityColor(t.intensity), size: 24),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(t.technique,
                      style: GoogleFonts.inter(color: TrustLayerColors.textPrimary, fontWeight: FontWeight.w600, fontSize: 14)),
                  if (t.evidence != null)
                    Text('"${t.evidence}"',
                        style: GoogleFonts.inter(color: TrustLayerColors.textSecondary, fontSize: 12, fontStyle: FontStyle.italic)),
                ]),
              ),
              Text(t.intensity,
                  style: GoogleFonts.inter(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: _intensityColor(t.intensity))),
            ]),
          )),
    ]);
  }

  Widget _buildExplanation(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: TrustLayerColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: TrustLayerColors.primary.withOpacity(0.2)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Icon(Icons.psychology_alt, size: 20, color: TrustLayerColors.primary),
          const SizedBox(width: 8),
          Text('AI Explanation',
              style: GoogleFonts.inter(fontWeight: FontWeight.bold, color: TrustLayerColors.textPrimary)),
          const Spacer(),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(
              color: TrustLayerColors.primary.withOpacity(0.2),
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(result.explanationSource == 'llm' ? 'LLM' : 'Rules',
                style: GoogleFonts.inter(fontSize: 10, color: TrustLayerColors.primary, fontWeight: FontWeight.bold)),
          ),
        ]),
        const SizedBox(height: 12),
        Text(result.explanation,
            style: GoogleFonts.inter(color: TrustLayerColors.textPrimary, fontSize: 14, height: 1.5)),
      ]),
    );
  }

  Widget _buildRecommendation(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _levelColor.withOpacity(0.1),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _levelColor.withOpacity(0.3)),
      ),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(Icons.shield, color: _levelColor, size: 24),
        const SizedBox(width: 12),
        Expanded(child: Text(result.recommendation,
            style: GoogleFonts.inter(color: TrustLayerColors.textPrimary, fontSize: 14, height: 1.4, fontWeight: FontWeight.w500))),
      ]),
    );
  }
}

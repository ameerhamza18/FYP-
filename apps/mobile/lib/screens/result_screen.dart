import 'package:flutter/material.dart';

import '../models/analysis_result.dart';

/// Analysis report screen: risk gauge, threat type, indicators with severity,
/// social-engineering technique breakdown, and the explainable-AI verdict.
class ResultScreen extends StatelessWidget {
  final AnalysisResult result;
  const ResultScreen({super.key, required this.result});

  Color get _levelColor {
    switch (result.riskLevel) {
      case 'CRITICAL':
        return Colors.red.shade900;
      case 'HIGH':
        return Colors.red;
      case 'MEDIUM':
        return Colors.orange;
      default:
        return Colors.green;
    }
  }

  IconData get _levelIcon {
    switch (result.riskLevel) {
      case 'CRITICAL':
      case 'HIGH':
        return Icons.dangerous;
      case 'MEDIUM':
        return Icons.warning_amber;
      default:
        return Icons.verified_user;
    }
  }

  Color _sevColor(String s) {
    switch (s) {
      case 'CRITICAL':
        return Colors.red.shade900;
      case 'HIGH':
        return Colors.red;
      case 'MEDIUM':
        return Colors.orange;
      case 'LOW':
        return Colors.amber.shade700;
      default:
        return Colors.blueGrey;
    }
  }

  Color _intensityColor(String s) =>
      s == 'HIGH' ? Colors.red : (s == 'MEDIUM' ? Colors.orange : Colors.amber.shade700);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Analysis Report')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Center(
            child: Column(children: [
              Stack(alignment: Alignment.center, children: [
                SizedBox(
                  width: 150,
                  height: 150,
                  child: CircularProgressIndicator(
                    value: result.riskScore / 100,
                    strokeWidth: 12,
                    backgroundColor: Colors.grey.shade200,
                    valueColor: AlwaysStoppedAnimation(_levelColor),
                  ),
                ),
                Column(children: [
                  Text('${result.riskScore}',
                      style: TextStyle(
                          fontSize: 40, fontWeight: FontWeight.bold, color: _levelColor)),
                  const Text('/ 100', style: TextStyle(color: Colors.grey)),
                ]),
              ]),
              const SizedBox(height: 10),
              Row(mainAxisSize: MainAxisSize.min, children: [
                Icon(_levelIcon, color: _levelColor),
                const SizedBox(width: 6),
                Text('${result.riskLevel} RISK',
                    style: TextStyle(
                        fontSize: 20, fontWeight: FontWeight.bold, color: _levelColor)),
              ]),
              Text(result.threatType, style: const TextStyle(color: Colors.grey)),
            ]),
          ),
          if (result.campaignFlagged)
            Container(
              margin: const EdgeInsets.only(top: 12),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.red.shade50,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.red),
              ),
              child: const Row(children: [
                Icon(Icons.campaign, color: Colors.red),
                SizedBox(width: 8),
                Expanded(child: Text('Part of a possible coordinated campaign detected')),
              ]),
            ),
          const SizedBox(height: 18),
          if (result.indicators.isNotEmpty) ...[
            const Text('Indicators',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            ...result.indicators.map((i) => ListTile(
                  dense: true,
                  leading: Icon(Icons.circle, size: 12, color: _sevColor(i.severity)),
                  title: Text(i.title, style: const TextStyle(fontSize: 14)),
                  subtitle: i.detail == null
                      ? null
                      : Text(i.detail!,
                          style: const TextStyle(fontSize: 12, color: Colors.grey)),
                  trailing: Text(i.severity,
                      style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: _sevColor(i.severity))),
                )),
            const SizedBox(height: 12),
          ],
          _buildSETechniques(context),
          const SizedBox(height: 12),
          _buildExplanation(context),
          const SizedBox(height: 12),
          _buildRecommendation(context),
          if (result.latencyMs != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Center(
                child: Text('analyzed in ${result.latencyMs!.toStringAsFixed(1)} ms',
                    style: const TextStyle(fontSize: 11, color: Colors.grey)),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildSETechniques(BuildContext context) {
    if (result.seTechniques.isEmpty) return const SizedBox.shrink();
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const Text('Social Engineering Techniques Detected',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
      ...result.seTechniques.map((t) => ListTile(
            dense: true,
            leading: Icon(Icons.psychology, color: _intensityColor(t.intensity)),
            title: Text(t.technique, style: const TextStyle(fontSize: 14)),
            subtitle: t.evidence == null
                ? null
                : Text('"${t.evidence}"',
                    style: const TextStyle(
                        fontSize: 12, fontStyle: FontStyle.italic, color: Colors.grey)),
            trailing: Text(t.intensity,
                style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: _intensityColor(t.intensity))),
          )),
    ]);
  }

  Widget _buildExplanation(BuildContext context) {
    return Card(
      color: Theme.of(context).colorScheme.surfaceVariant,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            const Icon(Icons.psychology_alt, size: 18),
            const SizedBox(width: 6),
            const Text('AI Explanation', style: TextStyle(fontWeight: FontWeight.bold)),
            const Spacer(),
            Text(result.explanationSource == 'llm' ? 'LLM' : 'Rules',
                style: const TextStyle(fontSize: 11, color: Colors.grey)),
          ]),
          const SizedBox(height: 8),
          Text(result.explanation, style: const TextStyle(fontSize: 13, height: 1.4)),
        ]),
      ),
    );
  }

  Widget _buildRecommendation(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Icon(Icons.shield, color: _levelColor),
          const SizedBox(width: 10),
          Expanded(child: Text(result.recommendation,
              style: const TextStyle(fontSize: 13, height: 1.35))),
        ]),
      ),
    );
  }
}

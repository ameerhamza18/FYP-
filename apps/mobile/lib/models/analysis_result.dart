/// Domain models mirroring the TrustLayer API risk report.
class Indicator {
  final String category, severity, title;
  final String? detail;
  Indicator({required this.category, required this.severity, required this.title, this.detail});

  factory Indicator.fromJson(Map<String, dynamic> j) => Indicator(
        category: j['category'] as String,
        severity: j['severity'] as String,
        title: j['title'] as String,
        detail: j['detail'] as String?,
      );
}

class SETechnique {
  final String technique, intensity;
  final String? evidence;
  SETechnique({required this.technique, required this.intensity, this.evidence});

  factory SETechnique.fromJson(Map<String, dynamic> j) => SETechnique(
        technique: j['technique'] as String,
        intensity: j['intensity'] as String,
        evidence: j['evidence'] as String?,
      );
}

class AnalysisResult {
  final int? id;
  final String inputType, riskLevel, threatType, recommendation, explanation;
  final String explanationSource;
  final int riskScore;
  final double? mlScore, ruleScore, intelScore, urlScore, latencyMs;
  final bool campaignFlagged;
  final List<Indicator> indicators;
  final List<SETechnique> seTechniques;

  AnalysisResult({
    this.id,
    required this.inputType,
    required this.riskScore,
    required this.riskLevel,
    required this.threatType,
    required this.recommendation,
    required this.explanation,
    this.explanationSource = 'rules',
    this.mlScore,
    this.ruleScore,
    this.intelScore,
    this.urlScore,
    this.latencyMs,
    this.campaignFlagged = false,
    this.indicators = const [],
    this.seTechniques = const [],
  });

  factory AnalysisResult.fromJson(Map<String, dynamic> j) => AnalysisResult(
        id: j['id'] as int?,
        inputType: (j['input_type'] ?? 'text') as String,
        riskScore: (j['risk_score'] as num?)?.toInt() ?? 0,
        riskLevel: (j['risk_level'] ?? 'LOW') as String,
        threatType: (j['threat_type'] ?? '') as String,
        recommendation: (j['recommendation'] ?? '') as String,
        explanation: (j['explanation'] ?? '') as String,
        explanationSource: (j['explanation_source'] ?? 'rules') as String,
        mlScore: (j['ml_score'] as num?)?.toDouble(),
        ruleScore: (j['rule_score'] as num?)?.toDouble(),
        intelScore: (j['intel_score'] as num?)?.toDouble(),
        urlScore: (j['url_score'] as num?)?.toDouble(),
        latencyMs: (j['latency_ms'] as num?)?.toDouble(),
        campaignFlagged: (j['campaign_flagged'] ?? false) as bool,
        indicators: (j['indicators'] as List<dynamic>? ?? [])
            .map((e) => Indicator.fromJson(e as Map<String, dynamic>))
            .toList(),
        seTechniques: (j['se_techniques'] as List<dynamic>? ?? [])
            .map((e) => SETechnique.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

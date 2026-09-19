/// Unit tests for the API risk-report domain models.
///
/// These lock down the contract between the Flutter client and the FastAPI
/// backend: every field name and type here must match `AnalysisDetailOut`
/// (backend/app/schemas.py). If the API renames a field, these fail fast
/// instead of the app silently showing "0/100" in production.
import 'package:flutter_test/flutter_test.dart';
import 'package:trustlayer/models/analysis_result.dart';

/// A verbatim /api/analyze/text response captured from the running backend.
const Map<String, dynamic> scamResponse = {
  'id': 17,
  'input_type': 'text',
  'risk_score': 72,
  'risk_level': 'HIGH',
  'threat_type': 'Phishing',
  'recommendation':
      'Do not click links or provide credentials. Verify the sender through official channels only, and report the message.',
  'explanation': 'Summary: TrustLayer rated this message HIGH risk (72/100)',
  'ml_score': 0.997607968511492,
  'rule_score': 100.0,
  'intel_score': 0.0,
  'url_score': 44.0,
  'latency_ms': 3.65,
  'campaign_flagged': false,
  'indicators': [
    {'category': 'credential', 'severity': 'CRITICAL', 'title': 'Credential request', 'detail': 'enter your password'},
    {'category': 'urgency', 'severity': 'HIGH', 'title': 'Urgency-based pressure', 'detail': null},
  ],
  'se_techniques': [
    {'technique': 'Urgency', 'intensity': 'HIGH', 'evidence': 'within 24 hours'},
    {'technique': 'Fear', 'intensity': 'MEDIUM', 'evidence': null},
  ],
};

void main() {
  group('AnalysisResult.fromJson — happy path', () {
    final r = AnalysisResult.fromJson(scamResponse);

    test('parses the top-level verdict fields', () {
      expect(r.id, 17);
      expect(r.inputType, 'text');
      expect(r.riskScore, 72);
      expect(r.riskLevel, 'HIGH');
      expect(r.threatType, 'Phishing');
      expect(r.campaignFlagged, isFalse);
    });

    test('parses the four engine channels used by the risk fusion', () {
      expect(r.mlScore, closeTo(0.9976, 0.0001));
      expect(r.ruleScore, 100.0);
      expect(r.intelScore, 0.0);
      expect(r.urlScore, 44.0);
      expect(r.latencyMs, closeTo(3.65, 0.001));
    });

    test('parses indicators including the optional detail', () {
      expect(r.indicators, hasLength(2));
      expect(r.indicators.first.category, 'credential');
      expect(r.indicators.first.severity, 'CRITICAL');
      expect(r.indicators.first.title, 'Credential request');
      expect(r.indicators.first.detail, 'enter your password');
      expect(r.indicators[1].detail, isNull);
    });

    test('parses social-engineering techniques', () {
      expect(r.seTechniques, hasLength(2));
      expect(r.seTechniques.first.technique, 'Urgency');
      expect(r.seTechniques.first.intensity, 'HIGH');
      expect(r.seTechniques.first.evidence, 'within 24 hours');
      expect(r.seTechniques[1].evidence, isNull);
    });
  });

  group('AnalysisResult.fromJson — defensive defaults', () {
    test('an empty body never throws and yields a LOW 0/100 verdict', () {
      final r = AnalysisResult.fromJson(const {});
      expect(r.id, isNull);
      expect(r.riskScore, 0);
      expect(r.riskLevel, 'LOW');
      expect(r.inputType, 'text');
      expect(r.threatType, '');
      expect(r.recommendation, '');
      expect(r.explanation, '');
      expect(r.indicators, isEmpty);
      expect(r.seTechniques, isEmpty);
      expect(r.campaignFlagged, isFalse);
      expect(r.mlScore, isNull);
      expect(r.latencyMs, isNull);
    });

    test('explicit nulls fall back rather than crashing', () {
      final r = AnalysisResult.fromJson(const {
        'risk_score': null,
        'risk_level': null,
        'input_type': null,
        'indicators': null,
        'se_techniques': null,
        'campaign_flagged': null,
      });
      expect(r.riskScore, 0);
      expect(r.riskLevel, 'LOW');
      expect(r.inputType, 'text');
      expect(r.indicators, isEmpty);
      expect(r.seTechniques, isEmpty);
    });

    test('integer-typed JSON numbers are coerced (SQLite/Postgres differences)', () {
      // Postgres returns 72 and 1 for integer columns; JSON doubles must also work.
      final r = AnalysisResult.fromJson(const {
        'risk_score': 72.0,
        'rule_score': 100,
        'latency_ms': 7,
      });
      expect(r.riskScore, 72);
      expect(r.riskScore, isA<int>());
      expect(r.ruleScore, 100.0);
      expect(r.latencyMs, 7.0);
    });

    test('a coordinated-campaign flag is surfaced', () {
      final r = AnalysisResult.fromJson(const {
        'risk_score': 90,
        'risk_level': 'CRITICAL',
        'campaign_flagged': true,
      });
      expect(r.campaignFlagged, isTrue);
      expect(r.riskLevel, 'CRITICAL');
    });
  });

  group('Indicator / SETechnique', () {
    test('Indicator.fromJson maps every required field', () {
      final i = Indicator.fromJson(const {
        'category': 'url',
        'severity': 'HIGH',
        'title': 'Suspicious TLD .xyz',
        'detail': 'verify-acct-alert.xyz',
      });
      expect(i.category, 'url');
      expect(i.severity, 'HIGH');
      expect(i.title, 'Suspicious TLD .xyz');
      expect(i.detail, 'verify-acct-alert.xyz');
    });

    test('SETechnique.fromJson maps every required field', () {
      final t = SETechnique.fromJson(const {
        'technique': 'Credential Harvesting',
        'intensity': 'MEDIUM',
        'evidence': 'enter your password',
      });
      expect(t.technique, 'Credential Harvesting');
      expect(t.intensity, 'MEDIUM');
      expect(t.evidence, 'enter your password');
    });
  });
}

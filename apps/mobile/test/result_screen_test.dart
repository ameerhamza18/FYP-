/// Widget tests for the Analysis Report screen (screens/result_screen.dart).
///
/// These need no device or emulator — `flutter test` renders the widget tree on
/// the Dart VM. The viewport is enlarged so ListView children below the fold are
/// laid out and can be asserted on.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:trustlayer/models/analysis_result.dart';
import 'package:trustlayer/screens/result_screen.dart';

AnalysisResult buildResult({
  int score = 72,
  String level = 'HIGH',
  String threatType = 'Phishing',
  String recommendation = 'Do not click links or provide credentials.',
  bool campaignFlagged = false,
  double? latencyMs,
  List<Indicator> indicators = const [],
  List<SETechnique> seTechniques = const [],
}) =>
    AnalysisResult(
      inputType: 'text',
      riskScore: score,
      riskLevel: level,
      threatType: threatType,
      recommendation: recommendation,
      explanation: 'Summary: rated $level risk ($score/100)',
      campaignFlagged: campaignFlagged,
      latencyMs: latencyMs,
      indicators: indicators,
      seTechniques: seTechniques,
    );

Future<void> pumpReport(WidgetTester tester, AnalysisResult result) async {
  tester.view.physicalSize = const Size(1080, 4000);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(MaterialApp(home: ResultScreen(result: result)));
  await tester.pumpAndSettle();
}

void main() {
  // Never hit the network for fonts during tests.
  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;
  });

  group('risk verdict rendering', () {
    testWidgets('renders the score, the 0-100 gauge label and the risk level',
        (tester) async {
      await pumpReport(tester, buildResult(score: 72, level: 'HIGH', threatType: 'Phishing'));

      expect(find.text('72'), findsOneWidget);
      expect(find.text('/ 100'), findsOneWidget);
      expect(find.text('HIGH RISK'), findsOneWidget);
      expect(find.text('Phishing'), findsOneWidget);
      expect(find.text('Analysis Report'), findsOneWidget);
    });

    testWidgets('renders a CRITICAL verdict', (tester) async {
      await pumpReport(tester, buildResult(score: 94, level: 'CRITICAL', threatType: 'Financial Fraud'));

      expect(find.text('94'), findsOneWidget);
      expect(find.text('CRITICAL RISK'), findsOneWidget);
      expect(find.text('Financial Fraud'), findsOneWidget);
    });

    testWidgets('renders a LOW verdict for a benign message', (tester) async {
      await pumpReport(tester, buildResult(score: 0, level: 'LOW', threatType: 'Clean / No Strong Threat'));

      expect(find.text('0'), findsOneWidget);
      expect(find.text('LOW RISK'), findsOneWidget);
    });

    testWidgets('drives the gauge sweep from the score', (tester) async {
      await pumpReport(tester, buildResult(score: 25));

      final gauge = tester.widget<CircularProgressIndicator>(
        find.byType(CircularProgressIndicator),
      );
      expect(gauge.value, closeTo(0.25, 1e-9));
    });
  });

  group('conditional sections', () {
    testWidgets('hides the campaign banner when not flagged', (tester) async {
      await pumpReport(tester, buildResult(campaignFlagged: false));
      expect(find.text('Part of a possible coordinated campaign detected'), findsNothing);
    });

    testWidgets('shows the campaign banner when flagged', (tester) async {
      await pumpReport(tester, buildResult(campaignFlagged: true));
      expect(find.text('Part of a possible coordinated campaign detected'), findsOneWidget);
    });

    testWidgets('hides the Indicators section when there are none', (tester) async {
      await pumpReport(tester, buildResult(indicators: const []));
      expect(find.text('Indicators'), findsNothing);
    });

    testWidgets('renders each indicator with its severity', (tester) async {
      await pumpReport(
        tester,
        buildResult(indicators: [
          Indicator(category: 'credential', severity: 'CRITICAL', title: 'Credential request', detail: 'enter your password'),
          Indicator(category: 'urgency', severity: 'HIGH', title: 'Urgency-based pressure'),
        ]),
      );

      expect(find.text('Indicators'), findsOneWidget);
      expect(find.text('Credential request'), findsOneWidget);
      expect(find.text('enter your password'), findsOneWidget);
      expect(find.text('Urgency-based pressure'), findsOneWidget);
      expect(find.text('CRITICAL'), findsOneWidget);
      expect(find.text('HIGH'), findsOneWidget);
    });

    testWidgets('hides the SE-techniques section when empty', (tester) async {
      await pumpReport(tester, buildResult(seTechniques: const []));
      expect(find.text('Social Engineering Techniques'), findsNothing);
    });

    testWidgets('renders the SE-technique breakdown with evidence',
        (tester) async {
      await pumpReport(
        tester,
        buildResult(seTechniques: [
          SETechnique(technique: 'Urgency', intensity: 'HIGH', evidence: 'within 24 hours'),
        ]),
      );

      expect(find.text('Social Engineering Techniques'), findsOneWidget);
      expect(find.text('Urgency'), findsOneWidget);
      expect(find.text('"within 24 hours"'), findsOneWidget);
    });

    testWidgets('hides the latency line when latency is unknown', (tester) async {
      await pumpReport(tester, buildResult(latencyMs: null));
      expect(find.textContaining('Analyzed in'), findsNothing);
    });

    testWidgets('shows the latency line when the API reported one',
        (tester) async {
      await pumpReport(tester, buildResult(latencyMs: 3.65));
      expect(find.text('Analyzed in 3.7 ms'), findsOneWidget);
    });
  });
}

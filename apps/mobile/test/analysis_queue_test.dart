/// Unit tests for the offline analysis queue (services/analysis_queue.dart).
///
/// This queue is the reason a scam message intercepted while the phone was
/// offline still gets analysed later, so losing or corrupting it silently would
/// mean a user never receives a warning they were promised. SharedPreferences'
/// first-party mock lets these run on the Dart VM with no device.
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:trustlayer/services/analysis_queue.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  test('all() is empty on a fresh install', () async {
    expect(await AnalysisQueue.all(), isEmpty);
    expect(await AnalysisQueue.length(), 0);
  });

  test('add() then all() round-trips text, source and sender', () async {
    await AnalysisQueue.add(
      text: 'Your account will be blocked, verify now',
      source: 'whatsapp',
      sender: '+923001234567',
    );

    final queued = await AnalysisQueue.all();
    expect(queued, hasLength(1));
    expect(queued.single.text, 'Your account will be blocked, verify now');
    expect(queued.single.source, 'whatsapp');
    expect(queued.single.sender, '+923001234567');
    expect(queued.single.queuedAt, greaterThan(0));
  });

  test('blank text is ignored rather than queued', () async {
    await AnalysisQueue.add(text: '   ', source: 'sms');
    expect(await AnalysisQueue.all(), isEmpty);
  });

  test('entries keep insertion order (oldest first)', () async {
    await AnalysisQueue.add(text: 'first', source: 'sms');
    await AnalysisQueue.add(text: 'second', source: 'sms');

    final queued = await AnalysisQueue.all();
    expect(queued.map((e) => e.text), ['first', 'second']);
  });

  test('clear() empties the queue after a successful flush', () async {
    await AnalysisQueue.add(text: 'pending', source: 'sms');
    await AnalysisQueue.clear();
    expect(await AnalysisQueue.all(), isEmpty);
  });

  test('queue is bounded: the oldest entries are dropped past the cap', () async {
    for (var i = 0; i < 30; i++) {
      await AnalysisQueue.add(text: 'message $i', source: 'sms');
    }

    final queued = await AnalysisQueue.all();
    expect(queued, hasLength(25));
    expect(queued.first.text, 'message 5');
    expect(queued.last.text, 'message 29');
  });

  test('a corrupt buffer is discarded instead of throwing', () async {
    SharedPreferences.setMockInitialValues({
      'pending_analysis_queue': 'this is not json',
    });

    expect(await AnalysisQueue.all(), isEmpty);
    expect(await AnalysisQueue.length(), 0);
  });
}

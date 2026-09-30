/// Unit tests for the protection status model and intercepted-message parsing
/// (services/protection_service.dart).
///
/// These are pure Dart: the platform channel is only touched by the async
/// helpers, so the parsing rules that decide whether the UI says "Protected"
/// can be verified without a phone.
import 'package:flutter_test/flutter_test.dart';
import 'package:trustlayer/services/protection_service.dart';

void main() {
  group('ProtectionStatus.fromMap', () {
    test('reads every field reported by Android', () {
      final status = ProtectionStatus.fromMap({
        'sms': true,
        'notifications': true,
        'notificationAccess': false,
        'quietMode': true,
        'pendingInterceptions': 3,
        'platformVersion': 34,
      });

      expect(status.smsPermission, isTrue);
      expect(status.notificationsEnabled, isTrue);
      expect(status.notificationAccess, isFalse);
      expect(status.quietMode, isTrue);
      expect(status.pendingInterceptions, 3);
      expect(status.platformVersion, 34);
    });

    test('missing or unknown keys default to "not protected"', () {
      final status = ProtectionStatus.fromMap(const {});
      expect(status.smsPermission, isFalse);
      expect(status.notificationsEnabled, isFalse);
      expect(status.notificationAccess, isFalse);
      expect(status.pendingInterceptions, 0);
    });

    test('the unknown status never claims protection', () {
      expect(ProtectionStatus.unknown.automaticSmsProtection, isFalse);
      expect(ProtectionStatus.unknown.fullyProtected, isFalse);
    });

    test('SMS protection requires SMS access *and* notifications', () {
      const smsOnly = ProtectionStatus(
        smsPermission: true,
        notificationsEnabled: false,
        notificationAccess: false,
        quietMode: false,
        pendingInterceptions: 0,
        platformVersion: 34,
      );
      // Otherwise warnings would be computed and then silently dropped.
      expect(smsOnly.automaticSmsProtection, isFalse);

      const both = ProtectionStatus(
        smsPermission: true,
        notificationsEnabled: true,
        notificationAccess: false,
        quietMode: false,
        pendingInterceptions: 0,
        platformVersion: 34,
      );
      expect(both.automaticSmsProtection, isTrue);
      expect(both.fullyProtected, isFalse); // chat monitoring still off
    });

    test('fullyProtected needs notification access too', () {
      const full = ProtectionStatus(
        smsPermission: true,
        notificationsEnabled: true,
        notificationAccess: true,
        quietMode: false,
        pendingInterceptions: 0,
        platformVersion: 34,
      );
      expect(full.fullyProtected, isTrue);
    });
  });

  group('InterceptedMessage.fromMap', () {
    test('parses a full SMS interception payload', () {
      final message = InterceptedMessage.fromMap({
        'text': 'Your card is blocked, verify now',
        'sender': 'HBL-ALERTS',
        'source': 'sms',
        'localRisk': 'HIGH',
        'localReasons': ['Account block threat', 'Credential request'],
      });

      expect(message.text, 'Your card is blocked, verify now');
      expect(message.sender, 'HBL-ALERTS');
      expect(message.source, 'sms');
      expect(message.localRisk, 'HIGH');
      expect(message.localReasons, hasLength(2));
    });

    test('tolerates a payload with only text (share target)', () {
      final message = InterceptedMessage.fromMap({'text': 'check this link'});
      expect(message.text, 'check this link');
      expect(message.sender, isNull);
      expect(message.source, isNotEmpty);
      expect(message.localReasons, isEmpty);
    });

    test('coerces a missing body to an empty string, never null', () {
      final message = InterceptedMessage.fromMap(const {});
      expect(message.text, '');
    });
  });
}

/// Unit tests for JWT persistence (services/token_store.dart).
///
/// SharedPreferences ships a first-party mock, so these run on the Dart VM with
/// no device, emulator or Android SDK required.
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:trustlayer/services/token_store.dart';

void main() {
  // Required before SharedPreferences.setMockInitialValues can register the
  // mocked platform channel.
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  test('read() returns null when nothing has been stored', () async {
    expect(await TokenStore.read(), isNull);
  });

  test('save() then read() round-trips the token', () async {
    await TokenStore.save('eyJhbGciOiJIUzI1NiJ9.payload.signature');
    expect(await TokenStore.read(), 'eyJhbGciOiJIUzI1NiJ9.payload.signature');
  });

  test('clear() removes a stored token (logout path)', () async {
    await TokenStore.save('token-to-be-cleared');
    expect(await TokenStore.read(), isNotNull);

    await TokenStore.clear();
    expect(await TokenStore.read(), isNull);
  });

  test('clear() on an empty store is a no-op, not an error', () async {
    await TokenStore.clear();
    expect(await TokenStore.read(), isNull);
  });

  test('save() overwrites a previous token (re-login as another user)', () async {
    await TokenStore.save('first-token');
    await TokenStore.save('second-token');
    expect(await TokenStore.read(), 'second-token');
  });

  test('persists under the documented "trustlayer_jwt" key', () async {
    await TokenStore.save('abc123');
    final prefs = await SharedPreferences.getInstance();
    // Guards against a key rename silently logging every user out.
    expect(prefs.getString('trustlayer_jwt'), 'abc123');
  });
}

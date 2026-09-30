# TrustLayer Mobile (Flutter)

Cross-platform client for the TrustLayer platform (Android / iOS), with an
Android **on-device interception layer** that warns about scam messages before
the user opens them.

## Screens
- **Login / Register** — JWT auth against the FastAPI backend
- **Home** — live **protection status** (permissions actually granted), quick
  tools: `🔍 Analyze Message`, `📸 Analyze Screenshot`, `🔗 Check URL`, plus
  **Recent Threats** history
- **Analysis Report** — risk gauge (0–100), threat type, severity-colored
  indicators (content, URL, threat-intel **and sender reputation**),
  social-engineering technique breakdown (Authority, Urgency, Fear, Reward,
  Scarcity…), AI explanation and recommended action

## Automatic interception (Android)
Three independent layers, so a scam is caught whichever way it arrives:

| Layer | Covers | Mechanism |
| --- | --- | --- |
| SMS | incoming text messages | `SmsInterceptor` (`SMS_RECEIVED`, priority 999) |
| Chat/notification | WhatsApp, Telegram, Instagram, Facebook, Viber, SMS apps | `NotificationInterceptorService` (`NotificationListenerService`) |
| Share / tap | any app's share sheet, warning notifications | `ACTION_SEND` + deep link in `MainActivity` |

Design rules that make this safe to ship:
- **On-device first.** Ordinary messages are never uploaded; only content the
  local engine flags as suspicious is sent to the backend for full analysis.
- **Nothing is dropped.** If the app is closed or offline, the warning still
  fires and the message is buffered (`InterceptionStore`) and replayed later —
  an interception is a one-time event that must not be lost.
- **No green badge lies.** The home card reads real OS state; it only says
  "Automatic protection ON" when SMS access *and* notifications are granted.
- **Quiet mode** (optional) withdraws the original scam notification so the user
  cannot tap it out of habit.

Read [`PROTECTION.md`](PROTECTION.md) for how each layer works, how to test it on
a device, and an honest feature comparison with commercial anti-scam apps.

## Setup
```bash
cd apps/mobile
flutter pub get

# Point the app at the backend without editing code
# (Docker Compose publishes the API on host port 8001):
#   Android emulator : flutter run --dart-define=API_BASE_URL=http://10.0.2.2:8001
#   Physical device  : flutter run --dart-define=API_BASE_URL=http://<your-lan-ip>:8001
#   Production       : always HTTPS, e.g. https://api.trustlayer.app
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:8001
```

Cleartext HTTP is denied by default (`res/xml/network_security_config.xml`); the
loopback/emulator dev hosts are the only exceptions, and the whole
`<domain-config>` block should be deleted once the API is served over HTTPS.

## Architecture notes
- `services/api_client.dart` — typed REST client (auth + text/url/screenshot
  analysis + history). `analyzeText()` forwards the observed **sender** so the
  backend can score sender reputation.
- `services/protection_service.dart` — the only place that talks to the Android
  interception channel; exposes real protection status as a stream.
- `services/analysis_queue.dart` — durable queue of analyses that could not be
  uploaded while offline.
- `widgets/protection_card.dart` — setup/status UI with the actions that fix
  each unmet requirement.
- `android/.../SmsInterceptor.kt`, `NotificationInterceptorService.kt`,
  `ThreatHeuristics.kt`, `ThreatAlerts.kt`, `InterceptionStore.kt`,
  `InterceptionBridge.kt` — the interception layer (see `PROTECTION.md`).
- `models/analysis_result.dart` — risk-report domain models.
- No secrets live in the app; the JWT is stored via `shared_preferences`
  (swap for `flutter_secure_storage` in hardened builds).


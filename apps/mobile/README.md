# TrustLayer Mobile (Flutter)

Cross-platform client for the TrustLayer platform (Android / iOS).

## Screens
- **Login / Register** — JWT auth against the FastAPI backend
- **Home** — 🛡 Stay Safe Online: `🔍 Analyze Message`, `📸 Analyze Screenshot`,
  `🔗 Check URL`, plus **Recent Threats** history
- **Analysis Report** — risk gauge (0–100), threat type, severity-colored
  indicators, social-engineering technique breakdown (Authority, Urgency, Fear,
  Reward, Scarcity…), AI explanation and recommended action

## Setup
```bash
cd apps/mobile
flutter pub get

# Point the app at your backend:
#   lib/services/api_client.dart → ApiConfig.baseUrl
#   Android emulator:            http://10.0.2.2:8000
#   iOS simulator / device:      http://<your-lan-ip>:8000

flutter run
```

Android cleartext note: for local `http://` testing add
`android:usesCleartextTraffic="true"` to `<application>` in
`android/app/src/main/AndroidManifest.xml` (use HTTPS in production).

## Architecture notes
- `services/api_client.dart` — typed REST client (auth + text/url/screenshot analysis + history)
- `services/token_store.dart` — JWT persistence (swap for `flutter_secure_storage` in hardened builds)
- `models/analysis_result.dart` — risk-report domain models
- Screens are stateless where possible; no secrets live in the app.

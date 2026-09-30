# TrustLayer Android Protection — how it works, and what it still lacks

This document is deliberately blunt: it explains the interception layer that is
implemented, how to verify it on a real phone, and which capabilities of a
commercial anti-scam product are **not** in this codebase yet.

---

## 1. The three interception layers

### Layer 1 — SMS (`SmsInterceptor.kt`)
* Registered for `android.provider.Telephony.SMS_RECEIVED` with
  `android:priority="999"`, so it runs before the user's messaging app shows the
  message. Requires the runtime permission `RECEIVE_SMS`.
* Scores the body + originator with `ThreatHeuristics` (on-device, no network).
* **Only suspicious content is forwarded** to the app/backend. Ordinary messages
  are dropped inside the receiver — the phone never uploads the user's normal SMS.
* If the app is not running, `ThreatAlerts` posts the warning instead and the
  message is buffered for later analysis.

### Layer 2 — Chat & app notifications (`NotificationInterceptorService.kt`)
* A `NotificationListenerService` restricted to chat/SMS surfaces
  (`MONITORED_PACKAGES`: WhatsApp, WhatsApp Business, Telegram, Instagram,
  Facebook Messenger, Viber, imo, Discord, Google/Samsung Messages, Teams, Slack,
  LinkedIn) — not "every notification on the phone".
* Skips its own notifications, ongoing events and group summaries, and de-dupes
  repeats within a 60-second window.
* Reads the message body from `EXTRA_MESSAGES` (bubble/inbox style),
  `EXTRA_BIG_TEXT`, `EXTRA_TEXT` or `EXTRA_SUB_TEXT` and passess it through the
  same on-device engine as SMS.
* **Quiet mode** additionally calls `cancelNotification(key)` so a flagged scam
  notification is withdrawn before the user can tap it.

> Notification access is granted only in **Settings → Notifications →
> Device & app notifications**; it can never be granted by a dialog. The app sends
> the user there from the protection card and re-checks on resume.

### Layer 3 — Share target & warning tap (`MainActivity.kt`)
* `ACTION_SEND` (`text/plain`) makes TrustLayer appear in every share sheet, so a
  suspicious chat can be pushed in from WhatsApp, a browser or the SMS app.
* Tapping a TrustLayer warning opens the app with the intercepted text pre-loaded.

---

## 2. The safety contracts

| Contract | Why it exists | Where |
| --- | --- | --- |
| Dart answers `true` only after accepting an event | Kotlin treats any other answer as "nobody is listening" and raises its own alert + buffers | `ProtectionService._handleCall`, `InterceptionBridge.dispatch` |
| A share/tap arriving during cold start is analysed exactly once | The payload is held in `pendingShare` and cleared when Dart accepts it, or handed over once via `getInitialInterceptedText` | `MainActivity.deliver`, `InterceptionBridge.takePendingShare` |
| An interception is never lost | Buffer in `InterceptionStore` (Kotlin) then, if the upload fails, in `AnalysisQueue` (Dart) — replayed on the next resume | `InterceptionStore`, `AnalysisQueue`, `HomeScreen._flushOfflineQueue` |
| The UI never claims unverified protection | Status comes from real permission/notification-access checks | `InterceptionBridge.statusMap`, `ProtectionCard` |
| The user's normal messages stay private | Only locally-flagged content is analysed remotely | `SmsInterceptor`, `NotificationInterceptorService` |

---

## 3. What interception can and cannot do (Android platform limits)

* **It warns; it cannot delete an SMS.** Since Android 4.4, only the *default* SMS
  app may discard a message broadcast. TrustLayer does not request the default-SMS
  role, so an SMS that is already in the inbox stays there — the warning is the
  protection. (Becoming the default SMS app would also oblige the app to
  implement MMS/`RESPOND_VIA_MESSAGE` receivers; that is a deliberate non-goal
  today.)
* **Notification access is manual.** If the user never opens that settings page,
  chat interception silently does nothing — which is why the card lists it with
  its own action button.
* **RCS is a blind spot.** Google Messages RCS chats do not emit `SMS_RECEIVED`.
  They are caught only via the notification layer when notifications are on.
* **OEM battery managers** (Xiaomi/Oppo/Vivo/Samsung) can delay or kill
  background components. The protection card offers a shortcut to the battery
  optimisation settings; a full solution needs a user-visible foreground service
  and per-OEM guidance.
* **minSdk 21 / targetSdk 34.** `POST_NOTIFICATIONS` is requested at runtime on
  API 33+; without it no warning can be shown.

---

## 4. Testing checklist on a device

```bash
# 1. Build and install (Flutter SDK required)
cd apps/mobile
flutter run --dart-define=API_BASE_URL=http://<your-lan-ip>:8001
```
1. Home card shows **Protection needs setup** with three unmet rows.
2. Tap **Allow → Read incoming SMS**; accept the dialog; the row ticks.
3. Tap **Open settings → Message & chat monitoring**; enable *TrustLayer Scam
   Protection*; return to the app — the row ticks without a restart.
4. Tap **Send test alert**: a heads-up warning must appear with the reason list.
5. Send yourself a scam SMS (e.g. `Dear customer, your HBL account will be
   blocked within 24 hours. Verify: http://verify-acct-alert.xyz and share your
   OTP`) — expect a heads-up *and* the analysis to open/anchor in the app.
6. Send a normal SMS ("are we still meeting at 6?") — expect **nothing**: no
   notification, no upload.
7. Force-stop the app, repeat step 5 — the warning must still appear, and the
   result must show up in *Recent Threats* after reopening the app.
8. Turn on airplane mode, repeat step 5 — warning appears; reopen the app, then
   disable airplane mode and pull-to-refresh — the queued check runs.
9. Enable **Hide flagged messages** and send a scam WhatsApp message from another
   number: the original notification disappears and only TrustLayer's warning
   remains.

---

## 5. Feature comparison with commercial anti-scam apps

Reference products: Truecaller / Hiya (caller ID + spam), RoboKiller (spam calls +
SMS), SpamHawk (SMS quarantine), Google Messages spam protection, Bitdefender
Scamio / McAfee / Norton Genie (AI scam checkers).

### Implemented here
| Capability | Where |
| --- | --- |
| On-demand scam check for text, URL and screenshots (AI) | `home_screen.dart` → `/api/analyze/*` |
| Automatic interception of **SMS** with a pre-open warning | `SmsInterceptor` |
| Automatic interception of **chat/app notifications** (WhatsApp, Telegram, IG, FB, Viber, SMS apps) | `NotificationInterceptorService` |
| Hiding a flagged notification (quarantine-like) | Quiet mode → `cancelNotification` |
| Share-sheet entry point from any app | `ACTION_SEND` intent filter |
| On-device detection that works with no signal | `ThreatHeuristics` |
| Sender reputation (spoofed brand sender IDs, foreign/premium numbers, known-bad senders) | `services/threat_engine/sender_intel.py`, `POST /api/analyze/text {sender}` |
| Explainable verdict + social-engineering technique breakdown | `risk_scoring`, `se_techniques`, result screen |
| Campaign correlation across users | `campaign_detector` + `/api/admin/campaigns` |
| Detection never lost offline (two-stage durable queue) | `InterceptionStore` + `AnalysisQueue` |
| Truthful protection status UI, test alert, battery-settings shortcut | `ProtectionCard` |
| Account deletion, audit logs, RBAC, rate limiting, CSV export | backend |

### Not implemented (what a commercial app still has over this)
| Missing capability | Why it matters | What it takes |
| --- | --- | --- |
| **On-device ML model** (TFLite) | Commercial apps classify offline with ML; here offline detection is rule/keyword based only | Export `ml/models/scam_model.joblib` to TFLite, bundle it, wire an `Interpreter` into `ThreatHeuristics` |
| **Spam-call blocking / caller ID** | The other half of the market (Truecaller, Hiya, RoboKiller) | `CallScreeningService` + `RoleManager.ROLE_CALL_SCREENING` + a number-reputation service and reverse-lookup DB |
| **Community reporting & shared blocklist** | Data network effect: one user's report protects everyone | `reports` table, `POST /api/analyze/{id}/report`, moderation, published blocklist endpoint, client sync |
| **Deleting/quarantining the original SMS** | SpamHawk-style "move to spam" | Requires the default-SMS-app role (`SMS_DELIVER` + `WAP_PUSH_DELIVER` + `RESPOND_VIA_MESSAGE` + compose activity) — deliberately not taken on yet |
| **Live threat-intel feeds** | New phishing domains appear within hours | Google Safe Browsing / PhishTank / URLhaus / MISP connectors behind the existing `threat_intel` interface |
| **Server push (FCM)** | Warn users about a live campaign wave and ship model updates | Firebase project + `firebase_messaging`, device-token registration, OTA config/model fetch |
| **Trusted senders / allowlist + false-positive feedback** | Without it, legitimate bank short codes keep getting flagged | `allowlist` table + a toggle on the result screen, feeding decisions back into training |
| **QR ("quishing") and shared-image analysis** | Scams increasingly arrive as QR codes or screenshots | QR decoding in the screenshot flow; add `image/*` to the `ACTION_SEND` filter |
| **Clipboard monitoring / banking-app overlay protection** | Blocks remote-access fraud mid-transaction | `AccessibilityService` + overlay detection (Play policy justification required) |
| **Offline result history** | Results live only in the server DB | Local cache (sqflite/drift) of recent analyses |
| **Urdu / Roman-Urdu UI localisation** | The engine understands Roman Urdu; the UI does not | `flutter_localizations` + ARB files |
| **Play Store compliance for SMS access** | Google requires the SMS-permission declaration form and a privacy-policy URL; without them the app is rejected | Play Console declarations, published privacy policy, data-safety form, notification-access justification |

### Roadmap order (highest value first)
1. Play Store declarations + HTTPS-only release configuration (nothing ships without this).
2. On-device TFLite model so offline detection matches online quality.
3. Trusted-sender allowlist + false-positive feedback loop (kills the main
   real-world complaint about SMS scanners).
4. Community reporting → shared blocklist (network effect, and the strongest
   differentiator for a country-specific deployment).
5. FCM campaign alerts + model/threat-intel OTA updates.
6. `CallScreeningService` spam-call role, then default-SMS quarantine.
7. QR/image share analysis, local history cache, Urdu UI.

> Scope note: this is an FYP-grade platform, not a shipped consumer product. The
> detection core, the interception pipeline and the SOC side are real and tested
> (103 backend tests); the rows above are exactly what separates it from
> Truecaller/Hiya/RoboKiller-class software, and each lists the concrete work it
> needs.

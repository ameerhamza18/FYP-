import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../main.dart';
import '../services/protection_service.dart';

/// The honest answer to "am I protected?".
///
/// Anti-scam apps live or die on this card: interception needs permissions the
/// user grants outside the app, and a badge claiming "Protected" while SMS
/// access is denied is worse than no badge at all. Every row reflects a real OS
/// state and offers exactly the action that fixes it.
class ProtectionCard extends StatelessWidget {
  const ProtectionCard({
    super.key,
    required this.status,
    required this.onEnableSms,
    required this.onEnableNotificationAccess,
    required this.onEnableNotifications,
    required this.onQuietModeChanged,
    required this.onTestAlert,
    required this.onOpenBatterySettings,
    this.busy = false,
  });

  final ProtectionStatus status;
  final VoidCallback onEnableSms;
  final VoidCallback onEnableNotificationAccess;
  final VoidCallback onEnableNotifications;
  final ValueChanged<bool> onQuietModeChanged;
  final VoidCallback onTestAlert;
  final VoidCallback onOpenBatterySettings;
  final bool busy;

  bool get _protected => status.automaticSmsProtection;

  @override
  Widget build(BuildContext context) {
    final accent = _protected ? TrustLayerColors.low : TrustLayerColors.high;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: TrustLayerColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: accent.withOpacity(0.35), width: 1.2),
        boxShadow: [
          BoxShadow(
            color: accent.withOpacity(0.08),
            blurRadius: 18,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: accent.withOpacity(0.12),
                  shape: BoxShape.circle,
                  border: Border.all(color: accent.withOpacity(0.4)),
                ),
                child: Icon(_protected ? Icons.verified_user_rounded : Icons.gpp_maybe_rounded, color: accent, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _protected ? 'AUTONOMOUS SENSOR GUARD: ACTIVE' : 'SENSOR GUARDS STANDBY',
                      style: GoogleFonts.inter(
                        color: TrustLayerColors.textPrimary,
                        fontWeight: FontWeight.w800,
                        fontSize: 13.5,
                        letterSpacing: 0.5,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      _protected
                          ? 'Real-time intercept stream enabled'
                          : 'Action needed to arm hardware filters',
                      style: TextStyle(color: TrustLayerColors.textSecondary, fontSize: 11),
                    ),
                  ],
                ),
              ),
              if (busy)
                const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2, color: TrustLayerColors.primary),
                ),
            ],
          ),
          const SizedBox(height: 16),
          _requirement(
            done: status.smsPermission,
            code: 'SMS-01',
            label: 'Read incoming SMS stream',
            detail: 'Intercepts OTP phishing and smishing payloads.',
            actionLabel: 'Authorize',
            onTap: onEnableSms,
          ),
          _requirement(
            done: status.notificationAccess,
            code: 'NOTIF-02',
            label: 'Chat & App Notification Monitor',
            detail: 'Protects WhatsApp, Telegram, Signal and Instagram.',
            actionLabel: 'Enable Service',
            onTap: onEnableNotificationAccess,
          ),
          _requirement(
            done: status.notificationsEnabled,
            code: 'ALERT-03',
            label: 'High-Priority Threat Alerts',
            detail: 'Delivers immediate heads-up warnings before app opens.',
            actionLabel: 'Authorize',
            onTap: onEnableNotifications,
          ),
          if (status.pendingInterceptions > 0) ...[
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: TrustLayerColors.high.withOpacity(0.12),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: TrustLayerColors.high.withOpacity(0.3)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.sync_problem_rounded, color: TrustLayerColors.high, size: 16),
                  const SizedBox(width: 8),
                  Text(
                    '${status.pendingInterceptions} intercepted payload(s) queued for scan.',
                    style: const TextStyle(color: TrustLayerColors.high, fontSize: 11, fontWeight: FontWeight.w600),
                  ),
                ],
              ),
            ),
          ],
          const Divider(height: 24, color: TrustLayerColors.surfaceBorder),
          _quietModeSwitch(),
          const SizedBox(height: 6),
          Row(
            children: [
              TextButton.icon(
                onPressed: onTestAlert,
                icon: const Icon(Icons.bolt_rounded, size: 16),
                label: const Text('Simulate Test Threat'),
                style: TextButton.styleFrom(
                  foregroundColor: TrustLayerColors.primary,
                  textStyle: GoogleFonts.jetBrainsMono(fontSize: 11, fontWeight: FontWeight.bold),
                ),
              ),
              const Spacer(),
              TextButton(
                onPressed: onOpenBatterySettings,
                style: TextButton.styleFrom(
                  foregroundColor: TrustLayerColors.textSecondary,
                  textStyle: GoogleFonts.jetBrainsMono(fontSize: 10.5),
                ),
                child: const Text('Battery Exemption →'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _quietModeSwitch() {
    return SwitchListTile.adaptive(
      contentPadding: EdgeInsets.zero,
      dense: true,
      activeColor: TrustLayerColors.primary,
      value: status.quietMode,
      onChanged: onQuietModeChanged,
      title: Text('Suppress Flagged Alerts in OS Shade',
          style: GoogleFonts.inter(color: TrustLayerColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w600)),
      subtitle: Text(
        'Neutralizes native push notification so malicious links cannot be opened accidentally.',
        style: TextStyle(color: TrustLayerColors.textSecondary, fontSize: 11),
      ),
    );
  }

  Widget _requirement({
    required bool done,
    required String code,
    required String label,
    required String detail,
    required String actionLabel,
    required VoidCallback onTap,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            margin: const EdgeInsets.only(top: 2),
            width: 16,
            height: 16,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: done ? TrustLayerColors.low.withOpacity(0.2) : Colors.transparent,
              border: Border.all(
                color: done ? TrustLayerColors.low : TrustLayerColors.surfaceBorder,
                width: 1.5,
              ),
            ),
            child: done
                ? const Center(child: Icon(Icons.check, size: 11, color: TrustLayerColors.low))
                : null,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      label,
                      style: GoogleFonts.inter(
                        color: TrustLayerColors.textPrimary,
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      '[$code]',
                      style: GoogleFonts.jetBrainsMono(
                        color: TrustLayerColors.textMuted,
                        fontSize: 9,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 1),
                Text(detail,
                    style: TextStyle(color: TrustLayerColors.textSecondary, fontSize: 11)),
              ],
            ),
          ),
          if (!done)
            InkWell(
              onTap: onTap,
              borderRadius: BorderRadius.circular(6),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: TrustLayerColors.surfaceElevated,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: TrustLayerColors.primary.withOpacity(0.4)),
                ),
                child: Text(
                  actionLabel,
                  style: GoogleFonts.jetBrainsMono(
                    color: TrustLayerColors.primary,
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}


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
        border: Border.all(color: accent.withOpacity(0.45), width: 1.2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(_protected ? Icons.verified_user : Icons.gpp_maybe, color: accent, size: 26),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  _protected ? 'Automatic protection ON' : 'Protection needs setup',
                  style: GoogleFonts.inter(
                    color: TrustLayerColors.textPrimary,
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                  ),
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
          const SizedBox(height: 6),
          Text(
            _protected
                ? 'TrustLayer checks SMS and chat messages as they arrive, before you open them.'
                : 'Two taps and TrustLayer will check scam messages for you automatically.',
            style: TextStyle(color: TrustLayerColors.textSecondary, fontSize: 13),
          ),
          const SizedBox(height: 14),
          _requirement(
            done: status.smsPermission,
            label: 'Read incoming SMS',
            detail: 'Lets TrustLayer warn you before you open a scam text.',
            actionLabel: 'Allow',
            onTap: onEnableSms,
          ),
          _requirement(
            done: status.notificationAccess,
            label: 'Message & chat monitoring',
            detail: 'Covers WhatsApp, Telegram, Instagram and SMS apps.',
            actionLabel: 'Open settings',
            onTap: onEnableNotificationAccess,
          ),
          _requirement(
            done: status.notificationsEnabled,
            label: 'Show warnings as notifications',
            detail: 'Needed so alerts reach you when the app is closed.',
            actionLabel: 'Allow',
            onTap: onEnableNotifications,
          ),
          if (status.pendingInterceptions > 0) ...[
            const SizedBox(height: 4),
            Text(
              '${status.pendingInterceptions} intercepted message(s) waiting to be analyzed.',
              style: TextStyle(color: TrustLayerColors.high, fontSize: 12),
            ),
          ],
          const Divider(height: 26, color: Colors.white12),
          _quietModeSwitch(),
          Row(
            children: [
              TextButton.icon(
                onPressed: onTestAlert,
                icon: const Icon(Icons.notifications_active_outlined, size: 18),
                label: const Text('Send test alert'),
                style: TextButton.styleFrom(foregroundColor: TrustLayerColors.primary),
              ),
              const Spacer(),
              TextButton(
                onPressed: onOpenBatterySettings,
                style: TextButton.styleFrom(foregroundColor: TrustLayerColors.textSecondary),
                child: const Text('Battery settings', style: TextStyle(fontSize: 12)),
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
      value: status.quietMode,
      onChanged: onQuietModeChanged,
      title: Text('Hide flagged messages',
          style: TextStyle(color: TrustLayerColors.textPrimary, fontSize: 14)),
      subtitle: Text(
        'Withdraws the original chat notification so a scam cannot be tapped out of habit.',
        style: TextStyle(color: TrustLayerColors.textSecondary, fontSize: 12),
      ),
    );
  }

  Widget _requirement({
    required bool done,
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
          Icon(done ? Icons.check_circle : Icons.radio_button_unchecked,
              color: done ? TrustLayerColors.low : TrustLayerColors.textSecondary, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label,
                    style: TextStyle(
                      color: TrustLayerColors.textPrimary,
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    )),
                Text(detail,
                    style: TextStyle(color: TrustLayerColors.textSecondary, fontSize: 12)),
              ],
            ),
          ),
          if (!done)
            TextButton(
              onPressed: onTap,
              style: TextButton.styleFrom(foregroundColor: TrustLayerColors.primary),
              child: Text(actionLabel, style: const TextStyle(fontSize: 12)),
            ),
        ],
      ),
    );
  }
}


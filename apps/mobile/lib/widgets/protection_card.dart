import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../main.dart';
import '../services/protection_service.dart';

/// Real OS-verified protection status card styled in Shieldly AI crisp white sheet aesthetic.
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
    final pillBg = _protected
        ? TrustLayerColors.pillSafeBg
        : TrustLayerColors.pillRiskyBg;
    final pillText = _protected ? TrustLayerColors.low : TrustLayerColors.medium;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: TrustLayerColors.surface,
        borderRadius: BorderRadius.circular(28),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF16161A).withOpacity(0.04),
            blurRadius: 20,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: _protected
                      ? TrustLayerColors.sage
                      : TrustLayerColors.sand,
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  _protected
                      ? Icons.verified_user_outlined
                      : Icons.shield_outlined,
                  color: TrustLayerColors.textPrimary,
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _protected ? 'Device Guard Active' : 'Device Sensors',
                      style: GoogleFonts.plusJakartaSans(
                        color: TrustLayerColors.textPrimary,
                        fontWeight: FontWeight.w700,
                        fontSize: 15,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      _protected
                          ? 'Real-time SMS & notification monitoring'
                          : 'Enable OS permissions for automatic checks',
                      style: GoogleFonts.plusJakartaSans(
                        color: TrustLayerColors.textSecondary,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              if (busy)
                const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: TrustLayerColors.primary,
                  ),
                )
              else
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
                  decoration: BoxDecoration(
                    color: pillBg,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    _protected ? '• Protected' : '• Setup',
                    style: GoogleFonts.plusJakartaSans(
                      color: pillText,
                      fontWeight: FontWeight.w700,
                      fontSize: 11.5,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 16),
          _requirement(
            done: status.smsPermission,
            label: 'Incoming SMS Protection',
            detail: 'Checks OTP phishing & smishing texts automatically.',
            actionLabel: 'Allow',
            onTap: onEnableSms,
          ),
          _requirement(
            done: status.notificationAccess,
            label: 'Chat & App Notifications',
            detail: 'Monitors WhatsApp, Telegram & Instagram previews.',
            actionLabel: 'Enable',
            onTap: onEnableNotificationAccess,
          ),
          _requirement(
            done: status.notificationsEnabled,
            label: 'Instant Warning Banners',
            detail: 'Alerts you before you tap a suspicious link.',
            actionLabel: 'Allow',
            onTap: onEnableNotifications,
          ),
          if (status.pendingInterceptions > 0) ...[
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: TrustLayerColors.pillRiskyBg,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.sync_rounded,
                    color: TrustLayerColors.medium,
                    size: 16,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      '${status.pendingInterceptions} intercepted message(s) queued for scan.',
                      style: GoogleFonts.plusJakartaSans(
                        color: TrustLayerColors.medium,
                        fontSize: 11.5,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
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
                icon: const Icon(Icons.notifications_active_outlined, size: 16),
                label: const Text('Test Alert'),
                style: TextButton.styleFrom(
                  backgroundColor: TrustLayerColors.surfaceElevated,
                  foregroundColor: TrustLayerColors.textPrimary,
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(20),
                  ),
                  textStyle: GoogleFonts.plusJakartaSans(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              const Spacer(),
              TextButton(
                onPressed: onOpenBatterySettings,
                style: TextButton.styleFrom(
                  foregroundColor: TrustLayerColors.textSecondary,
                  textStyle: GoogleFonts.plusJakartaSans(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                child: const Text('Battery Settings →'),
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
      title: Text(
        'Hide Flagged Previews in Shade',
        style: GoogleFonts.plusJakartaSans(
          color: TrustLayerColors.textPrimary,
          fontSize: 13,
          fontWeight: FontWeight.w600,
        ),
      ),
      subtitle: Text(
        'Prevents accidental taps on scam links in the notification shade.',
        style: GoogleFonts.plusJakartaSans(
          color: TrustLayerColors.textSecondary,
          fontSize: 11.5,
        ),
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
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: TrustLayerColors.surfaceElevated,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Row(
        children: [
          Container(
            width: 24,
            height: 24,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: done ? TrustLayerColors.pillSafeBg : Colors.white,
            ),
            child: Icon(
              done ? Icons.check_rounded : Icons.circle_outlined,
              size: 14,
              color: done ? TrustLayerColors.low : TrustLayerColors.textMuted,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: GoogleFonts.plusJakartaSans(
                    color: TrustLayerColors.textPrimary,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  detail,
                  style: GoogleFonts.plusJakartaSans(
                    color: TrustLayerColors.textSecondary,
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ),
          if (!done) ...[
            const SizedBox(width: 8),
            InkWell(
              onTap: onTap,
              borderRadius: BorderRadius.circular(20),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                decoration: BoxDecoration(
                  color: TrustLayerColors.primary,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  actionLabel,
                  style: GoogleFonts.plusJakartaSans(
                    color: Colors.white,
                    fontSize: 11.5,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

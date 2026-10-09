import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../main.dart';
import '../models/analysis_result.dart';
import '../services/api_client.dart';
import '../services/protection_service.dart';
import 'login_screen.dart';
import 'result_screen.dart';

/// Screen 6 ("Scan History & Profile") from `mobile-app.jpg`.
///
/// Features:
/// - Segmented Tab Switcher: "Account / History" vs "Profile/Settings"
/// - Forensic Scan History list with Risk badges, channel tags (SMS, WhatsApp, URL)
/// - Interactive toggles for Real-time Alerts, Regional Protection, and background sensors
/// - Account management (Sign out, delete account)
class HistoryProfileScreen extends StatefulWidget {
  const HistoryProfileScreen({
    super.key,
    required this.recentScans,
    required this.onRefresh,
    this.initialTab = 0,
  });

  final List<AnalysisResult> recentScans;
  final Future<void> Function() onRefresh;
  final int initialTab;

  @override
  State<HistoryProfileScreen> createState() => _HistoryProfileScreenState();
}

class _HistoryProfileScreenState extends State<HistoryProfileScreen> {
  late int _activeTab;
  final _api = TrustApiClient();

  // Settings preferences
  bool _realtimeAlerts = true;
  bool _regionalProtection = true;
  bool _quietMode = false;

  @override
  void initState() {
    super.initState();
    _activeTab = widget.initialTab;
    _loadPreferences();
  }

  Future<void> _loadPreferences() async {
    final quiet = await ProtectionService.getQuietMode();
    if (mounted) {
      setState(() {
        _quietMode = quiet;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: TrustLayerColors.background,
      appBar: AppBar(
        backgroundColor: TrustLayerColors.background,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18, color: Colors.white70),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'Scan History & Profile',
          style: GoogleFonts.inter(
            color: TrustLayerColors.textPrimary,
            fontWeight: FontWeight.w700,
            fontSize: 16,
            letterSpacing: 0.5,
          ),
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            const SizedBox(height: 12),

            // Segmented Switcher: "Account" | "Profile/Settings"
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Container(
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                  color: TrustLayerColors.surface,
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: TrustLayerColors.surfaceBorder),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: GestureDetector(
                        onTap: () => setState(() => _activeTab = 0),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          decoration: BoxDecoration(
                            color: _activeTab == 0
                                ? TrustLayerColors.surfaceElevated
                                : Colors.transparent,
                            borderRadius: BorderRadius.circular(20),
                            border: _activeTab == 0
                                ? Border.all(
                                    color: TrustLayerColors.primary.withOpacity(0.4),
                                    width: 1.0,
                                  )
                                : null,
                          ),
                          child: Center(
                            child: Text(
                              'Account / History',
                              style: GoogleFonts.inter(
                                fontSize: 13,
                                fontWeight: _activeTab == 0
                                    ? FontWeight.w700
                                    : FontWeight.w500,
                                color: _activeTab == 0
                                    ? Colors.white
                                    : TrustLayerColors.textSecondary,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                    Expanded(
                      child: GestureDetector(
                        onTap: () => setState(() => _activeTab = 1),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          decoration: BoxDecoration(
                            color: _activeTab == 1
                                ? TrustLayerColors.surfaceElevated
                                : Colors.transparent,
                            borderRadius: BorderRadius.circular(20),
                            border: _activeTab == 1
                                ? Border.all(
                                    color: TrustLayerColors.primary.withOpacity(0.4),
                                    width: 1.0,
                                  )
                                : null,
                          ),
                          child: Center(
                            child: Text(
                              'Profile/Settings',
                              style: GoogleFonts.inter(
                                fontSize: 13,
                                fontWeight: _activeTab == 1
                                    ? FontWeight.w700
                                    : FontWeight.w500,
                                color: _activeTab == 1
                                    ? Colors.white
                                    : TrustLayerColors.textSecondary,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 16),

            // Content Area
            Expanded(
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 250),
                child: _activeTab == 0
                    ? _buildHistoryList()
                    : _buildSettingsList(),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHistoryList() {
    if (widget.recentScans.isEmpty) {
      return Center(
        key: const ValueKey('empty_history'),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.shield_outlined,
              size: 48,
              color: TrustLayerColors.textMuted.withOpacity(0.4),
            ),
            const SizedBox(height: 12),
            Text(
              'NO THREAT SCANS RECORDED',
              style: GoogleFonts.jetBrainsMono(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.2,
                color: TrustLayerColors.textMuted,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Your incoming messages and manual scans will appear here.',
              style: TextStyle(
                fontSize: 12,
                color: TrustLayerColors.textSecondary.withOpacity(0.8),
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      key: const ValueKey('history_list'),
      onRefresh: widget.onRefresh,
      color: TrustLayerColors.primary,
      backgroundColor: TrustLayerColors.surface,
      child: ListView.separated(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
        itemCount: widget.recentScans.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (context, index) {
          final scan = widget.recentScans[index];
          final isRisk = scan.riskLevel == 'CRITICAL' || scan.riskLevel == 'HIGH';

          IconData leadingIcon = Icons.chat_bubble_outline_rounded;
          if (scan.inputType == 'url') leadingIcon = Icons.link_rounded;
          if (scan.inputType == 'screenshot') leadingIcon = Icons.center_focus_strong_outlined;

          return Container(
            decoration: BoxDecoration(
              color: TrustLayerColors.surface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: TrustLayerColors.surfaceBorder),
            ),
            child: ListTile(
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
              leading: Container(
                padding: const EdgeInsets.all(9),
                decoration: BoxDecoration(
                  color: TrustLayerColors.surfaceElevated,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: (isRisk ? TrustLayerColors.critical : TrustLayerColors.low)
                        .withOpacity(0.35),
                  ),
                ),
                child: Icon(
                  leadingIcon,
                  size: 18,
                  color: isRisk ? TrustLayerColors.critical : TrustLayerColors.primary,
                ),
              ),
              title: Text(
                scan.threatType.isNotEmpty ? scan.threatType : 'Scan Telemetry Record',
                style: GoogleFonts.inter(
                  color: Colors.white,
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              subtitle: Text(
                'Score: ${scan.riskScore} · Level: ${scan.riskLevel}',
                style: GoogleFonts.jetBrainsMono(
                  fontSize: 10,
                  color: TrustLayerColors.textSecondary,
                ),
              ),
              trailing: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                    decoration: BoxDecoration(
                      color: (isRisk ? TrustLayerColors.critical : TrustLayerColors.low)
                          .withOpacity(0.15),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(
                        color: (isRisk ? TrustLayerColors.critical : TrustLayerColors.low)
                            .withOpacity(0.4),
                      ),
                    ),
                    child: Text(
                      isRisk ? 'Risk' : 'Safe',
                      style: GoogleFonts.jetBrainsMono(
                        fontSize: 9.5,
                        fontWeight: FontWeight.bold,
                        color: isRisk ? TrustLayerColors.critical : TrustLayerColors.low,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    scan.inputType.toUpperCase(),
                    style: GoogleFonts.jetBrainsMono(
                      fontSize: 9.5,
                      fontWeight: FontWeight.w600,
                      color: TrustLayerColors.textMuted,
                    ),
                  ),
                  const SizedBox(width: 4),
                  const Icon(
                    Icons.chevron_right,
                    size: 18,
                    color: TrustLayerColors.textSecondary,
                  ),
                ],
              ),
              onTap: () {
                Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => ResultScreen(result: scan)),
                );
              },
            ),
          );
        },
      ),
    );
  }

  Widget _buildSettingsList() {
    return ListView(
      key: const ValueKey('settings_list'),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      children: [
        // Account summary card
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: TrustLayerColors.surface,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: TrustLayerColors.surfaceBorder),
          ),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: TrustLayerColors.surfaceElevated,
                  border: Border.all(color: TrustLayerColors.primary.withOpacity(0.4)),
                ),
                child: const Icon(
                  Icons.shield_outlined,
                  color: TrustLayerColors.primary,
                  size: 22,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Account',
                      style: GoogleFonts.inter(
                        fontSize: 11,
                        color: TrustLayerColors.textSecondary,
                      ),
                    ),
                    Text(
                      'TrustLayer Enterprise Core',
                      style: GoogleFonts.inter(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(
                Icons.chevron_right,
                color: TrustLayerColors.textSecondary,
                size: 20,
              ),
            ],
          ),
        ),

        const SizedBox(height: 24),

        // Preferences Group
        Text(
          'PREFERENCES',
          style: GoogleFonts.jetBrainsMono(
            fontSize: 11,
            fontWeight: FontWeight.w800,
            letterSpacing: 1.2,
            color: TrustLayerColors.primary,
          ),
        ),

        const SizedBox(height: 12),

        Container(
          decoration: BoxDecoration(
            color: TrustLayerColors.surface,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: TrustLayerColors.surfaceBorder),
          ),
          child: Column(
            children: [
              SwitchListTile(
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
                title: Text(
                  'Real-time Alerts',
                  style: GoogleFonts.inter(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w600,
                    color: Colors.white,
                  ),
                ),
                subtitle: Text(
                  'Instant OS notifications for incoming threats',
                  style: TextStyle(
                    fontSize: 11,
                    color: TrustLayerColors.textSecondary,
                  ),
                ),
                value: _realtimeAlerts,
                activeColor: TrustLayerColors.low,
                onChanged: (val) {
                  setState(() => _realtimeAlerts = val);
                },
              ),
              const Divider(color: TrustLayerColors.surfaceBorder, height: 1),
              SwitchListTile(
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
                title: Text(
                  'Regional Protection',
                  style: GoogleFonts.inter(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w600,
                    color: Colors.white,
                  ),
                ),
                subtitle: Text(
                  'Geographic social-engineering heuristics',
                  style: TextStyle(
                    fontSize: 11,
                    color: TrustLayerColors.textSecondary,
                  ),
                ),
                value: _regionalProtection,
                activeColor: TrustLayerColors.low,
                onChanged: (val) {
                  setState(() => _regionalProtection = val);
                },
              ),
              const Divider(color: TrustLayerColors.surfaceBorder, height: 1),
              SwitchListTile(
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
                title: Text(
                  'Quiet Mode',
                  style: GoogleFonts.inter(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w600,
                    color: Colors.white,
                  ),
                ),
                subtitle: Text(
                  'Only alert on HIGH and CRITICAL threats',
                  style: TextStyle(
                    fontSize: 11,
                    color: TrustLayerColors.textSecondary,
                  ),
                ),
                value: _quietMode,
                activeColor: TrustLayerColors.primary,
                onChanged: (val) async {
                  await ProtectionService.setQuietMode(val);
                  setState(() => _quietMode = val);
                },
              ),
            ],
          ),
        ),

        const SizedBox(height: 24),

        // Session Actions
        Container(
          decoration: BoxDecoration(
            color: TrustLayerColors.surface,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: TrustLayerColors.surfaceBorder),
          ),
          child: Column(
            children: [
              ListTile(
                leading: const Icon(Icons.logout_rounded, color: TrustLayerColors.textSecondary, size: 20),
                title: Text(
                  'Sign Out',
                  style: GoogleFonts.inter(fontSize: 13, color: Colors.white, fontWeight: FontWeight.w600),
                ),
                onTap: () async {
                  await _api.logout();
                  if (!mounted) return;
                  Navigator.of(context).pushAndRemoveUntil(
                    MaterialPageRoute(builder: (_) => const LoginScreen()),
                    (route) => false,
                  );
                },
              ),
              const Divider(color: TrustLayerColors.surfaceBorder, height: 1),
              ListTile(
                leading: const Icon(Icons.delete_forever_rounded, color: TrustLayerColors.critical, size: 20),
                title: Text(
                  'Delete Account & Threat Data',
                  style: GoogleFonts.inter(fontSize: 13, color: TrustLayerColors.critical, fontWeight: FontWeight.w600),
                ),
                onTap: () async {
                  final confirm = await showDialog<bool>(
                    context: context,
                    builder: (ctx) => AlertDialog(
                      backgroundColor: TrustLayerColors.surface,
                      title: const Text('Delete Account', style: TextStyle(color: TrustLayerColors.critical)),
                      content: const Text(
                        'This will permanently purge your telemetry logs and threat credentials.',
                        style: TextStyle(color: TrustLayerColors.textPrimary),
                      ),
                      actions: [
                        TextButton(
                          onPressed: () => Navigator.pop(ctx, false),
                          child: const Text('Cancel', style: TextStyle(color: TrustLayerColors.textSecondary)),
                        ),
                        FilledButton(
                          style: FilledButton.styleFrom(backgroundColor: TrustLayerColors.critical),
                          onPressed: () => Navigator.pop(ctx, true),
                          child: const Text('Delete Permanently'),
                        ),
                      ],
                    ),
                  );
                  if (confirm == true) {
                    await _api.deleteAccount();
                    if (!mounted) return;
                    Navigator.of(context).pushAndRemoveUntil(
                      MaterialPageRoute(builder: (_) => const LoginScreen()),
                      (route) => false,
                    );
                  }
                },
              ),
            ],
          ),
        ),

        const SizedBox(height: 24),
      ],
    );
  }
}

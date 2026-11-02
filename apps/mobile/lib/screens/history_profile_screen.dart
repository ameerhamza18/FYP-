import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../main.dart';
import '../models/analysis_result.dart';
import '../services/api_client.dart';
import '../services/protection_service.dart';
import 'login_screen.dart';
import 'result_screen.dart';

/// Shieldly AI-styled Scan History & Profile screen.
///
/// Features warm cream header, jet-black active pill switcher, stacked pastel
/// scan history cards, real OS & SharedPreferences toggles, Sign Out, and
/// Delete Account.
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

  bool _realtimeAlerts = true;
  bool _regionalProtection = true;
  bool _quietMode = false;

  static const List<Color> _pastelCards = [
    TrustLayerColors.periwinkle,
    TrustLayerColors.sage,
    TrustLayerColors.sand,
    TrustLayerColors.butter,
  ];

  @override
  void initState() {
    super.initState();
    _activeTab = widget.initialTab;
    _loadPreferences();
  }

  Future<void> _loadPreferences() async {
    final prefs = await SharedPreferences.getInstance();
    final quiet = await ProtectionService.loadQuietMode();
    if (mounted) {
      setState(() {
        _realtimeAlerts = prefs.getBool('pref_realtime_alerts') ?? true;
        _regionalProtection = prefs.getBool('pref_regional_protection') ?? true;
        _quietMode = quiet;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: TrustLayerColors.background,
      appBar: AppBar(
        backgroundColor: TrustLayerColors.headerWarm,
        elevation: 0,
        leading: Padding(
          padding: const EdgeInsets.only(left: 12),
          child: Center(
            child: InkWell(
              borderRadius: BorderRadius.circular(22),
              onTap: () => Navigator.pop(context),
              child: Container(
                width: 40,
                height: 40,
                decoration: const BoxDecoration(
                  color: TrustLayerColors.headerButton,
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.arrow_back_rounded,
                  size: 20,
                  color: TrustLayerColors.textPrimary,
                ),
              ),
            ),
          ),
        ),
        title: Text(
          _activeTab == 0 ? 'Scan History' : 'Profile & Settings',
          style: GoogleFonts.plusJakartaSans(
            color: TrustLayerColors.textPrimary,
            fontWeight: FontWeight.w700,
            fontSize: 17,
          ),
        ),
        centerTitle: true,
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Warm Cream Top Pill Switcher Block
            Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
              decoration: const BoxDecoration(
                color: TrustLayerColors.headerWarm,
                borderRadius: BorderRadius.vertical(
                  bottom: Radius.circular(32),
                ),
              ),
              child: Row(
                children: [
                  _tabPill(label: 'History', index: 0),
                  const SizedBox(width: 10),
                  _tabPill(label: 'Profile & Settings', index: 1),
                ],
              ),
            ),
            const SizedBox(height: 14),
            Expanded(
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 220),
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

  Widget _tabPill({required String label, required int index}) {
    final active = _activeTab == index;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _activeTab = index),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: active
                ? TrustLayerColors.primary
                : Colors.white.withOpacity(0.75),
            borderRadius: BorderRadius.circular(24),
          ),
          child: Center(
            child: Text(
              label,
              style: GoogleFonts.plusJakartaSans(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: active ? Colors.white : TrustLayerColors.textPrimary,
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHistoryList() {
    if (widget.recentScans.isEmpty) {
      return Center(
        key: const ValueKey('empty_history'),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 64,
                height: 64,
                decoration: const BoxDecoration(
                  color: TrustLayerColors.periwinkle,
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.shield_outlined,
                  size: 30,
                  color: TrustLayerColors.textPrimary,
                ),
              ),
              const SizedBox(height: 16),
              Text(
                'No scans recorded yet',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: TrustLayerColors.textPrimary,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Your checked messages, links, and screenshots will appear here.',
                textAlign: TextAlign.center,
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 13,
                  color: TrustLayerColors.textSecondary,
                ),
              ),
            ],
          ),
        ),
      );
    }

    return RefreshIndicator(
      key: const ValueKey('history_list'),
      onRefresh: widget.onRefresh,
      color: TrustLayerColors.primary,
      backgroundColor: TrustLayerColors.surface,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(18, 4, 18, 24),
        itemCount: widget.recentScans.length,
        separatorBuilder: (_, __) => const SizedBox(height: 12),
        itemBuilder: (context, index) {
          final scan = widget.recentScans[index];
          final cardBg = _pastelCards[index % _pastelCards.length];
          final level = scan.riskLevel.toUpperCase();

          final bool isScam = level == 'CRITICAL' || level == 'HIGH';
          final bool isMedium = level == 'MEDIUM';
          final Color pillBg = isScam
              ? TrustLayerColors.pillScamBg
              : isMedium
                  ? TrustLayerColors.pillRiskyBg
                  : TrustLayerColors.pillSafeBg;
          final Color pillColor = isScam
              ? TrustLayerColors.critical
              : isMedium
                  ? TrustLayerColors.medium
                  : TrustLayerColors.low;
          final String pillWord = isScam
              ? 'Scam'
              : isMedium
                  ? 'Risky'
                  : 'Safe';
          final String scoreStr = scan.riskScore.toString().padLeft(2, '0');

          IconData leadingIcon = Icons.chat_bubble_outline_rounded;
          if (scan.inputType == 'url') leadingIcon = Icons.link_rounded;
          if (scan.inputType == 'screenshot') {
            leadingIcon = Icons.crop_free_rounded;
          }

          return GestureDetector(
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => ResultScreen(result: scan)),
              );
            },
            child: Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: cardBg,
                borderRadius: BorderRadius.circular(26),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.85),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          leadingIcon,
                          size: 19,
                          color: TrustLayerColors.textPrimary,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              scan.threatType.isNotEmpty
                                  ? scan.threatType
                                  : 'Security Scan',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                                color: TrustLayerColors.textPrimary,
                              ),
                            ),
                            Text(
                              scan.inputType.toUpperCase(),
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: TrustLayerColors.textPrimary
                                    .withOpacity(0.55),
                              ),
                            ),
                          ],
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 11,
                          vertical: 5,
                        ),
                        decoration: BoxDecoration(
                          color: pillBg,
                          borderRadius: BorderRadius.circular(18),
                        ),
                        child: Text(
                          '$pillWord • $scoreStr',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 11.5,
                            fontWeight: FontWeight.w700,
                            color: pillColor,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text(
                    scan.recommendation.isNotEmpty
                        ? scan.recommendation
                        : scan.explanation,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 13,
                      height: 1.4,
                      color: TrustLayerColors.textPrimary.withOpacity(0.78),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildSettingsList() {
    return ListView(
      key: const ValueKey('settings_list'),
      padding: const EdgeInsets.fromLTRB(18, 4, 18, 28),
      children: [
        // Account Banner Card
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: TrustLayerColors.periwinkle,
            borderRadius: BorderRadius.circular(26),
          ),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.white,
                ),
                child: const Icon(
                  Icons.verified_user_outlined,
                  color: TrustLayerColors.textPrimary,
                  size: 24,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'TrustLayer Protection',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: TrustLayerColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Zero-disk privacy · Encrypted session',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        color: TrustLayerColors.textPrimary.withOpacity(0.7),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 20),

        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 10),
          child: Text(
            'Preferences',
            style: GoogleFonts.plusJakartaSans(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: TrustLayerColors.textPrimary,
            ),
          ),
        ),

        Container(
          decoration: BoxDecoration(
            color: TrustLayerColors.surface,
            borderRadius: BorderRadius.circular(26),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF16161A).withOpacity(0.04),
                blurRadius: 18,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: Column(
            children: [
              SwitchListTile.adaptive(
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 18, vertical: 4),
                title: Text(
                  'Real-time Alerts',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: TrustLayerColors.textPrimary,
                  ),
                ),
                subtitle: Text(
                  'Instant OS notifications for incoming threats',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 12,
                    color: TrustLayerColors.textSecondary,
                  ),
                ),
                value: _realtimeAlerts,
                activeColor: TrustLayerColors.primary,
                onChanged: (val) async {
                  final prefs = await SharedPreferences.getInstance();
                  await prefs.setBool('pref_realtime_alerts', val);
                  setState(() => _realtimeAlerts = val);
                },
              ),
              const Divider(color: TrustLayerColors.surfaceBorder, height: 1),
              SwitchListTile.adaptive(
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 18, vertical: 4),
                title: Text(
                  'Regional Protection',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: TrustLayerColors.textPrimary,
                  ),
                ),
                subtitle: Text(
                  'Raast, banking & local social-engineering rules',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 12,
                    color: TrustLayerColors.textSecondary,
                  ),
                ),
                value: _regionalProtection,
                activeColor: TrustLayerColors.primary,
                onChanged: (val) async {
                  final prefs = await SharedPreferences.getInstance();
                  await prefs.setBool('pref_regional_protection', val);
                  setState(() => _regionalProtection = val);
                },
              ),
              const Divider(color: TrustLayerColors.surfaceBorder, height: 1),
              SwitchListTile.adaptive(
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 18, vertical: 4),
                title: Text(
                  'Quiet Mode',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: TrustLayerColors.textPrimary,
                  ),
                ),
                subtitle: Text(
                  'Suppress flagged message previews in OS shade',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 12,
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

        const SizedBox(height: 20),

        Container(
          decoration: BoxDecoration(
            color: TrustLayerColors.surface,
            borderRadius: BorderRadius.circular(26),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF16161A).withOpacity(0.04),
                blurRadius: 18,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: Column(
            children: [
              ListTile(
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 18, vertical: 4),
                leading: Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: TrustLayerColors.surfaceElevated,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(
                    Icons.logout_rounded,
                    color: TrustLayerColors.textPrimary,
                    size: 19,
                  ),
                ),
                title: Text(
                  'Sign Out',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 14,
                    color: TrustLayerColors.textPrimary,
                    fontWeight: FontWeight.w700,
                  ),
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
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 18, vertical: 4),
                leading: Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: TrustLayerColors.pillScamBg,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(
                    Icons.delete_outline_rounded,
                    color: TrustLayerColors.critical,
                    size: 20,
                  ),
                ),
                title: Text(
                  'Delete Account & Threat Data',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 14,
                    color: TrustLayerColors.critical,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                onTap: () async {
                  final confirm = await showDialog<bool>(
                    context: context,
                    builder: (ctx) => AlertDialog(
                      backgroundColor: TrustLayerColors.surface,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(24),
                      ),
                      title: Text(
                        'Delete Account',
                        style: GoogleFonts.plusJakartaSans(
                          color: TrustLayerColors.critical,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      content: Text(
                        'This will permanently delete your account and all saved threat history.',
                        style: GoogleFonts.plusJakartaSans(
                          color: TrustLayerColors.textSecondary,
                          fontSize: 13.5,
                        ),
                      ),
                      actions: [
                        TextButton(
                          onPressed: () => Navigator.pop(ctx, false),
                          child: const Text(
                            'Cancel',
                            style:
                                TextStyle(color: TrustLayerColors.textSecondary),
                          ),
                        ),
                        FilledButton(
                          style: FilledButton.styleFrom(
                            backgroundColor: TrustLayerColors.critical,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(20),
                            ),
                          ),
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
      ],
    );
  }
}

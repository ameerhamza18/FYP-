import 'dart:async';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';

import '../main.dart';
import '../models/analysis_result.dart';
import '../services/analysis_queue.dart';
import '../services/api_client.dart';
import '../services/protection_service.dart';
import '../widgets/defense_shield_3d.dart';
import '../widgets/protection_card.dart';
import '../widgets/scanning_overlay.dart';
import 'history_profile_screen.dart';
import 'login_screen.dart';
import 'onboarding_screen.dart';
import 'result_screen.dart';

/// Screen 2 ("Main Home/Security Dashboard") matching `mobile-app.jpg`.
///
/// Features:
/// - Top Bar: Menu Hamburger button & Notification Bell with unread alert dot
/// - 3D Shield Hero with "3D SHIELD", "SYSTEM SECURE" and 4-dot indicator
/// - Real OS Protection Status & Sensors integration
/// - Quick Action Cards: "Scan Message" & "Scan URL"
/// - "Latest Activity" section with "See All" link and recent scan items
/// - Bottom Navigation Bar (5 tabs with center glowing floating action button)
/// - Integrated Fullscreen Animated Scanning Overlay during live scans
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with WidgetsBindingObserver {
  final _api = TrustApiClient();
  final _picker = ImagePicker();
  List<AnalysisResult> _recent = [];
  bool _busy = false;
  String _scanStatusMessage = 'TrustLayer AI is actively scanning…';
  int _currentNavIndex = 0;

  // Real protection state from Android platform layer
  ProtectionStatus _protection = ProtectionStatus.unknown;
  bool _protectionBusy = false;
  StreamSubscription<ProtectionStatus>? _protectionSub;

  String? _historyError;
  bool _historyLoading = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _loadHistory();
    _initProtection();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _protectionSub?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _refreshProtection();
      _flushOfflineQueue();
    }
  }

  Future<void> _loadHistory() async {
    if (mounted) setState(() { _historyLoading = true; _historyError = null; });
    try {
      final h = await _api.history(limit: 10);
      if (!mounted) return;
      setState(() => _recent = h);
    } on SessionExpiredException {
      // Handled globally
    } on ApiException catch (e) {
      if (mounted) setState(() => _historyError = e.message);
    } catch (_) {
      if (mounted) setState(() => _historyError = 'Could not load your recent threats.');
    } finally {
      if (mounted) setState(() => _historyLoading = false);
    }
  }

  Future<void> _initProtection() async {
    await ProtectionService.initialize(onIntercepted: _handleInterception);

    _protectionSub = ProtectionService.statusStream.listen((status) {
      if (mounted) setState(() => _protection = status);
    });

    await _refreshProtection();

    final initial = await ProtectionService.takeInitialInterception();
    if (initial != null) _handleInterception(initial);

    await _replayPendingInterceptions();
    await _flushOfflineQueue();
  }

  Future<void> _refreshProtection() async {
    final status = await ProtectionService.status();
    if (mounted) setState(() => _protection = status);
  }

  Future<void> _replayPendingInterceptions() async {
    final pending = await ProtectionService.drainPendingInterceptions();
    if (pending.isEmpty) return;
    if (mounted) {
      _snack('${pending.length} message(s) were checked while the app was closed.');
    }
    for (final message in pending) {
      _handleInterception(message, showResult: false);
    }
  }

  static const int _maxFlushPerResume = 5;

  Future<void> _flushOfflineQueue() async {
    final queued = await AnalysisQueue.all();
    if (queued.isEmpty) return;

    final batch = queued.take(_maxFlushPerResume).toList();
    final tail = queued.sublist(batch.length);
    await AnalysisQueue.clear();

    final failed = <QueuedAnalysis>[];
    var checked = 0;
    var stopped = false;
    var offline = false;

    for (final item in batch) {
      if (stopped) break;
      try {
        await _api.analyzeText(item.text, source: item.source, sender: item.sender);
        checked++;
      } on SessionExpiredException {
        failed.addAll(batch.sublist(checked));
        stopped = true;
      } on NetworkException {
        failed.addAll(batch.sublist(checked));
        stopped = true;
        offline = true;
      } catch (_) {}
    }

    await _requeue([...failed, ...tail]);

    if (offline) {
      _snack('Still offline — saved checks will run when you are back online.');
    } else if (checked > 0) {
      _snack('Checked $checked message(s) saved while you were offline.');
      await _loadHistory();
    }
  }

  Future<void> _requeue(List<QueuedAnalysis> items) async {
    for (final item in items) {
      await AnalysisQueue.add(text: item.text, source: item.source, sender: item.sender);
    }
  }

  void _handleInterception(InterceptedMessage message, {bool showResult = true}) {
    if (!mounted) return;
    _snack('⚡ Intercepted a ${_sourceLabel(message.source)} message — checking with TrustLayer…');
    _run(
      () => _api.analyzeText(message.text, source: message.source, sender: message.sender),
      showResult: showResult,
      queueOnOffline: message,
      statusMsg: 'Auditing intercepted ${_sourceLabel(message.source)} telemetry…',
    );
  }

  String _sourceLabel(String source) {
    switch (source) {
      case 'whatsapp': return 'WhatsApp';
      case 'telegram': return 'Telegram';
      case 'instagram': return 'Instagram';
      case 'facebook': return 'Facebook';
      case 'share': return 'shared';
      case 'notification-tap': return 'flagged';
      case 'notification': return 'chat';
      default: return 'SMS';
    }
  }

  Future<void> _enableSmsProtection() async {
    setState(() => _protectionBusy = true);
    await ProtectionService.requestSmsPermission();
    await _refreshProtection();
    if (mounted) setState(() => _protectionBusy = false);
  }

  Future<void> _enableNotificationAccess() async {
    if (!_protection.notificationAccess) {
      _snack('Turn on notification access for TrustLayer in the list that opens.');
    }
    await ProtectionService.openNotificationListenerSettings();
  }

  Future<void> _enableNotifications() async {
    setState(() => _protectionBusy = true);
    await ProtectionService.requestNotificationPermission();
    await _refreshProtection();
    if (mounted) setState(() => _protectionBusy = false);
  }

  Future<void> _setQuietMode(bool enabled) async {
    await ProtectionService.setQuietMode(enabled);
    await _refreshProtection();
  }

  Future<void> _analyzeText() async {
    final controller = TextEditingController();
    final text = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF090E1B),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: const BorderSide(color: TrustLayerColors.surfaceBorder, width: 1.2),
        ),
        title: Row(
          children: [
            const Icon(Icons.document_scanner_outlined, color: TrustLayerColors.primary, size: 20),
            const SizedBox(width: 8),
            Text(
              'SCAN MESSAGE / TEXT',
              style: GoogleFonts.jetBrainsMono(
                color: TrustLayerColors.textPrimary,
                fontWeight: FontWeight.bold,
                fontSize: 13,
                letterSpacing: 1.0,
              ),
            ),
          ],
        ),
        content: TextField(
          controller: controller,
          maxLines: 5,
          autofocus: true,
          style: const TextStyle(color: TrustLayerColors.textPrimary, fontSize: 13),
          decoration: InputDecoration(
            hintText: 'Paste SMS, WhatsApp text, email, or message payload…',
            hintStyle: TextStyle(color: TrustLayerColors.textSecondary.withOpacity(0.6), fontSize: 12),
            filled: true,
            fillColor: const Color(0xFF040711),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: TrustLayerColors.surfaceBorder),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: TrustLayerColors.primary, width: 1.5),
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel', style: TextStyle(color: TrustLayerColors.textSecondary)),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: TrustLayerColors.primary,
              foregroundColor: const Color(0xFF040711),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            onPressed: () => Navigator.pop(ctx, controller.text),
            child: const Text('Run Neural Scan', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
    if (text == null || text.trim().isEmpty) return;
    await _run(
      () => _api.analyzeText(text.trim()),
      statusMsg: 'TrustLayer AI is actively scanning message…',
    );
  }

  Future<void> _analyzeScreenshot() async {
    final img = await _picker.pickImage(source: ImageSource.gallery, imageQuality: 85);
    if (img == null) return;
    await _run(
      () => _api.analyzeScreenshot(img),
      statusMsg: 'Optical OCR heuristic parsing in progress…',
    );
  }

  Future<void> _checkUrl() async {
    final controller = TextEditingController();
    final url = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF090E1B),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: const BorderSide(color: TrustLayerColors.surfaceBorder, width: 1.2),
        ),
        title: Row(
          children: [
            const Icon(Icons.link_rounded, color: TrustLayerColors.primary, size: 20),
            const SizedBox(width: 8),
            Text(
              'PROBE SUSPICIOUS URL',
              style: GoogleFonts.jetBrainsMono(
                color: TrustLayerColors.textPrimary,
                fontWeight: FontWeight.bold,
                fontSize: 13,
                letterSpacing: 1.0,
              ),
            ),
          ],
        ),
        content: TextField(
          controller: controller,
          autofocus: true,
          style: const TextStyle(color: TrustLayerColors.textPrimary, fontSize: 13),
          decoration: InputDecoration(
            hintText: 'https://security-verify.example.com/login',
            hintStyle: TextStyle(color: TrustLayerColors.textSecondary.withOpacity(0.6), fontSize: 12),
            filled: true,
            fillColor: const Color(0xFF040711),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: TrustLayerColors.surfaceBorder),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: TrustLayerColors.primary, width: 1.5),
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel', style: TextStyle(color: TrustLayerColors.textSecondary)),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: TrustLayerColors.primary,
              foregroundColor: const Color(0xFF040711),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            onPressed: () => Navigator.pop(ctx, controller.text),
            child: const Text('Probe Domain', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
    if (url == null || url.trim().isEmpty) return;
    await _run(
      () => _api.analyzeUrl(url.trim()),
      statusMsg: 'Probing domain reputation & typosquat telemetry…',
    );
  }

  Future<void> _run(
    Future<AnalysisResult> Function() job, {
    bool showResult = true,
    InterceptedMessage? queueOnOffline,
    String? statusMsg,
  }) async {
    setState(() {
      _busy = true;
      if (statusMsg != null) _scanStatusMessage = statusMsg;
    });
    try {
      final result = await job();
      if (!mounted) return;
      if (showResult) {
        await Navigator.of(context).push(MaterialPageRoute(
          builder: (_) => ResultScreen(result: result),
        ));
      }
      await _loadHistory();
    } on SessionExpiredException {
      // Global handler routes to login
    } on NetworkException catch (e) {
      if (queueOnOffline != null) {
        await AnalysisQueue.add(
          text: queueOnOffline.text,
          source: queueOnOffline.source,
          sender: queueOnOffline.sender,
        );
        _snack('You are offline — the message is saved and will be checked automatically.');
      } else {
        _snack(e.message);
      }
    } on ApiException catch (e) {
      _snack(e.statusCode == 503
          ? 'OCR unavailable on the server — paste the text instead'
          : e.message);
    } catch (_) {
      _snack('Something went wrong. Please try again.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _snack(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  void _showScanModal() {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF090E1B),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        side: BorderSide(color: TrustLayerColors.surfaceBorder, width: 1.2),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.white24,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 18),
              Text(
                'COMMENCE CYBER AUDIT',
                style: GoogleFonts.jetBrainsMono(
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1.5,
                  color: TrustLayerColors.primary,
                ),
              ),
              const SizedBox(height: 16),
              ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: TrustLayerColors.surfaceElevated,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.chat_bubble_outline_rounded, color: TrustLayerColors.primary),
                ),
                title: const Text('Scan Message / Text', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
                subtitle: const Text('Analyze SMS, WhatsApp, phishing emails', style: TextStyle(color: TrustLayerColors.textSecondary, fontSize: 11)),
                onTap: () {
                  Navigator.pop(ctx);
                  _analyzeText();
                },
              ),
              ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: TrustLayerColors.surfaceElevated,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.link_rounded, color: Color(0xFF3B82F6)),
                ),
                title: const Text('Scan URL / Domain', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
                subtitle: const Text('Inspect domains for spoofing and typosquatting', style: TextStyle(color: TrustLayerColors.textSecondary, fontSize: 11)),
                onTap: () {
                  Navigator.pop(ctx);
                  _checkUrl();
                },
              ),
              ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: TrustLayerColors.surfaceElevated,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.center_focus_strong_outlined, color: Color(0xFF10B981)),
                ),
                title: const Text('Screenshot OCR Scan', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
                subtitle: const Text('Extract visual text via server OCR engine', style: TextStyle(color: TrustLayerColors.textSecondary, fontSize: 11)),
                onTap: () {
                  Navigator.pop(ctx);
                  _analyzeScreenshot();
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: TrustLayerColors.background,
      // Top Navigation Bar matching Screen 2
      appBar: AppBar(
        backgroundColor: TrustLayerColors.background,
        elevation: 0,
        leading: Builder(
          builder: (context) => IconButton(
            icon: const Icon(Icons.menu_rounded, color: Colors.white70, size: 24),
            onPressed: () => Scaffold.of(context).openDrawer(),
          ),
        ),
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(5),
              decoration: BoxDecoration(
                color: TrustLayerColors.surfaceElevated,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: TrustLayerColors.primary.withOpacity(0.35)),
              ),
              child: const Icon(Icons.shield_outlined, size: 16, color: TrustLayerColors.primary),
            ),
            const SizedBox(width: 8),
            Text(
              'TrustLayer',
              style: GoogleFonts.inter(
                fontWeight: FontWeight.w800,
                color: TrustLayerColors.textPrimary,
                letterSpacing: 1.0,
                fontSize: 16,
              ),
            ),
          ],
        ),
        centerTitle: true,
        actions: [
          // Notification Bell with Glowing Alert Dot
          Stack(
            alignment: Alignment.center,
            children: [
              IconButton(
                icon: const Icon(Icons.notifications_none_rounded, color: Colors.white70, size: 22),
                onPressed: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => HistoryProfileScreen(
                        recentScans: _recent,
                        onRefresh: _loadHistory,
                        initialTab: 0,
                      ),
                    ),
                  );
                },
              ),
              Positioned(
                top: 13,
                right: 13,
                child: Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: const Color(0xFFEF4444),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFFEF4444).withOpacity(0.8),
                        blurRadius: 6,
                        spreadRadius: 1,
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(width: 4),
        ],
      ),
      // Tactical Drawer
      drawer: Drawer(
        backgroundColor: const Color(0xFF080D1A),
        child: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.all(24),
                child: Row(
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: TrustLayerColors.surfaceElevated,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: TrustLayerColors.primary.withOpacity(0.5)),
                      ),
                      child: const Icon(Icons.shield_rounded, color: TrustLayerColors.primary, size: 26),
                    ),
                    const SizedBox(width: 14),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('TrustLayer 3D', style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w800, color: Colors.white)),
                        Text('AUTONOMOUS CORE', style: GoogleFonts.jetBrainsMono(fontSize: 9, color: TrustLayerColors.primary, fontWeight: FontWeight.bold)),
                      ],
                    ),
                  ],
                ),
              ),
              const Divider(color: TrustLayerColors.surfaceBorder, height: 1),
              ListTile(
                leading: const Icon(Icons.explore_outlined, color: TrustLayerColors.primary),
                title: const Text('Onboarding Tour', style: TextStyle(color: Colors.white)),
                onTap: () {
                  Navigator.pop(context);
                  Navigator.push(context, MaterialPageRoute(builder: (_) => const OnboardingScreen()));
                },
              ),
              ListTile(
                leading: const Icon(Icons.history_rounded, color: TrustLayerColors.primary),
                title: const Text('Scan History & Profile', style: TextStyle(color: Colors.white)),
                onTap: () {
                  Navigator.pop(context);
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => HistoryProfileScreen(
                        recentScans: _recent,
                        onRefresh: _loadHistory,
                      ),
                    ),
                  );
                },
              ),
              const Spacer(),
              ListTile(
                leading: const Icon(Icons.logout, color: TrustLayerColors.critical),
                title: const Text('Sign Out', style: TextStyle(color: TrustLayerColors.critical)),
                onTap: () async {
                  await _api.logout();
                  if (!mounted) return;
                  Navigator.pushAndRemoveUntil(
                    context,
                    MaterialPageRoute(builder: (_) => const LoginScreen()),
                    (route) => false,
                  );
                },
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
      // Main Body
      body: Stack(
        children: [
          RefreshIndicator(
            onRefresh: _loadHistory,
            color: TrustLayerColors.primary,
            backgroundColor: TrustLayerColors.surface,
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
              children: [
                // 1. Hero 3D Shield (with 3D SHIELD label, SYSTEM SECURE, 4 dots)
                DefenseShield3D(
                  isProtected: _protection.automaticSmsProtection,
                  onTap: _showScanModal,
                ),

                const SizedBox(height: 18),

                // Real OS-verified Protection Card Sensors
                ProtectionCard(
                  status: _protection,
                  busy: _protectionBusy,
                  onEnableSms: _enableSmsProtection,
                  onEnableNotificationAccess: _enableNotificationAccess,
                  onEnableNotifications: _enableNotifications,
                  onQuietModeChanged: _setQuietMode,
                  onTestAlert: () => ProtectionService.showTestAlert(),
                  onOpenBatterySettings: () =>
                      ProtectionService.openBatteryOptimizationSettings(),
                ),

                const SizedBox(height: 24),

                // 2. Quick Action Cards (Side by side matching Screen 2)
                Row(
                  children: [
                    // Card 1: Scan Message
                    Expanded(
                      child: _quickActionCard(
                        icon: Icons.chat_bubble_outline_rounded,
                        title: 'Scan Message',
                        subtitle: 'SMS / Chat Payload',
                        accentColor: TrustLayerColors.primary,
                        onTap: _analyzeText,
                      ),
                    ),
                    const SizedBox(width: 14),
                    // Card 2: Scan URL
                    Expanded(
                      child: _quickActionCard(
                        icon: Icons.link_rounded,
                        title: 'Scan URL',
                        subtitle: 'Domain Heuristics',
                        accentColor: const Color(0xFF3B82F6),
                        onTap: _checkUrl,
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 12),

                // Secondary Quick Row: Screenshot OCR & Chamber Audit
                Row(
                  children: [
                    Expanded(
                      child: _quickActionCard(
                        icon: Icons.center_focus_strong_outlined,
                        title: 'Screenshot OCR',
                        subtitle: 'Visual Heuristic',
                        accentColor: const Color(0xFF10B981),
                        onTap: _analyzeScreenshot,
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: _quickActionCard(
                        icon: Icons.history_rounded,
                        title: 'Audit Vault',
                        subtitle: 'Telemetry Log',
                        accentColor: const Color(0xFFF59E0B),
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => HistoryProfileScreen(
                                recentScans: _recent,
                                onRefresh: _loadHistory,
                                initialTab: 0,
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 28),

                // 3. Latest Activity Section (Matching Screen 2)
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Latest Activity',
                      style: GoogleFonts.inter(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: TrustLayerColors.textPrimary,
                        letterSpacing: 0.2,
                      ),
                    ),
                    GestureDetector(
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => HistoryProfileScreen(
                              recentScans: _recent,
                              onRefresh: _loadHistory,
                              initialTab: 0,
                            ),
                          ),
                        );
                      },
                      child: Text(
                        'See All',
                        style: GoogleFonts.inter(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: TrustLayerColors.primary,
                        ),
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 12),

                // Activity List Items
                if (_historyLoading && _recent.isEmpty)
                  const Center(
                    child: Padding(
                      padding: EdgeInsets.symmetric(vertical: 30),
                      child: CircularProgressIndicator(color: TrustLayerColors.primary),
                    ),
                  )
                else if (_recent.isEmpty)
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: TrustLayerColors.surface,
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: TrustLayerColors.surfaceBorder),
                    ),
                    child: Center(
                      child: Column(
                        children: [
                          Icon(Icons.shield_outlined, size: 36, color: TrustLayerColors.textMuted.withOpacity(0.5)),
                          const SizedBox(height: 8),
                          Text(
                            'NO ACTIVITY YET',
                            style: GoogleFonts.jetBrainsMono(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: TrustLayerColors.textMuted,
                            ),
                          ),
                        ],
                      ),
                    ),
                  )
                else
                  ..._recent.take(4).map((r) => _activityItem(r)),

                const SizedBox(height: 80), // Space for docked bottom nav
              ],
            ),
          ),

          // 4. Integrated Fullscreen Animated Scanning Overlay (Screen 3)
          if (_busy)
            ScanningOverlay(
              message: _scanStatusMessage,
              submessage: 'TrustLayer AI is detecting anomalies for financial fraud.',
            ),
        ],
      ),

      // Docked 5-tab Bottom Navigation Bar matching Screen 2
      bottomNavigationBar: Container(
        height: 72,
        decoration: BoxDecoration(
          color: const Color(0xFF060913),
          border: Border(
            top: BorderSide(
              color: TrustLayerColors.surfaceBorder.withOpacity(0.8),
              width: 1.0,
            ),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.6),
              blurRadius: 16,
              offset: const Offset(0, -4),
            ),
          ],
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            // Tab 1: Home
            _navIcon(
              icon: Icons.home_rounded,
              index: 0,
              onTap: () => setState(() => _currentNavIndex = 0),
            ),
            // Tab 2: Forensics / Search
            _navIcon(
              icon: Icons.search_rounded,
              index: 1,
              onTap: () => _analyzeText(),
            ),
            // Tab 3: Center Elevated Floating Shield Scan Button
            GestureDetector(
              onTap: _showScanModal,
              child: Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: const Color(0xFF0C1A30),
                  border: Border.all(
                    color: TrustLayerColors.primary.withOpacity(0.8),
                    width: 1.5,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: TrustLayerColors.primary.withOpacity(0.4),
                      blurRadius: 16,
                      spreadRadius: 1,
                    ),
                  ],
                ),
                child: const Center(
                  child: Icon(
                    Icons.shield_rounded,
                    color: TrustLayerColors.primary,
                    size: 24,
                  ),
                ),
              ),
            ),
            // Tab 4: Telemetry Log
            _navIcon(
              icon: Icons.tune_rounded,
              index: 3,
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => HistoryProfileScreen(
                      recentScans: _recent,
                      onRefresh: _loadHistory,
                      initialTab: 0,
                    ),
                  ),
                );
              },
            ),
            // Tab 5: Profile
            _navIcon(
              icon: Icons.person_outline_rounded,
              index: 4,
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => HistoryProfileScreen(
                      recentScans: _recent,
                      onRefresh: _loadHistory,
                      initialTab: 1,
                    ),
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _navIcon({
    required IconData icon,
    required int index,
    required VoidCallback onTap,
  }) {
    final isActive = _currentNavIndex == index;
    return IconButton(
      onPressed: onTap,
      icon: Icon(
        icon,
        size: 24,
        color: isActive ? TrustLayerColors.primary : Colors.white38,
      ),
    );
  }

  Widget _quickActionCard({
    required IconData icon,
    required String title,
    required String subtitle,
    required Color accentColor,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(18),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        decoration: BoxDecoration(
          color: TrustLayerColors.surface,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: TrustLayerColors.surfaceBorder),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(9),
              decoration: BoxDecoration(
                color: TrustLayerColors.surfaceElevated,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: accentColor.withOpacity(0.35)),
              ),
              child: Icon(icon, size: 20, color: accentColor),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: GoogleFonts.inter(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                      fontSize: 12.5,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: TextStyle(
                      color: TrustLayerColors.textSecondary,
                      fontSize: 10,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _activityItem(AnalysisResult r) {
    final isCritical = r.riskLevel == 'CRITICAL' || r.riskLevel == 'HIGH';
    IconData icon = Icons.chat_bubble_outline_rounded;
    if (r.inputType == 'url') icon = Icons.link_rounded;
    if (r.inputType == 'screenshot') icon = Icons.center_focus_strong_outlined;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: TrustLayerColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: TrustLayerColors.surfaceBorder),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
        leading: Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: TrustLayerColors.surfaceElevated,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: (isCritical ? TrustLayerColors.critical : TrustLayerColors.low).withOpacity(0.3),
            ),
          ),
          child: Icon(
            icon,
            size: 18,
            color: isCritical ? TrustLayerColors.critical : TrustLayerColors.primary,
          ),
        ),
        title: Text(
          r.threatType.isNotEmpty ? r.threatType : 'TrustLayer Telemetry Scan',
          style: GoogleFonts.inter(
            color: Colors.white,
            fontWeight: FontWeight.w600,
            fontSize: 13,
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        subtitle: Text(
          'Risk Score: ${r.riskScore} · ${r.riskLevel}',
          style: GoogleFonts.jetBrainsMono(
            fontSize: 10,
            color: TrustLayerColors.textSecondary,
          ),
        ),
        trailing: const Icon(
          Icons.chevron_right,
          color: TrustLayerColors.textSecondary,
          size: 18,
        ),
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => ResultScreen(result: r)),
          );
        },
      ),
    );
  }
}

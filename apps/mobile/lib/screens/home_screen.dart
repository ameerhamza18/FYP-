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

/// Shieldly AI-styled Home Experience.
///
/// Faithfully implements the warm cream headers, periwinkle AI prompt banner,
/// "Try Asking" prompt pills, 4 pastel "Or Upload" squircles, Intercepts sheet,
/// stacked pastel Messages feed, and floating 5-icon bottom dock — while
/// preserving 100% of TrustLayer's Android OS interception, offline queue,
/// and multimodal scanning logic.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with WidgetsBindingObserver {
  final _scaffoldKey = GlobalKey<ScaffoldState>();
  final _api = TrustApiClient();
  final _picker = ImagePicker();

  List<AnalysisResult> _recent = [];
  bool _busy = false;
  String _scanStatusMessage = 'TrustLayer AI is actively scanning…';

  // Default to Center Sparkle Hub ("TrustLayer AI" — index 2) matching Shieldly AI
  int _currentNavIndex = 2;
  String _interceptFilter = 'All';
  String _messageFilter = 'All';

  // Real protection state from Android platform layer
  ProtectionStatus _protection = ProtectionStatus.unknown;
  bool _protectionBusy = false;
  StreamSubscription<ProtectionStatus>? _protectionSub;

  String? _historyError;
  bool _historyLoading = true;

  static const List<Color> _pastelCycle = [
    TrustLayerColors.periwinkle,
    TrustLayerColors.sage,
    TrustLayerColors.sand,
    TrustLayerColors.butter,
  ];

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
    if (mounted) {
      setState(() {
        _historyLoading = true;
        _historyError = null;
      });
    }
    try {
      final h = await _api.history(limit: 15);
      if (!mounted) return;
      setState(() => _recent = h);
    } on SessionExpiredException {
      // Handled globally
    } on ApiException catch (e) {
      if (mounted) setState(() => _historyError = e.message);
    } catch (_) {
      if (mounted) {
        setState(() => _historyError = 'Could not load your recent threats.');
      }
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
        await _api.analyzeText(
          item.text,
          source: item.source,
          sender: item.sender,
          clientRequestId: item.clientRequestId,
        );
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
      await AnalysisQueue.add(
        text: item.text,
        source: item.source,
        sender: item.sender,
        clientRequestId: item.clientRequestId,
      );
    }
  }

  void _handleInterception(InterceptedMessage message, {bool showResult = true}) {
    if (!mounted) return;
    _snack('Intercepted a ${_sourceLabel(message.source)} message — checking with TrustLayer…');
    _run(
      () => _api.analyzeText(
        message.text,
        source: message.source,
        sender: message.sender,
      ),
      showResult: showResult,
      queueOnOffline: message,
      statusMsg: 'Checking intercepted ${_sourceLabel(message.source)} message…',
    );
  }

  String _sourceLabel(String source) {
    switch (source) {
      case 'whatsapp':
        return 'WhatsApp';
      case 'telegram':
        return 'Telegram';
      case 'instagram':
        return 'Instagram';
      case 'facebook':
        return 'Facebook';
      case 'share':
        return 'shared';
      case 'notification-tap':
        return 'flagged';
      case 'notification':
        return 'chat';
      default:
        return 'SMS';
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

  Future<void> _analyzeText({String? hintPrompt}) async {
    final controller = TextEditingController();
    final text = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: TrustLayerColors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
        title: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: const BoxDecoration(
                color: TrustLayerColors.periwinkle,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.chat_bubble_outline_rounded,
                color: TrustLayerColors.textPrimary,
                size: 18,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                hintPrompt ?? 'Paste Message or Text',
                style: GoogleFonts.plusJakartaSans(
                  color: TrustLayerColors.textPrimary,
                  fontWeight: FontWeight.w800,
                  fontSize: 16,
                ),
              ),
            ),
          ],
        ),
        content: TextField(
          controller: controller,
          maxLines: 5,
          autofocus: true,
          style: GoogleFonts.plusJakartaSans(
            color: TrustLayerColors.textPrimary,
            fontSize: 13.5,
          ),
          decoration: InputDecoration(
            hintText: 'Paste SMS, WhatsApp text, email, or phone alert…',
            hintStyle: GoogleFonts.plusJakartaSans(
              color: TrustLayerColors.textMuted,
              fontSize: 13,
            ),
            filled: true,
            fillColor: TrustLayerColors.surfaceElevated,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(18),
              borderSide: BorderSide.none,
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(18),
              borderSide: const BorderSide(
                color: TrustLayerColors.primary,
                width: 1.4,
              ),
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text(
              'Cancel',
              style: TextStyle(color: TrustLayerColors.textSecondary),
            ),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: TrustLayerColors.primary,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(22),
              ),
            ),
            onPressed: () => Navigator.pop(ctx, controller.text),
            child: Text(
              'Check Now',
              style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
    if (text == null || text.trim().isEmpty) return;
    await _run(
      () => _api.analyzeText(text.trim()),
      statusMsg: 'TrustLayer AI is checking your message…',
    );
  }

  Future<void> _analyzeScreenshot() async {
    final img =
        await _picker.pickImage(source: ImageSource.gallery, imageQuality: 85);
    if (img == null) return;
    await _run(
      () => _api.analyzeScreenshot(img),
      statusMsg: 'Extracting text from screenshot in memory…',
    );
  }

  Future<void> _checkUrl() async {
    final controller = TextEditingController();
    final url = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: TrustLayerColors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
        title: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: const BoxDecoration(
                color: TrustLayerColors.butter,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.link_rounded,
                color: TrustLayerColors.textPrimary,
                size: 19,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                'Check Website Link',
                style: GoogleFonts.plusJakartaSans(
                  color: TrustLayerColors.textPrimary,
                  fontWeight: FontWeight.w800,
                  fontSize: 16,
                ),
              ),
            ),
          ],
        ),
        content: TextField(
          controller: controller,
          autofocus: true,
          keyboardType: TextInputType.url,
          style: GoogleFonts.plusJakartaSans(
            color: TrustLayerColors.textPrimary,
            fontSize: 13.5,
          ),
          decoration: InputDecoration(
            hintText: 'https://suspicious-site.example/login',
            hintStyle: GoogleFonts.plusJakartaSans(
              color: TrustLayerColors.textMuted,
              fontSize: 13,
            ),
            filled: true,
            fillColor: TrustLayerColors.surfaceElevated,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(18),
              borderSide: BorderSide.none,
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(18),
              borderSide: const BorderSide(
                color: TrustLayerColors.primary,
                width: 1.4,
              ),
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text(
              'Cancel',
              style: TextStyle(color: TrustLayerColors.textSecondary),
            ),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: TrustLayerColors.primary,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(22),
              ),
            ),
            onPressed: () => Navigator.pop(ctx, controller.text),
            child: Text(
              'Scan Link',
              style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
    if (url == null || url.trim().isEmpty) return;
    await _run(
      () => _api.analyzeUrl(url.trim()),
      statusMsg: 'Inspecting domain reputation & link safety…',
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
        await Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => ResultScreen(result: result)),
        );
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
      _snack(
        e.statusCode == 503
            ? 'OCR unavailable on the server — paste the text instead'
            : e.message,
      );
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
      backgroundColor: TrustLayerColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(22, 14, 22, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: TrustLayerColors.surfaceBorder,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 18),
              Text(
                'What would you like to check?',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                  color: TrustLayerColors.textPrimary,
                ),
              ),
              const SizedBox(height: 16),
              _sheetOption(
                bg: TrustLayerColors.sage,
                icon: Icons.chat_bubble_outline_rounded,
                title: 'Message or Email Text',
                subtitle: 'Check SMS, WhatsApp, OTP or phishing emails',
                onTap: () {
                  Navigator.pop(ctx);
                  _analyzeText();
                },
              ),
              const SizedBox(height: 10),
              _sheetOption(
                bg: TrustLayerColors.butter,
                icon: Icons.link_rounded,
                title: 'Website Link / URL',
                subtitle: 'Check domains for spoofing and fake portals',
                onTap: () {
                  Navigator.pop(ctx);
                  _checkUrl();
                },
              ),
              const SizedBox(height: 10),
              _sheetOption(
                bg: TrustLayerColors.periwinkle,
                icon: Icons.crop_free_rounded,
                title: 'Screenshot / Image OCR',
                subtitle: 'Upload a screenshot for zero-disk OCR inspection',
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

  Widget _sheetOption({
    required Color bg,
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(22),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: TrustLayerColors.surfaceElevated,
          borderRadius: BorderRadius.circular(22),
        ),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: bg,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(icon, color: TrustLayerColors.textPrimary, size: 21),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: TrustLayerColors.textPrimary,
                    ),
                  ),
                  Text(
                    subtitle,
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 12,
                      color: TrustLayerColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(
              Icons.chevron_right_rounded,
              color: TrustLayerColors.textMuted,
            ),
          ],
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Filtering Helpers
  // ---------------------------------------------------------------------------

  bool _isScam(AnalysisResult r) {
    final l = r.riskLevel.toUpperCase();
    return l == 'CRITICAL' || l == 'HIGH';
  }

  bool _isMedium(AnalysisResult r) => r.riskLevel.toUpperCase() == 'MEDIUM';

  List<AnalysisResult> _filteredScans(String filter) {
    switch (filter) {
      case 'Safe':
        return _recent.where((r) => !_isScam(r) && !_isMedium(r)).toList();
      case 'Scam':
        return _recent.where(_isScam).toList();
      case 'Risky':
      case 'Suspicious':
        return _recent.where((r) => _isMedium(r) || _isScam(r)).toList();
      default:
        return _recent;
    }
  }

  // ---------------------------------------------------------------------------
  // Scaffold & Navigation
  // ---------------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      key: _scaffoldKey,
      backgroundColor: TrustLayerColors.background,
      extendBody: true,
      drawer: _buildDrawer(),
      body: Stack(
        children: [
          SafeArea(
            bottom: false,
            child: RefreshIndicator(
              onRefresh: _loadHistory,
              color: TrustLayerColors.primary,
              backgroundColor: TrustLayerColors.surface,
              child: _buildActiveTabBody(),
            ),
          ),

          // Floating White 5-Icon Bottom Dock (Shieldly AI signature dock)
          if (!_busy)
            Positioned(
              left: 18,
              right: 18,
              bottom: MediaQuery.of(context).padding.bottom + 14,
              child: _buildFloatingDock(),
            ),

          // Fullscreen Animated Pastel Scanning Overlay
          if (_busy)
            ScanningOverlay(
              message: _scanStatusMessage,
              submessage: 'Analyzing signals across 4 defense engines.',
            ),
        ],
      ),
    );
  }

  Widget _buildActiveTabBody() {
    switch (_currentNavIndex) {
      case 0:
        return _buildOverviewTab();
      case 1:
        return _buildInterceptsTab();
      case 3:
        return _buildMessagesFeedTab();
      case 2:
      default:
        return _buildShieldlyAiHubTab();
    }
  }

  // ---------------------------------------------------------------------------
  // Shared Top Header Controls (Warm Cream Circle Buttons)
  // ---------------------------------------------------------------------------

  Widget _topHeaderRow({required String title, Color? buttonBg}) {
    final bg = buttonBg ?? TrustLayerColors.headerButton;
    final hasScam = _recent.any(_isScam);
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        InkWell(
          borderRadius: BorderRadius.circular(24),
          onTap: () => _scaffoldKey.currentState?.openDrawer(),
          child: Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(color: bg, shape: BoxShape.circle),
            child: const Icon(
              Icons.menu_rounded,
              size: 20,
              color: TrustLayerColors.textPrimary,
            ),
          ),
        ),
        Text(
          title,
          style: GoogleFonts.plusJakartaSans(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: TrustLayerColors.textPrimary,
          ),
        ),
        InkWell(
          borderRadius: BorderRadius.circular(24),
          onTap: () {
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
          child: Stack(
            alignment: Alignment.center,
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(color: bg, shape: BoxShape.circle),
                child: const Icon(
                  Icons.notifications_none_rounded,
                  size: 21,
                  color: TrustLayerColors.textPrimary,
                ),
              ),
              if (hasScam)
                Positioned(
                  top: 10,
                  right: 11,
                  child: Container(
                    width: 8,
                    height: 8,
                    decoration: const BoxDecoration(
                      color: TrustLayerColors.critical,
                      shape: BoxShape.circle,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }

  // ---------------------------------------------------------------------------
  // TAB 2 (Center Sparkle Hub): Exact Shieldly AI Center Screen + Sensors
  // ---------------------------------------------------------------------------

  Widget _buildShieldlyAiHubTab() {
    return ListView(
      key: const ValueKey('tab_ai_hub'),
      padding: const EdgeInsets.only(bottom: 118),
      children: [
        // 1. Warm Peach/Cream Header Sheet + Periwinkle Hero Prompt Card
        Container(
          margin: const EdgeInsets.fromLTRB(12, 6, 12, 0),
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 18),
          decoration: BoxDecoration(
            color: TrustLayerColors.headerWarm,
            borderRadius: BorderRadius.circular(34),
          ),
          child: Column(
            children: [
              _topHeaderRow(title: 'TrustLayer AI'),
              const SizedBox(height: 18),
              // Periwinkle "How can I help you?" Hero Card
              GestureDetector(
                onTap: () => _analyzeText(),
                child: Container(
                  width: double.infinity,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 18, vertical: 20),
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
                          color: Colors.white,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.auto_awesome_outlined,
                          color: TrustLayerColors.textPrimary,
                          size: 23,
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'How can I help you?',
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 17.5,
                                fontWeight: FontWeight.w800,
                                color: TrustLayerColors.textPrimary,
                              ),
                            ),
                            const SizedBox(height: 3),
                            Text(
                              'Paste anything, get instant answers',
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 12.5,
                                fontWeight: FontWeight.w500,
                                color:
                                    TrustLayerColors.textPrimary.withOpacity(0.62),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 14),

        // 2. Crisp White "Try Asking" Card
        Container(
          margin: const EdgeInsets.symmetric(horizontal: 14),
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: TrustLayerColors.surface,
            borderRadius: BorderRadius.circular(30),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF16161A).withOpacity(0.035),
                blurRadius: 18,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Try Asking',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: TrustLayerColors.textPrimary,
                ),
              ),
              const SizedBox(height: 14),
              _promptPill(
                label: 'Verify this phone number or sender?',
                onTap: () =>
                    _analyzeText(hintPrompt: 'Verify Sender or Message'),
              ),
              const SizedBox(height: 10),
              _promptPill(
                label: 'Is this website safe?',
                onTap: _checkUrl,
              ),
              const SizedBox(height: 10),
              _promptPill(
                label: 'Is this text a scam?',
                onTap: () => _analyzeText(hintPrompt: 'Check Text Message'),
              ),
              const SizedBox(height: 10),
              _promptPill(
                label: 'Is this email fake?',
                onTap: () => _analyzeText(hintPrompt: 'Check Email Content'),
              ),
            ],
          ),
        ),

        const SizedBox(height: 20),

        // 3. "Or Upload" 4 Signature Pastel Squircles
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Or Upload',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: TrustLayerColors.textPrimary,
                ),
              ),
              GestureDetector(
                onTap: _showScanModal,
                child: Text(
                  'See all',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: TrustLayerColors.textSecondary,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14),
          child: Row(
            children: [
              Expanded(
                child: _uploadTile(
                  bg: TrustLayerColors.periwinkle,
                  icon: Icons.crop_free_rounded,
                  label: 'Screenshot',
                  onTap: _analyzeScreenshot,
                ),
              ),
              const SizedBox(width: 9),
              Expanded(
                child: _uploadTile(
                  bg: TrustLayerColors.sand,
                  icon: Icons.image_outlined,
                  label: 'Image',
                  onTap: _analyzeScreenshot,
                ),
              ),
              const SizedBox(width: 9),
              Expanded(
                child: _uploadTile(
                  bg: TrustLayerColors.butter,
                  icon: Icons.link_rounded,
                  label: 'Link',
                  onTap: _checkUrl,
                ),
              ),
              const SizedBox(width: 9),
              Expanded(
                child: _uploadTile(
                  bg: TrustLayerColors.sage,
                  icon: Icons.chat_bubble_outline_rounded,
                  label: 'Message',
                  onTap: () => _analyzeText(),
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 18),

        // 4. Real OS Sensor Protection Card directly accessible below
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14),
          child: ProtectionCard(
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
        ),
      ],
    );
  }

  Widget _promptPill({required String label, required VoidCallback onTap}) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(18),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
        decoration: BoxDecoration(
          color: TrustLayerColors.surfaceElevated,
          borderRadius: BorderRadius.circular(18),
        ),
        child: Text(
          label,
          style: GoogleFonts.plusJakartaSans(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: TrustLayerColors.textPrimary,
          ),
        ),
      ),
    );
  }

  Widget _uploadTile({
    required Color bg,
    required IconData icon,
    required String label,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 6),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(22),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.55),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 18, color: TrustLayerColors.textPrimary),
            ),
            const SizedBox(height: 10),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: GoogleFonts.plusJakartaSans(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: TrustLayerColors.textPrimary,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // TAB 1 (Intercepts / Activity): Exact Shieldly AI Left Screen
  // ---------------------------------------------------------------------------

  Widget _buildInterceptsTab() {
    final items = _filteredScans(_interceptFilter);
    final latest = _recent.isNotEmpty ? _recent.first : null;
    final latestScam = latest != null && _isScam(latest);

    return ListView(
      key: const ValueKey('tab_intercepts'),
      padding: const EdgeInsets.only(bottom: 118),
      children: [
        // Warm Cream Header Block + Latest Banner + Filter Pills
        Container(
          margin: const EdgeInsets.fromLTRB(12, 6, 12, 0),
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 18),
          decoration: BoxDecoration(
            color: TrustLayerColors.headerWarm,
            borderRadius: BorderRadius.circular(34),
          ),
          child: Column(
            children: [
              _topHeaderRow(title: 'Activity'),
              const SizedBox(height: 16),

              // Periwinkle Latest Alert Banner (matches "Unknown · Just now · • Scam")
              GestureDetector(
                onTap: latest != null
                    ? () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => ResultScreen(result: latest),
                          ),
                        );
                      }
                    : _showScanModal,
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                  decoration: BoxDecoration(
                    color: TrustLayerColors.periwinkle,
                    borderRadius: BorderRadius.circular(24),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 42,
                        height: 42,
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.75),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          latest?.inputType == 'url'
                              ? Icons.link_rounded
                              : Icons.shield_outlined,
                          size: 20,
                          color: TrustLayerColors.textPrimary,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              latest != null
                                  ? (latest.threatType.isNotEmpty
                                      ? latest.threatType
                                      : 'Latest Scan')
                                  : 'No Intercepts Yet',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 15,
                                fontWeight: FontWeight.w800,
                                color: TrustLayerColors.textPrimary,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              latest != null
                                  ? 'Most recent · ${latest.inputType.toUpperCase()}'
                                  : 'Tap to run a live scan',
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 12,
                                color:
                                    TrustLayerColors.textPrimary.withOpacity(0.65),
                              ),
                            ),
                          ],
                        ),
                      ),
                      _statusPill(
                        level: latest?.riskLevel ?? 'LOW',
                        showScore: false,
                        score: latest?.riskScore ?? 0,
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 14),

              // Filter Pills: All | Safe | Scam | Risky
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: ['All', 'Safe', 'Scam', 'Risky'].map((f) {
                    final active = _interceptFilter == f;
                    return Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: GestureDetector(
                        onTap: () => setState(() => _interceptFilter = f),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 160),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 20,
                            vertical: 10,
                          ),
                          decoration: BoxDecoration(
                            color: active
                                ? TrustLayerColors.primary
                                : TrustLayerColors.headerButton.withOpacity(0.75),
                            borderRadius: BorderRadius.circular(24),
                          ),
                          child: Text(
                            f,
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: active
                                  ? Colors.white
                                  : TrustLayerColors.textPrimary,
                            ),
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 14),

        // Pure White Rounded Sheet List (matches Left Screen list)
        Container(
          margin: const EdgeInsets.symmetric(horizontal: 14),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            color: TrustLayerColors.surface,
            borderRadius: BorderRadius.circular(30),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF16161A).withOpacity(0.035),
                blurRadius: 18,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: _historyLoading && _recent.isEmpty
              ? const Padding(
                  padding: EdgeInsets.symmetric(vertical: 36),
                  child: Center(
                    child: CircularProgressIndicator(
                      color: TrustLayerColors.primary,
                    ),
                  ),
                )
              : items.isEmpty
                  ? Padding(
                      padding: const EdgeInsets.symmetric(vertical: 32),
                      child: Column(
                        children: [
                          Icon(
                            latestScam
                                ? Icons.filter_list_rounded
                                : Icons.shield_outlined,
                            size: 36,
                            color: TrustLayerColors.textMuted,
                          ),
                          const SizedBox(height: 10),
                          Text(
                            _historyError ?? 'No scans in "$_interceptFilter"',
                            textAlign: TextAlign.center,
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: TrustLayerColors.textPrimary,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Checked SMS, links, and screenshots appear here.',
                            textAlign: TextAlign.center,
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 12,
                              color: TrustLayerColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    )
                  : Column(
                      children: items.map((r) => _whiteSheetRow(r)).toList(),
                    ),
        ),
      ],
    );
  }

  Widget _whiteSheetRow(AnalysisResult r) {
    IconData icon = Icons.chat_bubble_outline_rounded;
    if (r.inputType == 'url') icon = Icons.link_rounded;
    if (r.inputType == 'screenshot') icon = Icons.crop_free_rounded;
    if (_isScam(r)) icon = Icons.gpp_maybe_outlined;

    return InkWell(
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => ResultScreen(result: r)),
        );
      },
      borderRadius: BorderRadius.circular(18),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 11, horizontal: 2),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: const BoxDecoration(
                color: TrustLayerColors.surfaceElevated,
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 20, color: TrustLayerColors.textPrimary),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    r.threatType.isNotEmpty ? r.threatType : 'Security Check',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 14.5,
                      fontWeight: FontWeight.w700,
                      color: TrustLayerColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    '${r.inputType.toUpperCase()} • Score ${r.riskScore}/100',
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 12,
                      color: TrustLayerColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            _statusPill(
              level: r.riskLevel,
              showScore: false,
              score: r.riskScore,
            ),
          ],
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // TAB 3 (Messages Feed): Exact Shieldly AI Right Screen (Stacked Pastel Cards)
  // ---------------------------------------------------------------------------

  Widget _buildMessagesFeedTab() {
    final items = _filteredScans(_messageFilter);

    return ListView(
      key: const ValueKey('tab_messages'),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 118),
      children: [
        _topHeaderRow(
          title: 'Messages',
          buttonBg: Colors.white,
        ),
        const SizedBox(height: 16),

        // Filter Pills: All | Safe | Suspicious | Scam
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: ['All', 'Safe', 'Suspicious', 'Scam'].map((f) {
              final active = _messageFilter == f;
              return Padding(
                padding: const EdgeInsets.only(right: 8),
                child: GestureDetector(
                  onTap: () => setState(() => _messageFilter = f),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 160),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 20,
                      vertical: 10,
                    ),
                    decoration: BoxDecoration(
                      color: active ? TrustLayerColors.primary : Colors.white,
                      borderRadius: BorderRadius.circular(24),
                    ),
                    child: Text(
                      f,
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color:
                            active ? Colors.white : TrustLayerColors.textPrimary,
                      ),
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
        ),

        const SizedBox(height: 16),

        if (_historyLoading && _recent.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 48),
            child: Center(
              child: CircularProgressIndicator(color: TrustLayerColors.primary),
            ),
          )
        else if (items.isEmpty)
          Container(
            padding: const EdgeInsets.all(28),
            decoration: BoxDecoration(
              color: TrustLayerColors.periwinkle,
              borderRadius: BorderRadius.circular(28),
            ),
            child: Column(
              children: [
                Container(
                  width: 52,
                  height: 52,
                  decoration: const BoxDecoration(
                    color: Colors.white,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.chat_bubble_outline_rounded,
                    color: TrustLayerColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 14),
                Text(
                  'No messages in "$_messageFilter"',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: TrustLayerColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Tap below to paste a message and see instant stacked forensic cards.',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 13,
                    color: TrustLayerColors.textPrimary.withOpacity(0.7),
                  ),
                ),
                const SizedBox(height: 16),
                FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: TrustLayerColors.primary,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(22),
                    ),
                  ),
                  onPressed: () => _analyzeText(),
                  child: const Text('Paste a Message'),
                ),
              ],
            ),
          )
        else
          ...items.asMap().entries.map((entry) {
            final idx = entry.key;
            final r = entry.value;
            final bg = _pastelCycle[idx % _pastelCycle.length];
            final badgeCode = r.inputType == 'url'
                ? 'URL'
                : r.inputType == 'screenshot'
                    ? 'OCR'
                    : 'SMS';

            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: GestureDetector(
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => ResultScreen(result: r)),
                  );
                },
                child: Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: bg,
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
                              color: Colors.white.withOpacity(0.7),
                              shape: BoxShape.circle,
                            ),
                            child: Center(
                              child: Text(
                                badgeCode,
                                style: GoogleFonts.plusJakartaSans(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w800,
                                  color: TrustLayerColors.textPrimary,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              r.threatType.isNotEmpty
                                  ? r.threatType
                                  : 'Analyzed Message',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 15.5,
                                fontWeight: FontWeight.w800,
                                color: TrustLayerColors.textPrimary,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          _statusPill(
                            level: r.riskLevel,
                            showScore: true,
                            score: r.riskScore,
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Text(
                        r.explanation.isNotEmpty
                            ? r.explanation
                            : r.recommendation,
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 13,
                          height: 1.42,
                          color: TrustLayerColors.textPrimary.withOpacity(0.76),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          }),
      ],
    );
  }

  // ---------------------------------------------------------------------------
  // TAB 0 (Overview & Live Shield): 3D Shield + OS Sensor Controls
  // ---------------------------------------------------------------------------

  Widget _buildOverviewTab() {
    return ListView(
      key: const ValueKey('tab_overview'),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 118),
      children: [
        _topHeaderRow(title: 'Defense Shield', buttonBg: Colors.white),
        const SizedBox(height: 16),
        DefenseShield3D(
          isProtected: _protection.automaticSmsProtection,
          onTap: _showScanModal,
        ),
        const SizedBox(height: 16),
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
      ],
    );
  }

  // ---------------------------------------------------------------------------
  // Status Pill Helper ("• Safe" / "Scam • 97" / "Risky • 71")
  // ---------------------------------------------------------------------------

  Widget _statusPill({
    required String level,
    required bool showScore,
    required int score,
  }) {
    final upper = level.toUpperCase();
    final isScam = upper == 'CRITICAL' || upper == 'HIGH';
    final isRisky = upper == 'MEDIUM';

    final bg = isScam
        ? TrustLayerColors.pillScamBg
        : isRisky
            ? TrustLayerColors.pillRiskyBg
            : TrustLayerColors.pillSafeBg;
    final fg = isScam
        ? TrustLayerColors.critical
        : isRisky
            ? TrustLayerColors.medium
            : TrustLayerColors.low;
    final word = isScam
        ? 'Scam'
        : isRisky
            ? 'Risky'
            : 'Safe';
    final scorePadded = score.toString().padLeft(2, '0');

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Text(
        showScore ? '$word • $scorePadded' : '• $word',
        style: GoogleFonts.plusJakartaSans(
          fontSize: 11.5,
          fontWeight: FontWeight.w700,
          color: fg,
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Floating White 5-Icon Bottom Dock (Shieldly AI Reference Dock)
  // ---------------------------------------------------------------------------

  Widget _buildFloatingDock() {
    return Container(
      height: 68,
      padding: const EdgeInsets.symmetric(horizontal: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(32),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF16161A).withOpacity(0.08),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _dockItem(
            icon: Icons.home_outlined,
            activeIcon: Icons.home_rounded,
            index: 0,
            onTap: () => setState(() => _currentNavIndex = 0),
          ),
          _dockItem(
            icon: Icons.phone_in_talk_outlined,
            activeIcon: Icons.phone_in_talk_rounded,
            index: 1,
            onTap: () => setState(() => _currentNavIndex = 1),
          ),
          _dockItem(
            icon: Icons.auto_awesome_outlined,
            activeIcon: Icons.auto_awesome_rounded,
            index: 2,
            onTap: () => setState(() => _currentNavIndex = 2),
          ),
          _dockItem(
            icon: Icons.chat_bubble_outline_rounded,
            activeIcon: Icons.chat_bubble_rounded,
            index: 3,
            onTap: () => setState(() => _currentNavIndex = 3),
          ),
          _dockItem(
            icon: Icons.person_outline_rounded,
            activeIcon: Icons.person_rounded,
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
    );
  }

  Widget _dockItem({
    required IconData icon,
    required IconData activeIcon,
    required int index,
    required VoidCallback onTap,
  }) {
    final isActive = _currentNavIndex == index;
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        width: 52,
        height: 48,
        decoration: BoxDecoration(
          color: isActive ? TrustLayerColors.primary : Colors.transparent,
          borderRadius: BorderRadius.circular(18),
        ),
        child: Icon(
          isActive ? activeIcon : icon,
          size: 23,
          color: isActive ? Colors.white : TrustLayerColors.textPrimary,
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Warm Editorial Navigation Drawer
  // ---------------------------------------------------------------------------

  Widget _buildDrawer() {
    return Drawer(
      backgroundColor: TrustLayerColors.background,
      child: SafeArea(
        child: Column(
          children: [
            Container(
              width: double.infinity,
              margin: const EdgeInsets.all(14),
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: TrustLayerColors.headerWarm,
                borderRadius: BorderRadius.circular(26),
              ),
              child: Row(
                children: [
                  Container(
                    width: 46,
                    height: 46,
                    decoration: const BoxDecoration(
                      color: Colors.white,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.auto_awesome_rounded,
                      color: TrustLayerColors.textPrimary,
                      size: 22,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'TrustLayer AI',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          color: TrustLayerColors.textPrimary,
                        ),
                      ),
                      Text(
                        'Multimodal Scam Guard',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                          color: TrustLayerColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            ListTile(
              leading: const Icon(
                Icons.explore_outlined,
                color: TrustLayerColors.textPrimary,
              ),
              title: Text(
                'Onboarding Tour',
                style: GoogleFonts.plusJakartaSans(
                  color: TrustLayerColors.textPrimary,
                  fontWeight: FontWeight.w600,
                ),
              ),
              onTap: () {
                Navigator.pop(context);
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const OnboardingScreen()),
                );
              },
            ),
            ListTile(
              leading: const Icon(
                Icons.history_rounded,
                color: TrustLayerColors.textPrimary,
              ),
              title: Text(
                'Scan History & Settings',
                style: GoogleFonts.plusJakartaSans(
                  color: TrustLayerColors.textPrimary,
                  fontWeight: FontWeight.w600,
                ),
              ),
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
            Padding(
              padding: const EdgeInsets.all(16),
              child: ListTile(
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(18),
                ),
                tileColor: TrustLayerColors.pillScamBg,
                leading: const Icon(
                  Icons.logout_rounded,
                  color: TrustLayerColors.critical,
                ),
                title: Text(
                  'Sign Out',
                  style: GoogleFonts.plusJakartaSans(
                    color: TrustLayerColors.critical,
                    fontWeight: FontWeight.w700,
                  ),
                ),
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
            ),
          ],
        ),
      ),
    );
  }
}

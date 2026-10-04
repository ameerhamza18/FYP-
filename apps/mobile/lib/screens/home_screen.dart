import 'dart:async';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';

import '../models/analysis_result.dart';
import '../services/analysis_queue.dart';
import '../services/api_client.dart';
import '../services/protection_service.dart';
import '../main.dart';
import '../widgets/defense_shield_3d.dart';
import '../widgets/protection_card.dart';
import 'login_screen.dart';
import 'result_screen.dart';

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

  /// Real protection state, straight from Android. Starts as "unknown" so the UI
  /// never claims protection it has not verified.
  ProtectionStatus _protection = ProtectionStatus.unknown;
  bool _protectionBusy = false;
  StreamSubscription<ProtectionStatus>? _protectionSub;

  /// Non-null when the history fetch failed. Without this the screen showed
  /// "No threats detected yet" after a network failure, which told users the
  /// opposite of the truth.
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

  /// Permissions are granted in system settings, so coming back to the app is the
  /// only reliable moment to re-check whether anything changed.
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
      // The global handler in main.dart signs the user out; nothing to show.
    } on ApiException catch (e) {
      if (mounted) setState(() => _historyError = e.message);
    } catch (_) {
      if (mounted) setState(() => _historyError = 'Could not load your recent threats.');
    } finally {
      if (mounted) setState(() => _historyLoading = false);
    }
  }
  /// Connects to Android's interception layer: installs the handler that receives
  /// intercepted messages, subscribes to live protection status, and replays
  /// anything that arrived while the app was closed.
  Future<void> _initProtection() async {
    await ProtectionService.initialize(onIntercepted: _handleInterception);

    _protectionSub = ProtectionService.statusStream.listen((status) {
      if (mounted) setState(() => _protection = status);
    });

    await _refreshProtection();

    // Cold-start handshake: text shared into the app or a tapped warning.
    final initial = await ProtectionService.takeInitialInterception();
    if (initial != null) _handleInterception(initial);

    // Messages intercepted while the app was closed or offline.
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
      // Silent: these were already intercepted and the user has been told; the
      // results land in Recent Threats instead of stacking result screens.
      _handleInterception(message, showResult: false);
    }
  }

  /// Uploads analyses that failed earlier because the phone was offline.
  ///
  /// Every early exit path re-queues both the untried part of the batch and the
  /// items that were beyond it — the queue is cleared up-front, so anything not
  /// explicitly put back would be silently lost.
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
        // main.dart is already taking the user back to sign-in; keep the rest.
        failed.addAll(batch.sublist(checked));
        stopped = true;
      } on NetworkException {
        failed.addAll(batch.sublist(checked));
        stopped = true;
        offline = true;
      } catch (_) {
        // Permanently invalid item (e.g. rejected by validation): drop it rather
        // than retry it forever and block the queue.
      }
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

  // --------------------------------------------------------- protection setup
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
              'FORENSIC TEXT INSPECTOR',
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
          maxLines: 6,
          autofocus: true,
          style: const TextStyle(color: TrustLayerColors.textPrimary, fontSize: 13),
          decoration: InputDecoration(
            hintText: 'Paste SMS, WhatsApp payload, email header or body…',
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
            child: Text('Cancel', style: TextStyle(color: TrustLayerColors.textSecondary)),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: TrustLayerColors.primary,
              foregroundColor: const Color(0xFF040711),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            onPressed: () => Navigator.pop(ctx, controller.text),
            child: const Text('Execute Heuristic Scan', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
    if (text == null || text.trim().isEmpty) return;
    await _run(() => _api.analyzeText(text.trim()));
  }

  Future<void> _analyzeScreenshot() async {
    final img = await _picker.pickImage(source: ImageSource.gallery, imageQuality: 85);
    if (img == null) return;
    await _run(() => _api.analyzeScreenshot(img));
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
              'URL & DOMAIN REPUTATION',
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
            hintText: 'https://suspicious-login.example.com/verify',
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
            child: Text('Cancel', style: TextStyle(color: TrustLayerColors.textSecondary)),
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
    await _run(() => _api.analyzeUrl(url.trim()));
  }

  Future<void> _run(
    Future<AnalysisResult> Function() job, {
    bool showResult = true,
    InterceptedMessage? queueOnOffline,
  }) async {
    setState(() => _busy = true);
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
      // The global handler in main.dart returns the user to the login screen.
    } on NetworkException catch (e) {
      // An interception is a one-time event: if the upload fails the user would
      // simply never be warned, so it is queued and retried automatically.
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
    // Every call site sits after an `await`, so the widget may already be
    // detached (user navigated away) — using context here would throw.
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  Color _levelColor(String level) {
    switch (level) {
      case 'CRITICAL': return TrustLayerColors.critical;
      case 'HIGH': return TrustLayerColors.high;
      case 'MEDIUM': return TrustLayerColors.medium;
      default: return TrustLayerColors.low;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: TrustLayerColors.background,
      appBar: AppBar(
        backgroundColor: TrustLayerColors.background,
        elevation: 0,
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: TrustLayerColors.surfaceElevated,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: TrustLayerColors.primary.withOpacity(0.35)),
              ),
              child: const Icon(Icons.shield_outlined, size: 18, color: TrustLayerColors.primary),
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'TRUSTLAYER',
                  style: GoogleFonts.inter(
                    fontWeight: FontWeight.w800,
                    color: TrustLayerColors.textPrimary,
                    letterSpacing: 1.5,
                    fontSize: 15,
                  ),
                ),
                Row(
                  children: [
                    Container(
                      width: 5,
                      height: 5,
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        color: TrustLayerColors.low,
                      ),
                    ),
                    const SizedBox(width: 5),
                    Text(
                      'SOC MONITOR · ONLINE',
                      style: GoogleFonts.jetBrainsMono(
                        fontSize: 8.5,
                        letterSpacing: 0.8,
                        fontWeight: FontWeight.w600,
                        color: TrustLayerColors.low,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
        actions: [
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert, color: TrustLayerColors.textSecondary),
            color: TrustLayerColors.surface,
            onSelected: (value) async {
              if (value == 'logout') {
                await _api.logout();
                if (!mounted) return;
                Navigator.of(context).pushReplacement(
                  MaterialPageRoute(builder: (_) => const LoginScreen()),
                );
              } else if (value == 'delete_account') {
                final confirm = await showDialog<bool>(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    backgroundColor: TrustLayerColors.surface,
                    title: const Text('Delete Account', style: TextStyle(color: TrustLayerColors.critical)),
                    content: const Text(
                      'Are you sure you want to permanently delete your account and all associated threat data? This cannot be undone.',
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
                  try {
                    await _api.deleteAccount();
                    if (!mounted) return;
                    Navigator.of(context).pushReplacement(
                      MaterialPageRoute(builder: (_) => const LoginScreen()),
                    );
                  } catch (e) {
                    _snack('Failed to delete account');
                  }
                }
              }
            },
            itemBuilder: (context) => [
              const PopupMenuItem(
                value: 'logout',
                child: Row(
                  children: [
                    Icon(Icons.logout, size: 20, color: TrustLayerColors.textSecondary),
                    SizedBox(width: 10),
                    Text('Sign out', style: TextStyle(color: TrustLayerColors.textPrimary)),
                  ],
                ),
              ),
              const PopupMenuItem(
                value: 'delete_account',
                child: Row(
                  children: [
                    Icon(Icons.delete_forever, size: 20, color: TrustLayerColors.critical),
                    SizedBox(width: 10),
                    Text('Delete Account', style: TextStyle(color: TrustLayerColors.critical)),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
      body: Stack(
        children: [
          RefreshIndicator(
            onRefresh: _loadHistory,
            color: TrustLayerColors.primary,
            backgroundColor: TrustLayerColors.surface,
            child: ListView(
              padding: const EdgeInsets.all(18),
              children: [
                DefenseShield3D(
                  isProtected: _protection.automaticSmsProtection,
                ),
                const SizedBox(height: 18),
                // Real, OS-verified protection state
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
                const SizedBox(height: 28),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'FORENSIC PIPELINE',
                      style: GoogleFonts.inter(
                        fontSize: 13,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.2,
                        color: TrustLayerColors.textPrimary,
                      ),
                    ),
                    Text(
                      'CHAMBERS 01-04',
                      style: GoogleFonts.jetBrainsMono(
                        fontSize: 9.5,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 1.0,
                        color: TrustLayerColors.textMuted,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                GridView.count(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  crossAxisCount: 2,
                  crossAxisSpacing: 14,
                  mainAxisSpacing: 14,
                  childAspectRatio: 1.08,
                  children: [
                    _toolCard(
                      chamber: '01',
                      icon: Icons.chat_bubble_outline_rounded,
                      title: 'Analyze Text',
                      subtitle: 'SMS / WhatsApp / Mail',
                      onTap: _analyzeText,
                    ),
                    _toolCard(
                      chamber: '02',
                      icon: Icons.center_focus_strong_outlined,
                      title: 'Screenshot OCR',
                      subtitle: 'Visual Heuristic Parser',
                      onTap: _analyzeScreenshot,
                    ),
                    _toolCard(
                      chamber: '03',
                      icon: Icons.link_rounded,
                      title: 'Probe URL',
                      subtitle: 'Domain & Typosquat Check',
                      onTap: _checkUrl,
                    ),
                    _toolCard(
                      chamber: '04',
                      icon: Icons.history_rounded,
                      title: 'Telemetry Log',
                      subtitle: 'Sync Audit Records',
                      onTap: () => _loadHistory(),
                    ),
                  ],
                ),
                const SizedBox(height: 28),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'DETECTED THREAT LOG',
                      style: GoogleFonts.inter(
                        fontSize: 13,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.2,
                        color: TrustLayerColors.textPrimary,
                      ),
                    ),
                    if (_recent.isNotEmpty)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: TrustLayerColors.surfaceElevated,
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: TrustLayerColors.surfaceBorder),
                        ),
                        child: Text(
                          '${_recent.length} INCIDENTS',
                          style: GoogleFonts.jetBrainsMono(
                            fontSize: 9,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 0.8,
                            color: TrustLayerColors.textSecondary,
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 12),
                if (_historyLoading && _recent.isEmpty)
                  const Center(
                    child: Padding(
                      padding: EdgeInsets.symmetric(vertical: 40),
                      child: CircularProgressIndicator(color: TrustLayerColors.primary),
                    ),
                  )
                else if (_recent.isEmpty && _historyError != null)
                  Center(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 40),
                      child: Column(
                        children: [
                          Icon(Icons.cloud_off, size: 44,
                              color: TrustLayerColors.high.withOpacity(0.7)),
                          const SizedBox(height: 8),
                          Text(
                            _historyError!,
                            textAlign: TextAlign.center,
                            style: const TextStyle(color: TrustLayerColors.high, fontSize: 13),
                          ),
                          const SizedBox(height: 8),
                          TextButton(
                            onPressed: _loadHistory,
                            child: const Text('Retry Telemetry Sync',
                                style: TextStyle(color: TrustLayerColors.primary, fontWeight: FontWeight.bold)),
                          ),
                        ],
                      ),
                    ),
                  )
                else if (_recent.isEmpty)
                  Center(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 40),
                      child: Column(
                        children: [
                          Icon(Icons.shield_outlined, size: 48,
                              color: TrustLayerColors.textMuted.withOpacity(0.4)),
                          const SizedBox(height: 10),
                          Text(
                            'NO THREAT INCIDENTS DETECTED',
                            style: GoogleFonts.jetBrainsMono(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              letterSpacing: 1.0,
                              color: TrustLayerColors.textMuted,
                            ),
                          ),
                        ],
                      ),
                    ),
                  )
                else
                  ..._recent.map((r) => _threatTile(r)),
              ],
            ),
          ),
          if (_busy)
            Container(
              color: TrustLayerColors.background.withOpacity(0.85),
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const CircularProgressIndicator(color: TrustLayerColors.primary),
                    const SizedBox(height: 16),
                    Text(
                      'EXECUTING MULTI-ENGINE AUDIT…',
                      style: GoogleFonts.jetBrainsMono(
                        fontSize: 11,
                        letterSpacing: 1.2,
                        fontWeight: FontWeight.bold,
                        color: TrustLayerColors.primary,
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _toolCard({
    required String chamber,
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(18),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: TrustLayerColors.surface,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: TrustLayerColors.surfaceBorder, width: 1.0),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.4),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: TrustLayerColors.surfaceElevated,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: TrustLayerColors.primary.withOpacity(0.3)),
                  ),
                  child: Icon(icon, size: 20, color: TrustLayerColors.primary),
                ),
                Text(
                  'CH-$chamber',
                  style: GoogleFonts.jetBrainsMono(
                    fontSize: 9.5,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1.0,
                    color: TrustLayerColors.primary.withOpacity(0.7),
                  ),
                ),
              ],
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: GoogleFonts.inter(
                    color: TrustLayerColors.textPrimary,
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: TextStyle(
                    color: TrustLayerColors.textSecondary,
                    fontSize: 10,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _threatTile(AnalysisResult r) {
    final color = _levelColor(r.riskLevel);
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: TrustLayerColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: TrustLayerColors.surfaceBorder),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        leading: Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: color.withOpacity(0.12),
            shape: BoxShape.circle,
            border: Border.all(color: color.withOpacity(0.45), width: 1.5),
          ),
          child: Center(
            child: Text(
              '${r.riskScore}',
              style: GoogleFonts.jetBrainsMono(
                color: color,
                fontWeight: FontWeight.bold,
                fontSize: 14,
              ),
            ),
          ),
        ),
        title: Text(
          r.threatType,
          style: GoogleFonts.inter(
            color: TrustLayerColors.textPrimary,
            fontWeight: FontWeight.w700,
            fontSize: 13.5,
          ),
        ),
        subtitle: Row(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
              decoration: BoxDecoration(
                color: color.withOpacity(0.15),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                r.riskLevel,
                style: GoogleFonts.jetBrainsMono(
                  color: color,
                  fontSize: 9,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
            const SizedBox(width: 6),
            Text(
              r.inputType.toUpperCase(),
              style: GoogleFonts.jetBrainsMono(
                color: TrustLayerColors.textSecondary,
                fontSize: 9.5,
              ),
            ),
          ],
        ),
        trailing: r.campaignFlagged
            ? Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                decoration: BoxDecoration(
                  color: TrustLayerColors.critical.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: TrustLayerColors.critical.withOpacity(0.4)),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.campaign, color: TrustLayerColors.critical, size: 14),
                    SizedBox(width: 4),
                    Text('CAMPAIGN', style: TextStyle(color: TrustLayerColors.critical, fontSize: 8.5, fontWeight: FontWeight.bold)),
                  ],
                ),
              )
            : const Icon(Icons.chevron_right, color: TrustLayerColors.textSecondary, size: 20),
        onTap: () async {
          await Navigator.of(context).push(MaterialPageRoute(
            builder: (_) => ResultScreen(result: r),
          ));
          _loadHistory();
        },
      ),
    );
  }
}

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';

import '../models/analysis_result.dart';
import '../services/analysis_queue.dart';
import '../services/api_client.dart';
import '../services/protection_service.dart';
import '../main.dart';
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
        backgroundColor: TrustLayerColors.surface,
        title: Text('🔍 Analyze Message', style: GoogleFonts.inter(color: TrustLayerColors.textPrimary, fontWeight: FontWeight.bold)),
        content: TextField(
          controller: controller,
          maxLines: 6,
          autofocus: true,
          style: TextStyle(color: TrustLayerColors.textPrimary),
          decoration: InputDecoration(
            hintText: 'Paste the SMS, WhatsApp or email text here…',
            hintStyle: TextStyle(color: TrustLayerColors.textSecondary),
            filled: true,
            fillColor: TrustLayerColors.background,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: Text('Cancel', style: TextStyle(color: TrustLayerColors.textSecondary))),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: TrustLayerColors.primary),
            onPressed: () => Navigator.pop(ctx, controller.text),
            child: const Text('Analyze'),
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
        backgroundColor: TrustLayerColors.surface,
        title: Text('🔗 Check URL', style: GoogleFonts.inter(color: TrustLayerColors.textPrimary, fontWeight: FontWeight.bold)),
        content: TextField(
          controller: controller,
          autofocus: true,
          style: TextStyle(color: TrustLayerColors.textPrimary),
          decoration: InputDecoration(
            hintText: 'https://suspicious-link.example/login',
            hintStyle: TextStyle(color: TrustLayerColors.textSecondary),
            filled: true,
            fillColor: TrustLayerColors.background,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: Text('Cancel', style: TextStyle(color: TrustLayerColors.textSecondary))),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: TrustLayerColors.primary),
            onPressed: () => Navigator.pop(ctx, controller.text),
            child: const Text('Check'),
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
        title: Text('TRUSTLAYER',
          style: GoogleFonts.inter(fontWeight: FontWeight.bold, color: TrustLayerColors.textPrimary, letterSpacing: 1.2)),
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
            child: ListView(
              padding: const EdgeInsets.all(20),
              children: [
                // Real, OS-verified protection state (permissions, notification
                // access, quiet mode) — replaces the old always-green badge.
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
                const SizedBox(height: 32),
                Text('Quick Analysis',
                  style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.bold, color: TrustLayerColors.textPrimary)),
                const SizedBox(height: 16),
                GridView.count(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  crossAxisCount: 2,
                  crossAxisSpacing: 16,
                  mainAxisSpacing: 16,
                  childAspectRatio: 1.1,
                  children: [
                    _toolCard(Icons.message_outlined, 'Analyze\nMessage', _analyzeText),
                    _toolCard(Icons.camera_alt_outlined, 'Analyze\nScreenshot', _analyzeScreenshot),
                    _toolCard(Icons.link, 'Check\nURL', _checkUrl),
                    _toolCard(Icons.history, 'Scan\nHistory', () => _loadHistory()),
                  ],
                ),
                const SizedBox(height: 32),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Recent Threats',
                      style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.bold, color: TrustLayerColors.textPrimary)),
                    if (_recent.isNotEmpty)
                      Text('${_recent.length} detected',
                        style: GoogleFonts.inter(fontSize: 14, color: TrustLayerColors.textSecondary)),
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
                          Icon(Icons.cloud_off, size: 48,
                              color: TrustLayerColors.high.withOpacity(0.7)),
                          const SizedBox(height: 8),
                          Text(_historyError!,
                              textAlign: TextAlign.center,
                              style: TextStyle(color: TrustLayerColors.high, fontSize: 14)),
                          const SizedBox(height: 8),
                          TextButton(
                            onPressed: _loadHistory,
                            child: Text('Retry',
                                style: TextStyle(color: TrustLayerColors.primary)),
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
                              color: TrustLayerColors.textSecondary.withOpacity(0.3)),
                          const SizedBox(height: 8),
                          Text('No threats detected yet',
                              style: TextStyle(color: TrustLayerColors.textSecondary)),
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
              color: TrustLayerColors.background.withOpacity(0.8),
              child: const Center(child: CircularProgressIndicator(color: TrustLayerColors.primary)),
            ),
        ],
      ),
    );
  }

  Widget _toolCard(IconData icon, String label, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: TrustLayerColors.surface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: TrustLayerColors.textSecondary.withOpacity(0.1)),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 32, color: TrustLayerColors.primary),
            const SizedBox(height: 12),
            Text(label,
              textAlign: TextAlign.center,
              style: GoogleFonts.inter(color: TrustLayerColors.textPrimary, fontWeight: FontWeight.w600, fontSize: 14)),
          ],
        ),
      ),
    );
  }

  Widget _threatTile(AnalysisResult r) {
    final color = _levelColor(r.riskLevel);
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: TrustLayerColors.surface,
        borderRadius: BorderRadius.circular(16),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        leading: Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            color: color.withOpacity(0.15),
            shape: BoxShape.circle,
            border: Border.all(color: color.withOpacity(0.5), width: 2),
          ),
          child: Center(
            child: Text('${r.riskScore}',
                style: GoogleFonts.jetBrainsMono(
                    color: color,
                    fontWeight: FontWeight.bold,
                    fontSize: 14)),
          ),
        ),
        title: Text(r.threatType,
            style: GoogleFonts.inter(color: TrustLayerColors.textPrimary, fontWeight: FontWeight.w600)),
        subtitle: Text('${r.riskLevel} · ${r.inputType}',
            style: TextStyle(color: TrustLayerColors.textSecondary)),
        trailing: r.campaignFlagged
            ? const Icon(Icons.campaign, color: TrustLayerColors.critical, size: 20)
            : const Icon(Icons.chevron_right, color: TrustLayerColors.textSecondary),
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

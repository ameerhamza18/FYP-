import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';

import '../models/analysis_result.dart';
import '../services/api_client.dart';
import '../services/token_store.dart';
import '../main.dart';
import 'login_screen.dart';
import 'result_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _api = TrustApiClient();
  final _picker = ImagePicker();
  List<AnalysisResult> _recent = [];
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _loadHistory();
  }

  Future<void> _loadHistory() async {
    try {
      final h = await _api.history(limit: 10);
      if (mounted) setState(() => _recent = h);
    } catch (_) {/* offline — ignore */}
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

  Future<void> _run(Future<AnalysisResult> Function() job) async {
    setState(() => _busy = true);
    try {
      final result = await job();
      if (!mounted) return;
      await Navigator.of(context).push(MaterialPageRoute(
        builder: (_) => ResultScreen(result: result),
      ));
      await _loadHistory();
    } on ApiException catch (e) {
      _snack(e.statusCode == 503
          ? 'OCR unavailable on the server — paste the text instead'
          : e.message);
    } catch (_) {
      _snack('Cannot reach TrustLayer server');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _snack(String msg) =>
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));

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
                // Protection Status Card
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: TrustLayerColors.surface,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: TrustLayerColors.primary.withOpacity(0.3)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.verified_user, color: TrustLayerColors.low, size: 40),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Protection Active',
                              style: GoogleFonts.inter(color: TrustLayerColors.textPrimary, fontSize: 18, fontWeight: FontWeight.bold)),
                            Text('Real-time interception enabled',
                              style: GoogleFonts.inter(color: TrustLayerColors.textSecondary, fontSize: 14)),
                          ],
                        ),
                      ),
                    ],
                  ),
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
                if (_recent.isEmpty)
                  Center(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 40),
                      child: Column(
                        children: [
                          Icon(Icons.shield_outlined, size: 48, color: TrustLayerColors.textSecondary.withOpacity(0.3)),
                          const SizedBox(height: 8),
                          Text('No threats detected yet', style: TextStyle(color: TrustLayerColors.textSecondary)),
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

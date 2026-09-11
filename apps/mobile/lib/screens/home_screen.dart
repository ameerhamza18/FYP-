import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../models/analysis_result.dart';
import '../services/api_client.dart';
import '../services/token_store.dart';
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
        title: const Text('🔍 Analyze Message'),
        content: TextField(
          controller: controller,
          maxLines: 6,
          autofocus: true,
          decoration: const InputDecoration(
            hintText: 'Paste the SMS, WhatsApp or email text here…',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
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
        title: const Text('🔗 Check URL'),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: const InputDecoration(
            hintText: 'https://suspicious-link.example/login',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
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
      case 'CRITICAL':
        return Colors.red.shade900;
      case 'HIGH':
        return Colors.red;
      case 'MEDIUM':
        return Colors.orange;
      default:
        return Colors.green;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('🛡 TRUSTLAYER'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Sign out',
            onPressed: () async {
              await _api.logout();
              if (!mounted) return;
              Navigator.of(context).pushReplacement(
                MaterialPageRoute(builder: (_) => const LoginScreen()),
              );
            },
          ),
        ],
      ),
      body: Stack(
        children: [
          RefreshIndicator(
            onRefresh: _loadHistory,
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                const Center(
                  child: Padding(
                    padding: EdgeInsets.only(bottom: 20),
                    child: Text('🛡 Stay Safe Online',
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
                  ),
                ),
                _bigCard(Icons.search, 'Analyze Message',
                    'Check SMS, WhatsApp or email text', _analyzeText),
                _bigCard(Icons.camera_alt_outlined, 'Analyze Screenshot',
                    'OCR a scam screenshot', _analyzeScreenshot),
                _bigCard(Icons.link, 'Check URL',
                    'Inspect a suspicious link', _checkUrl),
                const SizedBox(height: 18),
                const Text('Recent Threats',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                if (_recent.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 18),
                    child: Text('Nothing analyzed yet — stay alert!',
                        style: TextStyle(color: Colors.grey)),
                  )
                else
                  ..._recent.map((r) => Card(
                        child: ListTile(
                          leading: CircleAvatar(
                            backgroundColor: _levelColor(r.riskLevel).withOpacity(.15),
                            child: Text('${r.riskScore}',
                                style: TextStyle(
                                    color: _levelColor(r.riskLevel),
                                    fontWeight: FontWeight.bold,
                                    fontSize: 12)),
                          ),
                          title: Text(r.threatType,
                              style: const TextStyle(fontWeight: FontWeight.w600)),
                          subtitle: Text('${r.riskLevel} · ${r.inputType}'),
                          trailing: r.campaignFlagged
                              ? const Tooltip(
                                  message: 'Coordinated campaign',
                                  child: Icon(Icons.campaign, color: Colors.red))
                              : null,
                        ),
                      )),
              ],
            ),
          ),
          if (_busy)
            Container(
              color: Colors.black38,
              child: const Center(child: CircularProgressIndicator()),
            ),
        ],
      ),
    );
  }

  Widget _bigCard(IconData icon, String title, String sub, VoidCallback onTap) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        onTap: onTap,
        leading: Icon(icon, size: 32, color: Theme.of(context).colorScheme.primary),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.bold)),
        subtitle: Text(sub),
        trailing: const Icon(Icons.chevron_right),
      ),
    );
  }
}

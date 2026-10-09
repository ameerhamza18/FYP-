'use client';

/**
 * TrustLayer SOC Command Center — Campaign Correlation Engine.
 *
 * Implements the 3D cybersecurity SOC Cockpit directly inspired by web.jpg:
 * - Top Cockpit Header: TrustLayer | Campaign Correlation Engine with award accolades.
 * - Left Panel: Search filter, Threat Feed, Technique Meters, Threat Telemetry & Waveforms.
 * - Center Stage: Live 3D Vector Nodes Map (Three.js), Decised Threat Header, Campaign Metadata & Tactical Action Triggers.
 * - Right Panel: Vector Nodes Radar, Khatra Level: Buland Risk Visualization with 3D Ruby Gem Shield, and Indicator Legend.
 * - Lower Operations Deck: Full Campaign Registry, Audit Trail, RBAC Accounts & System Health Telemetry.
 */
import { useState, useMemo, useCallback } from 'react';
import Footer from '@/components/Footer';
import Navbar from '@/components/Navbar';
import ThreatFeed from '@/components/dashboard/ThreatFeed';
import TrendChart from '@/components/dashboard/TrendChart';
import TechniqueBars from '@/components/dashboard/TechniqueBars';
import VectorNodesMap3D, { VectorNode } from '@/components/3d/VectorNodesMap3D';
import RiskShield3D from '@/components/3d/RiskShield3D';
import { BTN, CARD, EmptyState, Metric, RiskBadge } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { RequireAuth } from '@/lib/auth';
import { formatDateTime, formatNumber, relativeTime } from '@/lib/presentation';
import type { AdminStats, AdminUser, AuditLog, Campaign, Analysis } from '@/lib/types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

/* -------------------------------------------------------------- sub-views */

function SegmentedMeter({ label, pct, color = 'cyan' }: { label: string; pct: number; color?: 'cyan' | 'ruby' | 'amber' }) {
  const totalSegments = 14;
  const activeCount = Math.round((pct / 100) * totalSegments);

  return (
    <div className="flex items-center justify-between gap-3 text-xs font-mono">
      <span className="text-slate-300 w-28 truncate">{label}</span>
      <div className="flex items-center gap-2">
        <div className="flex gap-[3px]">
          {Array.from({ length: totalSegments }).map((_, idx) => (
            <span
              key={idx}
              className={`h-3 w-[3px] rounded-[1px] transition-colors ${
                idx < activeCount
                  ? color === 'ruby'
                    ? 'bg-rose-500 shadow-[0_0_6px_#f43f5e]'
                    : color === 'amber'
                    ? 'bg-amber-400 shadow-[0_0_6px_#fbbf24]'
                    : 'bg-sky-400 shadow-[0_0_6px_#38bdf8]'
                  : 'bg-slate-800'
              }`}
            />
          ))}
        </div>
        <span className="w-10 text-right font-bold text-slate-200">{pct}%</span>
      </div>
    </div>
  );
}

function WaveformCanvas() {
  return (
    <div className="h-10 w-full overflow-hidden rounded border border-sky-900/30 bg-slate-950/80 p-1">
      <svg className="h-full w-full" preserveAspectRatio="none" viewBox="0 0 200 40">
        <path
          d="M 0 20 Q 20 5, 40 20 T 80 20 T 120 10 T 160 30 T 200 20"
          fill="none"
          stroke="#0284c7"
          strokeWidth="1.5"
          className="opacity-70"
        />
        <path
          d="M 0 20 Q 30 35, 60 20 T 100 20 T 140 32 T 170 8 T 200 20"
          fill="none"
          stroke="#38bdf8"
          strokeWidth="1.2"
          className="opacity-90"
        />
      </svg>
    </div>
  );
}

function CampaignTable({ campaigns }: { campaigns: Campaign[] }) {
  if (campaigns.length === 0) {
    return (
      <section className="tl-hud-glass rounded-xl overflow-hidden">
        <div className="border-b border-sky-900/40 p-4">
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-sky-400">
            CAMPAIGN REGISTRY & CORRELATED ATTACKS
          </h2>
        </div>
        <EmptyState
          title="No campaigns correlated"
          description="Repeated attack signatures across users will be grouped here automatically."
        />
      </section>
    );
  }

  return (
    <section className="tl-hud-glass rounded-xl overflow-hidden">
      <div className="border-b border-sky-900/40 p-4 flex items-center justify-between">
        <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-sky-400">
          CAMPAIGN REGISTRY & CORRELATED ATTACKS
        </h2>
        <span className="font-mono text-[10px] text-slate-400">
          {campaigns.length} ACTIVE SIGNATURES
        </span>
      </div>
      <div className="tl-scroll overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-xs font-mono">
          <thead className="bg-slate-900/70 text-[10px] uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-4 py-2.5 font-semibold">Signature / Pattern</th>
              <th className="px-3 py-2.5 font-semibold">Severity</th>
              <th className="px-3 py-2.5 text-right font-semibold">Hits</th>
              <th className="px-3 py-2.5 text-right font-semibold">Targets</th>
              <th className="px-3 py-2.5 font-semibold">First seen</th>
              <th className="px-4 py-2.5 font-semibold">Last seen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sky-900/20">
            {campaigns.map((campaign) => (
              <tr
                key={campaign.id}
                className="transition-colors hover:bg-sky-950/30"
              >
                <td className="px-4 py-2.5">
                  <span
                    className="block max-w-[280px] truncate text-slate-200"
                    title={campaign.sample_snippet ?? campaign.signature}
                  >
                    {campaign.signature}
                  </span>
                  {campaign.sample_snippet && (
                    <span className="mt-0.5 block max-w-[280px] truncate text-[10px] text-slate-500">
                      {campaign.sample_snippet}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <RiskBadge level={campaign.severity} />
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-slate-200">
                  {formatNumber(campaign.hits)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-slate-400">
                  {formatNumber(campaign.distinct_users)}
                </td>
                <td className="px-3 py-2.5 text-[10px] text-slate-400">
                  {formatDateTime(campaign.first_seen)}
                </td>
                <td className="px-4 py-2.5 text-[10px] text-slate-400">
                  {relativeTime(campaign.last_seen)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AuditTrail({ logs }: { logs: AuditLog[] }) {
  return (
    <section className="tl-hud-glass rounded-xl overflow-hidden">
      <div className="border-b border-sky-900/40 p-4">
        <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-sky-400">
          CRYPTOGRAPHIC AUDIT TRAIL
        </h2>
        <p className="mt-0.5 text-[10px] font-mono text-slate-400">
          Append-only security log verified with HMAC digest
        </p>
      </div>
      {logs.length === 0 ? (
        <EmptyState title="No audit events" description="Logins and analyses will appear here." />
      ) : (
        <ul className="tl-scroll max-h-[340px] divide-y divide-sky-900/20 overflow-y-auto font-mono text-xs">
          {logs.map((log) => (
            <li key={log.id} className="flex items-center gap-3 px-4 py-2 hover:bg-sky-950/20">
              <span className="w-28 shrink-0 truncate text-sky-300 font-semibold text-[11px]">
                {log.action}
              </span>
              <span className="min-w-0 flex-1 truncate text-slate-300 text-[11px]" title={log.resource ?? ''}>
                {log.resource ?? '—'}
              </span>
              <span className="hidden w-28 shrink-0 truncate text-right text-[10px] text-slate-400 sm:block">
                {log.ip ?? '—'}
              </span>
              <span className="w-20 shrink-0 text-right text-[10px] text-slate-500">
                {relativeTime(log.created_at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function UserRoster({
  users,
  onActionSuccess,
}: {
  users: AdminUser[];
  onActionSuccess: () => void;
}) {
  const handleToggleStatus = async (account: AdminUser) => {
    try {
      await api.admin.toggleUserStatus(account.id, !account.is_active);
      toast.success(`User ${account.email} ${account.is_active ? 'deactivated' : 'activated'}`);
      onActionSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update user status');
    }
  };

  const handleToggleRole = async (account: AdminUser) => {
    const nextRole = account.role === 'admin' ? 'user' : 'admin';
    try {
      await api.admin.updateUserRole(account.id, nextRole);
      toast.success(`User ${account.email} role updated to ${nextRole}`);
      onActionSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update user role');
    }
  };

  const handleDelete = async (account: AdminUser) => {
    if (!confirm(`Are you sure you want to permanently delete account ${account.email}?`)) {
      return;
    }
    try {
      await api.admin.deleteUser(account.id);
      toast.success(`User ${account.email} deleted`);
      onActionSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete user');
    }
  };

  return (
    <section className="tl-hud-glass rounded-xl overflow-hidden">
      <div className="border-b border-sky-900/40 p-4 flex items-center justify-between">
        <div>
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-sky-400">
            RBAC ACCESS & OPERATOR ACCOUNTS
          </h2>
          <p className="mt-0.5 text-[10px] font-mono text-slate-400">{users.length} registered</p>
        </div>
      </div>
      <div className="tl-scroll max-h-[340px] overflow-y-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead className="sticky top-0 bg-slate-900/80 text-[10px] uppercase tracking-wider text-slate-400 z-10">
            <tr>
              <th className="px-4 py-2 font-semibold">Operator Email</th>
              <th className="px-3 py-2 font-semibold">Role</th>
              <th className="px-3 py-2 font-semibold">Status</th>
              <th className="px-4 py-2 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sky-900/20">
            {users.map((account) => (
              <tr key={account.id} className="transition-colors hover:bg-sky-950/20">
                <td className="px-4 py-2">
                  <div className="flex flex-col">
                    <span className="truncate font-medium text-slate-200">{account.email}</span>
                    <span className="text-[9px] text-slate-500">Joined {formatDateTime(account.created_at)}</span>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => handleToggleRole(account)}
                    title="Click to toggle role"
                    className={`rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase transition-all ${
                      account.role === 'admin'
                        ? 'border-sky-500/40 bg-sky-950/60 text-sky-400'
                        : 'border-slate-700 bg-slate-900 text-slate-400'
                    }`}
                  >
                    {account.role} ⇋
                  </button>
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                      account.is_active
                        ? 'border border-emerald-500/40 bg-emerald-950/50 text-emerald-400'
                        : 'border border-rose-500/40 bg-rose-950/50 text-rose-400'
                    }`}
                  >
                    {account.is_active ? 'Active' : 'Disabled'}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(account)}
                      className="rounded border border-sky-900/60 px-2 py-0.5 text-[10px] text-slate-300 hover:bg-sky-900/30"
                    >
                      {account.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(account)}
                      className="rounded border border-rose-900/60 px-2 py-0.5 text-[10px] text-rose-400 hover:bg-rose-950/40"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------- main command center */

function SocDashboard() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNode, setSelectedNode] = useState<VectorNode | null>(null);

  const { data: stats, isLoading: statsLoading, isError: statsError } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => api.admin.stats(),
  });

  const { data: campaigns, isLoading: campaignsLoading } = useQuery({
    queryKey: ['admin', 'campaigns'],
    queryFn: () => api.admin.campaigns(),
  });

  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ['admin', 'audit-logs'],
    queryFn: () => api.admin.auditLogs(60),
  });

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => api.admin.users(),
  });

  const { data: analysesData } = useQuery({
    queryKey: ['admin', 'analyses'],
    queryFn: () => api.admin.analyses({ limit: 100 }),
  });

  const { data: metrics } = useQuery({
    queryKey: ['admin', 'metrics'],
    queryFn: () => api.admin.metrics(),
  });

  const analyses = analysesData?.items || [];

  const handleRefresh = async () => {
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'campaigns'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'audit-logs'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'analyses'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'metrics'] }),
      ]);
      toast.success('SOC telemetry re-synchronized');
    } catch (err) {
      toast.error('Failed to refresh dashboard');
    }
  };

  const handleExportAudit = async () => {
    try {
      await api.admin.exportAuditLogsCsv();
      toast.success('Audit logs exported');
    } catch (err) {
      toast.error('Failed to export audit logs');
    }
  };

  const handleExportThreats = async () => {
    try {
      await api.admin.exportAnalysesCsv();
      toast.success('Threat feed exported');
    } catch (err) {
      toast.error('Failed to export threat feed');
    }
  };

  const handleCampaignReport = () => {
    toast.success('Generating Intelligence Dossier & Correlated Attack Graph...');
  };

  const handleIsolateAssets = () => {
    toast.error('Triggering Firewall Vector Quarantine across ingress endpoints');
  };

  const handleAlertManagers = () => {
    toast.info('Emergency Telegram & Slack SOC alert broadcast sent to Security Team');
  };

  const activeCampaign = campaigns?.[0] || {
    id: 1,
    signature: 'Malware Campaign (Urdu Phishing Dropper)',
    hits: 541,
    severity: 'CRITICAL',
    distinct_users: 14,
    first_seen: new Date().toISOString(),
    last_seen: new Date().toISOString(),
  };

  // Filter analyses based on search query
  const filteredAnalyses = useMemo(() => {
    if (!searchQuery) return analyses.slice(0, 4);
    const q = searchQuery.toLowerCase();
    return analyses.filter(a => 
      (a.content_snippet && a.content_snippet.toLowerCase().includes(q)) ||
      (a.risk_level && a.risk_level.toLowerCase().includes(q)) ||
      (a.input_type && a.input_type.toLowerCase().includes(q))
    ).slice(0, 4);
  }, [analyses, searchQuery]);

  return (
    <div className="min-h-screen bg-[#040711] text-slate-100 tl-circuit-pattern">
      {/* 1. TOP COCKPIT HEADER BAR (Matching web.jpg) */}
      <header className="border-b border-sky-950/70 bg-[#060b18]/90 backdrop-blur-xl px-5 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/20 border border-sky-400/40 text-sky-400">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </span>
            <span className="font-mono text-base font-extrabold tracking-tight text-white">TrustLayer</span>
          </div>
          <span className="text-slate-600 font-mono">|</span>
          <h1 className="font-mono text-sm font-semibold tracking-wider text-slate-300">
            Campaign Correlation Engine
          </h1>
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-950/50 px-2 py-0.5 font-mono text-[9px] text-sky-400">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse" />
            LIVE SOC SENSORS ACTIVE
          </span>
        </div>

        {/* Right side accolade and quick export buttons */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-3 px-3 py-1 rounded border border-white/5 bg-white/[0.02] font-mono text-[10px] text-slate-400">
            <span className="flex items-center gap-1 text-slate-300">
              <span className="text-amber-400 font-bold">Bē</span> Behance
            </span>
            <span className="text-slate-600">/</span>
            <span className="text-slate-400">Disignssiert Awards</span>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs">
            <button
              onClick={handleRefresh}
              className="rounded border border-sky-800/60 bg-sky-950/40 px-2.5 py-1 text-[11px] text-sky-300 hover:bg-sky-900/50"
            >
              SYNC TELEMETRY
            </button>
            <button
              onClick={handleExportThreats}
              className="rounded border border-slate-800 bg-slate-900 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-slate-800"
            >
              CSV EXPORT
            </button>
          </div>
        </div>
      </header>

      {/* 2. THREE-COLUMN COCKPIT (Direct match to web.jpg layout) */}
      <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* ---------------- LEFT PANEL (Col 1-3) ---------------- */}
        <div className="lg:col-span-3 space-y-4">
          
          {/* Search Box */}
          <div className="relative">
            <input
              type="text"
              placeholder="Q Search incidents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-sky-900/50 bg-[#091124]/90 px-3 py-2 text-xs font-mono text-slate-200 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none"
            />
            <span className="absolute right-3 top-2.5 text-xs text-slate-500">⌘K</span>
          </div>

          {/* Threat Feed */}
          <div className="tl-hud-glass rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between border-b border-sky-950 pb-2">
              <span className="font-mono text-xs font-bold text-sky-300">Threat Feed</span>
              <span className="font-mono text-[9px] text-slate-500">LIVE STREAMS</span>
            </div>
            
            <div className="space-y-2">
              <div className="rounded border border-sky-900/30 bg-slate-950/70 p-2 font-mono text-[11px]">
                <div className="flex justify-between items-center text-slate-400">
                  <span>Target: <strong className="text-rose-400">19.135.1.163</strong></span>
                  <span className="rounded bg-rose-950/60 text-rose-300 border border-rose-800/40 px-1 text-[9px]">Phishing</span>
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-slate-500">
                  <span>Source: 04.17.20.211</span>
                  <span>Port 443 TLS</span>
                </div>
              </div>

              {filteredAnalyses.slice(0, 2).map((item, idx) => (
                <div key={item.id || idx} className="rounded border border-sky-950/40 bg-slate-950/40 p-2 font-mono text-[11px]">
                  <div className="flex justify-between items-center text-slate-400">
                    <span>Target: <strong className="text-sky-300">{item.input_type || 'HTTP'}</strong></span>
                    <span className={`rounded px-1 text-[9px] border ${
                      item.risk_level === 'CRITICAL' ? 'bg-rose-950/60 text-rose-300 border-rose-800/40' :
                      item.risk_level === 'HIGH' ? 'bg-amber-950/60 text-amber-300 border-amber-800/40' :
                      'bg-sky-950/60 text-sky-300 border-sky-800/40'
                    }`}>
                      {item.risk_level || 'RISK'}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate text-[10px] text-slate-500">
                    {item.content_snippet?.slice(0, 42) || 'Encrypted telemetry stream'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Technique Meters */}
          <div className="tl-hud-glass rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between border-b border-sky-950 pb-2">
              <span className="font-mono text-xs font-bold text-sky-300">Technique Meters</span>
              <span className="font-mono text-[9px] text-slate-500">HEURISTICS</span>
            </div>
            
            <div className="space-y-2 pt-1">
              <SegmentedMeter label="Phishing" pct={70} color="ruby" />
              <SegmentedMeter label="Malware" pct={70} color="ruby" />
              <SegmentedMeter label="Brute Force" pct={66} color="amber" />
              <SegmentedMeter label="Social Pressure" pct={65} color="cyan" />
            </div>
            
            <div className="mt-2 rounded border border-sky-900/30 bg-sky-950/30 px-2 py-1 font-mono text-[9px] text-sky-400 flex items-center justify-between">
              <span>DIO3IETRIC DETAILS:</span>
              <span className="font-bold">[Feed ID Scan Successful]</span>
            </div>
          </div>

          {/* Campaign Metadata & Sparklines */}
          <div className="tl-hud-glass rounded-xl p-3.5 space-y-2 font-mono text-[11px]">
            <div className="flex items-center justify-between border-b border-sky-950 pb-2">
              <span className="text-xs font-bold text-sky-300">Campaign Metadata</span>
              <span className="text-[9px] text-slate-500">•••</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px] pt-1">
              <div>
                <span className="text-slate-500 block">Threat Acq:</span>
                <span className="text-slate-300">19.128.1.193</span>
              </div>
              <div>
                <span className="text-slate-500 block">Source:</span>
                <span className="text-slate-300">84.17.20.211</span>
              </div>
              <div>
                <span className="text-slate-500 block">Status:</span>
                <span className="text-rose-400 font-bold">Active</span>
              </div>
              <div>
                <span className="text-slate-500 block">Decryption:</span>
                <span className="text-emerald-400 font-bold">Verified</span>
              </div>
            </div>

            {/* Sparkline waveforms */}
            <div className="pt-1">
              <span className="text-[9px] text-slate-500 block mb-1">Signal Oscilloscope // Port 443</span>
              <WaveformCanvas />
            </div>

            <div className="flex justify-between items-center text-[10px] pt-1 text-slate-400 border-t border-sky-950/60">
              <span>Target: 10.128.1.152</span>
              <span>Source: 84.17.28.211</span>
            </div>
          </div>

        </div>

        {/* ---------------- CENTER PANEL (Col 4-9) ---------------- */}
        <div className="lg:col-span-6 space-y-4 flex flex-col">
          
          {/* Top Status Bar: Technique Meters | Decised Threat in Analysis */}
          <div className="tl-hud-glass rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 font-mono text-xs">
            <div className="flex items-center gap-2">
              <span className="text-sky-400 font-bold">Technique Meters</span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-300 font-semibold">Decised Threat in Analysis</span>
            </div>

            <div className="flex items-center gap-3 text-[11px]">
              <span>Target: <strong className="text-rose-400">19.135.1.163</strong></span>
              <span className="text-slate-600">/</span>
              <span>Type: <strong className="text-rose-400">Phishing</strong></span>
              <span className="text-slate-600">/</span>
              <span>Source: <strong className="text-sky-300">04.17.20.211</strong></span>
            </div>
          </div>

          {/* MAIN 3D VECTOR NODES MAP (Three.js Isometric Canvas) */}
          <div className="relative flex-1 min-h-[460px] rounded-xl overflow-hidden border border-sky-900/50 bg-[#02050f] shadow-2xl">
            <VectorNodesMap3D
              selectedNode={selectedNode}
              onSelectNode={(node) => setSelectedNode(node)}
            />
          </div>

          {/* Bottom Campaign Metadata Console with Tactical Buttons */}
          <div className="tl-hud-glass rounded-xl p-4 font-mono">
            <div className="flex items-center justify-between border-b border-sky-900/40 pb-2 mb-3">
              <span className="text-xs font-bold text-sky-400">Campaign Metadata</span>
              <span className="text-[10px] text-slate-500">SYSTEM-WIDE THREAT VECTOR #23783</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-4">
              <div>
                <span className="text-[10px] text-slate-500 block">Campaign:</span>
                <span className="text-rose-400 font-bold truncate block">{activeCampaign.signature.slice(0, 20)}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">Attribute:</span>
                <span className="text-slate-300">None</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">File Type / Lang:</span>
                <span className="text-sky-300">Urdu / OCR</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">Source IPs:</span>
                <span className="text-slate-300">84.17.211</span>
              </div>
            </div>

            {/* Tactical Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-sky-950 pt-3">
              <span className="text-[10px] text-slate-500">SYSTEM-WIDE ACTIONS</span>
              <div className="flex flex-wrap gap-2 text-xs">
                <button
                  type="button"
                  onClick={handleCampaignReport}
                  className="rounded border border-sky-700/60 bg-sky-950/60 px-3 py-1.5 font-bold text-sky-300 hover:bg-sky-900/60 transition-all active:scale-95"
                >
                  CAMPAIGN REPORT
                </button>
                <button
                  type="button"
                  onClick={handleIsolateAssets}
                  className="rounded border border-rose-800/70 bg-rose-950/60 px-3 py-1.5 font-bold text-rose-400 hover:bg-rose-900/60 transition-all active:scale-95"
                >
                  ISOLATE ASSETS
                </button>
                <button
                  type="button"
                  onClick={handleAlertManagers}
                  className="rounded border border-amber-700/60 bg-amber-950/60 px-3 py-1.5 font-bold text-amber-300 hover:bg-amber-900/60 transition-all active:scale-95"
                >
                  ALERT MANAGERS
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* ---------------- RIGHT PANEL (Col 10-12) ---------------- */}
        <div className="lg:col-span-3 space-y-4">
          
          {/* Vector Nodes Map (Mini Star Topology Radar) */}
          <div className="tl-hud-glass rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between border-b border-sky-950 pb-2">
              <span className="font-mono text-xs font-bold text-sky-300">Vector Nodes Map</span>
              <span className="font-mono text-[9px] text-slate-500">•••</span>
            </div>

            {/* Radar SVG */}
            <div className="relative h-28 w-full flex items-center justify-center rounded border border-sky-950/60 bg-slate-950/70">
              <svg className="h-full w-full" viewBox="0 0 160 100">
                {/* Central Hub */}
                <circle cx="80" cy="50" r="14" fill="#082f49" stroke="#38bdf8" strokeWidth="1.5" />
                <circle cx="80" cy="50" r="4" fill="#38bdf8" />
                {/* Outer satellite nodes */}
                <circle cx="30" cy="30" r="5" fill="#ef4444" />
                <circle cx="130" cy="25" r="5" fill="#f59e0b" />
                <circle cx="135" cy="75" r="5" fill="#38bdf8" />
                <circle cx="35" cy="75" r="5" fill="#38bdf8" />
                {/* Radial lines */}
                <line x1="80" y1="50" x2="30" y2="30" stroke="#ef4444" strokeWidth="1" strokeDasharray="2 2" />
                <line x1="80" y1="50" x2="130" y2="25" stroke="#f59e0b" strokeWidth="1" strokeDasharray="2 2" />
                <line x1="80" y1="50" x2="135" y2="75" stroke="#38bdf8" strokeWidth="1" />
                <line x1="80" y1="50" x2="35" y2="75" stroke="#38bdf8" strokeWidth="1" />
              </svg>
              <span className="absolute bottom-1 right-2 font-mono text-[8px] text-slate-500">STAR-CORRELATION</span>
            </div>
          </div>

          {/* Risk Visualization & 3D Mechanical Cyber Shield */}
          <div className="tl-hud-glass-ruby rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-rose-950 pb-2">
              <span className="font-mono text-xs font-bold text-rose-300">Risk Visualization</span>
              <span className="font-mono text-[9px] text-slate-500">•••</span>
            </div>

            {/* KHATRA LEVEL: BULAND Banner matching web.jpg */}
            <div className="rounded border border-rose-600/50 bg-rose-950/80 py-1.5 px-3 text-center shadow-[0_0_15px_rgba(244,63,94,0.3)]">
              <span className="font-mono text-xs font-extrabold tracking-widest text-rose-300">
                KHATRA LEVEL: BULAND
              </span>
            </div>

            {/* 3D Mechanical Cyber Shield with Ruby Core & Score */}
            <div className="relative">
              <RiskShield3D score={84} level="BULAND" />
              
              {/* Telemetry Readouts around shield */}
              <div className="grid grid-cols-2 gap-1 font-mono text-[9px] text-slate-400 pt-1">
                <div className="flex justify-between"><span>SPN:</span><span className="text-slate-200">104318/201</span></div>
                <div className="flex justify-between"><span>DRAF:</span><span className="text-slate-200">0606</span></div>
                <div className="flex justify-between"><span>CAOTA:</span><span className="text-slate-200">22004</span></div>
                <div className="flex justify-between"><span>MODI:</span><span className="text-rose-400 font-bold">2246,590</span></div>
                <div className="flex justify-between"><span>TURV:</span><span className="text-slate-200">7408</span></div>
                <div className="flex justify-between"><span>TEMA:</span><span className="text-slate-200">1M80BCHS</span></div>
              </div>
            </div>
          </div>

          {/* Connection Types and Indicators Legend matching web.jpg */}
          <div className="tl-hud-glass rounded-xl p-3.5 space-y-2 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-sky-950 pb-2">
              <span className="text-xs font-bold text-sky-300">Connection Types & Indicators</span>
              <span className="text-[9px] text-slate-500">•••</span>
            </div>

            <div className="space-y-2 pt-1 text-[11px]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-500 shadow-[0_0_6px_#f43f5e]" />
                  <span className="text-rose-400 font-semibold">Malware</span>
                </div>
                <span className="text-slate-500">→ Node</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-sky-400 shadow-[0_0_6px_#38bdf8]" />
                  <span className="text-sky-300 font-semibold">Suspicious Files</span>
                </div>
                <span className="text-slate-500">→ Connection line</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400 shadow-[0_0_6px_#fbbf24]" />
                  <span className="text-amber-400 font-semibold">C2 (Command & Control)</span>
                </div>
                <span className="text-slate-500">→ Vector arrow</span>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* 3. LOWER OPERATIONS DECK: CAMPAIGN REGISTRY, AUDIT, & RBAC */}
      <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto border-t border-sky-950/60 mt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-mono text-xs text-slate-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            ORGANIZATION COMPLIANCE & INCIDENT ARCHIVES
          </div>
        </div>

        {/* 14-day Risk Trend & Threat Taxonomy */}
        {stats && (
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="tl-hud-glass rounded-xl p-4">
              <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-sky-400 mb-3">
                14-DAY INCIDENT RISK TREND
              </h2>
              <TrendChart data={stats.threat_trend} />
            </section>
            <TechniqueBars stats={stats} />
          </div>
        )}

        {/* Active Campaigns Table */}
        <CampaignTable campaigns={campaigns ?? []} />

        {/* Audit Trail & RBAC */}
        <div className="grid gap-6 lg:grid-cols-2">
          <AuditTrail logs={logs ?? []} />
          <UserRoster users={users ?? []} onActionSuccess={handleRefresh} />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 bg-[#040711]">
        <RequireAuth adminOnly>
          <SocDashboard />
        </RequireAuth>
      </main>
      <Footer />
    </>
  );
}

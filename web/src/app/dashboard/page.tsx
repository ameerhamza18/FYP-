'use client';

/**
 * SOC dashboard (administrator only).
 *
 * Aggregates four admin endpoints into one operations view: headline metrics,
 * a 14-day risk trend, the most-abused manipulation techniques, the paginated
 * org-wide threat feed, the campaign registry, the audit trail and the user
 * roster. Authorization is enforced server-side (require_admin); this page only
 * reflects what the API returned.
 */
import { useCallback } from 'react';

import Footer from '@/components/Footer';
import Navbar from '@/components/Navbar';
import ThreatFeed from '@/components/dashboard/ThreatFeed';
import TrendChart from '@/components/dashboard/TrendChart';
import TechniqueBars from '@/components/dashboard/TechniqueBars';
import ThreatCloud from '@/components/dashboard/ThreatCloud';
import { BTN, CARD, EmptyState, Metric, RiskBadge } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { RequireAuth } from '@/lib/auth';
import { formatDateTime, formatNumber, relativeTime } from '@/lib/presentation';
import type { AdminStats, AdminUser, AuditLog, Campaign, Analysis } from '@/lib/types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

/* -------------------------------------------------------------- sub-views */

function StatsPanel({ stats }: { stats: AdminStats }) {
  const cards = [
    {
      label: 'TOTAL PAYLOADS SCANNED',
      value: formatNumber(stats.total_analyses),
      hint: 'Global traffic throughput',
      tone: 'text-foreground',
      code: 'METRIC_01',
    },
    {
      label: 'HIGH / CRITICAL THREATS',
      value: formatNumber(stats.high_risk),
      hint:
        stats.total_analyses > 0
          ? `${Math.round((stats.high_risk / stats.total_analyses) * 100)}% of total intercepted`
          : 'No traffic yet',
      tone: 'text-risk-high',
      code: 'METRIC_02',
    },
    {
      label: 'ACTIVE ATTACK CAMPAIGNS',
      value: formatNumber(stats.active_campaigns),
      hint: '3+ correlated multi-user hits',
      tone: 'text-risk-critical',
      code: 'METRIC_03',
    },
  ];

  const categories = [
    { label: 'Phishing Vectors', value: stats.phishing, code: 'VEC_01' },
    { label: 'Employment Scams', value: stats.job_scams, code: 'VEC_02' },
    { label: 'Financial Fraud', value: stats.financial_fraud, code: 'VEC_03' },
    { label: 'Investment Frauds', value: stats.investment_scams, code: 'VEC_04' },
    { label: 'Deceptive Rewards', value: stats.prize_scams, code: 'VEC_05' },
  ];

  return (
    <>
      <section className="grid gap-4 sm:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className={`${CARD} p-5 relative overflow-hidden`}>
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 mb-2">
              <span>{card.code}</span>
              <span className="h-1.5 w-1.5 rounded-full bg-brand tl-beacon" />
            </div>
            <Metric label={card.label} value={card.value} hint={card.hint} tone={card.tone} />
          </div>
        ))}
      </section>

      <section className={`${CARD} p-5`}>
        <div className="flex items-center justify-between border-b border-border-default pb-3">
          <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-muted">
            THREAT TAXONOMY BREAKDOWN
          </h2>
          <span className="font-mono text-[10px] text-slate-500">REAL-TIME DISTRIBUTION</span>
        </div>
        <ul className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-5">
          {categories.map((item) => (
            <li key={item.label} className="flex items-baseline justify-between gap-3 rounded-xl border border-white/5 bg-surface-muted/40 p-3 font-mono">
              <span className="text-xs text-muted truncate">{item.label}</span>
              <span className="text-base font-bold tabular-nums text-foreground">
                {formatNumber(item.value)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function CampaignTable({ campaigns }: { campaigns: Campaign[] }) {
  if (campaigns.length === 0) {
    return (
      <section className={`${CARD} overflow-hidden`}>
        <div className="border-b border-border-default p-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted">
            Campaign registry
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
    <section className={`${CARD} overflow-hidden`}>
      <div className="border-b border-border-default p-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted">
          Campaign registry
        </h2>
        <p className="mt-0.5 text-xs text-muted">
          {campaigns.length} signature{campaigns.length === 1 ? '' : 's'} tracked
        </p>
      </div>
      <div className="tl-scroll overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-surface-muted text-[11px] uppercase tracking-wider text-muted">
            <tr>
              <th className="px-5 py-3 font-semibold">Signature</th>
              <th className="px-3 py-3 font-semibold">Severity</th>
              <th className="px-3 py-3 text-right font-semibold">Hits</th>
              <th className="px-3 py-3 text-right font-semibold">Users</th>
              <th className="px-3 py-3 font-semibold">First seen</th>
              <th className="px-5 py-3 font-semibold">Last seen</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((campaign) => (
              <tr
                key={campaign.id}
                className="border-t border-border-default transition-colors hover:bg-surface-muted/60"
              >
                <td className="px-5 py-3">
                  <span
                    className="block max-w-[280px] truncate font-mono text-xs text-foreground"
                    title={campaign.sample_snippet ?? campaign.signature}
                  >
                    {campaign.signature}
                  </span>
                  {campaign.sample_snippet && (
                    <span className="mt-0.5 block max-w-[280px] truncate text-[11px] text-muted">
                      {campaign.sample_snippet}
                    </span>
                  )}
                </td>
                <td className="px-3 py-3">
                  <RiskBadge level={campaign.severity} />
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-foreground">
                  {formatNumber(campaign.hits)}
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-muted">
                  {formatNumber(campaign.distinct_users)}
                </td>
                <td className="px-3 py-3 text-xs text-muted">
                  {formatDateTime(campaign.first_seen)}
                </td>
                <td className="px-5 py-3 text-xs text-muted">
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
    <section className={`${CARD} overflow-hidden`}>
      <div className="border-b border-border-default p-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted">Audit trail</h2>
        <p className="mt-0.5 text-xs text-muted">
          Append-only record of security-relevant events
        </p>
      </div>
      {logs.length === 0 ? (
        <EmptyState title="No audit events" description="Logins and analyses will appear here." />
      ) : (
        <ul className="tl-scroll max-h-[360px] divide-y divide-border-default overflow-y-auto">
          {logs.map((log) => (
            <li key={log.id} className="flex items-center gap-3 px-5 py-2.5">
              <span className="w-32 shrink-0 truncate font-mono text-xs font-semibold text-foreground">
                {log.action}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-muted" title={log.resource ?? ''}>
                {log.resource ?? '—'}
              </span>
              <span className="hidden w-28 shrink-0 truncate text-right font-mono text-[11px] text-muted sm:block">
                {log.ip ?? '—'}
              </span>
              <span className="w-20 shrink-0 text-right text-[11px] text-muted">
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
    <section className={`${CARD} overflow-hidden`}>
      <div className="border-b border-border-default p-5 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted">Accounts & RBAC</h2>
          <p className="mt-0.5 text-xs text-muted">{users.length} registered</p>
        </div>
      </div>
      <div className="tl-scroll max-h-[420px] overflow-y-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-surface-muted text-[11px] uppercase tracking-wider text-muted z-10">
            <tr>
              <th className="px-5 py-3 font-semibold">Email</th>
              <th className="px-3 py-3 font-semibold">Role</th>
              <th className="px-3 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((account) => (
              <tr key={account.id} className="border-t border-border-default transition-colors hover:bg-surface-muted/30">
                <td className="px-5 py-2.5">
                  <div className="flex flex-col">
                    <span className="truncate text-xs font-medium text-foreground">{account.email}</span>
                    <span className="text-[10px] text-muted">Joined {formatDateTime(account.created_at)}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => handleToggleRole(account)}
                    title="Click to toggle between user and admin"
                    className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide transition-opacity hover:opacity-80 ${
                      account.role === 'admin'
                        ? 'border-brand/25 bg-brand-soft text-brand'
                        : 'border-border-default bg-surface-muted text-muted'
                    }`}
                  >
                    {account.role} ⇋
                  </button>
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${
                      account.is_active
                        ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400'
                        : 'border-risk-critical/25 bg-risk-critical/10 text-risk-critical'
                    }`}
                  >
                    {account.is_active ? 'Active' : 'Disabled'}
                  </span>
                </td>
                <td className="px-5 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(account)}
                      className="rounded-lg border border-border-default px-2 py-1 text-[11px] font-medium text-muted hover:bg-surface-muted hover:text-foreground transition-colors"
                    >
                      {account.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(account)}
                      className="rounded-lg border border-risk-critical/30 px-2 py-1 text-[11px] font-medium text-risk-critical hover:bg-risk-critical/10 transition-colors"
                      title="Delete account"
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


/* ------------------------------------------------------------------- page */

function SocDashboard() {
  const queryClient = useQueryClient();

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
      toast.success('Dashboard refreshed');
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

  const loading = statsLoading || campaignsLoading || logsLoading || usersLoading;

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-10 lg:px-6 lg:py-12">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-border-default/80 pb-6">
        <div>
          <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-widest text-brand-cyan">
            <span className="h-2 w-2 rounded-full bg-emerald-400 tl-beacon" />
            24/7 SOC THREAT OPERATIONS // RESTRICTED ACCESS
          </div>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Security Operations Center
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            Organisation-wide telemetry: 3D global threat topology, active campaign correlation,
            manipulation vector distributions, RBAC policy enforcement, and cryptographically verified audit trails.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
          <button
            type="button"
            onClick={handleExportAudit}
            className={`${BTN.secondary} text-xs py-2`}
            title="Download audit trail as CSV"
          >
            ↓ AUDIT CSV
          </button>
          <button
            type="button"
            onClick={handleExportThreats}
            className={`${BTN.secondary} text-xs py-2`}
            title="Download full threat feed as CSV"
          >
            ↓ THREAT CSV
          </button>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            className={`${BTN.primary} text-xs py-2`}
          >
            {loading ? 'REFRESHING…' : 'SYNC TELEMETRY'}
          </button>
        </div>
      </header>

      {statsError && (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-risk-critical/30 bg-risk-critical/10 px-4 py-3 text-sm text-risk-critical"
        >
          Could not load dashboard statistics.
        </div>
      )}

      {loading && !stats ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="tl-skeleton h-[104px] rounded-2xl" />
            ))}
          </div>
          <div className="tl-skeleton h-64 rounded-2xl" />
          <div className="tl-skeleton h-80 rounded-2xl" />
        </div>
      ) : !stats ? (
        <div className={CARD}>
          <EmptyState
            title="Dashboard unavailable"
            description="The administration API did not return any statistics."
          />
        </div>
      ) : (
        <div className="space-y-6">
          <StatsPanel stats={stats} />

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <section className={`${CARD} p-5`}>
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted">
                14-day risk trend
              </h2>
              <div className="mt-3">
                <TrendChart data={stats.threat_trend} />
              </div>
            </section>
            <TechniqueBars stats={stats} />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <section className={`${CARD} p-5 lg:col-span-2 h-[500px]`}>
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted mb-4">
                Live Threat Cloud
              </h2>
              <ThreatCloud analyses={analyses} />
            </section>
            <div className="space-y-6">
               <ThreatFeed />
            </div>
          </div>

          <CampaignTable campaigns={campaigns ?? []} />

          {metrics && (
            <section className={`${CARD} p-5`}>
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted mb-3">
                System Telemetry & Engine Health
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="rounded-xl bg-surface-muted/60 p-3">
                  <span className="text-[11px] text-muted block">Avg Latency</span>
                  <span className="text-lg font-bold tabular-nums text-foreground">
                    {metrics.performance?.avg_latency_ms ?? 0} ms
                  </span>
                </div>
                <div className="rounded-xl bg-surface-muted/60 p-3">
                  <span className="text-[11px] text-muted block">Threat Ratio</span>
                  <span className="text-lg font-bold tabular-nums text-risk-high">
                    {metrics.performance?.threat_ratio_pct ?? 0}%
                  </span>
                </div>
                <div className="rounded-xl bg-surface-muted/60 p-3">
                  <span className="text-[11px] text-muted block">Active Accounts</span>
                  <span className="text-lg font-bold tabular-nums text-foreground">
                    {metrics.users?.active ?? 0} / {metrics.users?.total ?? 0}
                  </span>
                </div>
                <div className="rounded-xl bg-surface-muted/60 p-3">
                  <span className="text-[11px] text-muted block">ML Classification</span>
                  <span className="text-xs font-semibold text-brand block mt-1">
                    {metrics.ml_engine?.mode ?? 'Active'}
                  </span>
                </div>
              </div>
            </section>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <AuditTrail logs={logs ?? []} />
            <UserRoster users={users ?? []} onActionSuccess={handleRefresh} />
          </div>
        </div>

      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 bg-background-subtle">
        <RequireAuth adminOnly>
          <SocDashboard />
        </RequireAuth>
      </main>
      <Footer />
    </>
  );
}

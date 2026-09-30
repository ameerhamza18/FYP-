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
      label: 'Analyses',
      value: formatNumber(stats.total_analyses),
      hint: 'All time, every user',
      tone: 'text-foreground',
    },
    {
      label: 'High / critical',
      value: formatNumber(stats.high_risk),
      hint:
        stats.total_analyses > 0
          ? `${Math.round((stats.high_risk / stats.total_analyses) * 100)}% of traffic`
          : 'No traffic yet',
      tone: 'text-risk-high',
    },
    {
      label: 'Active campaigns',
      value: formatNumber(stats.active_campaigns),
      hint: '3+ correlated hits',
      tone: 'text-risk-critical',
    },
  ];

  const categories = [
    { label: 'Phishing', value: stats.phishing },
    { label: 'Job scams', value: stats.job_scams },
    { label: 'Financial fraud', value: stats.financial_fraud },
    { label: 'Investment', value: stats.investment_scams },
    { label: 'Prize scams', value: stats.prize_scams },
  ];

  return (
    <>
      <section className="grid gap-4 sm:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className={`${CARD} p-5`}>
            <Metric label={card.label} value={card.value} hint={card.hint} tone={card.tone} />
          </div>
        ))}
      </section>

      <section className={`${CARD} p-5`}>
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted">
          Threat classification
        </h2>
        <ul className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-5">
          {categories.map((item) => (
            <li key={item.label} className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-muted">{item.label}</span>
              <span className="text-lg font-bold tabular-nums text-foreground">
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

function UserRoster({ users }: { users: AdminUser[] }) {
  return (
    <section className={`${CARD} overflow-hidden`}>
      <div className="border-b border-border-default p-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted">Accounts</h2>
        <p className="mt-0.5 text-xs text-muted">{users.length} registered</p>
      </div>
      <div className="tl-scroll max-h-[360px] overflow-y-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-surface-muted text-[11px] uppercase tracking-wider text-muted">
            <tr>
              <th className="px-5 py-3 font-semibold">Email</th>
              <th className="px-3 py-3 font-semibold">Role</th>
              <th className="px-5 py-3 text-right font-semibold">Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.map((account) => (
              <tr key={account.id} className="border-t border-border-default">
                <td className="px-5 py-2.5">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-xs text-foreground">{account.email}</span>
                    {!account.is_active && (
                      <span className="shrink-0 rounded-md border border-risk-critical/25 bg-risk-critical/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-risk-critical">
                        Disabled
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      account.role === 'admin'
                        ? 'border-brand/25 bg-brand-soft text-brand'
                        : 'border-border-default bg-surface-muted text-muted'
                    }`}
                  >
                    {account.role}
                  </span>
                </td>
                <td className="px-5 py-2.5 text-right text-xs text-muted">
                  {formatDateTime(account.created_at)}
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

  const analyses = (analysesData as any)?.data || [];

  const handleRefresh = async () => {
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'campaigns'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'audit-logs'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'analyses'] }),
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
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Security operations</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            Organisation-wide threat visibility: classification mix, campaign correlation and the
            full audit trail. Data is served by the role-restricted admin API.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleExportAudit}
            className={BTN.secondary}
            title="Download audit trail as CSV"
          >
            ↓ Audit CSV
          </button>
          <button
            type="button"
            onClick={handleExportThreats}
            className={BTN.secondary}
            title="Download full threat feed as CSV"
          >
            ↓ Threat CSV
          </button>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            className={BTN.secondary}
          >
            {loading ? 'Refreshing…' : 'Refresh'}
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

          <div className="grid gap-6 lg:grid-cols-2">
            <AuditTrail logs={logs ?? []} />
            <UserRoster users={users ?? []} />
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

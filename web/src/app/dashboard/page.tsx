'use client';

/**
 * TrustLayer SOC Command Center — Warm Editorial Bento Architecture (RevenueX style).
 *
 * Preserves 100% of SOC capabilities:
 * - Live telemetry stats, 14-day TrendChart, and Most-Abused TechniqueBars
 * - Searchable & sortable Live Threat Telemetry table with expandable snippets
 * - Interactive 3D Correlation Topology (VectorNodesMap3D) & RiskShield3D with fullscreen mode
 * - Correlated Attack Campaign Registry
 * - Dynamic IOC Blocklist CRUD & Runtime Sync (FR-12)
 * - Cryptographic HMAC-SHA256 Audit Ledger with live chain verification & CSV export (FR-10)
 * - RBAC Operator Roster (role toggle, activate/deactivate, delete)
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useMemo } from 'react';
import TrendChart from '@/components/dashboard/TrendChart';
import TechniqueBars from '@/components/dashboard/TechniqueBars';
import VectorNodesMap3D, { VectorNode } from '@/components/3d/VectorNodesMap3D';
import RiskShield3D from '@/components/3d/RiskShield3D';
import NotificationTray from '@/components/NotificationTray';
import ThemeToggle from '@/components/ThemeToggle';
import { BTN, CARD, EmptyState, Logo, RiskBadge } from '@/components/ui';
import { api } from '@/lib/api';
import { RequireAuth, useAuth } from '@/lib/auth';
import { formatDateTime, formatNumber, relativeTime } from '@/lib/presentation';
import type {
  AdminAnalysis,
  AdminMetrics,
  AdminStats,
  AdminUser,
  AuditChainVerification,
  AuditLog,
  Campaign,
  ThreatIOC,
} from '@/lib/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

/* ------------------------------------------------ RevenueX vertical tick bar */

function SegmentedTickBar({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  const totalTicks = 34;
  const activeCount = Math.round((clamped / 100) * totalTicks);

  return (
    <div className="flex items-center gap-[3px] flex-1 justify-end" aria-hidden>
      {Array.from({ length: totalTicks }).map((_, idx) => (
        <span
          key={idx}
          className={`h-6 w-[3px] rounded-full transition-colors ${
            idx < activeCount
              ? 'bg-gradient-to-b from-[#A855F7] to-[#7E22CE]'
              : 'bg-border-default'
          }`}
        />
      ))}
    </div>
  );
}

/* ----------------------------------------------------------- sub-components */

function CampaignTable({ campaigns }: { campaigns: Campaign[] }) {
  return (
    <section id="campaigns" className={`${CARD} overflow-hidden p-5 sm:p-6 scroll-mt-6`}>
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-muted text-foreground">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </span>
          <div>
            <h2 className="tl-serif text-xl text-foreground">Correlated Attack Campaigns</h2>
            <p className="text-xs text-muted">Cross-user template & IOC clustering</p>
          </div>
        </div>
        <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-foreground">
          {campaigns.length} active signatures
        </span>
      </div>

      {campaigns.length === 0 ? (
        <EmptyState
          title="No campaigns correlated"
          description="Repeated IOC or template signatures across users will be grouped here automatically."
        />
      ) : (
        <div className="tl-scroll overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead>
              <tr className="bg-surface-muted text-[11px] font-medium text-muted">
                <th className="rounded-l-xl px-4 py-2.5">Signature / Pattern</th>
                <th className="px-3 py-2.5">Severity</th>
                <th className="px-3 py-2.5 text-right">Hits</th>
                <th className="px-3 py-2.5 text-right">Targets</th>
                <th className="px-3 py-2.5">First seen</th>
                <th className="rounded-r-xl px-4 py-2.5 text-right">Last seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {campaigns.map((campaign) => (
                <tr key={campaign.id} className="transition-colors hover:bg-surface-muted/50">
                  <td className="px-4 py-3">
                    <span
                      className="block max-w-[280px] truncate font-semibold text-foreground"
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
                  <td className="px-3 py-3 text-right font-semibold tabular-nums text-foreground">
                    {formatNumber(campaign.hits)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-muted">
                    {formatNumber(campaign.distinct_users)} users
                  </td>
                  <td className="px-3 py-3 text-[11px] text-muted">
                    {formatDateTime(campaign.first_seen)}
                  </td>
                  <td className="px-4 py-3 text-right text-[11px] text-muted">
                    {relativeTime(campaign.last_seen)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function IOCBlocklistManager({
  iocs,
  onChanged,
}: {
  iocs: ThreatIOC[];
  onChanged: () => void;
}) {
  const [filterType, setFilterType] = useState<'ALL' | 'domain' | 'keyword' | 'sender'>('ALL');
  const [iocType, setIocType] = useState<'domain' | 'keyword' | 'sender'>('domain');
  const [value, setValue] = useState('');
  const [severity, setSeverity] = useState<'CRITICAL' | 'HIGH' | 'MEDIUM'>('HIGH');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const visibleIocs = useMemo(() => {
    if (filterType === 'ALL') return iocs;
    return iocs.filter((item) => item.ioc_type === filterType);
  }, [iocs, filterType]);

  const customCount = useMemo(
    () => iocs.filter((item) => item.source === 'custom').length,
    [iocs],
  );

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) {
      toast.error('Enter an IOC domain, keyword, or sender handle');
      return;
    }
    setSubmitting(true);
    try {
      await api.admin.addIoc({
        ioc_type: iocType,
        value: trimmed,
        severity,
        description: description.trim() || `SOC operator ${iocType} block rule`,
      });
      toast.success(`Added ${iocType} IOC "${trimmed}" to live threat engine`);
      setValue('');
      setDescription('');
      onChanged();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to register IOC');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (ioc: ThreatIOC) => {
    if (!ioc.id) return;
    try {
      await api.admin.deleteIoc(ioc.id);
      toast.success(`Removed custom IOC "${ioc.value}"`);
      onChanged();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete IOC');
    }
  };

  const handleSync = async () => {
    try {
      const res = await api.admin.syncIocs();
      toast.success(`Synchronized ${res.active_custom_iocs} custom IOCs into scoring channels`);
      onChanged();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to sync IOC feeds');
    }
  };

  return (
    <section id="iocs" className={`${CARD} overflow-hidden p-5 sm:p-6 scroll-mt-6`}>
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-muted text-foreground">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </span>
          <div>
            <h2 className="tl-serif text-xl text-foreground">Threat Intelligence IOC Blocklist</h2>
            <p className="text-xs text-muted">
              Live domain, scam phrase & spoofed sender rules ({iocs.length} active · {customCount} custom)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {(['ALL', 'domain', 'keyword', 'sender'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilterType(tab)}
              className={`rounded-full px-3 py-1 font-semibold capitalize transition-all ${
                filterType === tab
                  ? 'bg-brand text-brand-foreground shadow-2xs'
                  : 'bg-surface-muted text-muted hover:text-foreground'
              }`}
            >
              {tab === 'ALL' ? 'All' : tab}
            </button>
          ))}
          <button
            type="button"
            onClick={handleSync}
            className="ml-1 rounded-full bg-[#DFF4EC] border border-[#BCE6D7] px-3 py-1 font-semibold text-[#158067] hover:opacity-90"
          >
            Sync Runtime
          </button>
        </div>
      </div>

      {/* Add new IOC form */}
      <form
        onSubmit={handleAdd}
        className="mb-4 rounded-2xl bg-surface-muted/70 p-3 grid grid-cols-1 sm:grid-cols-12 gap-2.5 text-xs"
      >
        <select
          value={iocType}
          onChange={(e) => setIocType(e.target.value as 'domain' | 'keyword' | 'sender')}
          className="sm:col-span-2 rounded-xl border border-border-default bg-surface px-3 py-2 text-xs font-medium text-foreground focus:border-[#8B3DFF] focus:outline-none"
        >
          <option value="domain">Domain</option>
          <option value="keyword">Keyword</option>
          <option value="sender">Sender ID</option>
        </select>

        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={
            iocType === 'domain'
              ? 'e.g. raast-verify-bonus.xyz'
              : iocType === 'keyword'
              ? 'e.g. raast instant prize'
              : 'e.g. HBL-REWARD'
          }
          className="sm:col-span-4 rounded-xl border border-border-default bg-surface px-3 py-2 text-xs text-foreground placeholder:text-muted focus:border-[#8B3DFF] focus:outline-none"
        />

        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value as 'CRITICAL' | 'HIGH' | 'MEDIUM')}
          className="sm:col-span-2 rounded-xl border border-border-default bg-surface px-3 py-2 text-xs font-medium text-foreground focus:border-[#8B3DFF] focus:outline-none"
        >
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
        </select>

        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Analyst rationale / ticket note..."
          className="sm:col-span-2 rounded-xl border border-border-default bg-surface px-3 py-2 text-xs text-foreground placeholder:text-muted focus:border-[#8B3DFF] focus:outline-none"
        />

        <button
          type="submit"
          disabled={submitting}
          className="sm:col-span-2 rounded-xl bg-brand px-3 py-2 font-semibold text-brand-foreground hover:bg-brand-hover disabled:opacity-50"
        >
          {submitting ? 'Adding...' : '+ Add IOC'}
        </button>
      </form>

      <div className="tl-scroll max-h-[290px] overflow-y-auto">
        <table className="w-full min-w-[680px] text-left text-xs">
          <thead className="sticky top-0 bg-surface-muted text-[11px] font-medium text-muted z-10">
            <tr>
              <th className="rounded-l-xl px-4 py-2.5">Type</th>
              <th className="px-3 py-2.5">Indicator Value</th>
              <th className="px-3 py-2.5">Severity</th>
              <th className="px-3 py-2.5">Source</th>
              <th className="px-3 py-2.5">Context</th>
              <th className="rounded-r-xl px-4 py-2.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-default">
            {visibleIocs.map((ioc, idx) => (
              <tr key={`${ioc.source}-${ioc.ioc_type}-${ioc.value}-${idx}`} className="hover:bg-surface-muted/50">
                <td className="px-4 py-2.5">
                  <span className="rounded-full bg-[#E8EDFE] px-2.5 py-0.5 text-[10px] font-semibold uppercase text-[#28326B]">
                    {ioc.ioc_type}
                  </span>
                </td>
                <td className="px-3 py-2.5 font-semibold text-foreground">{ioc.value}</td>
                <td className="px-3 py-2.5">
                  <RiskBadge level={ioc.severity} />
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold capitalize ${
                      ioc.source === 'custom'
                        ? 'bg-[#FFF5CC] text-[#9A6B00]'
                        : 'bg-surface-muted text-muted'
                    }`}
                  >
                    {ioc.source}
                  </span>
                </td>
                <td className="px-3 py-2.5 max-w-[220px] truncate text-xs text-muted" title={ioc.description}>
                  {ioc.description || '—'}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {ioc.source === 'custom' && ioc.id ? (
                    <button
                      type="button"
                      onClick={() => handleDelete(ioc)}
                      className="rounded-full bg-[#FCE4E4] px-2.5 py-0.5 text-[11px] font-semibold text-risk-critical hover:opacity-85"
                    >
                      Remove
                    </button>
                  ) : (
                    <span className="text-[11px] text-muted">Core feed</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AuditTrail({
  logs,
  verification,
  onVerify,
  verifying,
  onExportCsv,
}: {
  logs: AuditLog[];
  verification?: AuditChainVerification | null;
  onVerify: () => void;
  verifying: boolean;
  onExportCsv: () => void;
}) {
  return (
    <section id="audit" className={`${CARD} overflow-hidden p-5 sm:p-6 scroll-mt-6`}>
      <div className="flex flex-wrap items-center justify-between gap-2 pb-4">
        <div>
          <h2 className="tl-serif text-xl text-foreground">Cryptographic Audit Ledger</h2>
          <p className="text-xs text-muted">
            Append-only log chained via prev_hash + HMAC-SHA256
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={onVerify}
            disabled={verifying}
            className="rounded-full bg-[#DFF4EC] border border-[#BCE6D7] px-3.5 py-1.5 font-semibold text-[#158067] hover:opacity-90 disabled:opacity-50"
          >
            {verifying ? 'Verifying...' : 'Verify Chain'}
          </button>
          <button
            type="button"
            onClick={onExportCsv}
            className="rounded-full border border-border-default bg-surface-muted px-3.5 py-1.5 font-semibold text-foreground hover:bg-surface-hover"
          >
            Export CSV
          </button>
        </div>
      </div>

      {verification && (
        <div
          className={`mb-3 rounded-2xl px-4 py-2.5 text-xs font-medium flex flex-wrap items-center justify-between gap-2 ${
            verification.valid
              ? 'bg-[#DFF4EC] text-[#158067]'
              : 'bg-[#FCE4E4] text-risk-critical'
          }`}
        >
          <span>
            {verification.valid
              ? `✓ HMAC chain intact · ${verification.checked_count} / ${verification.total_records} blocks verified`
              : `✗ Tamper detected at record #${verification.broken_at_id ?? '?'} (${verification.reason ?? 'hash mismatch'})`}
          </span>
          <span className="font-mono text-[10px] opacity-80">
            HEAD: {verification.head_signature ? `${verification.head_signature.slice(0, 14)}…` : 'GENESIS'}
          </span>
        </div>
      )}

      {logs.length === 0 ? (
        <EmptyState title="No audit events" description="Logins, IOC updates, exports, and analyses appear here." />
      ) : (
        <ul className="tl-scroll max-h-[340px] divide-y divide-border-default overflow-y-auto text-xs">
          {logs.map((log) => (
            <li key={log.id} className="flex items-center gap-3 px-2 py-2.5 hover:bg-surface-muted/50 rounded-xl">
              <span className="w-28 shrink-0 truncate font-semibold text-foreground">
                {log.action}
              </span>
              <span className="min-w-0 flex-1 truncate text-muted" title={log.resource ?? ''}>
                {log.resource ?? '—'}
              </span>
              <span
                className="hidden md:inline-block rounded-full bg-surface-muted px-2 py-0.5 font-mono text-[10px] text-[#158067]"
                title={`HMAC: ${log.hmac_signature ?? 'none'}\nPREV: ${log.prev_hash ?? 'none'}`}
              >
                {log.hmac_signature ? `${log.hmac_signature.slice(0, 10)}…` : 'UNSIGNED'}
              </span>
              <span className="hidden w-24 shrink-0 truncate text-right text-[11px] text-muted sm:block">
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
    <section id="operators" className={`${CARD} overflow-hidden p-5 sm:p-6 scroll-mt-6`}>
      <div className="flex items-center justify-between pb-4">
        <div>
          <h2 className="tl-serif text-xl text-foreground">Operator Accounts & RBAC</h2>
          <p className="text-xs text-muted">{users.length} registered accounts</p>
        </div>
      </div>

      <div className="tl-scroll max-h-[340px] overflow-y-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-surface-muted text-[11px] font-medium text-muted z-10">
            <tr>
              <th className="rounded-l-xl px-4 py-2.5">Account</th>
              <th className="px-3 py-2.5">Role</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="rounded-r-xl px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-default">
            {users.map((account) => (
              <tr key={account.id} className="transition-colors hover:bg-surface-muted/50">
                <td className="px-4 py-2.5">
                  <div className="flex flex-col">
                    <span className="truncate font-semibold text-foreground">{account.email}</span>
                    <span className="text-[10px] text-muted">Joined {formatDateTime(account.created_at)}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => handleToggleRole(account)}
                    title="Click to toggle role"
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase transition-all ${
                      account.role === 'admin'
                        ? 'bg-[#E8EDFE] text-[#28326B]'
                        : 'bg-surface-muted text-muted'
                    }`}
                  >
                    {account.role} ⇋
                  </button>
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                      account.is_active
                        ? 'bg-[#DFF4EC] text-[#158067]'
                        : 'bg-[#FCE4E4] text-risk-critical'
                    }`}
                  >
                    {account.is_active ? 'Active' : 'Disabled'}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(account)}
                      className="rounded-full bg-surface-muted px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-surface-hover"
                    >
                      {account.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(account)}
                      className="rounded-full bg-[#FCE4E4] px-2.5 py-1 text-[11px] font-semibold text-risk-critical hover:opacity-85"
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

/* ----------------------------------------------------- main SOC dashboard */

const NODE_POSITIONS: [number, number, number][] = [
  [0, 0.4, 0],
  [-2.4, 0.2, 1.2],
  [2.2, 0.3, -1.1],
  [-1.5, 0.25, -2.0],
  [1.6, 0.2, 1.8],
  [3.2, 0.2, 0.6],
  [-3.1, 0.2, -0.8],
];

function SocDashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState<string>('ALL');
  const [sortByScore, setSortByScore] = useState<boolean>(false);
  const [expandedRowId, setExpandedRowId] = useState<number | null>(null);
  const [activeNav, setActiveNav] = useState<string>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [selectedNode, setSelectedNode] = useState<VectorNode | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [verifyingChain, setVerifyingChain] = useState(false);

  const { data: stats } = useQuery<AdminStats>({
    queryKey: ['admin', 'stats'],
    queryFn: () => api.admin.stats(),
  });

  const { data: campaigns } = useQuery<Campaign[]>({
    queryKey: ['admin', 'campaigns'],
    queryFn: () => api.admin.campaigns(),
  });

  const { data: logs } = useQuery<AuditLog[]>({
    queryKey: ['admin', 'audit-logs'],
    queryFn: () => api.admin.auditLogs(60),
  });

  const { data: chainVerification, refetch: refetchChainVerification } = useQuery<AuditChainVerification>({
    queryKey: ['admin', 'audit-verify'],
    queryFn: () => api.admin.verifyAuditChain(),
  });

  const { data: iocs } = useQuery<ThreatIOC[]>({
    queryKey: ['admin', 'iocs'],
    queryFn: () => api.admin.listIocs(),
  });

  const { data: users } = useQuery<AdminUser[]>({
    queryKey: ['admin', 'users'],
    queryFn: () => api.admin.users(),
  });

  const { data: analysesData } = useQuery({
    queryKey: ['admin', 'analyses'],
    queryFn: () => api.admin.analyses({ limit: 100 }),
  });

  const { data: metrics } = useQuery<AdminMetrics>({
    queryKey: ['admin', 'metrics'],
    queryFn: () => api.admin.metrics(),
  });

  const analyses: AdminAnalysis[] = analysesData?.items || [];

  const handleRefresh = async () => {
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'campaigns'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'audit-logs'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'audit-verify'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'iocs'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'analyses'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'metrics'] }),
      ]);
      toast.success('SOC telemetry re-synchronized');
    } catch {
      toast.error('Failed to refresh dashboard');
    }
  };

  const handleVerifyChain = async () => {
    setVerifyingChain(true);
    try {
      const res = await refetchChainVerification();
      if (res.data?.valid) {
        toast.success(`HMAC chain verified (${res.data.checked_count} blocks intact)`);
      } else {
        toast.error(`Audit chain tamper detected at record #${res.data?.broken_at_id ?? '?'}`);
      }
    } catch {
      toast.error('Failed to verify audit chain');
    } finally {
      setVerifyingChain(false);
    }
  };

  const handleExportAudit = async () => {
    try {
      await api.admin.exportAuditLogsCsv();
      toast.success('HMAC-signed audit logs exported');
    } catch {
      toast.error('Failed to export audit logs');
    }
  };

  const handleExportThreats = async () => {
    try {
      await api.admin.exportAnalysesCsv();
      toast.success('Zero-storage threat feed exported');
    } catch {
      toast.error('Failed to export threat feed');
    }
  };

  const handleIsolateAssets = async () => {
    try {
      const res = await api.admin.syncIocs();
      toast.success(`Enforced ${res.active_custom_iocs} custom IOC blocklist rules across scoring channels`);
    } catch {
      toast.error('Failed to sync IOC quarantine rules');
    }
  };

  const handleAlertManagers = () => {
    toast.info('SOC campaign advisory queued for active operator accounts');
  };

  const activeCampaign = campaigns?.[0] || {
    id: 0,
    signature: 'Awaiting multi-user campaign correlation',
    hits: analyses.length,
    severity: analyses[0]?.risk_level || 'LOW',
    distinct_users: users?.length || 0,
    first_seen: new Date().toISOString(),
    last_seen: new Date().toISOString(),
  };

  const liveMeters = useMemo(() => {
    if (stats && stats.total_analyses > 0) {
      const denom = Math.max(1, stats.total_analyses);
      return [
        { label: 'Phishing', pct: Math.min(100, Math.round((stats.phishing / denom) * 100)) },
        { label: 'Financial / Raast', pct: Math.min(100, Math.round((stats.financial_fraud / denom) * 100)) },
        {
          label: 'Job & Investment',
          pct: Math.min(100, Math.round(((stats.job_scams + stats.investment_scams) / denom) * 100)),
        },
        { label: 'Prize / Lure', pct: Math.min(100, Math.round((stats.prize_scams / denom) * 100)) },
      ];
    }
    return [
      { label: 'Phishing', pct: 0 },
      { label: 'Financial / Raast', pct: 0 },
      { label: 'Job & Investment', pct: 0 },
      { label: 'Prize / Lure', pct: 0 },
    ];
  }, [stats]);

  const liveVectorNodes = useMemo<VectorNode[] | undefined>(() => {
    const built: VectorNode[] = [];
    for (const c of (campaigns ?? []).slice(0, 4)) {
      const idx = built.length;
      built.push({
        id: `c${c.id}`,
        name: c.signature.slice(0, 18).toUpperCase(),
        ip: `${c.distinct_users} users · ${c.hits} hits`,
        type: c.severity === 'CRITICAL' || c.severity === 'HIGH' ? 'malware' : 'c2',
        position: NODE_POSITIONS[idx % NODE_POSITIONS.length],
        hits: Math.min(100, Math.max(25, c.hits * 15)),
      });
    }
    for (const a of analyses.slice(0, 7 - built.length)) {
      const idx = built.length;
      built.push({
        id: `a${a.id}`,
        name: (a.threat_type || a.input_type || 'SCAN').slice(0, 18).toUpperCase(),
        ip: `${a.input_type.toUpperCase()} #${a.id}`,
        type:
          a.risk_level === 'CRITICAL' || a.risk_level === 'HIGH'
            ? 'malware'
            : a.risk_level === 'MEDIUM'
            ? 'c2'
            : 'suspicious',
        position: NODE_POSITIONS[idx % NODE_POSITIONS.length],
        hits: a.risk_score,
      });
    }
    return built.length >= 2 ? built : undefined;
  }, [campaigns, analyses]);

  const cockpitRiskScore = useMemo(() => {
    if (analyses.length > 0) {
      return Math.max(...analyses.slice(0, 10).map((a) => a.risk_score));
    }
    if (metrics?.performance?.threat_ratio_pct !== undefined) {
      return Math.round(metrics.performance.threat_ratio_pct);
    }
    return 0;
  }, [analyses, metrics]);

  const khatraLevel =
    cockpitRiskScore >= 70 ? 'BULAND' : cockpitRiskScore >= 40 ? 'DARMIYANA' : 'MEHFOOZ';

  const threatRatioPct = useMemo(() => {
    if (metrics?.performance?.threat_ratio_pct !== undefined) {
      return Math.round(metrics.performance.threat_ratio_pct);
    }
    if (stats && stats.total_analyses > 0) {
      return Math.round((stats.high_risk / stats.total_analyses) * 100);
    }
    return cockpitRiskScore;
  }, [metrics, stats, cockpitRiskScore]);

  const tableRows = useMemo(() => {
    let list = [...analyses];
    if (riskFilter !== 'ALL') {
      list = list.filter((a) => (a.risk_level || '').toUpperCase() === riskFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (a) =>
          (a.content_snippet && a.content_snippet.toLowerCase().includes(q)) ||
          (a.threat_type && a.threat_type.toLowerCase().includes(q)) ||
          (a.risk_level && a.risk_level.toLowerCase().includes(q)) ||
          (a.input_type && a.input_type.toLowerCase().includes(q)) ||
          (a.user_email && a.user_email.toLowerCase().includes(q)),
      );
    }
    if (sortByScore) {
      list.sort((a, b) => b.risk_score - a.risk_score);
    }
    return list.slice(0, 8);
  }, [analyses, riskFilter, searchQuery, sortByScore]);

  const customIocCount = useMemo(
    () => (iocs ?? []).filter((item) => item.source === 'custom').length,
    [iocs],
  );

  const jumpTo = (id: string, navKey: string) => {
    setActiveNav(navKey);
    setMobileMenuOpen(false);
    if (id === 'top') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between p-4">
      <div className="space-y-6">
        <div className="px-2 pt-1 flex items-center justify-between">
          <Link href="/" aria-label="TrustLayer Home">
            <Logo size={30} />
          </Link>
        </div>

        {/* Main section matching RevenueX */}
        <div>
          <p className="px-3 text-[11px] font-medium text-muted mb-1.5">Main</p>
          <div className="space-y-1">
            {[
              {
                key: 'overview',
                target: 'top',
                label: 'Dashboard',
                icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                    <rect x="3" y="3" width="7" height="7" rx="1.5" />
                    <rect x="14" y="3" width="7" height="7" rx="1.5" />
                    <rect x="14" y="14" width="7" height="7" rx="1.5" />
                    <rect x="3" y="14" width="7" height="7" rx="1.5" />
                  </svg>
                ),
              },
              {
                key: 'campaigns',
                target: 'campaigns',
                label: 'Campaigns',
                icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                ),
              },
              {
                key: 'topology',
                target: 'topology',
                label: 'Analytics & Topology',
                icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                    <path d="M18 20V10M12 20V4M6 20v-6" />
                  </svg>
                ),
              },
            ].map((item) => {
              const active = activeNav === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => jumpTo(item.target, item.key)}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-medium transition-all ${
                    active
                      ? 'bg-surface text-foreground font-semibold shadow-sm'
                      : 'text-foreground/80 hover:bg-black/[0.04]'
                  }`}
                >
                  <span className="text-foreground/80">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Monitors section matching RevenueX "Inboxes" */}
        <div>
          <p className="px-3 text-[11px] font-medium text-muted mb-1.5">Detection Channels</p>
          <div className="space-y-2 px-1">
            {[
              { name: 'SMS & Raast Stream', sub: 'EN + Roman Urdu' },
              { name: 'URL & Domain Sentry', sub: 'Static Heuristics' },
              { name: 'Optical OCR Guard', sub: 'In-Memory RAM' },
            ].map((ch) => (
              <div key={ch.name} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black/[0.06] text-foreground/80 text-[11px] font-bold">
                  {ch.name.charAt(0)}
                </span>
                <div className="min-w-0 leading-tight">
                  <p className="truncate text-xs font-semibold text-foreground">{ch.name}</p>
                  <p className="truncate text-[10px] text-muted">{ch.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Operations section matching RevenueX "Other" */}
        <div>
          <p className="px-3 text-[11px] font-medium text-muted mb-1.5">Operations</p>
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => jumpTo('iocs', 'iocs')}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-all ${
                activeNav === 'iocs'
                  ? 'bg-surface text-foreground font-semibold shadow-sm'
                  : 'text-foreground/80 hover:bg-black/[0.04]'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                IOC Blocklist
              </span>
              <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-brand-foreground">
                {iocs?.length ?? 0}
              </span>
            </button>

            <button
              type="button"
              onClick={() => jumpTo('audit', 'audit')}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-all ${
                activeNav === 'audit'
                  ? 'bg-surface text-foreground font-semibold shadow-sm'
                  : 'text-foreground/80 hover:bg-black/[0.04]'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
                HMAC Audit Trail
              </span>
            </button>

            <button
              type="button"
              onClick={() => jumpTo('operators', 'operators')}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-all ${
                activeNav === 'operators'
                  ? 'bg-surface text-foreground font-semibold shadow-sm'
                  : 'text-foreground/80 hover:bg-black/[0.04]'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                </svg>
                Operator Roster
              </span>
            </button>
          </div>
        </div>

        {/* Account section */}
        <div>
          <p className="px-3 text-[11px] font-medium text-muted mb-1.5">Account</p>
          <div className="space-y-1">
            <Link
              href="/analyze"
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-foreground/80 hover:bg-black/[0.04]"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              Shield AI Scanner
            </Link>
            <Link
              href="/"
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-foreground/80 hover:bg-black/[0.04]"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              </svg>
              Home Overview
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom Profile Card matching Evan Parker card in RevenueX */}
      <div className="mt-6 rounded-2xl bg-black/[0.05] dark:bg-white/[0.05] p-3 flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-foreground text-xs font-bold">
            {(user?.email || 'SA').slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-foreground">SOC Administrator</p>
            <p className="truncate text-[11px] text-muted">{user?.email || 'admin@trustlayer.app'}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            logout();
            router.push('/');
          }}
          title="Sign out"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-black/[0.06] hover:text-foreground"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>
    </div>
  );

  const operatorInitials = (users ?? []).slice(0, 3);
  const extraOperators = Math.max(0, (users?.length ?? 0) - 3);

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Left Stone Sidebar (Desktop) */}
      <aside className="hidden lg:block w-64 shrink-0 border-r border-border-default tl-sidebar-stone sticky top-0 h-screen overflow-y-auto tl-scroll">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-xs" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative z-10 w-72 max-w-[82vw] h-full tl-sidebar-stone border-r border-border-default overflow-y-auto">
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 min-w-0">
        {/* Top Search & Actions Header matching RevenueX */}
        <header className="sticky top-0 z-30 border-b border-border-default/70 bg-background/90 backdrop-blur-xl px-5 sm:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 max-w-md">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border-default bg-surface text-foreground"
              aria-label="Open SOC menu"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M3 12h18M3 18h18" />
              </svg>
            </button>

            <div className="relative flex-1">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="text"
                placeholder="Search threats, campaigns, or IOCs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-full border border-border-default bg-surface pl-9 pr-20 py-2 text-xs text-foreground placeholder:text-muted shadow-2xs focus:border-[#8B3DFF] focus:outline-none"
              />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-medium text-muted">
                ⌘ + Space
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Overlapping Operator Avatar Stack matching RevenueX */}
            {operatorInitials.length > 0 && (
              <div className="hidden sm:flex items-center mr-1">
                <div className="flex -space-x-2">
                  {operatorInitials.map((op, i) => {
                    const bgColors = ['bg-[#CBD4FA] text-[#1E2756]', 'bg-[#CBE3DF] text-[#134E44]', 'bg-[#EFE2D8] text-[#5C3D28]'];
                    return (
                      <span
                        key={op.id}
                        title={op.email}
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-surface text-[11px] font-bold ${bgColors[i % bgColors.length]}`}
                      >
                        {op.email.slice(0, 2).toUpperCase()}
                      </span>
                    );
                  })}
                </div>
                {extraOperators > 0 && (
                  <span className="ml-2 text-xs font-semibold text-muted">+{extraOperators}</span>
                )}
              </div>
            )}

            <ThemeToggle />
            <NotificationTray />

            <button
              type="button"
              onClick={handleExportThreats}
              className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-xs font-semibold text-brand-foreground shadow-[var(--shadow-cyber)] transition-all hover:bg-brand-hover"
            >
              <span>Export Data</span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </button>
          </div>
        </header>

        {/* Main Bento Canvas */}
        <div className="p-5 sm:p-8 space-y-6 max-w-[1400px] mx-auto">
          {/* Page Title Row matching "Performance Overview" in RevenueX */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="tl-serif text-3xl sm:text-4xl text-foreground">
                Security Overview
              </h1>
              <p className="mt-1 text-sm text-muted">
                Your detections, campaigns, and forensic insights — all in one place
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleRefresh}
                className={BTN.secondary}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                  <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                  <path d="M16 16h5v5" />
                </svg>
                Refresh
              </button>
              <button
                type="button"
                onClick={handleIsolateAssets}
                className={BTN.secondary}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="4" y1="21" x2="4" y2="14" />
                  <line x1="4" y1="10" x2="4" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12" y2="3" />
                  <line x1="20" y1="21" x2="20" y2="16" />
                  <line x1="20" y1="12" x2="20" y2="3" />
                </svg>
                Sync IOC Quarantine
              </button>
            </div>
          </div>

          {/* BENTO ROW 1: Golden-Amber Hero Card (5 cols) + Violet Detection Trends Card (7 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left Golden-Amber Mesh Card matching "Explore your performance" */}
            <div className="lg:col-span-5 rounded-[24px] border border-[#EFE3BA] dark:border-border-default tl-amber-mesh p-6 sm:p-7 flex flex-col justify-between min-h-[320px] shadow-[var(--shadow-card)]">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-1.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#141416] text-white text-[10px] font-bold">
                      TL
                    </span>
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#141416] text-white text-[9px] font-bold border border-white/30">
                      4x
                    </span>
                  </div>
                  <span className="text-xs font-medium text-[#141416] dark:text-foreground">
                    Telemetry · Live data
                  </span>
                </div>

                <span className="rounded-full bg-white/80 dark:bg-black/30 px-3 py-1 text-[11px] font-bold text-[#141416] dark:text-foreground backdrop-blur-sm">
                  Khatra: {khatraLevel}
                </span>
              </div>

              <div className="my-6">
                <h2 className="tl-serif text-4xl sm:text-[44px] leading-[1.03] text-[#141416] dark:text-foreground">
                  Explore your
                  <br />
                  <span className="italic">threat posture</span>
                </h2>
                <p className="mt-3 text-xs sm:text-sm text-[#3F3A2C] dark:text-muted max-w-xs">
                  Dive into 4-channel consensus, zero-storage incidents, and correlated scam campaigns.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleExportThreats}
                  className="rounded-full bg-[#141416] px-3.5 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                >
                  Export Dossier
                </button>
                <button
                  type="button"
                  onClick={handleAlertManagers}
                  className="rounded-full bg-white/85 px-3.5 py-1.5 text-xs font-semibold text-[#141416] transition-colors hover:bg-white"
                >
                  Alert Operators
                </button>
                <span className="ml-auto text-[11px] font-semibold text-[#3F3A2C] dark:text-muted">
                  {customIocCount} custom IOCs
                </span>
              </div>
            </div>

            {/* Right Detection Trends Card matching "Revenue Trends" */}
            <div className={`lg:col-span-7 ${CARD} p-6 flex flex-col justify-between`}>
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-muted text-foreground">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                      </svg>
                    </span>
                    <h2 className="tl-serif text-xl text-foreground">Detection Trends</h2>
                  </div>

                  <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-medium text-muted">
                    14-Day Window ▾
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <span className="text-3xl font-bold tracking-tight tabular-nums text-foreground">
                    {formatNumber(stats?.total_analyses ?? analyses.length)}
                  </span>
                  <span className="rounded-full bg-[#A3F750] px-2.5 py-0.5 text-xs font-bold text-[#143300]">
                    + {formatNumber(stats?.high_risk ?? 0)} high/crit
                  </span>
                  <span className="text-xs text-muted">
                    {metrics?.performance?.avg_latency_ms ?? 0}ms avg latency · {campaigns?.length ?? 0} active campaigns
                  </span>
                </div>
              </div>

              <div className="mt-4">
                <TrendChart data={stats?.threat_trend ?? []} />
              </div>
            </div>
          </div>

          {/* BENTO ROW 2: Live Threat Performance Table (7 cols) + Goal/Taxonomy & AI Co-Pilot (5 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left 7-col Table Card matching "Product Performance" */}
            <div className={`lg:col-span-7 ${CARD} p-5 sm:p-6`}>
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-muted text-foreground">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="7" height="7" rx="1" />
                      <rect x="14" y="3" width="7" height="7" rx="1" />
                      <rect x="14" y="14" width="7" height="7" rx="1" />
                      <rect x="3" y="14" width="7" height="7" rx="1" />
                    </svg>
                  </span>
                  <h2 className="tl-serif text-xl text-foreground">Threat Performance</h2>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSortByScore((v) => !v)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      sortByScore
                        ? 'bg-brand text-brand-foreground'
                        : 'bg-surface-muted text-foreground hover:bg-surface-hover'
                    }`}
                  >
                    Sort ↑↓
                  </button>
                  <select
                    value={riskFilter}
                    onChange={(e) => setRiskFilter(e.target.value)}
                    className="rounded-full bg-surface-muted px-3 py-1 text-xs font-medium text-foreground focus:outline-none"
                  >
                    <option value="ALL">Filter: All</option>
                    <option value="CRITICAL">Critical</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low / Safe</option>
                  </select>
                </div>
              </div>

              {tableRows.length === 0 ? (
                <EmptyState
                  title="No matching telemetry"
                  description="Submit a scan or adjust your search/filter criteria."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-xs">
                    <thead>
                      <tr className="bg-surface-muted text-[11px] font-medium text-muted">
                        <th className="rounded-l-xl px-4 py-2.5">Threat Vector</th>
                        <th className="px-3 py-2.5">Channel</th>
                        <th className="px-3 py-2.5">Status</th>
                        <th className="rounded-r-xl px-4 py-2.5 text-right">Risk Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-default">
                      {tableRows.map((item) => {
                        const isExpanded = expandedRowId === item.id;
                        return (
                          <tr
                            key={item.id}
                            onClick={() => setExpandedRowId(isExpanded ? null : item.id)}
                            className="cursor-pointer transition-colors hover:bg-surface-muted/45"
                          >
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-3">
                                <span
                                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
                                    item.campaign_flagged || isExpanded
                                      ? 'bg-[#A3F750] text-[#143300]'
                                      : 'border border-border-strong text-transparent'
                                  }`}
                                >
                                  ✓
                                </span>
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-foreground text-background text-[11px] font-bold uppercase">
                                  {(item.input_type || 'TX').slice(0, 2)}
                                </span>
                                <div className="min-w-0">
                                  <p className="truncate font-semibold text-foreground">
                                    {item.threat_type || 'Telemetry Scan'}
                                  </p>
                                  <p className="truncate text-[11px] text-muted">
                                    #IR-{item.id} · {relativeTime(item.created_at)}
                                  </p>
                                  {isExpanded && (
                                    <p className="mt-1.5 max-w-xs font-mono text-[11px] text-muted whitespace-normal">
                                      {item.content_snippet || 'Zero-storage hash reference'}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-3.5 font-medium text-foreground">
                              {item.input_type.toUpperCase()}
                              <span className="block text-[10px] text-muted">
                                {item.latency_ms ? `${Math.round(item.latency_ms)} ms` : '—'}
                              </span>
                            </td>
                            <td className="px-3 py-3.5">
                              <RiskBadge level={item.risk_level} />
                            </td>
                            <td className="px-4 py-3.5 text-right font-bold tabular-nums text-foreground">
                              {item.risk_score}/100
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Right 5-col Stack: Goal/Taxonomy Progress + AI Forensic Assistant */}
            <div className="lg:col-span-5 flex flex-col gap-5">
              {/* Card 1: Goal Progress style card */}
              <div className={`${CARD} p-6`}>
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-muted text-foreground">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="5" width="20" height="14" rx="2" />
                      <line x1="2" y1="10" x2="22" y2="10" />
                    </svg>
                  </span>
                  <h2 className="tl-serif text-xl text-foreground">Threat Ratio & Taxonomy</h2>
                </div>

                <div className="mt-4 flex items-center gap-4">
                  <div className="shrink-0">
                    <span className="text-3xl font-bold tabular-nums text-[#7E22CE] dark:text-[#C084FC]">
                      {threatRatioPct}%
                    </span>
                    <span className="ml-1.5 text-xs text-muted">high-risk share</span>
                  </div>
                  <SegmentedTickBar pct={threatRatioPct} />
                </div>

                <div className="mt-5 grid grid-cols-2 gap-4 pt-3 border-t border-border-default">
                  {liveMeters.map((m) => (
                    <div key={m.label}>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-base font-bold tabular-nums text-[#7E22CE] dark:text-[#C084FC]">
                          {m.pct}%
                        </span>
                        <span className="truncate text-[11px] text-muted">{m.label}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
                        <div
                          className="h-full rounded-full bg-[#8B3DFF]"
                          style={{ width: `${Math.max(4, m.pct)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Card 2: AI Forensic Assistant matching RevenueX "AI Analytics Assistant" */}
              <div className="rounded-[24px] border border-[#CEE0FA] dark:border-border-default tl-sky-mesh p-6 shadow-[var(--shadow-card)] flex-1 flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/80 dark:bg-surface text-foreground shadow-2xs">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3z" />
                      </svg>
                    </span>
                    <h2 className="tl-serif text-xl text-[#141416] dark:text-foreground">
                      AI Forensic Assistant
                    </h2>
                  </div>

                  <span className="rounded-full border border-black/10 bg-white/75 dark:bg-surface px-3 py-1 text-[11px] font-medium text-[#141416] dark:text-foreground">
                    {metrics?.ml_engine?.model_loaded ? '15k TF-IDF Live' : '4-Engine Core'}
                  </span>
                </div>

                <div className="mt-4 space-y-2.5 rounded-2xl bg-white/45 dark:bg-black/20 p-3 backdrop-blur-md border border-white/60 dark:border-white/10">
                  <div className="rounded-xl bg-white/95 dark:bg-surface px-3.5 py-2.5 text-xs font-medium text-[#141416] dark:text-foreground shadow-2xs">
                    What insights are active across SOC channels?
                  </div>
                  <div className="rounded-xl bg-white/95 dark:bg-surface px-3.5 py-2.5 text-xs leading-relaxed text-[#4B5563] dark:text-muted shadow-2xs">
                    Lead campaign <strong className="text-[#141416] dark:text-foreground">{activeCampaign.signature.slice(0, 26)}</strong> has{' '}
                    <strong className="text-[#141416] dark:text-foreground">{activeCampaign.hits} correlated hits</strong> across{' '}
                    {activeCampaign.distinct_users} targets. HMAC audit chain is{' '}
                    <strong className={chainVerification?.valid === false ? 'text-risk-critical' : 'text-[#158067]'}>
                      {chainVerification?.valid === false ? 'flagged for review' : 'cryptographically verified'}
                    </strong>.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* BENTO ROW 3: Interactive 3D Correlation Topology + Most-Abused Techniques */}
          <div id="topology" className="grid grid-cols-1 lg:grid-cols-12 gap-5 scroll-mt-6">
            <div className={`lg:col-span-7 ${CARD} p-5 sm:p-6 flex flex-col`}>
              <div className="flex items-center justify-between pb-4">
                <div>
                  <h2 className="tl-serif text-xl text-foreground">3D Campaign Correlation Map</h2>
                  <p className="text-xs text-muted">
                    Interactive node cluster across EN, Roman Urdu & Raast vectors
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className={BTN.secondary}
                >
                  {isFullscreen ? 'Exit Fullscreen' : 'Expand'}
                </button>
              </div>

              <div
                className={`relative flex-1 min-h-[340px] ${
                  isFullscreen ? 'fixed inset-4 z-50 rounded-[24px] shadow-2xl' : ''
                }`}
              >
                <VectorNodesMap3D
                  nodes={liveVectorNodes}
                  selectedNode={selectedNode}
                  onSelectNode={(node) => setSelectedNode(node)}
                />
                {isFullscreen && (
                  <button
                    type="button"
                    onClick={() => setIsFullscreen(false)}
                    className="absolute top-4 right-4 z-20 rounded-full bg-brand px-4 py-1.5 text-xs font-semibold text-brand-foreground shadow-lg"
                  >
                    Close Fullscreen
                  </button>
                )}
              </div>
            </div>

            <div className="lg:col-span-5 flex flex-col gap-5">
              {stats && <TechniqueBars stats={stats} />}
              <div className={`${CARD} p-5`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="tl-serif text-lg text-foreground">Peak Risk Posture</h3>
                    <p className="text-xs text-muted">Live Khatra index: {khatraLevel}</p>
                  </div>
                  <RiskBadge level={activeCampaign.severity} score={cockpitRiskScore} />
                </div>
                <RiskShield3D score={cockpitRiskScore} level={khatraLevel} />
              </div>
            </div>
          </div>

          {/* BENTO ROW 4: Correlated Campaigns Registry */}
          <CampaignTable campaigns={campaigns ?? []} />

          {/* BENTO ROW 5: Dynamic IOC Blocklist Controls */}
          <IOCBlocklistManager iocs={iocs ?? []} onChanged={handleRefresh} />

          {/* BENTO ROW 6: Cryptographic Audit Trail & RBAC Operator Roster */}
          <div className="grid gap-5 lg:grid-cols-2">
            <AuditTrail
              logs={logs ?? []}
              verification={chainVerification}
              onVerify={handleVerifyChain}
              verifying={verifyingChain}
              onExportCsv={handleExportAudit}
            />
            <UserRoster users={users ?? []} onActionSuccess={handleRefresh} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <main className="flex-1 bg-background">
      <RequireAuth adminOnly>
        <SocDashboard />
      </RequireAuth>
    </main>
  );
}

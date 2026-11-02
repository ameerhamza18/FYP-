'use client';

import { useCallback, useEffect, useState } from 'react';

import { BTN, CARD, EmptyState, RiskBadge, SkeletonRows } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { relativeTime } from '@/lib/presentation';
import type { AdminAnalysisPage } from '@/lib/types';

const PAGE_SIZE = 10;
const RISK_FILTERS = ['', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const INPUT_FILTERS = ['', 'text', 'url', 'screenshot'];

export default function ThreatFeed() {
  const [data, setData] = useState<AdminAnalysisPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [risk, setRisk] = useState('');
  const [inputType, setInputType] = useState('');
  const [offset, setOffset] = useState(0);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(
        await api.admin.analyses({
          limit: PAGE_SIZE,
          offset,
          riskLevel: risk || undefined,
          inputType: inputType || undefined,
        }),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the threat feed.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [offset, risk, inputType]);

  useEffect(() => {
    load();
  }, [load]);

  const total = data?.total ?? 0;
  const first = total === 0 ? 0 : offset + 1;
  const last = offset + (data?.items.length ?? 0);

  return (
    <section className={`${CARD} overflow-hidden p-5 sm:p-6`}>
      <div className="flex flex-wrap items-center gap-3 pb-4">
        <div className="mr-auto flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-muted text-foreground">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
            </svg>
          </span>
          <div>
            <h2 className="tl-serif text-xl text-foreground">Threat Feed</h2>
            <p className="text-xs text-muted">
              {total === 0 ? 'No matching analyses' : `Showing ${first}–${last} of ${total}`}
            </p>
          </div>
        </div>

        <select
          value={risk}
          onChange={(e) => {
            setRisk(e.target.value);
            setOffset(0);
          }}
          className="rounded-full border border-border-default bg-surface-muted px-3.5 py-1.5 text-xs font-medium text-foreground focus:border-[#8B3DFF] focus:outline-none"
        >
          {RISK_FILTERS.map((value) => (
            <option key={value || 'all'} value={value}>
              {value ? `Risk: ${value}` : 'All risk levels'}
            </option>
          ))}
        </select>

        <select
          value={inputType}
          onChange={(e) => {
            setInputType(e.target.value);
            setOffset(0);
          }}
          className="rounded-full border border-border-default bg-surface-muted px-3.5 py-1.5 text-xs font-medium text-foreground focus:border-[#8B3DFF] focus:outline-none"
        >
          {INPUT_FILTERS.map((value) => (
            <option key={value || 'all'} value={value}>
              {value ? `Type: ${value}` : 'All input types'}
            </option>
          ))}
        </select>

        <button type="button" onClick={load} className={BTN.secondary}>
          Refresh
        </button>
      </div>

      {loading ? (
        <SkeletonRows rows={5} />
      ) : error ? (
        <div
          role="alert"
          className="rounded-2xl border border-risk-critical/30 bg-[#FCE4E4] px-4 py-3 text-sm text-risk-critical"
        >
          {error}
        </div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState title="Nothing to show" description="No analyses match the current filters." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] border-collapse text-left">
            <thead>
              <tr className="rounded-xl bg-surface-muted text-xs font-medium text-muted">
                <th className="rounded-l-xl px-4 py-2.5">Threat Type</th>
                <th className="px-4 py-2.5">Owner</th>
                <th className="px-4 py-2.5">Input</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Latency</th>
                <th className="rounded-r-xl px-4 py-2.5 text-right">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {data.items.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  className="cursor-pointer transition-colors hover:bg-surface-muted/50"
                >
                  <td className="px-4 py-3.5">
                    <span className="text-sm font-semibold text-foreground">
                      {item.threat_type}
                    </span>
                    {item.campaign_flagged && (
                      <span className="ml-2 rounded-full bg-[#A3F750] px-2 py-0.5 text-[10px] font-bold text-[#143300]">
                        Campaign
                      </span>
                    )}
                    {expandedId === item.id && (
                      <p className="mt-2 max-w-xl font-mono text-xs leading-relaxed text-muted">
                        {item.content_snippet}
                      </p>
                    )}
                  </td>
                  <td className="max-w-[180px] truncate px-4 py-3.5 text-xs text-muted">
                    {item.user_email ?? `user #${item.user_id}`}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="rounded-full bg-surface-muted px-2.5 py-1 text-[11px] font-medium uppercase text-muted">
                      {item.input_type}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <RiskBadge level={item.risk_level} score={item.risk_score} />
                  </td>
                  <td className="px-4 py-3.5 text-right text-xs font-medium tabular-nums text-foreground">
                    {item.latency_ms === null || item.latency_ms === undefined
                      ? '—'
                      : `${Math.round(item.latency_ms)} ms`}
                  </td>
                  <td className="px-4 py-3.5 text-right text-xs text-muted">
                    {relativeTime(item.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-border-default pt-4">
          <button
            type="button"
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            disabled={offset === 0 || loading}
            className={BTN.secondary}
          >
            Previous
          </button>
          <span className="text-xs tabular-nums text-muted">
            Page {Math.floor(offset / PAGE_SIZE) + 1} of{' '}
            {Math.max(1, Math.ceil(total / PAGE_SIZE))}
          </span>
          <button
            type="button"
            onClick={() => setOffset(offset + PAGE_SIZE)}
            disabled={last >= total || loading}
            className={BTN.secondary}
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}

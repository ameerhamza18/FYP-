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
    <section className={`${CARD} overflow-hidden`}>
      <div className="flex flex-wrap items-center gap-3 border-b border-border-default p-5">
        <div className="mr-auto">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted">Threat feed</h2>
          <p className="mt-0.5 text-xs text-muted">
            {total === 0 ? 'No matching analyses' : `Showing ${first}–${last} of ${total}`}
          </p>
        </div>

        <label className="flex items-center gap-2 text-xs text-muted">
          Risk
          <select
            value={risk}
            onChange={(e) => {
              setRisk(e.target.value);
              setOffset(0);
            }}
            className="rounded-lg border border-border-default bg-background px-2.5 py-1.5 text-xs text-foreground focus:border-brand focus:outline-none"
          >
            {RISK_FILTERS.map((value) => (
              <option key={value || 'all'} value={value}>
                {value || 'All levels'}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-xs text-muted">
          Input
          <select
            value={inputType}
            onChange={(e) => {
              setInputType(e.target.value);
              setOffset(0);
            }}
            className="rounded-lg border border-border-default bg-background px-2.5 py-1.5 text-xs text-foreground focus:border-brand focus:outline-none"
          >
            {INPUT_FILTERS.map((value) => (
              <option key={value || 'all'} value={value}>
                {value || 'All types'}
              </option>
            ))}
          </select>
        </label>

        <button type="button" onClick={load} className={BTN.ghost}>
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="p-5">
          <SkeletonRows rows={5} />
        </div>
      ) : error ? (
        <div className="p-5">
          <div
            role="alert"
            className="rounded-xl border border-risk-critical/30 bg-risk-critical/10 px-4 py-3 text-sm text-risk-critical"
          >
            {error}
          </div>
        </div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState title="Nothing to show" description="No analyses match the current filters." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead className="bg-background-subtle text-[11px] uppercase tracking-wider text-muted">
              <tr>
                <th className="px-5 py-3 font-semibold">Risk</th>
                <th className="px-5 py-3 font-semibold">Threat type</th>
                <th className="px-5 py-3 font-semibold">Owner</th>
                <th className="px-5 py-3 font-semibold">Input</th>
                <th className="px-5 py-3 text-right font-semibold">Latency</th>
                <th className="px-5 py-3 text-right font-semibold">When</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  className="cursor-pointer border-t border-border-default transition-colors hover:bg-background-subtle"
                >
                  <td className="px-5 py-3.5">
                    <RiskBadge level={item.risk_level} score={item.risk_score} />
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-sm font-semibold text-foreground">
                      {item.threat_type}
                    </span>
                    {item.campaign_flagged && (
                      <span className="ml-2 rounded bg-brand/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-brand">
                        campaign
                      </span>
                    )}
                    {expandedId === item.id && (
                      <p className="mt-2 max-w-xl font-mono text-xs leading-relaxed text-muted">
                        {item.content_snippet}
                      </p>
                    )}
                  </td>
                  <td className="max-w-[180px] truncate px-5 py-3.5 text-xs text-muted">
                    {item.user_email ?? `user #${item.user_id}`}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="rounded-md border border-border-default bg-surface-muted px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted">
                      {item.input_type}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right text-xs tabular-nums text-muted">
                    {item.latency_ms === null || item.latency_ms === undefined
                      ? '—'
                      : `${Math.round(item.latency_ms)} ms`}
                  </td>
                  <td className="px-5 py-3.5 text-right text-xs text-muted">
                    {relativeTime(item.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between gap-3 border-t border-border-default p-4">
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
import RiskVortex from '@/components/analysis/RiskVortex';
import { BTN, CARD, Chip, RiskBadge } from '@/components/ui';
import { riskTone, TONE_BG, TONE_SOFT, TONE_TEXT } from '@/lib/presentation';
import type { AnalysisDetail } from '@/lib/types';
import { api } from '@/lib/api';
import { toast } from 'sonner';

/**
 * Engine channels. `ml_score` is a 0–1 probability while the rule, intel and
 * URL channels already report 0–100, so the ML value is scaled for display.
 */
const ENGINES: { key: keyof AnalysisDetail; label: string; scale: number; code: string }[] = [
  { key: 'ml_score', label: 'Neural Classifier', scale: 100, code: 'Channel 01 · ML' },
  { key: 'rule_score', label: 'Deterministic Rules', scale: 1, code: 'Channel 02 · Heuristics' },
  { key: 'intel_score', label: 'Threat Intel (IOC)', scale: 1, code: 'Channel 03 · Intel' },
  { key: 'url_score', label: 'URL Forensics', scale: 1, code: 'Channel 04 · URL' },
];

function asPercent(value: unknown, scale: number): number | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value * scale)));
}

function severityTone(severity: string) {
  return riskTone(severity);
}

interface EngineRow {
  label: string;
  code: string;
  percent: number | null;
}

function engineRows(analysis: AnalysisDetail): EngineRow[] {
  return ENGINES.map((engine) => ({
    label: engine.label,
    code: engine.code,
    percent: asPercent(analysis[engine.key], engine.scale),
  }));
}

export default function ResultReport({ analysis }: { analysis: AnalysisDetail }) {
  const tone = riskTone(analysis.risk_level);
  const rows = engineRows(analysis);

  const handleExportReport = async () => {
    try {
      const data = await api.analyze.exportReport(analysis.id);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `TrustLayer_Report_IR_${analysis.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Official Forensic Incident Report downloaded');
    } catch (err: any) {
      toast.error(err.message || 'Failed to export report');
    }
  };

  return (
    <div className="space-y-6">
      {/* Verdict & 3D Reactive Vortex */}
      <section className={`${CARD} overflow-hidden`}>
        <div className="flex flex-col items-center gap-8 p-6 sm:flex-row sm:p-8">
          <div className="h-[250px] w-[250px] shrink-0">
            <RiskVortex score={analysis.risk_score} />
          </div>

          <div className="flex-1 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <RiskBadge level={analysis.risk_level} score={analysis.risk_score} />
              <Chip tone="brand">{analysis.threat_type}</Chip>
              <Chip>{analysis.input_type.toUpperCase()}</Chip>
              {analysis.campaign_flagged && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-risk-critical/30 bg-[#FCE4E4] px-3 py-1 text-[11px] font-semibold text-risk-critical">
                  <span className="h-1.5 w-1.5 rounded-full bg-risk-critical tl-beacon" />
                  Coordinated Campaign
                </span>
              )}
            </div>

            <h2 className={`tl-serif mt-4 text-4xl font-normal tracking-tight sm:text-5xl ${TONE_TEXT[tone]}`}>
              {analysis.risk_score}
              <span className="text-2xl text-muted"> / 100 Risk Index</span>
            </h2>
            <p className="mt-2.5 text-sm leading-relaxed text-muted">{analysis.explanation}</p>

            <div className="mt-5 rounded-[20px] border border-[#C8D2FA] bg-[#EEF1FE]/80 px-5 py-4 dark:border-border-default dark:bg-surface-muted">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#28326B] dark:text-[#C4B5FD]">
                Recommended Action
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {analysis.recommendation}
              </p>
            </div>

            <div className="mt-5 flex items-center justify-center gap-3 sm:justify-start">
              <button
                type="button"
                onClick={handleExportReport}
                className={BTN.secondary}
                title="Download verifiable incident report for bank or police submission"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Export Forensic Report (.JSON)
              </button>
            </div>
          </div>
        </div>

        {/* Engine breakdown */}
        <div className="border-t border-border-default bg-surface-muted/65 px-6 py-5 sm:px-8">
          <div className="flex items-center justify-between pb-3">
            <span className="text-xs font-bold text-foreground">
              Multi-Channel Telemetry Confidence
            </span>
            <span className="rounded-full bg-surface px-2.5 py-0.5 text-[11px] font-medium text-muted border border-border-default">
              4 Channels Fused
            </span>
          </div>
          <div className="mt-2 grid gap-3.5 sm:grid-cols-2">
            {rows.map((row) => (
              <div
                key={row.label}
                className="rounded-2xl border border-border-default bg-surface p-3.5 shadow-2xs"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[11px] font-medium text-muted">{row.code}</span>
                  <span className="font-bold tabular-nums text-foreground">
                    {row.percent === null ? 'Inactive' : `${row.percent}%`}
                  </span>
                </div>
                <div className="mt-1.5 text-xs font-semibold text-foreground">{row.label}</div>
                <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
                  {row.percent !== null && (
                    <div
                      className={`h-full rounded-full ${TONE_BG[tone]}`}
                      style={{ width: `${row.percent}%` }}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Indicators + techniques */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className={`${CARD} p-6`}>
          <div className="flex items-center justify-between border-b border-border-default pb-3.5">
            <h3 className="tl-serif text-2xl font-normal text-foreground">
              Detection Indicators{' '}
              <span className="font-sans text-sm font-semibold text-muted">
                ({analysis.indicators.length})
              </span>
            </h3>
            <span className="rounded-full bg-surface-muted px-2.5 py-1 text-[11px] font-medium text-muted">
              Signals Triggered
            </span>
          </div>
          {analysis.indicators.length === 0 ? (
            <p className="mt-4 text-sm text-muted">
              Zero rule or intelligence signatures triggered for this payload.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {analysis.indicators.map((indicator, index) => {
                const indTone = severityTone(indicator.severity);
                return (
                  <li
                    key={`${indicator.title}-${index}`}
                    className="rounded-2xl border border-border-default bg-surface-muted/60 p-4 transition-colors hover:bg-surface-muted"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase ${TONE_SOFT[indTone]} ${TONE_TEXT[indTone]}`}
                      >
                        • {indicator.severity}
                      </span>
                      <span className="rounded-full border border-border-default bg-surface px-2.5 py-0.5 text-[10px] font-medium uppercase text-muted">
                        {indicator.category}
                      </span>
                    </div>
                    <p className="mt-2.5 text-sm font-bold text-foreground">{indicator.title}</p>
                    {indicator.detail && (
                      <p className="mt-1 text-xs leading-relaxed text-muted">{indicator.detail}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className={`${CARD} p-6`}>
          <div className="flex items-center justify-between border-b border-border-default pb-3.5">
            <h3 className="tl-serif text-2xl font-normal text-foreground">
              Manipulation Tactics{' '}
              <span className="font-sans text-sm font-semibold text-muted">
                ({analysis.se_techniques.length})
              </span>
            </h3>
            <span className="rounded-full bg-surface-muted px-2.5 py-1 text-[11px] font-medium text-muted">
              Psychological Vectors
            </span>
          </div>
          {analysis.se_techniques.length === 0 ? (
            <p className="mt-4 text-sm text-muted">
              No social-engineering manipulation vectors detected.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {analysis.se_techniques.map((technique, index) => {
                const techTone = riskTone(technique.intensity);
                return (
                  <li
                    key={`${technique.technique}-${index}`}
                    className="rounded-2xl border border-border-default bg-surface-muted/60 p-4 transition-colors hover:bg-surface-muted"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-bold text-foreground">
                        {technique.technique}
                      </span>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase ${TONE_SOFT[techTone]} ${TONE_TEXT[techTone]}`}
                      >
                        {technique.intensity} intensity
                      </span>
                    </div>
                    {technique.evidence && (
                      <div className="mt-2.5 rounded-xl border-l-2 border-[#8B3DFF] bg-surface px-3.5 py-2.5 text-xs italic leading-relaxed text-muted">
                        “{technique.evidence}”
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* Metadata Dossier */}
      <section className={`${CARD} flex flex-wrap items-center justify-between gap-6 p-5 text-xs`}>
        <div>
          <span className="block text-[11px] font-medium text-muted">End-to-End Latency</span>
          <span className="mt-0.5 block text-sm font-bold text-foreground tabular-nums">
            {analysis.latency_ms === null || analysis.latency_ms === undefined
              ? '—'
              : `${Math.round(analysis.latency_ms)} ms`}
          </span>
        </div>
        <div>
          <span className="block text-[11px] font-medium text-muted">Synthesizer Mode</span>
          <span className="mt-0.5 block text-sm font-bold text-foreground">
            {analysis.explanation_source === 'llm' ? 'Fine-Tuned LLM' : 'Rule Consensus Matrix'}
          </span>
        </div>
        <div>
          <span className="block text-[11px] font-medium text-muted">Forensic Incident ID</span>
          <span className="mt-0.5 block text-sm font-bold text-[#6D28D9] dark:text-[#C4B5FD]">
            #IR-{analysis.id}
          </span>
        </div>
        <div className="min-w-0 max-w-xs truncate">
          <span className="block text-[11px] font-medium text-muted">Payload Snippet</span>
          <span
            className="mt-0.5 block truncate text-xs text-muted"
            title={analysis.content_snippet}
          >
            {analysis.content_snippet}
          </span>
        </div>
      </section>
    </div>
  );
}

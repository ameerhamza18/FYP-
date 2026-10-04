import RiskGauge from '@/components/RiskGauge';
import RiskVortex from '@/components/analysis/RiskVortex';
import { CARD, Chip, RiskBadge } from '@/components/ui';
import { riskTone, TONE_BG, TONE_TEXT } from '@/lib/presentation';
import type { AnalysisDetail } from '@/lib/types';
import { api } from '@/lib/api';
import { toast } from 'sonner';

/**
 * Engine channels. `ml_score` is a 0–1 probability while the rule, intel and
 * URL channels already report 0–100, so the ML value is scaled for display.
 */
const ENGINES: { key: keyof AnalysisDetail; label: string; scale: number }[] = [
  { key: 'ml_score', label: 'ML classifier', scale: 100 },
  { key: 'rule_score', label: 'Rule engine', scale: 1 },
  { key: 'intel_score', label: 'Threat intel', scale: 1 },
  { key: 'url_score', label: 'URL forensics', scale: 1 },
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
  percent: number | null;
}

function engineRows(analysis: AnalysisDetail): EngineRow[] {
  return ENGINES.map((engine) => ({
    label: engine.label,
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
    <div className="space-y-5">
      {/* Verdict */}
      <section className={`${CARD} overflow-hidden`}>
        <div className="flex flex-col items-center gap-8 p-6 sm:flex-row sm:p-8">
          <div className="h-[240px] w-[240px] shrink-0">
            <RiskVortex score={analysis.risk_score} />
          </div>

          <div className="flex-1 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <RiskBadge level={analysis.risk_level} />
              <Chip tone="brand">{analysis.threat_type}</Chip>
              <Chip>{analysis.input_type}</Chip>
              {analysis.campaign_flagged && <Chip tone="brand">Campaign detected</Chip>}
            </div>

            <h2 className={`mt-4 text-2xl font-bold tracking-tight ${TONE_TEXT[tone]}`}>
              {analysis.risk_score}/100 risk
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{analysis.explanation}</p>

            <div className="mt-5 rounded-xl border border-brand/25 bg-brand-soft px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-brand">
                Recommendation
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {analysis.recommendation}
              </p>
            </div>

            <div className="mt-4 flex items-center justify-center sm:justify-start gap-3">
              <button
                type="button"
                onClick={handleExportReport}
                className="flex items-center gap-2 rounded-xl border border-brand/30 bg-brand/10 px-3.5 py-2 text-xs font-semibold text-brand transition-colors hover:bg-brand/20"
                title="Download verifiable incident report for bank or police submission"
              >
                <span>📄</span> Export Forensic Report (JSON)
              </button>
            </div>
          </div>
        </div>


        {/* Engine breakdown */}
        <div className="border-t border-border-default bg-background-subtle px-6 py-5 sm:px-8">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
            Engine breakdown
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {rows.map((row) => (
              <div key={row.label} className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-xs text-muted">{row.label}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted">
                  {row.percent !== null && (
                    <span
                      className={`block h-full rounded-full ${TONE_BG[tone]}`}
                      style={{ width: `${row.percent}%` }}
                    />
                  )}
                </span>
                <span className="w-12 shrink-0 text-right text-xs font-semibold tabular-nums text-foreground">
                  {row.percent === null ? '—' : row.percent}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Indicators + techniques */}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className={`${CARD} p-6`}>
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted">
            Indicators ({analysis.indicators.length})
          </h3>
          {analysis.indicators.length === 0 ? (
            <p className="mt-3 text-sm text-muted">
              No rule or intelligence indicators fired for this content.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {analysis.indicators.map((indicator, index) => {
                const indTone = severityTone(indicator.severity);
                return (
                  <li
                    key={`${indicator.title}-${index}`}
                    className="rounded-xl border border-border-default bg-background-subtle p-3.5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-xs font-bold uppercase ${TONE_TEXT[indTone]}`}>
                        {indicator.severity}
                      </span>
                      <span className="rounded-md border border-border-default bg-surface px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted">
                        {indicator.category}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm font-semibold text-foreground">
                      {indicator.title}
                    </p>
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
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted">
            Manipulation techniques ({analysis.se_techniques.length})
          </h3>
          {analysis.se_techniques.length === 0 ? (
            <p className="mt-3 text-sm text-muted">
              No social-engineering pressure patterns were detected.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {analysis.se_techniques.map((technique, index) => {
                const techTone = riskTone(technique.intensity);
                return (
                  <li
                    key={`${technique.technique}-${index}`}
                    className="rounded-xl border border-border-default bg-background-subtle p-3.5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-foreground">
                        {technique.technique}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${TONE_TEXT[techTone]}`}
                      >
                        {technique.intensity}
                      </span>
                    </div>
                    {technique.evidence && (
                      <p className="mt-1.5 border-l-2 border-border-strong pl-3 text-xs italic leading-relaxed text-muted">
                        “{technique.evidence}”
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* Metadata */}
      <section className={`${CARD} flex flex-wrap items-center gap-x-8 gap-y-4 p-5`}>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Latency</p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
            {analysis.latency_ms === null || analysis.latency_ms === undefined
              ? '—'
              : `${Math.round(analysis.latency_ms)} ms`}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Explanation</p>
          <p className="mt-0.5 text-sm font-semibold text-foreground">
            {analysis.explanation_source === 'llm' ? 'LLM-generated' : 'Deterministic template'}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Analysis ID</p>
          <p className="mt-0.5 font-mono text-sm text-foreground">#{analysis.id}</p>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
            Content analysed
          </p>
          <p className="mt-0.5 truncate font-mono text-xs text-muted" title={analysis.content_snippet}>
            {analysis.content_snippet}
          </p>
        </div>
      </section>
    </div>
  );
}
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
const ENGINES: { key: keyof AnalysisDetail; label: string; scale: number; code: string }[] = [
  { key: 'ml_score', label: 'Neural Classifier', scale: 100, code: 'CH_01 // ML' },
  { key: 'rule_score', label: 'Deterministic Rules', scale: 1, code: 'CH_02 // HEUR' },
  { key: 'intel_score', label: 'Threat Intel (IOC)', scale: 1, code: 'CH_03 // INTEL' },
  { key: 'url_score', label: 'URL Forensics', scale: 1, code: 'CH_04 // URL' },
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
      <section className={`${CARD} overflow-hidden border-border-default/80`}>
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
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-risk-critical/40 bg-risk-critical/15 px-2.5 py-1 font-mono text-[10px] font-bold uppercase text-risk-critical">
                  <span className="h-1.5 w-1.5 rounded-full bg-risk-critical tl-beacon" />
                  COORDINATED CAMPAIGN
                </span>
              )}
            </div>

            <h2 className={`mt-4 text-3xl font-black tracking-tight ${TONE_TEXT[tone]}`}>
              {analysis.risk_score}/100 Risk Index
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{analysis.explanation}</p>

            <div className="mt-5 rounded-2xl border border-brand/25 bg-brand-soft/70 px-4 py-3.5 backdrop-blur-md">
              <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-brand">
                RESPONSE RECOMMENDATION
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {analysis.recommendation}
              </p>
            </div>

            <div className="mt-5 flex items-center justify-center sm:justify-start gap-3">
              <button
                type="button"
                onClick={handleExportReport}
                className="flex items-center gap-2 rounded-xl border border-brand/40 bg-brand/10 px-4 py-2 text-xs font-mono font-semibold text-brand transition-all hover:bg-brand/20 active:scale-[0.99] shadow-sm"
                title="Download verifiable incident report for bank or police submission"
              >
                <span>📄</span> Export Forensic Report (.JSON)
              </button>
            </div>
          </div>
        </div>

        {/* Engine breakdown */}
        <div className="border-t border-border-default bg-surface-muted/60 px-6 py-5 sm:px-8">
          <div className="flex items-center justify-between pb-3">
            <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-muted">
              MULTI-CHANNEL TELEMETRY CONFIDENCE
            </span>
            <span className="font-mono text-[10px] text-slate-500">4 CHANNELS FUSED</span>
          </div>
          <div className="mt-2 grid gap-4 sm:grid-cols-2">
            {rows.map((row) => (
              <div key={row.label} className="rounded-xl border border-white/5 bg-background/50 p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-[10px] text-muted">{row.code}</span>
                  <span className="font-bold tabular-nums text-foreground">
                    {row.percent === null ? 'INACTIVE' : `${row.percent}%`}
                  </span>
                </div>
                <div className="mt-2 text-xs font-medium text-foreground">{row.label}</div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
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
          <div className="flex items-center justify-between border-b border-border-default pb-3">
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-muted">
              DETECTION INDICATORS ({analysis.indicators.length})
            </h3>
            <span className="font-mono text-[10px] text-slate-500">SIGNALS TRIGGERED</span>
          </div>
          {analysis.indicators.length === 0 ? (
            <p className="mt-4 text-xs text-muted">
              Zero rule or intelligence signatures triggered for this payload.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {analysis.indicators.map((indicator, index) => {
                const indTone = severityTone(indicator.severity);
                return (
                  <li
                    key={`${indicator.title}-${index}`}
                    className="tl-reticle-card rounded-xl border border-border-default bg-background/60 p-4 transition-colors hover:border-brand/30"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className={`font-mono text-[10px] font-bold uppercase ${TONE_TEXT[indTone]}`}>
                        [{indicator.severity}]
                      </span>
                      <span className="rounded border border-border-default bg-surface px-2 py-0.5 font-mono text-[9px] uppercase text-muted">
                        {indicator.category}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-bold text-foreground">
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
          <div className="flex items-center justify-between border-b border-border-default pb-3">
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-muted">
              MANIPULATION TACTICS ({analysis.se_techniques.length})
            </h3>
            <span className="font-mono text-[10px] text-slate-500">PSYCHOLOGICAL VECTORS</span>
          </div>
          {analysis.se_techniques.length === 0 ? (
            <p className="mt-4 text-xs text-muted">
              No social-engineering manipulation vectors detected.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {analysis.se_techniques.map((technique, index) => {
                const techTone = riskTone(technique.intensity);
                return (
                  <li
                    key={`${technique.technique}-${index}`}
                    className="tl-reticle-card rounded-xl border border-border-default bg-background/60 p-4 transition-colors hover:border-brand/30"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-bold text-foreground">
                        {technique.technique}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 font-mono text-[9px] font-bold uppercase ${TONE_TEXT[techTone]}`}
                      >
                        {technique.intensity} INTENSITY
                      </span>
                    </div>
                    {technique.evidence && (
                      <div className="mt-2 rounded-lg border-l-2 border-brand bg-surface-muted/40 p-2.5 text-xs italic leading-relaxed text-slate-300">
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
      <section className={`${CARD} flex flex-wrap items-center justify-between gap-6 p-5 font-mono text-xs`}>
        <div>
          <span className="text-[10px] uppercase text-muted block">End-to-End Latency</span>
          <span className="mt-0.5 font-bold text-foreground">
            {analysis.latency_ms === null || analysis.latency_ms === undefined
              ? '—'
              : `${Math.round(analysis.latency_ms)} ms`}
          </span>
        </div>
        <div>
          <span className="text-[10px] uppercase text-muted block">Synthesizer Mode</span>
          <span className="mt-0.5 font-bold text-foreground">
            {analysis.explanation_source === 'llm' ? 'Fine-Tuned LLM' : 'Rule Consensus Matrix'}
          </span>
        </div>
        <div>
          <span className="text-[10px] uppercase text-muted block">Forensic Incident ID</span>
          <span className="mt-0.5 font-bold text-brand-cyan">#IR-{analysis.id}</span>
        </div>
        <div className="min-w-0 max-w-xs truncate">
          <span className="text-[10px] uppercase text-muted block">Payload Snippet</span>
          <span className="mt-0.5 truncate text-[11px] text-muted block" title={analysis.content_snippet}>
            {analysis.content_snippet}
          </span>
        </div>
      </section>
    </div>
  );
}
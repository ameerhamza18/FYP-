/** Shared presentational primitives and tactical cybersecurity UI recipes. */
import type { ReactNode } from 'react';

import { riskLabel, riskTone, TONE_SOFT, TONE_TEXT } from '@/lib/presentation';

/* ----------------------------------------------------------- class recipes */

export const CARD =
  'tl-reticle-card rounded-2xl border border-border-default bg-surface/90 shadow-[var(--shadow-card)] backdrop-blur-xl transition-all duration-200';

export const BTN = {
  primary:
    'inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground shadow-[var(--shadow-cyber)] transition-all hover:bg-brand-hover hover:shadow-[var(--shadow-lift)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50',
  secondary:
    'inline-flex items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface px-4 py-2.5 text-sm font-semibold text-foreground transition-all hover:bg-surface-hover hover:border-brand/40 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50',
  ghost:
    'inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-muted hover:text-foreground active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50',
  danger:
    'inline-flex items-center justify-center gap-2 rounded-xl border border-risk-critical/30 bg-risk-critical/10 px-4 py-2.5 text-sm font-semibold text-risk-critical transition-colors hover:bg-risk-critical/20 disabled:cursor-not-allowed disabled:opacity-50',
} as const;

export const INPUT =
  'w-full rounded-xl border border-border-default bg-background/80 px-4 py-3 text-sm text-foreground placeholder:text-muted transition-all focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 disabled:opacity-60 font-sans';

/* ------------------------------------------------------------------- brand */

export function Logo({
  size = 32,
  showWordmark = true,
  onInk = false,
  subtitle,
}: {
  size?: number;
  showWordmark?: boolean;
  /** Render for the always-dark bands (hero/nav/footer). */
  onInk?: boolean;
  subtitle?: string;
}) {
  const glyph = Math.round(size * 0.56);
  return (
    <span className="flex items-center gap-2.5 select-none">
      <span
        className="relative flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand via-brand-hover to-indigo-700 text-brand-foreground shadow-[var(--shadow-cyber)] border border-white/20"
        style={{ width: size, height: size }}
        aria-hidden
      >
        <svg
          width={glyph}
          height={glyph}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      </span>
      {showWordmark && (
        <span className="flex flex-col leading-none">
          <span
            className={`text-[17px] font-extrabold tracking-tight flex items-center gap-1.5 ${
              onInk ? 'text-ink-foreground' : 'text-foreground'
            }`}
          >
            TrustLayer
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 tl-beacon" />
          </span>
          {subtitle && (
            <span
              className={`mt-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.18em] ${
                onInk ? 'text-ink-muted' : 'text-muted'
              }`}
            >
              {subtitle}
            </span>
          )}
        </span>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ badges */

export function RiskBadge({
  level,
  score,
  className = '',
}: {
  level?: string | null;
  score?: number | null;
  className?: string;
}) {
  const tone = riskTone(level);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider ${TONE_SOFT[tone]} ${TONE_TEXT[tone]} ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current tl-beacon" aria-hidden />
      {riskLabel(level)}
      {score !== undefined && score !== null && <span className="opacity-80">[{score}]</span>}
    </span>
  );
}

export function Chip({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'brand';
  className?: string;
}) {
  const styles =
    tone === 'brand'
      ? 'border-brand/30 bg-brand-soft text-brand font-medium'
      : 'border-border-default bg-surface-muted/80 text-muted';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs ${styles} ${className}`}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ layout */

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2.5 text-sm text-muted">
      <span
        aria-hidden
        className="h-4 w-4 animate-spin rounded-full border-2 border-border-strong border-t-brand"
      />
      {label}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-muted">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && <p className="max-w-sm text-xs leading-relaxed text-muted">{description}</p>}
      {action}
    </div>
  );
}

export function SkeletonRows({ rows = 4, className = '' }: { rows?: number; className?: string }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="tl-skeleton h-12 rounded-xl" />
      ))}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'center',
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: 'center' | 'left';
}) {
  const alignment = align === 'center' ? 'text-center items-center' : 'text-left items-start';
  return (
    <div className={`flex flex-col ${alignment} gap-3`}>
      {eyebrow && (
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-brand">
          <span className="h-1.5 w-1.5 rounded-full bg-brand" />
          {eyebrow}
        </span>
      )}
      <h2 className="max-w-2xl text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">
        {title}
      </h2>
      {description && (
        <p className="max-w-2xl text-base leading-relaxed text-muted">{description}</p>
      )}
    </div>
  );
}

/** Small labelled metric used in the SOC header strip. */
export function Metric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</span>
      <span className={`text-2xl font-black tabular-nums tracking-tight ${tone ?? 'text-foreground'}`}>{value}</span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  );
}
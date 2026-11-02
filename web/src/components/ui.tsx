/** Shared presentational primitives — Warm Editorial & Soft Pastel UI System. */
import type { ReactNode } from 'react';

import { riskLabel, riskTone, TONE_SOFT, TONE_TEXT } from '@/lib/presentation';

/* ----------------------------------------------------------- class recipes */

export const CARD =
  'rounded-[24px] border border-border-default bg-surface shadow-[var(--shadow-card)] transition-all duration-200';

export const BTN = {
  primary:
    'inline-flex items-center justify-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground shadow-[var(--shadow-cyber)] transition-all hover:bg-brand-hover hover:shadow-[var(--shadow-lift)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50',
  secondary:
    'inline-flex items-center justify-center gap-2 rounded-full border border-border-default bg-surface px-4 py-2.5 text-sm font-semibold text-foreground shadow-2xs transition-all hover:bg-surface-muted active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50',
  ghost:
    'inline-flex items-center justify-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-muted hover:text-foreground active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50',
  danger:
    'inline-flex items-center justify-center gap-2 rounded-full border border-risk-critical/25 bg-[#FCE4E4] px-4 py-2.5 text-sm font-semibold text-risk-critical transition-colors hover:bg-[#F9D0D0] disabled:cursor-not-allowed disabled:opacity-50',
} as const;

export const INPUT =
  'w-full rounded-2xl border border-border-default bg-surface-muted/80 px-4 py-3 text-sm text-foreground placeholder:text-muted transition-all focus:border-[#8B3DFF] focus:bg-surface focus:outline-none focus:ring-2 focus:ring-[#8B3DFF]/15 disabled:opacity-60 font-sans';

/* ------------------------------------------------------------------- brand */

export function Logo({
  size = 32,
  showWordmark = true,
  onInk = false,
  subtitle,
}: {
  size?: number;
  showWordmark?: boolean;
  onInk?: boolean;
  subtitle?: string;
}) {
  const glyph = Math.round(size * 0.54);
  return (
    <span className="flex items-center gap-2.5 select-none">
      <span
        className="relative flex shrink-0 items-center justify-center rounded-xl bg-brand text-brand-foreground shadow-sm"
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
            className={`text-[18px] font-bold tracking-tight flex items-center gap-1.5 ${
              onInk ? 'text-ink-foreground' : 'text-foreground'
            }`}
          >
            TrustLayer
          </span>
          {subtitle && (
            <span
              className={`mt-0.5 text-[10px] font-medium tracking-wide ${
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
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-tight ${TONE_SOFT[tone]} ${TONE_TEXT[tone]} ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {riskLabel(level)}
      {score !== undefined && score !== null && (
        <span className="opacity-85 tabular-nums">· {String(score).padStart(2, '0')}</span>
      )}
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
      ? 'border-[#C8D2FA] bg-[#E8EDFE] text-[#28326B] font-semibold dark:border-brand/30 dark:bg-brand-soft dark:text-brand-cyan'
      : 'border-border-default bg-surface-muted text-muted font-medium';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${styles} ${className}`}
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
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EEF1FE] text-[#3B4990] dark:bg-surface-muted dark:text-muted">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="m9 12 2 2 4-4" />
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
        <div key={i} className="tl-skeleton h-12 rounded-2xl" />
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
        <span className="inline-flex items-center gap-2 rounded-full border border-border-default bg-surface px-3.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground shadow-2xs">
          <span className="h-1.5 w-1.5 rounded-full bg-[#8B3DFF]" />
          {eyebrow}
        </span>
      )}
      <h2 className="tl-serif max-w-2xl text-4xl font-normal tracking-tight text-foreground md:text-5xl leading-[1.08]">
        {title}
      </h2>
      {description && (
        <p className="max-w-2xl text-base leading-relaxed text-muted">{description}</p>
      )}
    </div>
  );
}

/** Small labelled metric used in summary strips. */
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
      <span className="text-xs font-medium text-muted">{label}</span>
      <span className={`text-2xl font-bold tabular-nums tracking-tight ${tone ?? 'text-foreground'}`}>{value}</span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  );
}

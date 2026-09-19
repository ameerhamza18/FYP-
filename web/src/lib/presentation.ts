/** Presentation helpers shared by every view (tones, dates, formatting). */

import type { RiskLevel } from './types';

export type Tone = 'critical' | 'high' | 'medium' | 'low' | 'info';

/** Map any API risk level onto a semantic tone. */
export function riskTone(level?: string | null): Tone {
  switch ((level ?? '').toUpperCase()) {
    case 'CRITICAL':
      return 'critical';
    case 'HIGH':
      return 'high';
    case 'MEDIUM':
      return 'medium';
    case 'LOW':
      return 'low';
    default:
      return 'info';
  }
}

/**
 * Tone -> Tailwind utility maps. Kept as complete literal class strings so
 * Tailwind's compiler can see them (dynamic `text-risk-${tone}` would not be
 * detected and the styles would be purged).
 */
export const TONE_TEXT: Record<Tone, string> = {
  critical: 'text-risk-critical',
  high: 'text-risk-high',
  medium: 'text-risk-medium',
  low: 'text-risk-low',
  info: 'text-risk-info',
};

export const TONE_BG: Record<Tone, string> = {
  critical: 'bg-risk-critical',
  high: 'bg-risk-high',
  medium: 'bg-risk-medium',
  low: 'bg-risk-low',
  info: 'bg-risk-info',
};

export const TONE_SOFT: Record<Tone, string> = {
  critical: 'bg-risk-critical/10 border-risk-critical/25',
  high: 'bg-risk-high/10 border-risk-high/25',
  medium: 'bg-risk-medium/10 border-risk-medium/25',
  low: 'bg-risk-low/10 border-risk-low/25',
  info: 'bg-risk-info/10 border-risk-info/25',
};

/** CSS variable reference, for SVG strokes/fills that follow the theme. */
export const TONE_VAR: Record<Tone, string> = {
  critical: 'var(--risk-critical)',
  high: 'var(--risk-high)',
  medium: 'var(--risk-medium)',
  low: 'var(--risk-low)',
  info: 'var(--risk-info)',
};

export function riskLabel(level?: string | null): string {
  const value = (level ?? '').toUpperCase();
  if (!value) return 'Unknown';
  return value.charAt(0) + value.slice(1).toLowerCase();
}

export function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function relativeTime(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(value);
}

export function formatNumber(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return value.toLocaleString();
}

/** Score labels used by the risk dial. */
export function scoreDescriptor(score: number): string {
  if (score >= 80) return 'Critical risk';
  if (score >= 60) return 'High risk';
  if (score >= 30) return 'Moderate risk';
  return 'Low risk';
}

export const RISK_ORDER: RiskLevel[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
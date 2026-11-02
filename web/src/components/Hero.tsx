'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';

const DefenseMatrix3D = dynamic(() => import('./3d/DefenseMatrix3D'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[410px] w-full flex-col items-center justify-center rounded-[28px] border border-border-default bg-surface text-xs font-medium text-muted gap-3 shadow-[var(--shadow-card)]">
      <div className="h-7 w-7 rounded-full border-2 border-brand border-t-transparent animate-spin" />
      <span>Initializing 3D Sentinel Core…</span>
    </div>
  ),
});

const ENGINE_BARS = [
  { label: 'Neural Classifier', value: 98, pill: 'bg-[#E8EDFE] text-[#28326B]', bar: 'bg-[#8B3DFF]' },
  { label: 'Heuristic Rules', value: 100, pill: 'bg-[#DFF4EC] text-[#158067]', bar: 'bg-[#158067]' },
  { label: 'Threat Intel (IOC)', value: 88, pill: 'bg-[#F7EFE9] text-[#7A5236]', bar: 'bg-[#6D28D9]' },
  { label: 'URL Forensics', value: 94, pill: 'bg-[#FFF5CC] text-[#9A6B00]', bar: 'bg-[#D9820B]' },
];

const STATS = [
  { value: '< 240ms', label: 'Detection latency', sub: 'Median end-to-end' },
  { value: '4 Engines', label: 'Fused defense layers', sub: 'Multi-signal consensus' },
  { value: '0–100', label: 'Explainable verdict', sub: 'Auditable & forensic' },
];

export default function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border-default bg-background">
      {/* Soft Pastel Ambient Washes */}
      <div
        className="pointer-events-none absolute -left-36 top-[-8rem] h-[28rem] w-[28rem] rounded-full bg-[#CBD4FA]/45 blur-[130px] dark:bg-[#8B3DFF]/15"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-28 bottom-[-10rem] h-[28rem] w-[28rem] rounded-full bg-[#F5D67B]/35 blur-[130px] dark:bg-[#F5C84C]/10"
        aria-hidden
      />

      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-6 py-16 lg:grid-cols-[1.02fr_1fr] lg:py-24">
        <div>
          {/* Soft Status Pill */}
          <div className="inline-flex items-center gap-2.5 rounded-full border border-border-default bg-surface px-4 py-1.5 text-xs font-semibold text-foreground shadow-2xs">
            <span className="inline-flex h-2 w-2 rounded-full bg-[#158067]" />
            <span>Multimodal Scam &amp; Fraud Defense · Live</span>
          </div>

          <h1 className="tl-serif mt-6 text-5xl font-normal leading-[1.04] tracking-tight text-foreground sm:text-6xl lg:text-[68px]">
            Autonomous threat detection{' '}
            <span className="italic text-[#6D28D9] dark:text-[#C4B5FD]">
              before damage occurs
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
            TrustLayer intercepts deceptive messages, malicious links, and suspicious screenshots.
            It fuses neural machine learning, deterministic rule engines, and live threat
            intelligence into a clear, auditable 0–100 verdict.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/analyze"
              className="inline-flex items-center justify-center gap-2.5 rounded-full bg-brand px-7 py-3.5 text-sm font-semibold text-brand-foreground shadow-[var(--shadow-cyber)] transition-all hover:bg-brand-hover hover:shadow-[var(--shadow-lift)] active:scale-[0.99]"
            >
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.1"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              Scan suspicious content
            </Link>
            <Link
              href="/#pipeline"
              className="inline-flex items-center justify-center rounded-full border border-border-default bg-surface px-7 py-3.5 text-sm font-semibold text-foreground shadow-2xs transition-all hover:bg-surface-muted active:scale-[0.99]"
            >
              Inspect 3D Pipeline
            </Link>
          </div>

          {/* Editorial Metrics Bar */}
          <dl className="mt-12 grid grid-cols-3 gap-6 border-t border-border-default pt-8">
            {STATS.map((stat) => (
              <div key={stat.label}>
                <dt className="text-xs font-medium text-muted">{stat.label}</dt>
                <dd className="tl-serif mt-1 text-3xl font-normal tracking-tight text-foreground sm:text-4xl">
                  {stat.value}
                </dd>
                <dd className="mt-0.5 hidden text-xs text-muted sm:block">{stat.sub}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Right Showcase: Shieldly Verdict Preview + 3D Core + Telemetry Bento */}
        <div className="relative space-y-4">
          {/* Shieldly-inspired Pastel Live Verdict Banner */}
          <div className="tl-periwinkle-card flex items-center justify-between gap-4 rounded-[24px] px-5 py-3.5 shadow-2xs">
            <div className="flex items-center gap-3 min-w-0">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#141416] shadow-xs">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
                </svg>
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[#141416] dark:text-white">
                  Instant Multimodal Protection
                </p>
                <p className="truncate text-xs text-[#3D4674] dark:text-slate-300">
                  Paste messages, links, or screenshots for instant forensic answers
                </p>
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-[#FCE4E4] px-3 py-1 text-xs font-semibold text-[#D9383A]">
              • Scam · 97
            </span>
          </div>

          <DefenseMatrix3D />

          {/* Clean Bento Telemetry Strip */}
          <div className="rounded-[24px] border border-border-default bg-surface p-5 shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between border-b border-border-default pb-3 text-xs">
              <span className="flex items-center gap-2 font-semibold text-foreground">
                <span className="h-2 w-2 rounded-full bg-[#8B3DFF]" />
                Fused Telemetry Channels
              </span>
              <span className="rounded-full bg-[#DFF4EC] px-2.5 py-0.5 text-[11px] font-semibold text-[#158067]">
                All Sensors Live
              </span>
            </div>
            <div className="mt-3.5 grid grid-cols-2 gap-3 text-xs">
              {ENGINE_BARS.map((bar) => (
                <div
                  key={bar.label}
                  className="rounded-2xl border border-border-default/80 bg-surface-muted/70 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium text-foreground">{bar.label}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${bar.pill}`}>
                      {bar.value}%
                    </span>
                  </div>
                  <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-border-default">
                    <div
                      className={`h-full rounded-full ${bar.bar}`}
                      style={{ width: `${bar.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

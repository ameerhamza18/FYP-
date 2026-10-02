'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';

const DefenseMatrix3D = dynamic(() => import('./3d/DefenseMatrix3D'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[420px] w-full items-center justify-center rounded-3xl border border-white/10 bg-[#0a0f1d]/80 font-mono text-xs tracking-wider text-slate-500 animate-pulse">
      INITIALIZING 3D DEFENSE MATRIX...
    </div>
  ),
});

const ENGINE_BARS = [
  { label: 'ML CLASSIFIER', value: 98, color: 'bg-blue-500' },
  { label: 'DETERMINISTIC RULES', value: 100, color: 'bg-emerald-500' },
  { label: 'THREAT INTEL (IOC)', value: 85, color: 'bg-indigo-500' },
  { label: 'URL FORENSICS', value: 72, color: 'bg-sky-500' },
];

const STATS = [
  { value: '<240ms', label: 'Detection latency' },
  { value: '4 Layers', label: 'Fused defense engines' },
  { value: '0–100', label: 'Explainable verdict' },
];

export default function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-ink-border bg-ink">
      <div className="tl-grid-bg pointer-events-none absolute inset-0 opacity-40" aria-hidden />
      <div
        className="pointer-events-none absolute -left-40 top-[-12rem] h-[32rem] w-[32rem] rounded-full bg-brand/20 blur-[140px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-32 bottom-[-16rem] h-[30rem] w-[30rem] rounded-full bg-[#8b5cf6]/20 blur-[150px]"
        aria-hidden
      />

      <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-6 py-20 lg:grid-cols-[1fr_1fr] lg:py-28">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-ink-border bg-white/5 px-3 py-1.5 font-mono text-xs font-medium text-slate-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            DEFENSE STACK // MULTIMODAL FORENSICS
          </span>

          <h1 className="mt-6 text-4xl font-extrabold leading-[1.08] tracking-tight text-ink-foreground sm:text-5xl lg:text-6xl">
            Autonomous threat detection
            <br />
            <span className="tl-gradient-text">before damage occurs</span>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-ink-muted sm:text-lg">
            TrustLayer inspects suspicious messages, shortlinks, and screenshots.
            It mathematically fuses machine learning, deterministic rule engines, and
            active threat intelligence into an explainable, auditable risk score.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/analyze"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-6 py-3.5 text-base font-semibold text-brand-foreground transition-all hover:bg-brand-hover hover:shadow-[var(--shadow-lift)]"
            >
              Scan suspicious content
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
            <Link
              href="/#how-it-works"
              className="inline-flex items-center justify-center rounded-xl border border-ink-border bg-white/5 px-6 py-3.5 text-base font-semibold text-ink-foreground transition-colors hover:bg-white/10"
            >
              Architecture walkthrough
            </Link>
          </div>

          <dl className="mt-12 grid grid-cols-3 gap-6 border-t border-ink-border pt-8">
            {STATS.map((stat) => (
              <div key={stat.label}>
                <dt className="font-mono text-xs uppercase tracking-wider text-ink-muted">
                  {stat.label}
                </dt>
                <dd className="mt-1.5 font-mono text-xl font-bold tracking-tight text-ink-foreground sm:text-2xl">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Right side: 3D Interactive Defense Matrix Console */}
        <div className="relative">
          <DefenseMatrix3D />

          {/* Under-canvas Live Engine Telemetry Strip */}
          <div className="mt-4 rounded-2xl border border-white/10 bg-[#070b14]/90 p-4 backdrop-blur-xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/5 font-mono text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                FUSED TELEMETRY CHANNELS
              </span>
              <span className="text-slate-500">REAL-TIME</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 font-mono text-[10px]">
              {ENGINE_BARS.map((bar) => (
                <div key={bar.label} className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>{bar.label}</span>
                    <span className="font-bold text-slate-200">{bar.value}%</span>
                  </div>
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/10">
                    <div className={`h-full rounded-full ${bar.color}`} style={{ width: `${bar.value}%` }} />
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

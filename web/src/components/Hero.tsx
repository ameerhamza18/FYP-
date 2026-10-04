'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';

const DefenseMatrix3D = dynamic(() => import('./3d/DefenseMatrix3D'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[440px] w-full flex-col items-center justify-center rounded-3xl border border-white/10 bg-[#060a14] font-mono text-xs tracking-wider text-slate-500 animate-pulse gap-3">
      <div className="h-8 w-8 rounded-full border-2 border-brand border-t-transparent animate-spin" />
      <span>INITIALIZING 3D DEFENSE MATRIX...</span>
    </div>
  ),
});

const ENGINE_BARS = [
  { label: 'ML TRANSFORMER', value: 98, status: 'OPTIMAL', color: 'from-blue-600 to-sky-400' },
  { label: 'HEURISTIC RULES', value: 100, status: 'ARMED', color: 'from-emerald-600 to-teal-400' },
  { label: 'THREAT INTEL (IOC)', value: 88, status: 'SYNCED', color: 'from-indigo-600 to-violet-400' },
  { label: 'URL FORENSICS', value: 94, status: 'ACTIVE', color: 'from-cyan-600 to-blue-400' },
];

const STATS = [
  { value: '< 240ms', label: 'Detection latency', sub: 'Median end-to-end' },
  { value: '4 Engines', label: 'Fused defense layers', sub: 'Multi-signal consensus' },
  { value: '0–100', label: 'Explainable verdict', sub: 'Auditable & forensic' },
];

export default function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-ink-border bg-ink">
      {/* Background Cyber Grid & Radiant Blurs */}
      <div className="tl-cyber-grid pointer-events-none absolute inset-0 opacity-30" aria-hidden />
      <div
        className="pointer-events-none absolute -left-48 top-[-10rem] h-[34rem] w-[34rem] rounded-full bg-brand/15 blur-[160px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-36 bottom-[-14rem] h-[32rem] w-[32rem] rounded-full bg-cyan-600/15 blur-[160px]"
        aria-hidden
      />

      <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-6 py-20 lg:grid-cols-[1fr_1.08fr] lg:py-28">
        <div>
          {/* Tactical Status Pill */}
          <div className="inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 font-mono text-xs font-semibold text-slate-300 backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span className="tracking-wide">DEFENSE STACK // MULTIMODAL FORENSICS</span>
          </div>

          <h1 className="mt-6 text-4xl font-extrabold leading-[1.08] tracking-tight text-ink-foreground sm:text-5xl lg:text-6xl">
            Autonomous threat detection
            <br />
            <span className="tl-gradient-text tl-cyber-text-glow">before damage occurs</span>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-ink-muted sm:text-lg">
            TrustLayer intercepts and neutralizes deceptive messages, malicious links, and suspicious screenshots.
            It mathematically fuses neural machine learning, deterministic rule engines, and
            real-time threat intelligence into an explainable, auditable risk score.
          </p>

          <div className="mt-9 flex flex-col gap-3.5 sm:flex-row">
            <Link
              href="/analyze"
              className="inline-flex items-center justify-center gap-2.5 rounded-xl bg-brand px-6 py-3.5 text-base font-semibold text-brand-foreground shadow-[var(--shadow-cyber)] transition-all hover:bg-brand-hover hover:shadow-[var(--shadow-lift)] active:scale-[0.99]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              Scan suspicious content
            </Link>
            <Link
              href="/#pipeline"
              className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-6 py-3.5 text-base font-semibold text-ink-foreground transition-all hover:bg-white/[0.08] hover:border-white/20 active:scale-[0.99]"
            >
              Inspect 3D Pipeline
            </Link>
          </div>

          {/* Stats Bar */}
          <dl className="mt-12 grid grid-cols-3 gap-6 border-t border-ink-border pt-8">
            {STATS.map((stat) => (
              <div key={stat.label}>
                <dt className="font-mono text-[10px] uppercase tracking-wider text-ink-muted">
                  {stat.label}
                </dt>
                <dd className="mt-1 font-mono text-xl font-black tracking-tight text-ink-foreground sm:text-2xl">
                  {stat.value}
                </dd>
                <dd className="mt-0.5 text-[11px] text-slate-500 hidden sm:block">
                  {stat.sub}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Right side: 3D Interactive Sentinel Defense Matrix Console */}
        <div className="relative">
          <DefenseMatrix3D />

          {/* Live Engine Telemetry Strip */}
          <div className="mt-4 rounded-2xl border border-white/10 bg-[#070c18]/90 p-4 backdrop-blur-xl shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 font-mono text-[11px] text-slate-400">
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                <span className="font-bold text-slate-200">FUSED TELEMETRY CHANNELS</span>
              </span>
              <span className="text-emerald-400 font-bold">ALL SENSORS LIVE</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 font-mono text-[10px]">
              {ENGINE_BARS.map((bar) => (
                <div key={bar.label} className="rounded-xl border border-white/5 bg-white/[0.02] p-2.5">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="truncate pr-2">{bar.label}</span>
                    <span className="font-bold text-slate-200 tabular-nums">{bar.value}%</span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${bar.color}`}
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


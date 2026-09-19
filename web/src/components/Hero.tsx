import Link from 'next/link';

import RiskGauge from './RiskGauge';

const ENGINE_BARS = [
  { label: 'ML classifier', value: 98 },
  { label: 'Rule engine', value: 100 },
  { label: 'Threat intel', value: 62 },
  { label: 'URL analysis', value: 44 },
];

const STATS = [
  { value: '<300ms', label: 'Median scoring latency' },
  { value: '4', label: 'Detection engines fused' },
  { value: '0–100', label: 'Explainable risk score' },
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
        className="pointer-events-none absolute -right-32 bottom-[-16rem] h-[30rem] w-[30rem] rounded-full bg-[#8b5cf6]/25 blur-[150px]"
        aria-hidden
      />

      <div className="relative mx-auto grid max-w-7xl items-center gap-16 px-6 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:py-28">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-ink-border bg-white/5 px-3 py-1.5 text-xs font-medium text-ink-muted">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
            </span>
            Multimodal detection engine · live
          </span>

          <h1 className="mt-6 text-4xl font-extrabold leading-[1.08] tracking-tight text-ink-foreground sm:text-5xl lg:text-6xl">
            Catch the scam
            <br />
            <span className="tl-gradient-text">before it catches you</span>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-ink-muted sm:text-lg">
            Paste a suspicious message, URL, or screenshot. TrustLayer fuses machine
            learning, expert rules, threat intelligence and URL forensics into one
            explainable risk score — and tells you exactly which psychological triggers
            the attacker is using.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/analyze"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-6 py-3.5 text-base font-semibold text-brand-foreground transition-all hover:bg-brand-hover hover:shadow-[var(--shadow-lift)]"
            >
              Analyze a message
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
              See how it works
            </Link>
          </div>

          <dl className="mt-12 grid grid-cols-3 gap-6 border-t border-ink-border pt-8">
            {STATS.map((stat) => (
              <div key={stat.label}>
                <dt className="text-xs font-medium uppercase tracking-wider text-ink-muted">
                  {stat.label}
                </dt>
                <dd className="mt-1.5 text-xl font-bold text-ink-foreground sm:text-2xl">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative">
          <div className="rounded-3xl border border-ink-border bg-ink-surface/80 p-4 shadow-2xl backdrop-blur">
            <div className="flex items-center justify-between px-2 pb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                Risk report
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-risk-critical/35 bg-risk-critical/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-risk-critical">
                <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
                Phishing
              </span>
            </div>

            <div className="rounded-2xl border border-ink-border bg-ink p-6">
              <div className="flex flex-col items-center gap-6 sm:flex-row">
                <RiskGauge score={82} level="CRITICAL" size={132} thickness={11} />

                <div className="flex-1">
                  <p className="text-sm font-semibold text-ink-foreground">
                    Credential-harvesting SMS
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">
                    “Your account will be blocked within 24 hours. Verify immediately at
                    verify-acct-alert.xyz/login”
                  </p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {['Urgency', 'Authority', 'Credential request'].map((tag) => (
                      <span
                        key={tag}
                        className="rounded-md border border-ink-border bg-white/5 px-2 py-0.5 text-[10px] font-medium text-ink-muted"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-3 border-t border-ink-border pt-5">
                {ENGINE_BARS.map((bar) => (
                  <div key={bar.label} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 text-[11px] text-ink-muted">{bar.label}</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                      <span
                        className="block h-full rounded-full bg-brand"
                        style={{ width: `${bar.value}%` }}
                      />
                    </span>
                    <span className="w-9 shrink-0 text-right text-[11px] font-semibold tabular-nums text-ink-muted">
                      {bar.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

import Link from 'next/link';

const CONTROLS = [
  { name: 'OWASP API1 (BOLA)', desc: 'Object-level user ownership verified by automated CI/CD test gates' },
  { name: 'Sliding-Window Rate Limiting', desc: 'In-memory token bucket mitigation per IP & authenticated principal' },
  { name: 'Bcrypt Cost Factor 12', desc: 'Secure per-user cryptographic salt generation with timing attack defense' },
  { name: 'JWT Cryptographic Sessions', desc: 'Revocable RS256/HS256 tokens with short lifetime & sliding renewal' },
  { name: 'Zero-Disk In-Memory OCR', desc: 'Temporary image tensors are isolated in RAM and flushed immediately' },
  { name: 'Immutable Audit Trail', desc: 'Cryptographically ordered log for every auth, scan, and admin operation' },
  { name: 'Prompt-Injection Defenses', desc: 'Strict sanitization filters and isolated LLM output schema validation' },
  { name: 'Strict CORS Allow-Lists', desc: 'Origin validation enforced; zero wildcard credentials permitted' },
];

export function SecurityBand() {
  return (
    <section id="security" className="relative overflow-hidden border-b border-ink-border bg-ink py-20 lg:py-28">
      <div className="tl-cyber-grid pointer-events-none absolute inset-0 opacity-25" aria-hidden />
      <div
        className="pointer-events-none absolute right-[-8rem] top-[-8rem] h-[28rem] w-[28rem] rounded-full bg-brand/15 blur-[150px]"
        aria-hidden
      />

      <div className="relative mx-auto grid max-w-7xl gap-14 px-6 lg:grid-cols-2">
        <div>
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-brand-cyan">
            ASSURANCE ARCHITECTURE
          </span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink-foreground md:text-4xl">
            Hardened on the OWASP API Top 10
          </h2>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-ink-muted">
            An engine that inspects high-risk payloads must be impervious to tampering. Every endpoint is authenticated, rate-regulated, MIME-validated, and tamper-logged.
          </p>

          <dl className="mt-10 grid grid-cols-2 gap-6 border-t border-ink-border pt-8 font-mono">
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <dt className="text-[10px] uppercase tracking-wider text-ink-muted">AUTHENTICATION</dt>
              <dd className="mt-1 text-base font-bold text-ink-foreground">JWT + RBAC</dd>
              <dd className="mt-0.5 text-[11px] text-slate-500">Sub-second expiry</dd>
            </div>
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <dt className="text-[10px] uppercase tracking-wider text-ink-muted">KEY STRETCHING</dt>
              <dd className="mt-1 text-base font-bold text-ink-foreground">bcrypt · cost 12</dd>
              <dd className="mt-0.5 text-[11px] text-slate-500">Per-hash salting</dd>
            </div>
          </dl>
        </div>

        <ul className="grid gap-3 sm:grid-cols-2">
          {CONTROLS.map((control) => (
            <li
              key={control.name}
              className="tl-reticle-card flex flex-col justify-between rounded-xl border border-white/10 bg-[#080d1a]/80 p-4 backdrop-blur-xl transition-all hover:border-brand/40"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span className="font-mono text-xs font-bold text-slate-200">{control.name}</span>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                  {control.desc}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function CtaBand() {
  return (
    <section className="relative overflow-hidden border-b border-ink-border bg-gradient-to-r from-[#060a14] via-[#091124] to-[#060a14] py-16">
      <div className="tl-cyber-dots pointer-events-none absolute inset-0 opacity-20" />
      <div className="relative mx-auto flex max-w-7xl flex-col items-center gap-6 px-6 text-center lg:flex-row lg:justify-between lg:text-left">
        <div>
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400">
            RAPID DEPLOYMENT // INSTANT ANALYSIS
          </span>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink-foreground md:text-3xl">
            Neutralize a suspicious payload right now
          </h2>
          <p className="mt-2 text-sm text-ink-muted">
            Instant live scanning. Paste suspicious texts, verify deceptive URLs, or upload screenshots in seconds.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/analyze"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-6 py-3.5 text-sm font-semibold text-brand-foreground shadow-[var(--shadow-cyber)] transition-all hover:bg-brand-hover hover:shadow-[var(--shadow-lift)] active:scale-[0.99]"
          >
            Launch Analyzer Console
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-6 py-3.5 text-sm font-semibold text-ink-foreground transition-all hover:bg-white/[0.08] hover:border-white/20 active:scale-[0.99]"
          >
            Create SOC Account
          </Link>
        </div>
      </div>
    </section>
  );
}
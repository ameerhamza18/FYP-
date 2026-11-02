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
    <section
      id="security"
      className="relative overflow-hidden border-b border-border-default bg-background-subtle py-20 lg:py-28"
    >
      <div className="relative mx-auto grid max-w-7xl gap-14 px-6 lg:grid-cols-2">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-border-default bg-surface px-3.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground shadow-2xs">
            <span className="h-1.5 w-1.5 rounded-full bg-[#158067]" />
            Assurance Architecture
          </span>
          <h2 className="tl-serif mt-4 text-4xl font-normal tracking-tight text-foreground md:text-5xl leading-[1.08]">
            Hardened on the <span className="italic">OWASP API Top 10</span>
          </h2>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-muted">
            An engine that inspects high-risk payloads must be impervious to tampering. Every
            endpoint is authenticated, rate-regulated, MIME-validated, and tamper-logged.
          </p>

          <dl className="mt-10 grid grid-cols-2 gap-4 border-t border-border-default pt-8">
            <div className="rounded-[22px] border border-border-default bg-surface p-5 shadow-[var(--shadow-card)]">
              <dt className="text-xs font-medium text-muted">Authentication</dt>
              <dd className="tl-serif mt-1 text-2xl text-foreground">JWT + RBAC</dd>
              <dd className="mt-0.5 text-xs text-muted">Scoped role verification</dd>
            </div>
            <div className="rounded-[22px] border border-border-default bg-surface p-5 shadow-[var(--shadow-card)]">
              <dt className="text-xs font-medium text-muted">Key Stretching</dt>
              <dd className="tl-serif mt-1 text-2xl text-foreground">bcrypt · cost 12</dd>
              <dd className="mt-0.5 text-xs text-muted">Per-hash cryptographic salt</dd>
            </div>
          </dl>
        </div>

        <ul className="grid gap-3.5 sm:grid-cols-2">
          {CONTROLS.map((control) => (
            <li
              key={control.name}
              className="flex flex-col justify-between rounded-[20px] border border-border-default bg-surface p-4.5 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]"
            >
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#DFF4EC] text-[11px] font-bold text-[#158067]">
                    ✓
                  </span>
                  <span className="text-xs font-bold text-foreground">{control.name}</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted">{control.desc}</p>
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
    <section className="border-b border-border-default bg-background py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-6">
        <div className="tl-amber-mesh relative flex flex-col items-center justify-between gap-8 overflow-hidden rounded-[32px] border border-[#E8D59C] px-8 py-12 text-center shadow-[var(--shadow-card)] lg:flex-row lg:px-14 lg:py-14 lg:text-left dark:border-border-default">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-[#141416] px-3.5 py-1 text-[11px] font-semibold text-white">
              <span className="h-1.5 w-1.5 rounded-full bg-[#A3F750]" />
              Instant Protection · Live Scanner
            </span>
            <h2 className="tl-serif mt-4 text-4xl font-normal tracking-tight text-[#141416] md:text-5xl leading-[1.06] dark:text-foreground">
              Neutralize a suspicious payload{' '}
              <span className="italic">right now</span>
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[#4E4632] dark:text-muted">
              Paste suspicious messages, inspect deceptive URLs, or upload screenshots in seconds —
              with full forensic explainability.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/analyze"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#141416] px-7 py-3.5 text-sm font-semibold text-white shadow-[var(--shadow-cyber)] transition-all hover:bg-[#2A2A2E] active:scale-[0.99]"
            >
              Launch Analyzer Console
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-full border border-[#141416]/15 bg-white/90 px-7 py-3.5 text-sm font-semibold text-[#141416] shadow-2xs transition-all hover:bg-white active:scale-[0.99]"
            >
              Create SOC Account
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

import Link from 'next/link';

const CONTROLS = [
  'JWT authentication with expiry and RBAC on every API route',
  'Object-level authorization (OWASP API1/BOLA) — verified by tests',
  'Sliding-window rate limiting per client IP',
  'bcrypt password hashing (cost 12) with per-hash salt',
  'Strict CORS allow-list — never a wildcard with credentials',
  'Immutable audit trail for logins, registrations and analyses',
  'Prompt-injection defenses and LLM output validation',
  'Uploads validated by size and MIME type, processed in memory only',
  'Hardened response headers (nosniff, DENY, referrer policy, HSTS)',
  'Fail-fast startup: refuses to boot on insecure production config',
];

export function SecurityBand() {
  return (
    <section id="security" className="relative overflow-hidden border-b border-ink-border bg-ink">
      <div className="tl-grid-bg pointer-events-none absolute inset-0 opacity-30" aria-hidden />
      <div
        className="pointer-events-none absolute right-[-10rem] top-[-8rem] h-[26rem] w-[26rem] rounded-full bg-brand/20 blur-[130px]"
        aria-hidden
      />

      <div className="relative mx-auto grid max-w-7xl gap-14 px-6 py-20 lg:grid-cols-2 lg:py-24">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-hover">
            Security model
          </span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-ink-foreground md:text-4xl">
            Built on the OWASP API Top 10
          </h2>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-ink-muted">
            A tool that inspects your sensitive messages has to earn that trust. Every
            endpoint is authenticated, rate-limited, validated and audited — and the
            authorization rules are covered by an automated test suite.
          </p>

          <dl className="mt-9 grid grid-cols-2 gap-6 border-t border-ink-border pt-8">
            <div>
              <dt className="text-xs uppercase tracking-wider text-ink-muted">Auth</dt>
              <dd className="mt-1 text-lg font-bold text-ink-foreground">JWT + RBAC</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-ink-muted">Hashing</dt>
              <dd className="mt-1 text-lg font-bold text-ink-foreground">bcrypt · cost 12</dd>
            </div>
          </dl>
        </div>

        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          {CONTROLS.map((control) => (
            <li key={control} className="flex items-start gap-3">
              <span
                className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-brand/40 bg-brand/15 text-brand-hover"
                aria-hidden
              >
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m5 13 4 4L19 7" />
                </svg>
              </span>
              <span className="text-sm leading-relaxed text-ink-muted">{control}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function CtaBand() {
  return (
    <section className="border-b border-ink-border bg-ink-surface">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-6 py-16 text-center lg:flex-row lg:justify-between lg:text-left">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-ink-foreground md:text-3xl">
            Check a suspicious message right now
          </h2>
          <p className="mt-2 text-sm text-ink-muted">
            Free to try. Create an account in seconds, then paste anything that looks off.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/analyze"
            className="inline-flex items-center justify-center rounded-xl bg-brand px-6 py-3 text-base font-semibold text-brand-foreground transition-colors hover:bg-brand-hover"
          >
            Open the analyzer
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-xl border border-ink-border px-6 py-3 text-base font-semibold text-ink-foreground transition-colors hover:bg-white/10"
          >
            Create an account
          </Link>
        </div>
      </div>
    </section>
  );
}
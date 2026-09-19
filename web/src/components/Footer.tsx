import Link from 'next/link';

import { Logo } from './ui';

const COLUMNS: { heading: string; links: { href: string; label: string }[] }[] = [
  {
    heading: 'Product',
    links: [
      { href: '/analyze', label: 'Threat analyzer' },
      { href: '/dashboard', label: 'SOC dashboard' },
      { href: '/#features', label: 'Capabilities' },
      { href: '/#how-it-works', label: 'How it works' },
    ],
  },
  {
    heading: 'Developers',
    links: [
      { href: '/docs', label: 'API reference' },
      { href: '/openapi.json', label: 'OpenAPI schema' },
      { href: '/redoc', label: 'ReDoc explorer' },
      { href: '/health', label: 'Service health' },
    ],
  },
  {
    heading: 'Trust',
    links: [
      { href: '/#security', label: 'Security model' },
      { href: '/#security', label: 'OWASP API Top 10' },
      { href: '/privacy', label: 'Privacy Policy' },
      { href: '/#security', label: 'Data handling' },
    ],
  },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-ink-border bg-ink">
      <div className="mx-auto max-w-7xl px-6 py-14">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Logo onInk subtitle="Threat defense platform" />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-muted">
              Multimodal phishing, scam and social-engineering detection with explainable
              risk scoring, built on a hybrid ML + rules + threat-intelligence engine.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full border border-ink-border px-2.5 py-1 text-[11px] font-medium text-ink-muted">
                Explainable AI
              </span>
              <span className="rounded-full border border-ink-border px-2.5 py-1 text-[11px] font-medium text-ink-muted">
                OWASP-aligned
              </span>
              <span className="rounded-full border border-ink-border px-2.5 py-1 text-[11px] font-medium text-ink-muted">
                Audit-logged
              </span>
            </div>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.heading}>
              <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-ink-foreground">
                {column.heading}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={`${column.heading}-${link.label}`}>
                    <Link
                      href={link.href}
                      className="text-sm text-ink-muted transition-colors hover:text-ink-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-ink-border">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-6 py-6 sm:flex-row">
          <p className="text-xs text-ink-muted">© {year} TrustLayer AI. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/privacy" className="text-xs text-ink-muted transition-colors hover:text-ink-foreground">Privacy Policy</Link>
            <p className="text-xs text-ink-muted">For detection assistance only — always verify with the official source.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
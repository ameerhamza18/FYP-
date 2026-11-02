import Link from 'next/link';

import { Logo } from './ui';

const COLUMNS: { heading: string; links: { href: string; label: string }[] }[] = [
  {
    heading: 'Platform',
    links: [
      { href: '/analyze', label: 'Shield AI Scanner' },
      { href: '/dashboard', label: 'SOC Overview' },
      { href: '/#features', label: 'Capabilities' },
      { href: '/#pipeline', label: 'Detection Pipeline' },
    ],
  },
  {
    heading: 'Developers & SOC',
    links: [
      { href: '/docs', label: 'API Specifications' },
      { href: '/openapi.json', label: 'OpenAPI Schema' },
      { href: '/redoc', label: 'ReDoc Interactive' },
      { href: '/health', label: 'Telemetry & Health' },
    ],
  },
  {
    heading: 'Assurance',
    links: [
      { href: '/#security', label: 'Security Model' },
      { href: '/#security', label: 'OWASP API Compliance' },
      { href: '/privacy', label: 'Data Isolation Policy' },
      { href: '/#security', label: 'Zero-Disk Architecture' },
    ],
  },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-border-default bg-background-subtle relative overflow-hidden">
      <div className="relative mx-auto max-w-7xl px-6 py-14">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Logo subtitle="AI Scam & Phishing Defense" />
            <p className="mt-4 max-w-sm text-xs leading-relaxed text-muted">
              Multimodal scam, phishing, and social-engineering protection platform.
              Combining machine-learning classifiers, deterministic fraud rules, and live IOC intelligence into clear, explainable verdicts.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full border border-border-default bg-surface px-3 py-1 text-[11px] font-medium text-muted">
                Zero-Disk OCR
              </span>
              <span className="rounded-full border border-border-default bg-surface px-3 py-1 text-[11px] font-medium text-muted">
                OWASP API Top 10
              </span>
              <span className="rounded-full bg-[#DFF4EC] border border-[#BCE6D7] px-3 py-1 text-[11px] font-semibold text-[#158067] flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#158067]" />
                All Systems Operational
              </span>
            </div>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.heading}>
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                {column.heading}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={`${column.heading}-${link.label}`}>
                    <Link
                      href={link.href}
                      className="text-xs text-muted transition-colors hover:text-foreground"
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

      <div className="border-t border-border-default py-5">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-6 sm:flex-row text-xs text-muted">
          <p>© {year} TrustLayer Defense. All rights reserved.</p>
          <div className="flex items-center gap-5">
            <Link href="/privacy" className="hover:text-foreground transition-colors font-medium">
              Privacy Policy
            </Link>
            <span>·</span>
            <span>Zero-Storage Privacy Architecture</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

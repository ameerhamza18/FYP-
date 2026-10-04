import Link from 'next/link';

import { Logo } from './ui';

const COLUMNS: { heading: string; links: { href: string; label: string }[] }[] = [
  {
    heading: 'Platform',
    links: [
      { href: '/analyze', label: 'Threat Analyzer' },
      { href: '/dashboard', label: 'SOC Command Center' },
      { href: '/#features', label: 'Capabilities' },
      { href: '/#pipeline', label: '3D Pipeline Architecture' },
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
    <footer className="mt-auto border-t border-ink-border bg-ink relative overflow-hidden">
      <div className="tl-cyber-dots pointer-events-none absolute inset-0 opacity-15" />

      <div className="relative mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Logo onInk subtitle="Autonomous Deception Defense" />
            <p className="mt-4 max-w-sm text-xs leading-relaxed text-ink-muted">
              Multimodal scam, phishing, and social-engineering interception platform.
              Fusing neural ML classifiers, deterministic fraud heuristics, and IOC threat intelligence into auditable risk verdicts.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 font-mono">
              <span className="rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-1 text-[10px] text-slate-400">
                AES-256-GCM
              </span>
              <span className="rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-1 text-[10px] text-slate-400">
                OWASP TOP 10
              </span>
              <span className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] text-emerald-400 flex items-center gap-1.5 font-bold">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                SYSTEM 100% OPERATIONAL
              </span>
            </div>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.heading}>
              <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink-foreground">
                {column.heading}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={`${column.heading}-${link.label}`}>
                    <Link
                      href={link.href}
                      className="text-xs text-ink-muted transition-colors hover:text-ink-foreground"
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

      <div className="border-t border-ink-border/80 bg-[#02050b] py-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-6 sm:flex-row text-xs font-mono text-ink-muted">
          <p>© {year} TrustLayer Defense. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="hover:text-ink-foreground transition-colors">
              Privacy Policy
            </Link>
            <span className="text-slate-600">·</span>
            <span>NODE: AP-SOUTHEAST-PROD</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
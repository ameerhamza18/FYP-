import type { ReactNode } from 'react';

import { SectionHeading } from './ui';

interface Feature {
  id: string;
  title: string;
  description: string;
  metric: string;
  icon: ReactNode;
}

const FEATURES: Feature[] = [
  {
    id: '01',
    title: 'Four Engines, One Fused Verdict',
    description:
      'A supervised neural classifier, deterministic fraud rulesets, live IOC threat intelligence, and URL forensics are mathematically unified into a single 0–100 risk score.',
    metric: '< 240ms latency',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
      </svg>
    ),
  },
  {
    id: '02',
    title: 'Forensically Explainable by Design',
    description:
      'Zero black-box ambiguity. Every verdict highlights the exact deception indicators triggered, urgency manipulation tactics, and credential-harvesting vectors.',
    metric: 'Auditable Evidence',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    id: '03',
    title: 'Multimodal In-Memory Inspection',
    description:
      'Inspect raw text payloads, suspicious URLs, or full screenshots. Visual OCR extraction executes entirely in volatile RAM — zero user data touches disk.',
    metric: 'Zero-Disk OCR',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
  },
  {
    id: '04',
    title: 'Enterprise SOC Visibility',
    description:
      'SOC teams monitor live global telemetry, 14-day attack velocity, manipulation technique distributions, cross-user campaign correlations, and immutable audit logs.',
    metric: 'Real-Time Correlated',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <path d="M7 15h10M7 9h4M7 12h7" />
      </svg>
    ),
  },
];

export default function Features() {
  return (
    <section
      id="features"
      className="relative border-b border-border-default bg-background-subtle py-20 lg:py-28"
    >
      <div className="tl-cyber-dots pointer-events-none absolute inset-0 opacity-25" />

      <div className="relative mx-auto max-w-7xl px-6">
        <SectionHeading
          eyebrow="CAPABILITIES"
          title="Security intelligence that proves every verdict"
          description="Most scanners flash a generic red or green light without explanation. TrustLayer provides concrete mathematical evidence and forensic lineage for every decision."
        />

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <article
              key={feature.title}
              className="tl-reticle-card group relative flex flex-col justify-between rounded-2xl border border-white/10 bg-surface/90 p-6 backdrop-blur-xl shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-brand/40 hover:shadow-[var(--shadow-lift)]"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-brand/25 bg-brand-soft text-brand transition-all duration-300 group-hover:scale-105 group-hover:border-brand/50 group-hover:bg-brand group-hover:text-brand-foreground shadow-sm">
                    {feature.icon}
                  </span>
                  <span className="font-mono text-[10px] font-bold text-slate-500">
                    // {feature.id}
                  </span>
                </div>

                <h3 className="mt-5 text-base font-bold text-foreground tracking-tight">
                  {feature.title}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-muted">
                  {feature.description}
                </p>
              </div>

              <div className="mt-6 border-t border-border-default pt-3">
                <span className="font-mono text-[10px] font-semibold uppercase text-brand tracking-wider">
                  ✦ {feature.metric}
                </span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
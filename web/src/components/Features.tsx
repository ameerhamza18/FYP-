import type { ReactNode } from 'react';

import { SectionHeading } from './ui';

interface Feature {
  id: string;
  title: string;
  description: string;
  metric: string;
  tileBg: string;
  icon: ReactNode;
}

const FEATURES: Feature[] = [
  {
    id: '01',
    title: 'Four Engines, One Fused Verdict',
    description:
      'A supervised neural classifier, deterministic fraud rulesets, live IOC threat intelligence, and URL forensics are mathematically unified into a single 0–100 risk score.',
    metric: '< 240ms latency',
    tileBg: 'bg-[#CBD4FA] text-[#1D2549]',
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
    tileBg: 'bg-[#CBE3DF] text-[#134E44]',
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
    tileBg: 'bg-[#EFE2D8] text-[#5C3D28]',
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
    tileBg: 'bg-[#E8D68A] text-[#5A4506]',
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
      <div className="relative mx-auto max-w-7xl px-6">
        <SectionHeading
          eyebrow="Capabilities"
          title="Security intelligence that proves every verdict"
          description="Most scanners flash a generic red or green light without explanation. TrustLayer provides concrete mathematical evidence and forensic lineage for every decision."
        />

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <article
              key={feature.title}
              className="group relative flex flex-col justify-between rounded-[26px] border border-border-default bg-surface p-6 shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-105 ${feature.tileBg}`}
                  >
                    {feature.icon}
                  </span>
                  <span className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-semibold text-muted">
                    {feature.id}
                  </span>
                </div>

                <h3 className="mt-6 text-lg font-bold tracking-tight text-foreground">
                  {feature.title}
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-muted">
                  {feature.description}
                </p>
              </div>

              <div className="mt-6 border-t border-border-default pt-4">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#8B3DFF]" />
                  {feature.metric}
                </span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

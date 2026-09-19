import type { ReactNode } from 'react';

import { CARD, SectionHeading } from './ui';

/** Shared SVG props (declared before use so module evaluation is safe). */
const iconProps = {
  xmlns: 'http://www.w3.org/2000/svg',
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

interface Feature {
  title: string;
  description: string;
  icon: ReactNode;
}

const FEATURES: Feature[] = [
  {
    title: 'Four engines, one verdict',
    description:
      'A supervised ML classifier, a curated scam rule-set, live threat-intelligence lookups and URL forensics are fused into a single 0–100 risk score.',
    icon: (
      <svg {...iconProps}>
        <path d="m12 2 9 5-9 5-9-5 9-5Zm9 10-9 5-9-5m18 5-9 5-9-5" />
      </svg>
    ),
  },
  {
    title: 'Explainable by design',
    description:
      'Every verdict ships with the indicators that fired and the manipulation techniques detected — urgency, authority, fear, credential harvesting and more.',
    icon: (
      <svg {...iconProps}>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      </svg>
    ),
  },
  {
    title: 'Multimodal input',
    description:
      'Analyze raw message text, a bare URL, or a screenshot. Images are OCR-extracted in memory and never written to disk.',
    icon: (
      <svg {...iconProps}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    title: 'SOC-grade visibility',
    description:
      'Administrators get a live threat feed, a 14-day risk trend, top manipulation techniques, campaign clustering and a full audit trail.',
    icon: (
      <svg {...iconProps}>
        <path d="M3 3v18h18M7 15l3-4 3 3 5-7" />
      </svg>
    ),
  },
];

export default function Features() {
  return (
    <section
      id="features"
      className="border-b border-border-default bg-background-subtle py-20 lg:py-24"
    >
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeading
          eyebrow="Capabilities"
          title="Detection that explains itself"
          description="Most scanners hand you a red light. TrustLayer shows you the evidence, so you can act with confidence instead of guessing."
        />

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <article
              key={feature.title}
              className={`${CARD} group flex flex-col gap-4 p-6 transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]`}
            >
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-brand/20 bg-brand-soft text-brand transition-colors group-hover:bg-brand group-hover:text-brand-foreground">
                {feature.icon}
              </span>
              <h3 className="text-base font-bold text-foreground">{feature.title}</h3>
              <p className="text-sm leading-relaxed text-muted">{feature.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
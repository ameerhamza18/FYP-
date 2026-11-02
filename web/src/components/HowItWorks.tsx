'use client';

import dynamic from 'next/dynamic';
import { SectionHeading } from './ui';

const ScanningPipeline3D = dynamic(() => import('./3d/ScanningPipeline3D'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[360px] w-full flex-col items-center justify-center rounded-[28px] border border-border-default bg-surface text-xs font-medium text-muted gap-3 shadow-[var(--shadow-card)]">
      <div className="h-7 w-7 rounded-full border-2 border-[#8B3DFF] border-t-transparent animate-spin" />
      <span>Loading 3D Pipeline Topology…</span>
    </div>
  ),
});

const STEPS = [
  {
    step: '01',
    title: 'Multimodal Stream Ingestion',
    body: 'Paste message text, enter a suspected URL, or upload a mobile screenshot. Images undergo in-memory OCR isolation — zero payload data is committed to disk.',
    detail: 'text · url · screenshot',
    latency: '18ms',
    pill: 'bg-[#E8EDFE] text-[#28326B]',
  },
  {
    step: '02',
    title: 'Four Parallel Forensic Engines',
    body: 'The ML neural classifier, deterministic fraud rulesets, threat intelligence lookups, and URL forensics score the payload concurrently.',
    detail: '4 detection channels',
    latency: '82ms',
    pill: 'bg-[#DFF4EC] text-[#158067]',
  },
  {
    step: '03',
    title: 'Adaptive Mathematical Consensus',
    body: 'Channels with absent signals are excluded and weights dynamically redistributed, preventing cold-start bias from diluting confirmed threat indicators.',
    detail: 'weighted consensus',
    latency: '24ms',
    pill: 'bg-[#F7EFE9] text-[#7A5236]',
  },
  {
    step: '04',
    title: 'Explainable Forensic Verdict',
    body: 'Receive a calibrated 0–100 risk index, threat taxonomy tag, fired detection rules, social manipulation tactics, and downloadable incident JSON.',
    detail: 'forensic incident report',
    latency: '12ms',
    pill: 'bg-[#FFF5CC] text-[#9A6B00]',
  },
];

export default function HowItWorks() {
  return (
    <section id="pipeline" className="relative border-b border-border-default bg-background py-20 lg:py-28">
      <div className="relative mx-auto max-w-7xl px-6">
        <SectionHeading
          eyebrow="3D Pipeline Topology"
          title="From deception to detection in under 240ms"
          description="Every payload flows through a multi-stage validation lattice. Interact with the 3D pipeline below to inspect how signals are decomposed and scored."
        />

        <div className="mt-14">
          <ScanningPipeline3D />
        </div>

        <ol className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => (
            <li
              key={step.title}
              className="flex flex-col justify-between rounded-[24px] border border-border-default bg-surface p-6 shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${step.pill}`}>
                    Step {step.step}
                  </span>
                  <span className="text-xs font-medium text-muted">~ {step.latency}</span>
                </div>
                <h3 className="mt-5 text-base font-bold tracking-tight text-foreground">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
              </div>

              <div className="mt-6 border-t border-border-default pt-3">
                <span className="inline-flex items-center rounded-full bg-surface-muted px-3 py-1 text-[11px] font-medium text-muted">
                  {step.detail}
                </span>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

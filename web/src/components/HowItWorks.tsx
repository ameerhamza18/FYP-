'use client';

import dynamic from 'next/dynamic';
import { SectionHeading } from './ui';

const ScanningPipeline3D = dynamic(() => import('./3d/ScanningPipeline3D'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[360px] w-full flex-col items-center justify-center rounded-3xl border border-white/10 bg-[#070c18] font-mono text-xs text-slate-500 animate-pulse gap-3">
      <div className="h-7 w-7 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
      <span>LOADING 3D PIPELINE TOPOLOGY...</span>
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
  },
  {
    step: '02',
    title: 'Four Parallel Forensic Engines',
    body: 'The ML neural classifier, deterministic fraud rulesets, threat intelligence lookups, and URL forensics score the payload concurrently.',
    detail: '4 detection channels',
    latency: '82ms',
  },
  {
    step: '03',
    title: 'Adaptive Mathematical Consensus',
    body: 'Channels with absent signals are excluded and weights dynamically redistributed, preventing cold-start bias from diluting confirmed threat indicators.',
    detail: 'weighted consensus',
    latency: '24ms',
  },
  {
    step: '04',
    title: 'Explainable Forensic Verdict',
    body: 'Receive a calibrated 0–100 risk index, threat taxonomy tag, fired detection rules, social manipulation tactics, and downloadable incident JSON.',
    detail: 'forensic incident report',
    latency: '12ms',
  },
];

export default function HowItWorks() {
  return (
    <section id="pipeline" className="relative border-b border-border-default py-20 lg:py-28 bg-ink">
      <div className="tl-cyber-grid pointer-events-none absolute inset-0 opacity-20" />

      <div className="relative mx-auto max-w-7xl px-6">
        <SectionHeading
          eyebrow="3D PIPELINE TOPOLOGY"
          title="From deception to detection in under 240ms"
          description="Every payload flows through a multi-stage validation lattice. Interact with the 3D pipeline below to inspect how signals are decomposed and scored."
        />

        {/* Interactive 3D Scanning Pipeline Canvas */}
        <div className="mt-14">
          <ScanningPipeline3D />
        </div>

        {/* 4 Pipeline Steps */}
        <ol className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => (
            <li
              key={step.title}
              className="tl-reticle-card relative flex flex-col justify-between rounded-2xl border border-white/10 bg-[#080d1a]/90 p-6 shadow-xl backdrop-blur-xl transition-all duration-300 hover:border-brand/40"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-black text-brand-cyan">
                    [{step.step}]
                  </span>
                  <span className="font-mono text-[10px] text-slate-500">
                    ~ {step.latency}
                  </span>
                </div>
                <h3 className="mt-4 text-base font-bold text-white tracking-tight">
                  {step.title}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">
                  {step.body}
                </p>
              </div>

              <div className="mt-6 border-t border-white/5 pt-3">
                <span className="inline-flex items-center rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-slate-400">
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
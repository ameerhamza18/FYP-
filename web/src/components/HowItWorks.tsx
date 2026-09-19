import { CARD, SectionHeading } from './ui';

const STEPS = [
  {
    title: 'Submit the content',
    body: 'Paste message text, drop in a bare URL, or upload a screenshot. Images are OCR-extracted in memory — the file never touches disk.',
    detail: 'text · url · screenshot',
  },
  {
    title: 'Engines run in parallel',
    body: 'The ML classifier, the scam rule-set, threat-intelligence lookups and URL forensics each score the content independently.',
    detail: '4 detection channels',
  },
  {
    title: 'Signals are fused',
    body: 'Channels that produced no evidence are excluded and their weight redistributed, so a cold start never drags the score down artificially.',
    detail: 'weighted fusion',
  },
  {
    title: 'You get a decision',
    body: 'A 0–100 risk score, the threat category, the indicators that fired, the manipulation techniques detected, and a concrete recommendation.',
    detail: 'explainable output',
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="border-b border-border-default py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeading
          eyebrow="How it works"
          title="From suspicion to certainty in four steps"
          description="No black box. You always see which signals drove the verdict, so the result is defensible."
        />

        <ol className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className={`${CARD} relative flex flex-col gap-3 p-6`}>
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand text-sm font-bold text-brand-foreground">
                {index + 1}
              </span>
              <h3 className="text-base font-bold text-foreground">{step.title}</h3>
              <p className="text-sm leading-relaxed text-muted">{step.body}</p>
              <span className="mt-auto inline-flex w-fit items-center rounded-md border border-border-default bg-surface-muted px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted">
                {step.detail}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
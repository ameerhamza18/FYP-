import { riskTone, scoreDescriptor, TONE_VAR } from '@/lib/presentation';

/**
 * Circular risk dial. Colour follows the shared risk tokens so it adapts to
 * the active theme automatically.
 */
export default function RiskGauge({
  score,
  level,
  size = 168,
  thickness = 13,
  caption,
}: {
  score: number;
  level?: string | null;
  size?: number;
  thickness?: number;
  caption?: string;
}) {
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const offset = circumference * (1 - clamped / 100);
  const tone = riskTone(level);
  const color = TONE_VAR[tone];

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Risk score ${clamped} out of 100 — ${scoreDescriptor(clamped)}`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={thickness}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 700ms cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-bold tabular-nums leading-none"
          style={{ color, fontSize: size * 0.27 }}
        >
          {clamped}
        </span>
        <span
          className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em]"
          style={{ color }}
        >
          {level ?? scoreDescriptor(clamped)}
        </span>
        {caption && <span className="mt-0.5 text-[10px] text-muted">{caption}</span>}
      </div>
    </div>
  );
}
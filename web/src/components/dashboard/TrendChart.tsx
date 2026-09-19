import { formatDate } from '@/lib/presentation';
import type { ThreatTrendPoint } from '@/lib/types';

/**
 * 14-day risk trend. Drawn with a fixed viewBox so the aspect ratio is stable
 * at any container width.
 */
export default function TrendChart({ data }: { data: ThreatTrendPoint[] }) {
  const W = 640;
  const H = 190;
  const PAD_X = 28;
  const PAD_Y = 26;

  if (!data || data.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted">
        No analyses recorded in the last 14 days.
      </p>
    );
  }

  const max = Math.max(...data.map((d) => d.total), 1);
  const span = Math.max(data.length - 1, 1);
  const stepX = (W - PAD_X * 2) / span;

  const x = (index: number) => PAD_X + index * stepX;
  const y = (value: number) => H - PAD_Y - (value / max) * (H - PAD_Y * 2);

  const toPath = (selector: (point: ThreatTrendPoint) => number) =>
    data
      .map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)},${y(selector(point)).toFixed(1)}`)
      .join(' ');

  const totalPath = toPath((d) => d.total);
  const highPath = toPath((d) => d.high);
  const areaPath = `${totalPath} L${x(data.length - 1).toFixed(1)},${H - PAD_Y} L${x(0).toFixed(1)},${H - PAD_Y} Z`;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-brand" aria-hidden />
          All analyses
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-risk-high" aria-hidden />
          High / critical
        </span>
        <span className="ml-auto tabular-nums">Peak {max}/day</span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`Threat trend over ${data.length} days, peak ${max} per day`}
      >
        <defs>
          <linearGradient id="tl-trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0, 0.5, 1].map((fraction) => {
          const gridY = PAD_Y + fraction * (H - PAD_Y * 2);
          return (
            <line
              key={fraction}
              x1={PAD_X}
              x2={W - PAD_X}
              y1={gridY}
              y2={gridY}
              stroke="var(--border)"
              strokeWidth="1"
              strokeDasharray="4 6"
            />
          );
        })}

        <path d={areaPath} fill="url(#tl-trend-fill)" />
        <path
          d={totalPath}
          fill="none"
          stroke="var(--brand)"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={highPath}
          fill="none"
          stroke="var(--risk-high)"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="5 4"
        />

        {data.map((point, index) => (
          <circle
            key={point.date}
            cx={x(index)}
            cy={y(point.total)}
            r="3"
            fill="var(--surface)"
            stroke="var(--brand)"
            strokeWidth="2"
          />
        ))}
      </svg>

      <div className="mt-2 flex justify-between text-[11px] text-muted">
        <span>{formatDate(data[0].date)}</span>
        {data.length > 2 && <span>{formatDate(data[Math.floor(data.length / 2)].date)}</span>}
        <span>{formatDate(data[data.length - 1].date)}</span>
      </div>
    </div>
  );
}
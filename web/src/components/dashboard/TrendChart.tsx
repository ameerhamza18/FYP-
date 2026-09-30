import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
} from 'recharts';
import { formatDate } from '@/lib/presentation';
import type { ThreatTrendPoint } from '@/lib/types';

/**
 * 14-day risk trend.
 * Upgraded to Recharts for interactivity and professional visualization.
 */
export default function TrendChart({ data }: { data: ThreatTrendPoint[] }) {
  if (!data || data.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted">
        No analyses recorded in the last 14 days.
      </p>
    );
  }

  const max = Math.max(...data.map((d) => d.total), 1);

  return (
    <div className="h-[220px] w-full">
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
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

      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--brand)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--brand)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="var(--border)"
            opacity={0.5}
          />
          <XAxis
            dataKey="date"
            tickFormatter={(val) => formatDate(val)}
            tick={{ fontSize: 11, fill: 'var(--muted)' }}
            axisLine={false}
            tickLine={false}
            minTickGap={30}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--muted)' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--surface)',
              borderColor: 'var(--border)',
              borderRadius: '12px',
              fontSize: '12px',
              color: 'var(--foreground)',
            }}
            itemStyle={{ color: 'var(--foreground)' }}
          />
          <Area
            type="monotone"
            dataKey="total"
            stroke="var(--brand)"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorTotal)"
          />
          <Line
            type="monotone"
            dataKey="high"
            stroke="var(--risk-high)"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

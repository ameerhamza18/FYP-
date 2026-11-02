import {
  ComposedChart,
  Area,
  Bar,
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
 * 14-day risk trend styled after the RevenueX "Revenue Trends" chart:
 * violet impulse bars + smooth spline curve + floating editorial tooltip card.
 */
export default function TrendChart({ data }: { data: ThreatTrendPoint[] }) {
  if (!data || data.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted">
        No analyses recorded in the last 14 days.
      </p>
    );
  }

  return (
    <div className="h-[235px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 12, right: 10, left: -22, bottom: 0 }}
        >
          <defs>
            <linearGradient id="tlVioletFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8B3DFF" stopOpacity={0.22} />
              <stop offset="95%" stopColor="#8B3DFF" stopOpacity={0.01} />
            </linearGradient>
            <linearGradient id="tlImpulseBars" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8B3DFF" stopOpacity={0.55} />
              <stop offset="100%" stopColor="#C4B5FD" stopOpacity={0.12} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="var(--border)"
            opacity={0.75}
          />
          <XAxis
            dataKey="date"
            tickFormatter={(val) => formatDate(val)}
            tick={{ fontSize: 11, fill: 'var(--muted)' }}
            axisLine={false}
            tickLine={false}
            minTickGap={28}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--muted)' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ stroke: '#8B3DFF', strokeWidth: 1, strokeDasharray: '3 3' }}
            content={({ active, payload, label }) => {
              if (!active || !payload || payload.length === 0) return null;
              const point = payload[0]?.payload as ThreatTrendPoint | undefined;
              if (!point) return null;
              const highPct =
                point.total > 0 ? Math.round((point.high / point.total) * 100) : 0;
              return (
                <div className="rounded-2xl border border-border-default bg-surface px-3.5 py-2.5 shadow-[var(--shadow-lift)]">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold tabular-nums text-foreground">
                      {point.total} scans
                    </span>
                    <span className="rounded-full bg-[#A3F750] px-2 py-0.5 text-[10px] font-bold text-[#143300]">
                      {point.high} high ({highPct}%)
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted">{formatDate(String(label))}</p>
                </div>
              );
            }}
          />
          <Bar
            dataKey="total"
            fill="url(#tlImpulseBars)"
            radius={[4, 4, 0, 0]}
            barSize={8}
          />
          <Area
            type="monotone"
            dataKey="total"
            stroke="#8B3DFF"
            strokeWidth={2.2}
            fillOpacity={1}
            fill="url(#tlVioletFill)"
          />
          <Line
            type="monotone"
            dataKey="high"
            stroke="var(--risk-critical)"
            strokeWidth={1.8}
            strokeDasharray="4 4"
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

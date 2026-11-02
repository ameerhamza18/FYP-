import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CARD } from '@/components/ui';
import type { AdminStats } from '@/lib/types';

/**
 * Interactive bar chart for most-abused social-engineering techniques,
 * styled with RevenueX editorial serif header and violet accents.
 */
export default function TechniqueBars({ stats }: { stats: AdminStats }) {
  const techniques = stats.top_techniques ?? [];

  if (techniques.length === 0) {
    return (
      <section className={`${CARD} p-6`}>
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-muted text-foreground">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 20V10M12 20V4M6 20v-6" />
            </svg>
          </span>
          <h2 className="tl-serif text-xl text-foreground">Most-Abused Techniques</h2>
        </div>
        <p className="mt-4 text-sm text-muted">
          No social-engineering techniques recorded yet.
        </p>
      </section>
    );
  }

  const chartData = techniques.map((t) => ({
    name: t.technique,
    count: t.count,
  }));

  return (
    <section className={`${CARD} p-6`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-muted text-foreground">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 20V10M12 20V4M6 20v-6" />
            </svg>
          </span>
          <h2 className="tl-serif text-xl text-foreground">Most-Abused Techniques</h2>
        </div>
        <span className="rounded-full bg-surface-muted px-3 py-1 text-[11px] font-medium text-muted">
          8-Vector Taxonomy
        </span>
      </div>

      <div className="mt-4 h-[270px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={chartData}
            margin={{ top: 5, right: 24, left: 24, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" opacity={0.6} />
            <XAxis type="number" hide />
            <YAxis
              dataKey="name"
              type="category"
              tick={{ fontSize: 11.5, fill: 'var(--foreground)' }}
              axisLine={false}
              tickLine={false}
              width={110}
            />
            <Tooltip
              cursor={{ fill: 'var(--surface-muted)', opacity: 0.6 }}
              contentStyle={{
                backgroundColor: 'var(--surface)',
                borderColor: 'var(--border)',
                borderRadius: '14px',
                fontSize: '12px',
                color: 'var(--foreground)',
              }}
            />
            <Bar
              dataKey="count"
              fill="#8B3DFF"
              radius={[0, 8, 8, 0]}
              barSize={14}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

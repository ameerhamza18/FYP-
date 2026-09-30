import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CARD } from '@/components/ui';
import type { AdminStats } from '@/lib/types';

/**
 * Interactive bar chart for most-abused techniques.
 * Extracted from the main dashboard page for better maintainability.
 */
export default function TechniqueBars({ stats }: { stats: AdminStats }) {
  const techniques = stats.top_techniques ?? [];

  if (techniques.length === 0) {
    return (
      <section className={`${CARD} p-5`}>
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted">
          Most-abused techniques
        </h2>
        <p className="mt-4 text-sm text-muted">
          No social-engineering techniques recorded yet.
        </p>
      </section>
    );
  }

  // Format data for Recharts: [{ name: 'Technique', count: 123 }]
  const chartData = techniques.map(t => ({
    name: t.technique,
    count: t.count
  }));

  return (
    <section className={`${CARD} p-5`}>
      <h2 className="text-sm font-bold uppercase tracking-wider text-muted">
        Most-abused techniques
      </h2>
      <div className="mt-4 h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={chartData}
            margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" opacity={0.5} />
            <XAxis type="number" hide />
            <YAxis
              dataKey="name"
              type="category"
              tick={{ fontSize: 11, fill: 'var(--muted)' }}
              axisLine={false}
              tickLine={false}
              width={100}
            />
            <Tooltip
              cursor={{ fill: 'var(--surface-muted)', opacity: 0.4 }}
              contentStyle={{
                backgroundColor: 'var(--surface)',
                borderColor: 'var(--border)',
                borderRadius: '12px',
                fontSize: '12px',
                color: 'var(--foreground)',
              }}
            />
            <Bar
              dataKey="count"
              fill="var(--brand)"
              radius={[0, 4, 4, 0]}
              barSize={12}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

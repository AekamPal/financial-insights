import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { gdpGrowth } from '../data/financialData';

export default function GdpChart() {
  const data = gdpGrowth.map(d => ({ quarter: d.month, value: d.value }));
  return (
    <div className="glass" style={{ borderRadius: 'var(--radius-lg)', padding: '22px 24px' }}>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey="quarter" tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.4)' }} axisLine={false} tickLine={false} />
          <YAxis domain={[4, 10]} tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.4)' }} axisLine={false} tickLine={false} width={30}
            tickFormatter={v => `${v}%`} />
          <Tooltip
            contentStyle={{
              background: 'rgba(6,13,31,0.92)',
              border: '1px solid rgba(99,160,255,0.2)',
              borderRadius: 8, fontSize: 12,
              color: 'rgba(255,255,255,0.85)',
            }}
            formatter={(v) => [`${v}%`, 'GDP Growth']}
          />
          <ReferenceLine y={7} stroke="#22d3ee" strokeDasharray="3 3" strokeOpacity={0.5}
            label={{ value: '7% target', fill: '#22d3ee88', fontSize: 10, position: 'insideTopRight' }} />
          <Bar dataKey="value" name="GDP Growth %" fill="#14b8a6" fillOpacity={0.85} radius={[4,4,0,0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

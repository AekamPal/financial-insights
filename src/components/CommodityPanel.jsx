import { useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import ChartTooltip from './ChartTooltip';
import { TrendingUp, TrendingDown } from 'lucide-react';

export default function CommodityPanel({ commodities }) {
  const [selected, setSelected] = useState(0);
  const item = commodities[selected];
  const chartData = item.series.map(d => ({ month: d.month.slice(2), value: d.value }));

  return (
    <div className="glass" style={{ borderRadius: 'var(--radius-lg)', padding: '22px 24px' }}>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>
        Commodities
      </div>
      {/* tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
        {commodities.map((c, i) => (
          <button key={c.name} onClick={() => setSelected(i)} style={{
            padding: '5px 11px', fontSize: 11, fontWeight: 500, borderRadius: 8,
            border: `1px solid ${i === selected ? c.color + '60' : 'transparent'}`,
            background: i === selected ? c.color + '18' : 'rgba(255,255,255,0.04)',
            color: i === selected ? c.color : 'var(--text-secondary)',
            cursor: 'pointer', transition: 'all 0.2s',
          }}>{c.name.split(' ')[0]}</button>
        ))}
      </div>
      {/* hero */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
        <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', color: item.color }}>
          {item.value.toLocaleString('en-IN')}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.unit}</span>
        <span className={`tag ${item.change >= 0 ? 'tag-up' : 'tag-down'}`} style={{ marginLeft: 'auto' }}>
          {item.change >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
          {item.change >= 0 ? '+' : ''}{item.change}%
        </span>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="comm-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={item.color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={item.color} stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} interval={4} />
          <YAxis domain={['auto','auto']} tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} width={50}
            tickFormatter={v => v.toLocaleString('en-IN')} />
          <Tooltip content={<ChartTooltip />} />
          <Area type="monotone" dataKey="value" name={item.name} stroke={item.color} strokeWidth={2}
            fill="url(#comm-grad)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

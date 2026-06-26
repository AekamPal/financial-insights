import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function ChartMini({ data, color }) {
  return (
    <ResponsiveContainer width="100%" height={130}>
      <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`mini-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0.01} />
          </linearGradient>
        </defs>
        <XAxis dataKey="month" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} interval={5} />
        <YAxis hide domain={['auto','auto']} />
        <Tooltip
          contentStyle={{
            background: 'rgba(6,13,31,0.9)',
            border: '1px solid rgba(99,160,255,0.2)',
            borderRadius: 8, fontSize: 12,
            color: 'rgba(255,255,255,0.85)',
          }}
        />
        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2}
          fill={`url(#mini-${color.replace('#','')})`} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

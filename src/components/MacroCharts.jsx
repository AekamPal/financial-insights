import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts';
import ChartTooltip from './ChartTooltip';

function mini(data, color, label, suffix = '', refVal = null) {
  const d = data.map(x => ({ month: x.month.slice(2), value: x.value }));
  return (
    <div className="glass glass-hover" style={{ borderRadius: 'var(--radius-md)', padding: '16px 18px' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 10, color }}>
        {d.at(-1).value}{suffix}
      </div>
      <ResponsiveContainer width="100%" height={80}>
        <LineChart data={d} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <XAxis dataKey="month" hide />
          <YAxis hide domain={['auto', 'auto']} />
          <Tooltip content={<ChartTooltip suffix={suffix} />} />
          {refVal && <ReferenceLine y={refVal} stroke={color} strokeDasharray="3 3" strokeOpacity={0.4} />}
          <Line type="monotone" dataKey="value" name={label} stroke={color} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function fiiBar(data) {
  const d = data.slice(-12).map(x => ({
    month: x.month.slice(2),
    value: parseFloat((x.value / 1000).toFixed(1)),
  }));
  return (
    <div className="glass glass-hover" style={{ borderRadius: 'var(--radius-md)', padding: '16px 18px' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>FII Flows (₹'000 Cr)</div>
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 10, color: '#22d3ee' }}>
        {d.at(-1).value > 0 ? '+' : ''}{d.at(-1).value}k Cr
      </div>
      <ResponsiveContainer width="100%" height={80}>
        <BarChart data={d} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <XAxis dataKey="month" hide />
          <YAxis hide />
          <Tooltip content={<ChartTooltip suffix="k Cr" />} />
          <Bar dataKey="value" name="FII Net" radius={[3,3,0,0]}
            fill="#22d3ee" fillOpacity={0.7}
            label={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function MacroCharts({ inflation, repoRate, usdinr, fiiFlow }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
      {mini(inflation, '#f59e0b', 'CPI Inflation', '%', 4)}
      {mini(repoRate,  '#6366f1', 'RBI Repo Rate', '%', 6.5)}
      {mini(usdinr,   '#22c55e', 'USD / INR', '', 84)}
      {fiiBar(fiiFlow)}
    </div>
  );
}

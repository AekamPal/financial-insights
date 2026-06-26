import { useState } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts';
import { Brain, TrendingUp, TrendingDown, Flame, BarChart2, ChevronDown, ChevronUp, Coins } from 'lucide-react';
import { linearRegression, forecast, generateInsight, oilImpactNarrative } from '../utils/regression';

function CorrelationBar({ label, corr, desc }) {
  const abs = Math.abs(corr);
  const positive = corr > 0;
  const color = abs > 0.6 ? '#f43f5e' : abs > 0.35 ? '#f59e0b' : '#22d3ee';
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 13, fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color }}>{corr > 0 ? '+' : ''}{corr}</span>
      </div>
      <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${abs * 100}%`,
          background: `linear-gradient(90deg, ${color}60, ${color})`,
          borderRadius: 3, transition: 'width 1s ease',
        }} />
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{desc}</div>
    </div>
  );
}

function ForecastChart({ data, label, color, n = 4 }) {
  const fc = forecast(data, n);
  const combined = [
    ...data.slice(-12).map(d => ({ month: d.month.slice(2), actual: d.value })),
    ...fc.map(d => ({ month: d.month.slice(2), predicted: d.value })),
  ];
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
        Regression Forecast — next {n} months
      </div>
      <ResponsiveContainer width="100%" height={120}>
        <ScatterChart margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey="month" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} />
          <YAxis domain={['auto','auto']} tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} width={50} />
          <Tooltip cursor={{ stroke: 'rgba(255,255,255,0.1)' }} content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0];
            return (
              <div style={{ background: 'rgba(6,13,31,0.95)', border: '1px solid rgba(99,160,255,0.2)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
                <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{p.payload.month}</div>
                <div style={{ color: p.fill, fontWeight: 700 }}>{Number(p.value).toLocaleString('en-IN')}</div>
              </div>
            );
          }} />
          <Scatter data={combined.filter(d => d.actual !== undefined).map(d => ({ month: d.month, value: d.actual }))}
            dataKey="value" name="Actual" fill={color} />
          <Scatter data={combined.filter(d => d.predicted !== undefined).map(d => ({ month: d.month, value: d.predicted }))}
            dataKey="value" name="Forecast" fill="#f59e0b" shape="triangle" />
        </ScatterChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', gap: 14, marginTop: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} /> Actual
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)' }}>
          <span style={{ width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderBottom: '8px solid #f59e0b', display: 'inline-block' }} /> Forecast
        </div>
      </div>
    </div>
  );
}

export default function InsightsPanel({ crudeoil, nifty50, gold, usdinr, inflation, oilImpacts }) {
  const [expanded, setExpanded] = useState(null);
  const niftyClose = nifty50.map(d => ({ month: d.month, value: d.close }));
  const oilNarrative = oilImpactNarrative(crudeoil, oilImpacts);
  const niftyInsight = generateInsight('Nifty 50', niftyClose);
  const oilInsight   = generateInsight('Crude Oil', crudeoil, ' USD/bbl');
  const goldInsight  = generateInsight('Gold', gold, ' ₹/10g');

  const topics = [
    { id: 'oil',   label: 'Crude Oil Impact Analysis',  Icon: Flame,     text: oilNarrative,  color: '#f59e0b', data: crudeoil,  forecastColor: '#f59e0b' },
    { id: 'nifty', label: 'Nifty 50 Trend Regression',  Icon: TrendingUp, text: niftyInsight, color: '#3b82f6', data: niftyClose,forecastColor: '#3b82f6' },
    { id: 'gold',  label: 'Gold Price Outlook',          Icon: Coins,     text: goldInsight,   color: '#fbbf24', data: gold,      forecastColor: '#fbbf24' },
    { id: 'infl',  label: 'Inflation vs Repo Rate',      Icon: BarChart2, text: `RBI has been managing inflation through active repo rate adjustments. A persistent CPI above 4% target has led to elevated rates, suppressing credit growth and consumption. As inflation moderates, markets anticipate rate cuts that could re-rate equities and attract FII inflows.`, color: '#6366f1', data: inflation, forecastColor: '#6366f1' },
  ];

  return (
    <div>
      {/* Oil correlation matrix */}
      <div className="glass" style={{ borderRadius: 'var(--radius-lg)', padding: '22px 24px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <Brain size={18} color="#6366f1" />
          <span style={{ fontSize: 16, fontWeight: 650 }}>Crude Oil → Market Correlations</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>24-month Pearson r</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px' }}>
          {oilImpacts.map(impact => (
            <CorrelationBar key={impact.factor} label={impact.factor} corr={impact.corr} desc={impact.desc} />
          ))}
        </div>
      </div>

      {/* Collapsible insight cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {topics.map(t => (
          <div key={t.id} className="glass" style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            <button onClick={() => setExpanded(expanded === t.id ? null : t.id)} style={{
              width: '100%', padding: '16px 20px', background: 'transparent', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
              fontFamily: 'var(--font)',
            }}>
              <span style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                background: `${t.color}18`, border: `1px solid ${t.color}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <t.Icon size={15} color={t.color} strokeWidth={2} />
              </span>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', flex: 1, fontFamily: 'var(--font)', letterSpacing: '-0.01em' }}>{t.label}</span>
              <span style={{ color: t.color, marginRight: 4, flexShrink: 0 }}>
                {expanded === t.id ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
              </span>
            </button>
            {expanded === t.id && (
              <div style={{ padding: '0 20px 20px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginTop: 14 }}>{t.text}</p>
                <ForecastChart data={t.data} label={t.label} color={t.forecastColor} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

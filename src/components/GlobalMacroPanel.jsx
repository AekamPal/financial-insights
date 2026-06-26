import React, { useState } from 'react';
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { AV_INDICATOR_META, AV_COMMODITY_META } from '../api/alphaVantage';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(v, decimals = 2) {
  if (v == null || isNaN(v)) return '—';
  return `${v >= 0 ? '' : ''}${v.toFixed(decimals)}`;
}

function latestChange(series) {
  if (!series?.length || series.length < 2) return null;
  const a = series[series.length - 2].value;
  const b = series[series.length - 1].value;
  return b - a;
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, unit }) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div style={{
      background: '#1e293b', border: '1px solid #334155', borderRadius: 8,
      padding: '8px 12px', fontSize: 12, color: '#e2e8f0',
    }}>
      <div style={{ color: '#94a3b8', marginBottom: 2 }}>{d.payload.month}</div>
      <div style={{ fontWeight: 700, color: d.color }}>
        {fmt(d.value)}{unit}
      </div>
    </div>
  );
}

// ── Single indicator card ──────────────────────────────────────────────────────

function IndicatorCard({ indicatorKey, series }) {
  const meta  = AV_INDICATOR_META[indicatorKey];
  const [open, setOpen] = useState(false);
  if (!meta || !series?.length) return null;

  const latest = series[series.length - 1];
  const delta  = latestChange(series);
  const isUp   = delta >= 0;
  const color  = meta.color;

  // Show last 36 data points for chart
  const chartData = series.slice(-36);
  const minVal    = Math.min(...chartData.map(d => d.value));
  const maxVal    = Math.max(...chartData.map(d => d.value));
  const padding   = (maxVal - minVal) * 0.15 || 0.5;
  const hasNeg    = minVal < 0;

  return (
    <div style={{
      background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12,
      padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{meta.label}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 24, fontWeight: 700, color: '#f1f5f9' }}>
              {fmt(latest.value)}<span style={{ fontSize: 14, color: '#64748b' }}>{meta.unit}</span>
            </span>
            {delta != null && (
              <span style={{ fontSize: 12, color: isUp ? '#4ade80' : '#f87171' }}>
                {isUp ? '▲' : '▼'} {Math.abs(delta).toFixed(2)}{meta.unit} MoM
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
            as of {latest.month}
          </div>
        </div>
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            background: 'none', border: '1px solid #334155', borderRadius: 6,
            color: '#64748b', fontSize: 11, padding: '3px 8px', cursor: 'pointer',
          }}
        >
          {open ? 'Hide note' : 'Why it matters'}
        </button>
      </div>

      {/* Explanation */}
      {open && (
        <div style={{
          background: '#1e293b', borderRadius: 8, padding: '10px 12px',
          fontSize: 12, color: '#94a3b8', lineHeight: 1.6,
        }}>
          {meta.note}
        </div>
      )}

      {/* Chart */}
      <ResponsiveContainer width="100%" height={90}>
        <AreaChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`grad-${indicatorKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis dataKey="month" hide />
          <YAxis domain={[minVal - padding, maxVal + padding]} hide />
          {hasNeg && <ReferenceLine y={0} stroke="#334155" strokeDasharray="3 3" />}
          <Tooltip content={<ChartTooltip unit={meta.unit} />} />
          <Area
            type="monotone" dataKey="value"
            stroke={color} strokeWidth={2}
            fill={`url(#grad-${indicatorKey})`}
            dot={false} activeDot={{ r: 3 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Commodity history mini-cards ───────────────────────────────────────────────

function CommodityHistoryCard({ avKey, series }) {
  const meta = AV_COMMODITY_META[avKey];
  if (!meta || !series?.length) return null;

  const latest  = series[series.length - 1];
  const prev12  = series.length >= 13 ? series[series.length - 13] : null;
  const yoyPct  = prev12 ? +((latest.value - prev12.value) / prev12.value * 100).toFixed(1) : null;
  const isUp    = yoyPct >= 0;
  const color   = meta.color;
  const chartData = series.slice(-24);
  const minVal  = Math.min(...chartData.map(d => d.value));
  const maxVal  = Math.max(...chartData.map(d => d.value));
  const pad     = (maxVal - minVal) * 0.12 || 1;

  return (
    <div style={{
      background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10,
      padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 11, color: '#64748b' }}>{meta.label}</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', lineHeight: 1.2 }}>
            {fmt(latest.value)}<span style={{ fontSize: 11, color: '#64748b', marginLeft: 3 }}>{meta.unit}</span>
          </div>
        </div>
        {yoyPct != null && (
          <div style={{
            fontSize: 12, fontWeight: 600,
            color: isUp ? '#4ade80' : '#f87171',
            background: isUp ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
            padding: '3px 8px', borderRadius: 20,
          }}>
            {isUp ? '▲' : '▼'} {Math.abs(yoyPct)}% YoY
          </div>
        )}
      </div>
      <ResponsiveContainer width="100%" height={52}>
        <LineChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
          <XAxis dataKey="month" hide />
          <YAxis domain={[minVal - pad, maxVal + pad]} hide />
          <Tooltip content={<ChartTooltip unit={` ${meta.unit}`} />} />
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function GlobalMacroPanel({ avIndicators, avCommodities, fetchedAt }) {
  const [collapsed, setCollapsed] = useState(false);

  const hasIndicators = Object.keys(avIndicators ?? {}).length > 0;
  const hasCommodities = Object.keys(avCommodities ?? {}).length > 0;
  if (!hasIndicators && !hasCommodities) return null;

  return (
    <div style={{
      background: '#0a0f1a', border: '1px solid #1e293b', borderRadius: 16,
      padding: '20px 24px', marginBottom: 24,
    }}>
      {/* Panel header */}
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: collapsed ? 0 : 20 }}
        onClick={() => setCollapsed(o => !o)}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>
              Global Macro Signals
            </span>
            <span style={{
              fontSize: 10, padding: '2px 7px', borderRadius: 20,
              background: 'rgba(99,102,241,0.15)', color: '#818cf8', fontWeight: 600,
            }}>
              AV
            </span>
          </div>
          <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
            US economic indicators &amp; commodity history · Alpha Vantage official monthly data
            {fetchedAt && ` · updated ${new Date(fetchedAt).toLocaleTimeString()}`}
          </div>
        </div>
        <span style={{ color: '#475569', fontSize: 16 }}>{collapsed ? '▼' : '▲'}</span>
      </div>

      {!collapsed && (
        <>
          {/* Economic indicators 2-col grid */}
          {hasIndicators && (
            <>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Economic Indicators
              </div>
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginBottom: 20,
              }}>
                {Object.keys(AV_INDICATOR_META).map(k =>
                  avIndicators[k]?.length ? (
                    <IndicatorCard key={k} indicatorKey={k} series={avIndicators[k]} />
                  ) : null
                )}
              </div>
            </>
          )}

          {/* Commodity history 3-col grid */}
          {hasCommodities && (
            <>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Commodity Monthly History (Official AV Data)
              </div>
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10,
              }}>
                {Object.keys(AV_COMMODITY_META).map(k => {
                  const appKey = AV_COMMODITY_META[k].appKey;
                  return avCommodities[appKey]?.length ? (
                    <CommodityHistoryCard key={k} avKey={k} series={avCommodities[appKey]} />
                  ) : null;
                })}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { X, TrendingUp, TrendingDown, BarChart2 } from 'lucide-react';
import { linearRegression } from '../utils/regression';
import { getSeriesForSpan, ALL_SPANS } from '../utils/shortTermData';

const SPANS = ALL_SPANS;

function fmt(v) {
  if (typeof v !== 'number') return '—';
  return v.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export default function HistoryModal({ item, onClose }) {
  const [span, setSpan] = useState('1Y');
  const [tab,  setTab]  = useState('Chart');

  // close on Escape
  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  if (!item) return null;

  const isOHLC  = 'close' in (item.series?.[0] ?? {});
  const baseVal  = isOHLC ? item.series.at(-1)?.close : item.series.at(-1)?.value ?? 0;
  const baseVol  = baseVal * 0.012;
  const sliced   = getSeriesForSpan(span, baseVal, baseVol, item.series ?? []);
  const isShort  = ['1H','4H','1D','1W','1M'].includes(span);

  const values  = sliced.map(d => d.value ?? d.close ?? 0);
  const hi      = Math.max(...values);
  const lo      = Math.min(...values);
  const avg     = values.reduce((a, b) => a + b, 0) / values.length;
  const current = values.at(-1) ?? 0;
  const start   = values[0] ?? 0;
  const pctChg  = start ? ((current - start) / start * 100) : 0;

  const chartData = sliced.map(d => ({
    month: d.time ?? d.month?.slice(2) ?? '',
    value: d.value ?? (isOHLC ? d.close : 0),
    high:  !isShort && isOHLC ? d.high : undefined,
    low:   !isShort && isOHLC ? d.low  : undefined,
  }));

  const reg = linearRegression(chartData.map((d, i) => ({ month: String(i), value: d.value })));

  const tableRows = [...sliced].reverse().map(d => ({
    month:  d.time ?? d.month ?? '',
    value:  d.value ?? (isOHLC ? d.close : 0),
    open:   !isShort && isOHLC ? d.open   : undefined,
    high:   !isShort && isOHLC ? d.high   : undefined,
    low:    !isShort && isOHLC ? d.low    : undefined,
    volume: !isShort && isOHLC ? d.volume : undefined,
  }));

  const color = item.color ?? '#3b82f6';

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(3,7,18,0.75)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
        animation: 'fadeIn 0.18s ease',
      }}
    >
      <div className="glass" style={{
        width: '100%', maxWidth: 860, maxHeight: '88vh',
        borderRadius: 'var(--radius-xl)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        borderColor: `${color}28`,
        boxShadow: `0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px ${color}20`,
        animation: 'modalIn 0.22s cubic-bezier(0.16,1,0.3,1)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: `${color}18`, border: `1px solid ${color}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <BarChart2 size={16} color={color} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em' }}>{item.name ?? item.label}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{item.unit ?? item.sub ?? ''}</div>
          </div>
          {/* Current value */}
          <div style={{ textAlign: 'right', marginRight: 16 }}>
            <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', color }}>{fmt(current)}</div>
            <span className={`tag ${pctChg >= 0 ? 'tag-up' : 'tag-down'}`} style={{ float: 'right', marginTop: 4 }}>
              {pctChg >= 0 ? <TrendingUp size={9}/> : <TrendingDown size={9}/>}
              {pctChg >= 0 ? '+' : ''}{pctChg.toFixed(2)}% ({span})
            </span>
          </div>
          <button onClick={onClose} style={{
            width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.05)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <X size={14} color="var(--text-secondary)" />
          </button>
        </div>

        {/* Stat pills */}
        <div style={{
          display: 'flex', gap: 8, padding: '14px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0,
        }}>
          {[
            { label: 'Period High', value: fmt(hi), up: true },
            { label: 'Period Low',  value: fmt(lo), up: false },
            { label: 'Average',     value: fmt(avg) },
            { label: 'Trend',       value: reg.direction === 'up' ? '↑ Upward' : '↓ Downward', up: reg.direction === 'up' },
            { label: 'R²',          value: reg.r2 },
          ].map(s => (
            <div key={s.label} style={{
              flex: 1, padding: '8px 12px',
              background: 'rgba(255,255,255,0.03)',
              borderRadius: 8, textAlign: 'center',
            }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{s.label}</div>
              <div style={{
                fontSize: 13, fontWeight: 700,
                color: s.up === true ? 'var(--accent-green)' : s.up === false ? 'var(--accent-rose)' : 'var(--text-primary)',
              }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Tabs + Span row */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {['Chart', 'History'].map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: '5px 14px', fontSize: 12, fontWeight: 500,
                borderRadius: 8, border: 'none', cursor: 'pointer',
                background: tab === t ? `${color}22` : 'transparent',
                color: tab === t ? color : 'var(--text-secondary)',
                fontFamily: 'var(--font)',
              }}>{t}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 3 }}>
            {SPANS.map(s => (
              <button key={s} onClick={() => setSpan(s)} style={{
                padding: '4px 10px', fontSize: 11, fontWeight: 600,
                borderRadius: 7, border: `1px solid ${span === s ? color + '50' : 'transparent'}`,
                background: span === s ? `${color}15` : 'rgba(255,255,255,0.04)',
                color: span === s ? color : 'var(--text-secondary)',
                cursor: 'pointer', fontFamily: 'var(--font)',
              }}>{s}</button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
          {tab === 'Chart' && (
            <>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="modal-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={color} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={color} stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.35)' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis domain={['auto','auto']} tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.35)' }} axisLine={false} tickLine={false} width={60}
                    tickFormatter={v => v.toLocaleString('en-IN', { maximumFractionDigits: 0 })} />
                  <Tooltip contentStyle={{
                    background: 'rgba(6,13,31,0.95)', border: `1px solid ${color}40`,
                    borderRadius: 10, fontSize: 12, color: 'rgba(255,255,255,0.85)',
                  }} formatter={v => [fmt(v), 'Value']} />
                  <ReferenceLine y={avg} stroke={color} strokeDasharray="4 3" strokeOpacity={0.35}
                    label={{ value: 'Avg', fill: color, fontSize: 10, position: 'insideTopRight' }} />
                  <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2}
                    fill="url(#modal-grad)" dot={false} activeDot={{ r: 4, fill: color, strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            </>
          )}

          {tab === 'History' && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    {['Month', isOHLC ? 'Close' : 'Value', isOHLC && 'Open', isOHLC && 'High', isOHLC && 'Low', isOHLC && 'Volume']
                      .filter(Boolean).map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'right', fontSize: 10, fontWeight: 700,
                        color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase',
                        ':first-child': { textAlign: 'left' } }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row, i) => {
                    const prev = tableRows[i + 1];
                    const chg  = prev ? ((row.value - prev.value) / prev.value * 100) : null;
                    return (
                      <tr key={row.month} style={{
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        transition: 'background 0.12s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '9px 12px', color: 'var(--text-secondary)', fontWeight: 500 }}>{row.month}</td>
                        <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color }}>
                          {fmt(row.value)}
                          {chg !== null && (
                            <span style={{ fontSize: 10, marginLeft: 8, color: chg >= 0 ? 'var(--accent-green)' : 'var(--accent-rose)' }}>
                              {chg >= 0 ? '+' : ''}{chg.toFixed(1)}%
                            </span>
                          )}
                        </td>
                        {isOHLC && <td style={{ padding: '9px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>{fmt(row.open)}</td>}
                        {isOHLC && <td style={{ padding: '9px 12px', textAlign: 'right', color: 'var(--accent-green)' }}>{fmt(row.high)}</td>}
                        {isOHLC && <td style={{ padding: '9px 12px', textAlign: 'right', color: 'var(--accent-rose)'  }}>{fmt(row.low)}</td>}
                        {isOHLC && <td style={{ padding: '9px 12px', textAlign: 'right', color: 'var(--text-muted)', fontSize: 11 }}>
                          {row.volume ? (row.volume / 1e7).toFixed(1) + ' Cr' : '—'}
                        </td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes modalIn {
          from { opacity:0; transform:scale(0.96) translateY(10px); }
          to   { opacity:1; transform:scale(1)    translateY(0);    }
        }
      `}</style>
    </div>
  );
}

import { useState, useEffect } from 'react';
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import ChartTooltip from './ChartTooltip';
import { linearRegression, movingAverage } from '../utils/regression';
import { fetchHistory } from '../api/yahooFinance';

// ── Span → Yahoo Finance fetch config ─────────────────────────────────────────
// 1H/4H/1D share the same fetch (5m, 1d) and differ only by how many points to show
const SPAN_CONFIG = {
  '1H':  { interval: '5m',  range: '1d',  tail: 12  },  // last 12 × 5m = 1h
  '4H':  { interval: '5m',  range: '1d',  tail: 48  },  // last 48 × 5m = 4h
  '1D':  { interval: '5m',  range: '1d',  tail: null },  // full session
  '1W':  { interval: '60m', range: '5d',  tail: null },
  '1M':  { interval: '1d',  range: '1mo', tail: null },
  '3M':  { interval: '1d',  range: '3mo', tail: null },
  '6M':  { interval: '1d',  range: '6mo', tail: null },
  '1Y':  { interval: '1d',  range: '1y',  tail: null },
  '2Y':  { interval: '1wk', range: '2y',  tail: null },
};

const ALL_SPANS  = Object.keys(SPAN_CONFIG);
const VIEW_TABS  = ['Close', 'MA(3)', 'Trend'];

function cacheKey(cfg) { return `${cfg.interval}_${cfg.range}`; }

// Format a candle timestamp for the chart x-axis label
function xLabel(d, interval) {
  if (!d.ts) return d.time ?? d.month?.slice(2) ?? '';
  const dt = new Date(d.ts);
  if (interval === '5m')  return `${dt.getHours()}:${String(dt.getMinutes()).padStart(2,'0')}`;
  if (interval === '60m') return `${String(dt.getHours()).padStart(2,'0')}:00`;
  if (interval === '1d')  return `${dt.getDate()}-${dt.toLocaleString('en', { month: 'short' })}`;
  if (interval === '1wk') return `${dt.toLocaleString('en', { month: 'short' })} '${String(dt.getFullYear()).slice(2)}`;
  return d.time ?? d.month?.slice(2) ?? '';
}

export default function IndexChart({ data, label, color, prefix = '', onCardClick, livePrice, liveChangePct, liveMarketTime, ticker }) {
  const [viewTab, setViewTab] = useState('Close');
  const [span,    setSpan]    = useState('1Y');
  const [cache,   setCache]   = useState({});
  const [loading, setLoading] = useState(false);
  const loadingSpanRef        = { current: null };   // track in-flight span

  async function loadSpan(newSpan) {
    const cfg = SPAN_CONFIG[newSpan];
    const key = cacheKey(cfg);
    setSpan(newSpan);
    if (cache[key] || !ticker) return;
    setLoading(true);
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (attempt > 0) await new Promise(r => setTimeout(r, 1200));
        const raw = await fetchHistory(ticker, cfg.interval, cfg.range);
        if (raw?.length) { setCache(prev => ({ ...prev, [key]: raw })); break; }
      } catch (e) {
        if (attempt === 1) console.warn(`[IndexChart] ${label} ${newSpan} failed after retry:`, e.message);
      }
    }
    setLoading(false);
  }

  // Pre-load 1Y on mount so first render is accurate
  useEffect(() => { if (ticker) loadSpan('1Y'); }, [ticker]);   // eslint-disable-line

  // ── Active candles ─────────────────────────────────────────────────────────
  const cfg      = SPAN_CONFIG[span];
  const ck       = cacheKey(cfg);
  let   candles  = cache[ck] ?? null;
  if (candles && cfg.tail) candles = candles.slice(-cfg.tail);

  // Fallback to the monthly data prop while real data is loading
  if (!candles && data?.length) {
    const monthsBack = { '3M': 3, '6M': 6, '1Y': 12 };
    const n = monthsBack[span];
    candles = n ? data.slice(-n) : data;
  }

  // ── Chart data ─────────────────────────────────────────────────────────────
  const closeData = (candles ?? []).map(d => ({
    t:     xLabel(d, cfg.interval),
    value: d.close ?? d.value,
    high:  d.high  ?? null,
    low:   d.low   ?? null,
  }));

  const normData  = closeData.map(d => ({ month: d.t, value: d.value }));
  const maData    = movingAverage(normData, 3);
  const trendLine = linearRegression(normData).trendLine;

  const chartData = closeData.map((d, i) => ({
    month: d.t,
    close:  d.value,
    ma:     maData[i]?.value,
    trend:  trendLine[i]?.value,
  }));

  // ── H/L — only from real OHLC candles; show null (hidden) if no real data yet ─
  const allHighs = closeData.map(d => d.high ?? d.value).filter(v => v != null);
  const allLows  = closeData.map(d => d.low  ?? d.value).filter(v => v != null);
  const hi = allHighs.length ? Math.max(livePrice ?? -Infinity, ...allHighs) : null;
  const lo = allLows.length  ? Math.min(livePrice ?? Infinity,  ...allLows)  : null;

  const start = closeData[0]?.value;
  const end   = closeData.at(-1)?.value;
  const pct   = start ? ((end - start) / start * 100) : 0;

  const currentPrice = livePrice
    || closeData.at(-1)?.value
    || data?.at(-1)?.close
    || data?.at(-1)?.value
    || null;

  return (
    <div
      className="glass glass-hover"
      style={{ borderRadius: 'var(--radius-lg)', padding: '22px 24px', cursor: onCardClick ? 'pointer' : 'default' }}
      onClick={onCardClick}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', marginTop: 3 }}>
            {currentPrice != null
              ? `${prefix}${currentPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
              : <span style={{ color: 'var(--text-muted)', fontSize: 14, fontWeight: 400 }}>Loading…</span>}
          </div>
          {liveChangePct != null ? (
            <span className={`tag ${liveChangePct >= 0 ? 'tag-up' : 'tag-down'}`} style={{ marginTop: 5, fontSize: 10 }}>
              {liveChangePct >= 0 ? '+' : ''}{liveChangePct.toFixed(2)}% today
            </span>
          ) : (
            <span className={`tag ${pct >= 0 ? 'tag-up' : 'tag-down'}`} style={{ marginTop: 5, fontSize: 10 }}>
              {pct >= 0 ? '+' : ''}{pct.toFixed(2)}% ({span})
            </span>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
          {/* Span selector */}
          <div style={{ display: 'flex', gap: 3 }}>
            {ALL_SPANS.map(s => (
              <button key={s} onClick={e => { e.stopPropagation(); loadSpan(s); }} style={{
                padding: '3px 9px', fontSize: 10, fontWeight: 600, borderRadius: 6,
                border: `1px solid ${span === s ? color + '50' : 'transparent'}`,
                background: span === s ? color + '18' : 'rgba(255,255,255,0.04)',
                color: span === s ? color : 'var(--text-muted)',
                cursor: 'pointer', fontFamily: 'var(--font)',
              }}>{s}</button>
            ))}
          </div>
          {/* View tabs */}
          <div style={{ display: 'flex', gap: 3 }}>
            {VIEW_TABS.map(t => (
              <button key={t} onClick={e => { e.stopPropagation(); setViewTab(t); }} style={{
                padding: '3px 9px', fontSize: 10, fontWeight: 500, borderRadius: 6, border: 'none', cursor: 'pointer',
                background: viewTab === t ? color + '28' : 'transparent',
                color: viewTab === t ? color : 'var(--text-secondary)',
                fontFamily: 'var(--font)',
              }}>{t}</button>
            ))}
          </div>
        </div>
      </div>

      {/* H/L strip */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 12, alignItems: 'center' }}>
        {hi != null && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>H <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>{prefix}{hi.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span></span>}
        {lo != null && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>L <span style={{ color: 'var(--accent-rose)',  fontWeight: 600 }}>{prefix}{lo.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span></span>}
        <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto', opacity: 0.6 }}>
          {loading ? (
            <span style={{ fontStyle: 'italic' }}>Loading {span}…</span>
          ) : liveMarketTime ? (() => {
            const staleSec = Math.floor(Date.now() / 1000) - liveMarketTime;
            const timeStr  = new Date(liveMarketTime * 1000).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
            return staleSec < 120
              ? <span style={{ color: 'var(--accent-green)', opacity: 0.8 }}>live · NSE · {timeStr}</span>
              : <>{timeStr} IST · ~15min delay</>;
          })() : candles ? (
            <>{candles.length} candles · {cfg.interval}</>
          ) : null}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={190}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={color} stopOpacity={0.28} />
              <stop offset="95%" stopColor={color} stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.35)' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis domain={['auto','auto']} tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.35)' }} axisLine={false} tickLine={false} width={58}
            tickFormatter={v => prefix + v.toLocaleString('en-IN', { maximumFractionDigits: 0 })} />
          <Tooltip content={<ChartTooltip prefix={prefix} />} />
          <Area type="monotone" dataKey="close" name="Close" stroke={color} strokeWidth={1.5}
            fill={`url(#grad-${label})`} dot={false} />
          {viewTab === 'MA(3)' && (
            <Line type="monotone" dataKey="ma" name="MA(3)" stroke="#22d3ee" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
          )}
          {viewTab === 'Trend' && (
            <Line type="monotone" dataKey="trend" name="Trend" stroke="#f59e0b" strokeWidth={1.5} dot={false} strokeDasharray="5 3" />
          )}
        </ComposedChart>
      </ResponsiveContainer>

      {onCardClick && (
        <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
          Click to view full history
        </div>
      )}
    </div>
  );
}

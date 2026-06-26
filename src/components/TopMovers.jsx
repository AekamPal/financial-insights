import { TrendingUp, TrendingDown } from 'lucide-react';

function fmt(v, dp = 2) {
  if (v == null || isNaN(v)) return '—';
  return v.toLocaleString('en-IN', { maximumFractionDigits: dp });
}

export default function TopMovers({ movers, fundamentals }) {
  return (
    <div className="glass" style={{ borderRadius: 'var(--radius-lg)', padding: '22px 24px' }}>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>
        Top Nifty Movers
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {movers.map((m, i) => {
          const up      = m.change >= 0;
          const TICKER_KEY = { RELIANCE: 'reliance', TCS: 'tcs', HDFC: 'hdfc', HDFCBANK: 'hdfc', INFY: 'infy', ICICIBANK: 'icici', ADANIGRP: 'adani', ADANIENT: 'adani', LT: 'lt', WIPRO: 'wipro' };
          const f       = fundamentals?.[TICKER_KEY[m.ticker]] ?? null;

          return (
            <div key={m.ticker} style={{
              padding: '11px 0',
              borderBottom: i < movers.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
            }}>
              {/* Row 1: rank | ticker | mktcap | price+change */}
              <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr auto auto', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>#{i + 1}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{m.ticker}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{f?.industry ?? m.name}</div>
                </div>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'right' }}>{m.mktCap}</span>
                <div style={{ textAlign: 'right', minWidth: 76 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>₹{fmt(m.price, 2)}</div>
                  <span className={`tag ${up ? 'tag-up' : 'tag-down'}`} style={{ fontSize: 10 }}>
                    {up ? <TrendingUp size={8} /> : <TrendingDown size={8} />}
                    {up ? '+' : ''}{m.change}%
                  </span>
                </div>
              </div>

              {/* Row 2: fundamentals strip */}
              <div style={{
                display: 'flex', gap: 14, marginTop: 7, marginLeft: 38,
                padding: '5px 10px',
                background: 'rgba(255,255,255,0.02)',
                borderRadius: 6,
              }}>
                <FundStat label="P/E"    value={f?.pe      != null ? fmt(f.pe, 1) : '—'} />
                <FundStat label="EPS"    value={f?.eps     != null ? `₹${fmt(f.eps, 1)}` : '—'} />
                <FundStat label="52W H"  value={f?.weekHigh != null ? `₹${fmt(f.weekHigh, 0)}` : '—'} color="var(--accent-green)" />
                <FundStat label="52W L"  value={f?.weekLow  != null ? `₹${fmt(f.weekLow, 0)}`  : '—'} color="var(--accent-rose)"  />
                {f?.faceValue && <FundStat label="FV" value={`₹${f.faceValue}`} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FundStat({ label, value, color }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: color ?? 'var(--text-secondary)' }}>{value}</span>
    </div>
  );
}

import { TrendingUp, TrendingDown, Wallet, BarChart2, RefreshCw } from 'lucide-react';

function fmt(v, dp = 2) {
  if (v == null || isNaN(v)) return '—';
  return v.toLocaleString('en-IN', { maximumFractionDigits: dp });
}
function fmtCr(v) {
  if (v == null) return '—';
  const cr = v / 1e7;
  return cr >= 1 ? `₹${cr.toFixed(2)} Cr` : `₹${fmt(v, 0)}`;
}

export default function PortfolioPanel({ data, loading, error, onRefresh }) {
  // Not configured — show nothing (parent decides whether to render this)
  if (error === 'not_configured' || (!loading && !data)) return null;

  const { holdings = [], positions = [], margin, profile } = data ?? {};

  // Compute portfolio P&L from holdings
  const totalInvested = holdings.reduce((s, h) => s + (h.average_price * h.quantity), 0);
  // Current value requires live prices — show as N/A if not available
  // (Would need to cross-reference with live quotes)
  const totalPnL = positions.reduce((s, p) => s + (p.realised_pnl ?? 0), 0);

  return (
    <div className="glass" style={{ borderRadius: 'var(--radius-lg)', padding: '22px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: '#22c55e18', border: '1px solid #22c55e30', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Wallet size={14} color="#22c55e" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              My Portfolio
              {profile?.ucc && <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 8 }}>UCC: {profile.ucc}</span>}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>via Groww</div>
          </div>
        </div>
        <button onClick={onRefresh} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <RefreshCw size={12} color="var(--text-muted)" />
        </button>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
          Loading portfolio…
        </div>
      )}

      {!loading && (
        <>
          {/* Funds / Margin summary */}
          {margin && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 18 }}>
              <FundStat label="Available Cash"  value={`₹${fmt(margin.clear_cash, 0)}`}              color="var(--accent-green)" />
              <FundStat label="CNC Balance"     value={`₹${fmt(margin.cnc_balance_available, 0)}`}   />
              <FundStat label="Margin Used"     value={`₹${fmt(margin.net_margin_used, 0)}`}          color="var(--accent-rose)" />
            </div>
          )}

          {/* Holdings */}
          {holdings.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
                Holdings · {holdings.length} stocks
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginBottom: 16 }}>
                {holdings.slice(0, 8).map((h, i) => {
                  const invested = h.average_price * h.quantity;
                  return (
                    <div key={h.isin ?? i} style={{
                      display: 'grid', gridTemplateColumns: '1fr auto auto',
                      alignItems: 'center', gap: 12,
                      padding: '9px 0',
                      borderBottom: i < Math.min(holdings.length, 8) - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{h.trading_symbol}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Qty: {h.quantity} · Avg: ₹{fmt(h.average_price)}</div>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>₹{fmt(invested, 0)}</span>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-green)' }} />
                    </div>
                  );
                })}
                {holdings.length > 8 && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>
                    +{holdings.length - 8} more holdings
                  </div>
                )}
              </div>
            </>
          )}

          {/* Today's positions */}
          {positions.filter(p => p.quantity !== 0).length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
                Today's Positions
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {positions.filter(p => p.quantity !== 0).map((p, i) => {
                  const pnl = p.realised_pnl ?? 0;
                  const up  = pnl >= 0;
                  return (
                    <div key={p.trading_symbol + i} style={{
                      display: 'grid', gridTemplateColumns: '1fr auto auto',
                      alignItems: 'center', gap: 12, padding: '9px 0',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                    }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{p.trading_symbol}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                          {p.segment} · Qty: {p.quantity} @ ₹{fmt(p.net_price)}
                        </div>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.exchange}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: up ? 'var(--accent-green)' : 'var(--accent-rose)' }}>
                        {up ? '+' : ''}₹{fmt(pnl)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {holdings.length === 0 && positions.length === 0 && (
            <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-muted)', fontSize: 13 }}>
              No holdings or positions found
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FundStat({ label, value, color }) {
  return (
    <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: color ?? 'var(--text-primary)' }}>{value}</div>
    </div>
  );
}

import { Activity, RefreshCw } from 'lucide-react';
import { useState } from 'react';

const TROY_OZ_G = 31.1035;

function fmtINR(n, dp = 2) {
  if (n == null) return '—';
  return n.toLocaleString('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

export default function Navbar({ onRefresh, quotes }) {
  const [spinning, setSpinning] = useState(false);
  const now = new Date().toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });

  function handleRefresh() {
    setSpinning(true);
    setTimeout(() => { setSpinning(false); onRefresh?.(); }, 900);
  }

  const q      = quotes ?? {};
  const usdInr = q.usdinr?.price ?? 84;

  const niftyPrice  = q.nifty?.price;
  const sensexPrice = q.sensex?.price;

  // Gold: MCX INR/10g direct (Kite) → COMEX USD/oz conversion (Yahoo) → '—'
  const goldMCX   = q.goldMCX?.price;
  const goldComex = q.gold?.price;
  const goldInr   = goldMCX ?? (goldComex ? +((goldComex / TROY_OZ_G) * 10 * usdInr).toFixed(0) : null);
  const goldUp    = goldMCX != null ? (q.goldMCX?.changePct ?? 0) >= 0 : (q.gold?.changePct ?? 0) >= 0;

  // Crude: MCX INR/bbl (Kite) or Brent USD/bbl (Yahoo)
  const crudeMCX  = q.crudeMCX?.price;
  const crudeBrent = q.crude?.price;
  const crudeVal  = crudeMCX ?? crudeBrent;
  const crudeDisp = crudeVal != null
    ? (crudeMCX != null ? `₹${Math.round(crudeMCX).toLocaleString('en-IN')}` : `$${crudeBrent.toFixed(2)}`)
    : '—';
  const crudeUp   = crudeMCX != null ? (q.crudeMCX?.changePct ?? 0) >= 0 : (q.crude?.changePct ?? 0) >= 0;

  const tickers = [
    {
      label: 'NIFTY',
      val:   niftyPrice  != null ? fmtINR(niftyPrice, 2)  : '—',
      up:    (q.nifty?.changePct  ?? 0) >= 0,
    },
    {
      label: 'SENSEX',
      val:   sensexPrice != null ? fmtINR(sensexPrice, 2) : '—',
      up:    (q.sensex?.changePct ?? 0) >= 0,
    },
    {
      label: 'CRUDE',
      val:   crudeDisp,
      up:    crudeUp,
    },
    {
      label: 'GOLD',
      val:   goldInr != null ? `₹${goldInr.toLocaleString('en-IN')}` : '—',
      up:    goldUp,
    },
  ];

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: 'rgba(6,13,31,0.78)',
      backdropFilter: 'blur(32px) saturate(180%)',
      WebkitBackdropFilter: 'blur(32px) saturate(180%)',
      borderBottom: '1px solid rgba(99,160,255,0.1)',
      padding: '0 32px',
      height: 56,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 14px rgba(59,130,246,0.5)',
        }}>
          <Activity size={15} color="#fff" strokeWidth={2.5} />
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1 }}>Julius Baer</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>INDIA DESK</div>
        </div>
      </div>

      {/* Live ticker */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        {tickers.map(t => (
          <div key={t.label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>{t.label}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: t.val === '—' ? 'var(--text-muted)' : t.up ? 'var(--accent-green)' : 'var(--accent-rose)' }}>
              {t.val}
            </div>
          </div>
        ))}
      </div>

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
          <span className="dot-pulse" />
          Live Data
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{now}</span>
        <button onClick={handleRefresh} style={{
          width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(99,160,255,0.15)',
          background: 'rgba(59,130,246,0.1)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--accent-blue)',
        }}>
          <RefreshCw size={14} style={{ transition: 'transform 0.9s', transform: spinning ? 'rotate(360deg)' : 'none' }} />
        </button>
      </div>
    </nav>
  );
}

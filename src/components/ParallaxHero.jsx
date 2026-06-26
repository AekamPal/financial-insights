import { useEffect, useRef, useState } from 'react';

const FALLBACK_BLOBS = [
  { label: 'Nifty 50',  value: '24,150.35', change: '+0.74%', x: 6,  y: 28, color: '#3b82f6', up: true  },
  { label: 'Sensex',    value: '79,480.12', change: '+0.68%', x: 80, y: 18, color: '#6366f1', up: true  },
  { label: 'Crude',     value: '$82.40',    change: '-1.12%', x: 78, y: 62, color: '#f43f5e', up: false },
  { label: 'Gold',      value: '₹72,450',  change: '+0.33%', x: 9,  y: 68, color: '#f59e0b', up: true  },
];

function buildBlobs(quotes) {
  if (!quotes) return FALLBACK_BLOBS;
  const isGroww = quotes._source === 'groww';
  const p = (k) => { const v = quotes[k]; return typeof v === 'number' ? v : v?.price ?? null; };
  const c = (k) => { const v = quotes[k]; return typeof v === 'number' ? null : v?.changePct ?? null; };
  const pct = (k) => { const cp = c(k); return cp != null ? `${cp >= 0 ? '+' : ''}${cp.toFixed(2)}%` : null; };

  const usdInr = p('usdinr') ?? 84;
  const goldPx = p('gold');
  const goldInr = goldPx ? (isGroww ? goldPx : +((goldPx / 31.1035) * 10 * usdInr).toFixed(0)) : null;

  return [
    {
      label: 'Nifty 50', x: 6, y: 28, color: '#3b82f6', up: (c('nifty') ?? 1) >= 0,
      value:  p('nifty') != null ? p('nifty').toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : FALLBACK_BLOBS[0].value,
      change: pct('nifty') ?? FALLBACK_BLOBS[0].change,
    },
    {
      label: 'Sensex', x: 80, y: 18, color: '#6366f1', up: (c('sensex') ?? 1) >= 0,
      value:  p('sensex') != null ? p('sensex').toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : FALLBACK_BLOBS[1].value,
      change: pct('sensex') ?? FALLBACK_BLOBS[1].change,
    },
    {
      label: 'Crude', x: 78, y: 62, color: '#f43f5e', up: (c('crude') ?? -1) >= 0,
      value:  p('crude') != null ? `$${p('crude').toFixed(2)}` : FALLBACK_BLOBS[2].value,
      change: pct('crude') ?? FALLBACK_BLOBS[2].change,
    },
    {
      label: 'Gold', x: 9, y: 68, color: '#f59e0b', up: (c('gold') ?? 1) >= 0,
      value:  goldInr != null ? `₹${goldInr.toLocaleString('en-IN')}` : FALLBACK_BLOBS[3].value,
      change: pct('gold') ?? FALLBACK_BLOBS[3].change,
    },
  ];
}

export default function ParallaxHero({ onInsightsClick, quotes }) {
  const heroRef  = useRef(null);
  const innerRef = useRef(null);
  const blobsRef = useRef(null);
  const orb1Ref  = useRef(null);
  const orb2Ref  = useRef(null);
  const mouse    = useRef({ x: 0.5, y: 0.5 });
  const raf      = useRef(null);
  const [visible, setVisible] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  // blobs are re-derived whenever `quotes` changes (every 60s from useLiveData)
  const blobs = buildBlobs(quotes);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    function onScroll() {
      const y = window.scrollY;
      setScrollY(y);
      if (innerRef.current) innerRef.current.style.transform = `translateY(${y * 0.35}px)`;
      if (blobsRef.current) blobsRef.current.style.transform = `translateY(${y * 0.18}px)`;
      if (heroRef.current)  heroRef.current.style.opacity = Math.max(0, 1 - y / 320);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    function onMove(e) {
      mouse.current = { x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight };
    }
    window.addEventListener('mousemove', onMove);
    function tick() {
      const { x, y } = mouse.current;
      const dx = (x - 0.5) * 24, dy = (y - 0.5) * 14;
      if (orb1Ref.current) orb1Ref.current.style.transform = `translate(${dx * 0.7}px, ${dy * 0.7}px)`;
      if (orb2Ref.current) orb2Ref.current.style.transform = `translate(${-dx * 0.45}px, ${-dy * 0.45}px)`;
      if (blobsRef.current) {
        const sy = window.scrollY * 0.18;
        blobsRef.current.style.transform = `translateY(${sy}px) translate(${dx * 0.22}px, ${dy * 0.14}px)`;
      }
      raf.current = requestAnimationFrame(tick);
    }
    raf.current = requestAnimationFrame(tick);
    return () => { window.removeEventListener('mousemove', onMove); cancelAnimationFrame(raf.current); };
  }, []);

  return (
    <div ref={heroRef} style={{
      position: 'relative', height: '52vh', minHeight: 340, maxHeight: 500,
      overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
      opacity: visible ? 1 : 0, transition: 'opacity 0.7s ease',
    }}>
      {/* Grid */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: `linear-gradient(rgba(59,130,246,0.045) 1px, transparent 1px),
                          linear-gradient(90deg, rgba(59,130,246,0.045) 1px, transparent 1px)`,
        backgroundSize: '56px 56px',
        maskImage: 'radial-gradient(ellipse 90% 90% at 50% 50%, black 30%, transparent 100%)',
        WebkitMaskImage: 'radial-gradient(ellipse 90% 90% at 50% 50%, black 30%, transparent 100%)',
      }} />

      {/* Orbs */}
      <div ref={orb1Ref} style={{
        position: 'absolute', width: 560, height: 560, borderRadius: '50%', pointerEvents: 'none',
        background: 'radial-gradient(circle, rgba(59,130,246,0.13) 0%, transparent 70%)',
        top: '-10%', left: '5%', transition: 'transform 0.14s ease-out',
        animation: 'orbA 9s ease-in-out infinite',
      }} />
      <div ref={orb2Ref} style={{
        position: 'absolute', width: 480, height: 480, borderRadius: '50%', pointerEvents: 'none',
        background: 'radial-gradient(circle, rgba(99,102,241,0.11) 0%, transparent 70%)',
        bottom: '-15%', right: '5%', transition: 'transform 0.18s ease-out',
        animation: 'orbB 11s ease-in-out infinite',
      }} />

      {/* Floating blobs — values come from live quotes prop */}
      <div ref={blobsRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', transition: 'transform 0.12s ease-out' }}>
        {blobs.map(b => (
          <div key={b.label} className="glass" style={{
            position: 'absolute', left: `${b.x}%`, top: `${b.y}%`,
            padding: '9px 13px', borderRadius: 10, minWidth: 108,
            borderColor: `${b.color}25`,
            animation: 'blobDrift 7s ease-in-out infinite',
            animationDelay: `${(b.x % 3) * 1.2}s`,
          }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2, fontWeight: 600, letterSpacing: '0.05em' }}>{b.label}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: b.color }}>{b.value}</div>
            {b.change && (
              <div style={{ fontSize: 10, marginTop: 2, color: b.up ? 'var(--accent-green)' : 'var(--accent-rose)', fontWeight: 600 }}>
                {b.change}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Center content */}
      <div ref={innerRef} style={{
        position: 'relative', zIndex: 2, textAlign: 'center', padding: '0 40px',
        transition: 'transform 0.1s ease-out',
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          padding: '5px 14px', borderRadius: 999,
          background: 'rgba(59,130,246,0.09)', border: '1px solid rgba(59,130,246,0.2)',
          fontSize: 10, fontWeight: 700, letterSpacing: '0.13em',
          color: 'rgba(147,197,253,0.9)', textTransform: 'uppercase', marginBottom: 20,
        }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s infinite', display: 'inline-block' }} />
          Julius Baer · India Desk · Live
        </div>

        <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.42)', maxWidth: 460, margin: '0 auto 28px', lineHeight: 1.65, fontWeight: 400 }}>
          Equity indices, commodities, macro indicators,<br />and AI-driven cross-market insights.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <button
            onClick={() => window.scrollTo({ top: window.innerHeight, behavior: 'smooth' })}
            style={{
              padding: '10px 24px', background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
              border: 'none', borderRadius: 10, cursor: 'pointer',
              fontSize: 13, fontWeight: 700, color: '#fff',
              boxShadow: '0 0 20px rgba(59,130,246,0.35)', transition: 'transform 0.15s, box-shadow 0.15s',
              letterSpacing: '-0.01em', fontFamily: 'var(--font)',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 0 32px rgba(59,130,246,0.55)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='0 0 20px rgba(59,130,246,0.35)'; }}
          >View Dashboard</button>
          <button
            onClick={onInsightsClick}
            style={{
              padding: '10px 20px', background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, cursor: 'pointer',
              fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.6)',
              transition: 'all 0.15s', letterSpacing: '-0.01em', fontFamily: 'var(--font)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,0.09)'; e.currentTarget.style.color='#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.05)'; e.currentTarget.style.color='rgba(255,255,255,0.6)'; }}
          >Insights →</button>
        </div>
      </div>

      {/* Scroll hint */}
      <div style={{
        position: 'absolute', bottom: 18, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        opacity: Math.max(0, 1 - scrollY / 60), transition: 'opacity 0.2s', pointerEvents: 'none',
      }}>
        <div style={{ width: 1, height: 32, background: 'linear-gradient(to bottom, rgba(99,160,255,0.4), transparent)', animation: 'scrollLine 2s ease-in-out infinite' }} />
      </div>

      {/* Bottom fade */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, background: 'linear-gradient(to bottom, transparent, var(--bg-deep))', pointerEvents: 'none' }} />

      <style>{`
        @keyframes orbA { 0%,100%{transform:translate(0,0)} 50%{transform:translate(25px,-18px)} }
        @keyframes orbB { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-18px,25px)} }
        @keyframes blobDrift { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
        @keyframes scrollLine {
          0%{opacity:0;transform:scaleY(0);transform-origin:top}
          50%{opacity:1;transform:scaleY(1);transform-origin:top}
          100%{opacity:0;transform:scaleY(1);transform-origin:bottom}
        }
      `}</style>
    </div>
  );
}

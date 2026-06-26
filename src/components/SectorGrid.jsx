import { TrendingUp, TrendingDown } from 'lucide-react';

export default function SectorGrid({ sectors }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
      {sectors.map(s => {
        const up = s.change >= 0;
        return (
          <div key={s.name} className="glass glass-hover" style={{
            borderRadius: 'var(--radius-md)',
            padding: '14px 16px',
            cursor: 'default',
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>{s.name}</div>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 6 }}>
              {s.value.toLocaleString('en-IN')}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className={`tag ${up ? 'tag-up' : 'tag-down'}`} style={{ fontSize: 10 }}>
                {up ? <TrendingUp size={9}/> : <TrendingDown size={9}/>}
                {up ? '+' : ''}{s.change}%
              </span>
              {s.ytd != null && (
                <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                  YTD {s.ytd > 0 ? '+' : ''}{s.ytd}%
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

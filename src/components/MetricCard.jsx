import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function MetricCard({ label, value, change, up, sub, delay = 0 }) {
  const tagClass = up === true ? 'tag-up' : up === false ? 'tag-down' : 'tag-flat';
  const Icon = up === true ? TrendingUp : up === false ? TrendingDown : Minus;

  return (
    <div
      className="glass glass-hover"
      style={{
        borderRadius: 'var(--radius-lg)',
        padding: '20px 22px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        cursor: 'default',
        animationDelay: `${delay}s`,
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </span>
      <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)', lineHeight: 1 }}>
        {value}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className={`tag ${tagClass}`}>
          <Icon size={10} strokeWidth={2.5} />
          {change}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub}</span>
      </div>
    </div>
  );
}

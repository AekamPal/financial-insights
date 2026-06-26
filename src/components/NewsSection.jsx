import { useState } from 'react';
import { ExternalLink } from 'lucide-react';

const TAG_COLORS = {
  Nifty:     '#3b82f6',
  Sensex:    '#6366f1',
  FII:       '#8b5cf6',
  Rupee:     '#06b6d4',
  RBI:       '#0ea5e9',
  Macro:     '#a78bfa',
  crude:     '#f97316',
  gold:      '#f59e0b',
  silver:    '#94a3b8',
  natgas:    '#22c55e',
  copper:    '#f43f5e',
  aluminium: '#e2e8f0',
  Markets:   '#64748b',
};

export default function NewsSection({ items = [], loading, title = 'Latest News' }) {
  const [hovered, setHovered] = useState(null);

  return (
    <div className="glass" style={{ borderRadius: 'var(--radius-lg)', padding: '20px 24px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16,
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--text-muted)' }}>
          <span className="dot-pulse" style={{ width: 5, height: 5 }} />
          Live RSS
        </div>
      </div>

      {loading && (
        <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
          Loading news…
        </div>
      )}

      {!loading && items.length === 0 && (
        <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
          No articles available right now.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {items.map((item, i) => {
          const key = item.id ?? item.link ?? i;
          return (
          <div
            key={key}
            onMouseEnter={() => setHovered(key)}
            onMouseLeave={() => setHovered(null)}
            style={{
              display: 'grid',
              gridTemplateColumns: '80px 1fr auto',
              alignItems: 'start',
              gap: 14,
              padding: '12px 0',
              borderBottom: i < items.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
              cursor: 'default',
              transition: 'background 0.15s',
              borderRadius: 6,
              margin: '0 -6px',
              padding: '12px 6px',
              background: hovered === key ? 'rgba(255,255,255,0.025)' : 'transparent',
            }}
          >
            {/* Tag — supports both mock {tag,color} and RSS {tags[]} formats */}
            {(() => {
              const tagLabel = item.tag ?? item.tags?.[0] ?? 'Markets';
              const color    = item.color ?? TAG_COLORS[tagLabel] ?? '#94a3b8';
              return (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  padding: '3px 8px', borderRadius: 6,
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.03em',
                  background: `${color}18`, color, border: `1px solid ${color}25`,
                  whiteSpace: 'nowrap', marginTop: 1,
                }}>
                  {tagLabel}
                </span>
              );
            })()}

            {/* Headline — supports both {headline} (mock) and {title} (RSS) */}
            <div>
              <a
                href={item.link ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: 'none' }}
              >
                <div style={{
                  fontSize: 13, fontWeight: 400,
                  color: hovered === key ? 'var(--text-primary)' : 'rgba(255,255,255,0.78)',
                  lineHeight: 1.5, transition: 'color 0.15s',
                }}>
                  {item.headline ?? item.title}
                </div>
              </a>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                {item.source}
              </div>
            </div>

            {/* Time + link icon */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{item.ago}</span>
              <ExternalLink
                size={11}
                color={hovered === key ? 'var(--accent-blue)' : 'rgba(255,255,255,0.15)'}
                style={{ transition: 'color 0.15s' }}
              />
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}

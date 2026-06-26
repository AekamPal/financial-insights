export default function ChartTooltip({ active, payload, label, prefix = '', suffix = '' }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(6,13,31,0.92)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(99,160,255,0.2)',
      borderRadius: 10,
      padding: '10px 14px',
      fontSize: 13,
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 6, fontSize: 11 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block', flexShrink: 0 }} />
          <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{p.name}</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600, marginLeft: 'auto', paddingLeft: 12 }}>
            {prefix}{typeof p.value === 'number' ? p.value.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : p.value}{suffix}
          </span>
        </div>
      ))}
    </div>
  );
}

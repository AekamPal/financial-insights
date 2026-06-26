export default function SectionHeader({ title, subtitle, accent = 'var(--accent-blue)', right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20 }}>
      <div>
        <div style={{
          width: 3, height: 18, background: accent,
          borderRadius: 2, display: 'inline-block', marginRight: 10, verticalAlign: 'middle',
          boxShadow: `0 0 10px ${accent}80`,
        }} />
        <span style={{ fontSize: 18, fontWeight: 650, letterSpacing: '-0.02em', verticalAlign: 'middle' }}>{title}</span>
        {subtitle && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, marginLeft: 13 }}>{subtitle}</div>
        )}
      </div>
      {right && <div>{right}</div>}
    </div>
  );
}

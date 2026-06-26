import { useState, useMemo } from 'react';
import { resolveModel, estimate } from '../utils/regressionModels';

const MODEL_SERIES = {
  crude_cpi:      { xKey: 'BRENT',       yKey: 'inflation'     },
  crude_usdinr:   { xKey: 'BRENT',       yKey: 'usdinr'        },
  crude_nifty:    { xKey: 'BRENT',       yKey: 'nifty'         },
  gold_usdinr:    { xKey: 'GOLD',        yKey: 'usdinr'        },
  gold_nifty:     { xKey: 'GOLD',        yKey: 'nifty'         },
  silver_metal:   { xKey: 'SILVER',      yKey: 'niftyMetal'    },
  copper_capex:   { xKey: 'COPPER',      yKey: 'niftyCapGoods' },
  copper_metal:   { xKey: 'COPPER',      yKey: 'niftyMetal'    },
  usdinr_it:      { xKey: null,          yKey: 'niftyIT'       },
  usdinr_cpi:     { xKey: null,          yKey: 'inflation'     },
  natgas_fert:    { xKey: 'NATURAL_GAS', yKey: null            },
  repo_nifty:     { xKey: null,          yKey: 'nifty'         },
  repo_niftybank: { xKey: null,          yKey: 'niftyBank'     },
  repo_usdinr:    { xKey: null,          yKey: 'usdinr'        },
  repo_realty:    { xKey: null,          yKey: 'niftyRealty'   },
  repo_gold:      { xKey: null,          yKey: 'gold'          },
  fed_usdinr:     { xKey: null,          yKey: 'usdinr'        },
  fed_nifty:      { xKey: null,          yKey: 'nifty'         },
  fed_niftyit:    { xKey: null,          yKey: 'niftyIT'       },
  fed_gold:       { xKey: null,          yKey: 'gold'          },
};

const TARGET_MAP = {
  'Nifty 50': {
    unit: '%',
    sources: [
      { label: 'Crude Oil',     key: 'crude',  modelKey: 'crude_nifty',    isRate: false, min: -50, max: 50,  step: 1    },
      { label: 'Gold',          key: 'gold',   modelKey: 'gold_nifty',     isRate: false, min: -30, max: 30,  step: 1    },
      { label: 'RBI Repo Rate', key: 'repo',   modelKey: 'repo_nifty',     isRate: true,  min: -2,  max: 2,   step: 0.25 },
      { label: 'US Fed Rate',   key: 'fed',    modelKey: 'fed_nifty',      isRate: true,  min: -2,  max: 2,   step: 0.25 },
    ],
  },
  'USD/INR': {
    unit: '%',
    sources: [
      { label: 'Crude Oil',     key: 'crude',  modelKey: 'crude_usdinr',   isRate: false, min: -50, max: 50,  step: 1    },
      { label: 'Gold',          key: 'gold',   modelKey: 'gold_usdinr',    isRate: false, min: -30, max: 30,  step: 1    },
      { label: 'RBI Repo Rate', key: 'repo',   modelKey: 'repo_usdinr',    isRate: true,  min: -2,  max: 2,   step: 0.25 },
      { label: 'US Fed Rate',   key: 'fed',    modelKey: 'fed_usdinr',     isRate: true,  min: -2,  max: 2,   step: 0.25 },
    ],
  },
  'CPI India': {
    unit: 'pp',
    sources: [
      { label: 'Crude Oil',     key: 'crude',  modelKey: 'crude_cpi',      isRate: false, min: -50, max: 50,  step: 1 },
      { label: 'USD/INR',       key: 'usdinr', modelKey: 'usdinr_cpi',     isRate: false, min: -20, max: 20,  step: 1 },
    ],
  },
  'Nifty IT': {
    unit: '%',
    sources: [
      { label: 'USD/INR',       key: 'usdinr', modelKey: 'usdinr_it',      isRate: false, min: -20, max: 20,  step: 1    },
      { label: 'US Fed Rate',   key: 'fed',    modelKey: 'fed_niftyit',    isRate: true,  min: -2,  max: 2,   step: 0.25 },
    ],
  },
  'Nifty Bank': {
    unit: '%',
    sources: [
      { label: 'RBI Repo Rate', key: 'repo',   modelKey: 'repo_niftybank', isRate: true,  min: -2,  max: 2,   step: 0.25 },
    ],
  },
  'Nifty Metal': {
    unit: '%',
    sources: [
      { label: 'Silver',        key: 'silver', modelKey: 'silver_metal',   isRate: false, min: -30, max: 30,  step: 1 },
      { label: 'Copper',        key: 'copper', modelKey: 'copper_metal',   isRate: false, min: -30, max: 30,  step: 1 },
    ],
  },
  'Nifty Realty': {
    unit: '%',
    sources: [
      { label: 'RBI Repo Rate', key: 'repo',   modelKey: 'repo_realty',    isRate: true,  min: -2,  max: 2,   step: 0.25 },
    ],
  },
  'Gold': {
    unit: '%',
    sources: [
      { label: 'RBI Repo Rate', key: 'repo',   modelKey: 'repo_gold',      isRate: true,  min: -2,  max: 2,   step: 0.25 },
      { label: 'US Fed Rate',   key: 'fed',    modelKey: 'fed_gold',       isRate: true,  min: -2,  max: 2,   step: 0.25 },
    ],
  },
  'Nifty CapEx': {
    unit: '%',
    sources: [
      { label: 'Copper',        key: 'copper', modelKey: 'copper_capex',   isRate: false, min: -30, max: 30,  step: 1 },
    ],
  },
  'Nifty Fertilisers': {
    unit: '%',
    sources: [
      { label: 'Natural Gas',   key: 'natgas', modelKey: 'natgas_fert',    isRate: false, min: -50, max: 50,  step: 1 },
    ],
  },
};

const TARGETS = Object.keys(TARGET_MAP);

const SRC_COLOR = {
  crude:  '#f59e0b',
  gold:   '#eab308',
  silver: '#94a3b8',
  copper: '#fb923c',
  usdinr: '#22d3ee',
  natgas: '#4ade80',
  repo:   '#f43f5e',
  fed:    '#3b82f6',
};

function fmt(v, unit) {
  if (v == null) return '—';
  const s = v > 0 ? '+' : '';
  return unit === 'pp' ? `${s}${v.toFixed(2)} pp` : `${s}${v.toFixed(2)}%`;
}

function fmtChg(v, isRate) {
  if (!v) return '0';
  const s = v > 0 ? '+' : '';
  return isRate ? `${s}${v.toFixed(2)} pp` : `${s}${v.toFixed(0)}%`;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  panel: {
    borderRadius: 'var(--radius-lg)',
    background: 'var(--glass-bg)',
    backdropFilter: 'var(--blur)',
    WebkitBackdropFilter: 'var(--blur)',
    border: '1px solid var(--glass-border)',
    boxShadow: 'var(--shadow-card), inset 0 1px 0 var(--glass-shine)',
    padding: '28px 30px',
    marginTop: 24,
  },
  label: {
    fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.28)', fontWeight: 500, marginBottom: 10,
  },
  divider: {
    height: 1, background: 'rgba(255,255,255,0.05)', margin: '16px 0',
  },
};

export default function MultiFactorPanel({ commodityHistory, allSeries }) {
  const [target,  setTarget]  = useState('Nifty 50');
  const [changes, setChanges] = useState({});   // key → number
  const [hidden,  setHidden]  = useState({});   // key → bool (X'd out)

  const cfg     = TARGET_MAP[target];
  const sources = cfg.sources;

  function selectTarget(t) {
    setTarget(t);
    setChanges({});
    setHidden({});
  }

  function removeSource(key) {
    setHidden(h => ({ ...h, [key]: true }));
    setChanges(c => ({ ...c, [key]: 0 }));
  }

  function addSource(key) {
    setHidden(h => ({ ...h, [key]: false }));
  }

  const visibleSources = sources.filter(s => !hidden[s.key]);
  const hiddenSources  = sources.filter(s =>  hidden[s.key]);

  // Compute model + impact for visible sources
  const impacts = useMemo(() => {
    return visibleSources.map(src => {
      const ms      = MODEL_SERIES[src.modelKey] ?? {};
      const xSeries = ms.xKey ? (commodityHistory?.[ms.xKey] ?? []) : [];
      const ySeries = ms.yKey ? (allSeries?.[ms.yKey]         ?? []) : [];
      const model   = resolveModel(src.modelKey, xSeries, ySeries);
      const chg     = changes[src.key] ?? 0;
      const impact  = model && chg !== 0 ? estimate(model, chg) : null;
      return { src, model, chg, impact };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleSources, changes, commodityHistory, allSeries]);

  const totals = useMemo(() => {
    const rows = impacts.filter(r => r.impact);
    if (!rows.length) return null;
    const point = rows.reduce((s, r) => s + r.impact.point, 0);
    const lo    = rows.reduce((s, r) => s + r.impact.low,   0);
    const hi    = rows.reduce((s, r) => s + r.impact.high,  0);
    return { point, low: Math.min(lo, hi), high: Math.max(lo, hi) };
  }, [impacts]);

  const totalColor = !totals ? 'rgba(255,255,255,0.3)' : totals.point >= 0 ? '#22c55e' : '#f87171';

  // For the breakdown bar widths
  const maxImpactAbs = useMemo(() => {
    const vs = impacts.filter(r => r.impact).map(r => Math.abs(r.impact.point));
    return vs.length ? Math.max(...vs) : 1;
  }, [impacts]);

  return (
    <div style={S.panel}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 26 }}>
        <div>
          <div style={S.label}>Multi-Factor Scenario</div>
          <div style={{ fontSize: 17, fontWeight: 600, color: 'rgba(255,255,255,0.9)', letterSpacing: '-0.02em' }}>
            Combined Impact Simulator
          </div>
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)', textAlign: 'right', lineHeight: 1.7 }}>
          Impacts superimposed · independent-source approximation<br />
          β from bivariate OLS or empirical benchmarks
        </div>
      </div>

      {/* Target selector */}
      <div style={{ marginBottom: 22 }}>
        <div style={S.label}>Select target</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {TARGETS.map(t => {
            const active = target === t;
            return (
              <button key={t} onClick={() => selectTarget(t)} style={{
                padding: '4px 13px', fontSize: 11, fontWeight: active ? 600 : 400,
                borderRadius: 999, cursor: 'pointer', fontFamily: 'var(--font)',
                border: `1px solid ${active ? 'rgba(139,92,246,0.6)' : 'rgba(255,255,255,0.09)'}`,
                background: active ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.03)',
                color: active ? '#c4b5fd' : 'rgba(255,255,255,0.38)',
                transition: 'all 0.15s',
              }}>{t}</button>
            );
          })}
        </div>
      </div>

      {/* Factor chips — active (with X) + inactive (with +) */}
      <div style={{ marginBottom: 20 }}>
        <div style={S.label}>Factors</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {/* Active sources */}
          {visibleSources.map(src => {
            const col = SRC_COLOR[src.key] ?? '#94a3b8';
            return (
              <span key={src.key} style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '4px 10px 4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 500,
                background: col + '18', border: `1px solid ${col}40`,
                color: col,
              }}>
                {src.label}
                <button
                  onClick={() => removeSource(src.key)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 14, height: 14, borderRadius: '50%', border: 'none', cursor: 'pointer',
                    background: col + '30', color: col, fontSize: 9, fontWeight: 700,
                    lineHeight: 1, padding: 0, fontFamily: 'var(--font)',
                  }}
                >×</button>
              </span>
            );
          })}
          {/* Hidden sources — click to re-add */}
          {hiddenSources.map(src => (
            <button key={src.key} onClick={() => addSource(src.key)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '4px 11px', borderRadius: 999, fontSize: 11, fontWeight: 400,
              background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontFamily: 'var(--font)',
            }}>
              + {src.label}
            </button>
          ))}
        </div>
      </div>

      <div style={S.divider} />

      {/* Slider rows — all in one flat list */}
      {visibleSources.length === 0 ? (
        <div style={{ padding: '24px 0', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>
          Add factors above to begin
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {impacts.map(({ src, model, chg, impact }, i) => {
            const col   = SRC_COLOR[src.key] ?? '#94a3b8';
            const impPt = impact?.point ?? 0;
            const isLast = i === impacts.length - 1;

            return (
              <div key={src.key}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0' }}>
                  {/* Colour dot */}
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: col, flexShrink: 0 }} />

                  {/* Label */}
                  <span style={{ fontSize: 12, fontWeight: 400, color: 'rgba(255,255,255,0.65)', minWidth: 120, flexShrink: 0 }}>
                    {src.label}
                  </span>

                  {/* Slider */}
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', minWidth: 24, textAlign: 'right' }}>
                      {src.isRate ? `${src.min}` : `${src.min}%`}
                    </span>
                    <input
                      type="range"
                      min={src.min} max={src.max} step={src.step} value={chg}
                      onChange={e => setChanges(c => ({ ...c, [src.key]: parseFloat(e.target.value) }))}
                      style={{ flex: 1, accentColor: col, cursor: 'pointer', height: 3 }}
                    />
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', minWidth: 24 }}>
                      {src.isRate ? `+${src.max}` : `+${src.max}%`}
                    </span>
                  </div>

                  {/* Change value */}
                  <span style={{
                    fontSize: 11, fontWeight: 500, minWidth: 62, textAlign: 'right',
                    color: chg === 0 ? 'rgba(255,255,255,0.22)' : chg > 0 ? '#4ade80' : '#f87171',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {fmtChg(chg, src.isRate)}
                  </span>

                  {/* Impact */}
                  <span style={{
                    fontSize: 12, fontWeight: 600, minWidth: 68, textAlign: 'right',
                    color: impPt > 0 ? '#4ade80' : impPt < 0 ? '#f87171' : 'rgba(255,255,255,0.2)',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {impact ? fmt(impPt, cfg.unit) : '—'}
                  </span>

                  {/* β */}
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.18)', minWidth: 52, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    β&thinsp;{model?.beta != null ? (model.beta > 0 ? '+' : '') + model.beta.toFixed(3) : '—'}
                  </span>
                </div>
                {!isLast && <div style={{ height: 1, background: 'rgba(255,255,255,0.04)' }} />}
              </div>
            );
          })}
        </div>
      )}

      {/* Combined result */}
      {totals && (
        <>
          <div style={S.divider} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Big number */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div>
                <div style={{ ...S.label, marginBottom: 6 }}>Combined impact on {target}</div>
                <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.04em', color: totalColor, lineHeight: 1 }}>
                  {fmt(totals.point, cfg.unit)}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginBottom: 3 }}>95% range</div>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.45)', fontVariantNumeric: 'tabular-nums' }}>
                  {fmt(totals.low, cfg.unit)}&ensp;–&ensp;{fmt(totals.high, cfg.unit)}
                </div>
              </div>
            </div>

            {/* CI bar */}
            {(() => {
              const span  = Math.max(Math.abs(totals.low), Math.abs(totals.high)) * 2 || 1;
              const toPct = v => Math.max(0, Math.min(100, ((v + span / 2) / span) * 100));
              const pPt   = toPct(totals.point);
              const pLo   = toPct(totals.low);
              const pHi   = toPct(totals.high);
              const bLo   = Math.min(pLo, pHi);
              const bW    = Math.abs(pHi - pLo);
              return (
                <div style={{ position: 'relative', height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3 }}>
                  <div style={{ position: 'absolute', top: 0, height: '100%', borderRadius: 3, left: `${bLo}%`, width: `${bW}%`, background: totalColor + '35' }} />
                  <div style={{ position: 'absolute', top: -3, width: 2, height: 12, borderRadius: 1, left: `${pPt}%`, transform: 'translateX(-50%)', background: totalColor }} />
                  <div style={{ position: 'absolute', top: 0, width: 1, height: '100%', left: '50%', background: 'rgba(255,255,255,0.15)' }} />
                </div>
              );
            })()}

            {/* Factor breakdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {impacts.filter(r => r.impact).map(({ src, impact }) => {
                const col  = SRC_COLOR[src.key] ?? '#94a3b8';
                const pct  = maxImpactAbs > 0 ? Math.abs(impact.point) / maxImpactAbs * 100 : 0;
                const isP  = impact.point >= 0;
                return (
                  <div key={src.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 11, color: col, fontWeight: 400, minWidth: 104 }}>{src.label}</span>
                    <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 2, width: `${Math.min(100, pct)}%`, background: isP ? '#22c55e' : '#f87171', opacity: 0.8 }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, minWidth: 64, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: isP ? '#4ade80' : '#f87171' }}>
                      {fmt(impact.point, cfg.unit)}
                    </span>
                  </div>
                );
              })}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.4)' }}>Net</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: totalColor, fontVariantNumeric: 'tabular-nums' }}>{fmt(totals.point, cfg.unit)}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

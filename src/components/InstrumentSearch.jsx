import { useState, useRef } from 'react';
import { Search, X, TrendingUp, TrendingDown, Loader } from 'lucide-react';
import { useInstrumentSearch } from '../hooks/useInstrumentSearch';
import { fetchYFDetail } from '../api/nseFinance';

const SEG_COLORS  = { CASH: '#3b82f6', FNO: '#f59e0b', CD: '#22c55e', COM: '#f97316' };
const TYPE_LABELS = { EQ: 'Equity', IDX: 'Index', CE: 'Call', PE: 'Put', FUT: 'Future' };

function fmt(n, dp = 2) {
  if (n == null || isNaN(n)) return '—';
  return n.toLocaleString('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}
function fmtCr(n) {
  if (n == null) return '—';
  const cr = n / 1e7;
  if (cr >= 1e5) return `₹${(cr / 1e5).toFixed(2)}L Cr`;
  if (cr >= 1e3) return `₹${(cr / 1e3).toFixed(2)}K Cr`;
  return `₹${cr.toFixed(0)} Cr`;
}

function toYFTicker(inst) {
  if (!inst) return null;
  const sym = inst.trading_symbol;
  if (inst.exchange === 'NSE') return `${sym}.NS`;
  if (inst.exchange === 'BSE') return `${sym}.BO`;
  return null;
}

export default function InstrumentSearch() {
  const [query,      setQuery]      = useState('');
  const [open,       setOpen]       = useState(false);
  const [selected,   setSelected]   = useState(null);
  const [liveData,   setLiveData]   = useState(null);
  const [loadingLive,setLoadingLive]= useState(false);
  const { results, loading, search, clear } = useInstrumentSearch();
  const inputRef = useRef(null);

  function handleChange(e) {
    const v = e.target.value;
    setQuery(v);
    setSelected(null);
    setLiveData(null);
    search(v, { segment: 'CASH' });
    setOpen(true);
  }

  async function handleSelect(inst) {
    setSelected(inst);
    setQuery(inst.name || inst.trading_symbol);
    setOpen(false);
    clear();
    setLiveData(null);

    const ticker = toYFTicker(inst);
    if (ticker) {
      setLoadingLive(true);
      try {
        const d = await fetchYFDetail(ticker);
        setLiveData(d);
      } catch {
        setLiveData(null);
      } finally {
        setLoadingLive(false);
      }
    }
  }

  function handleClear() {
    setQuery('');
    setSelected(null);
    setLiveData(null);
    clear();
    inputRef.current?.focus();
  }

  const segColor = SEG_COLORS[selected?.segment] ?? '#64748b';
  const isUp     = liveData?.changePct != null ? liveData.changePct >= 0 : null;

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 560 }}>
      {/* Input */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px', borderRadius: 10,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.1)',
      }}>
        <Search size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
        <input
          ref={inputRef}
          value={query}
          onChange={handleChange}
          onFocus={() => results.length && setOpen(true)}
          placeholder="Search instruments — RELIANCE, NIFTY, HDFC…"
          style={{
            flex: 1, background: 'none', border: 'none', outline: 'none',
            fontSize: 13, color: 'var(--text-primary)', fontFamily: 'var(--font)',
          }}
        />
        {loading && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>…</span>}
        {query && (
          <button onClick={handleClear} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
            <X size={13} color="var(--text-muted)" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 9999,
          background: '#0a1628', border: '1px solid rgba(99,160,255,0.18)',
          borderRadius: 10, overflow: 'hidden', boxShadow: '0 16px 48px rgba(0,0,0,0.8)',
        }}>
          {results.map((inst, i) => {
            const c = SEG_COLORS[inst.segment] ?? '#64748b';
            return (
              <div
                key={`${inst.exchange}-${inst.trading_symbol}-${i}`}
                onClick={() => handleSelect(inst)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                  cursor: 'pointer', borderBottom: i < results.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                  background: `${c}18`, color: c, border: `1px solid ${c}25`, flexShrink: 0,
                }}>{inst.exchange}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {inst.trading_symbol}
                  </div>
                  {inst.name && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {inst.name}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{TYPE_LABELS[inst.instrument_type] ?? inst.instrument_type}</div>
                  {inst.isin && <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>{inst.isin}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail card */}
      {selected && (
        <div className="glass" style={{ marginTop: 10, borderRadius: 12, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{selected.trading_symbol}</div>
                {selected.name && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{selected.name}</div>
                )}
                {(liveData?.industry || liveData?.sector) && (
                  <div style={{ fontSize: 11, color: 'rgba(99,160,255,0.7)', marginTop: 3 }}>
                    {[liveData.sector, liveData.industry].filter(Boolean).join(' · ')}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                  background: `${segColor}18`, color: segColor, border: `1px solid ${segColor}25`,
                }}>{selected.exchange} · {selected.segment}</span>
                {selected.isin && (
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{selected.isin}</span>
                )}
              </div>
            </div>

            {/* Live price */}
            {loadingLive && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, color: 'var(--text-muted)', fontSize: 12 }}>
                <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} />
                Loading live data…
              </div>
            )}
            {liveData?.price != null && (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                  ₹{fmt(liveData.price)}
                </span>
                {liveData.changePct != null && (
                  <span style={{
                    display: 'flex', alignItems: 'center', gap: 3,
                    fontSize: 13, fontWeight: 600,
                    color: isUp ? 'var(--accent-green)' : 'var(--accent-rose)',
                  }}>
                    {isUp ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                    {isUp ? '+' : ''}{fmt(liveData.change)} ({isUp ? '+' : ''}{fmt(liveData.changePct)}%)
                  </span>
                )}
              </div>
            )}
            {!loadingLive && liveData == null && selected && (
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                Live data unavailable for this instrument.
              </div>
            )}
          </div>

          {/* Fundamentals grid */}
          {liveData && (
            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
                Fundamentals
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {[
                  { label: 'P/E (TTM)',     val: liveData.pe        != null ? fmt(liveData.pe, 1) + 'x'  : '—' },
                  { label: 'EPS (TTM)',      val: liveData.eps       != null ? '₹' + fmt(liveData.eps)    : '—' },
                  { label: 'P/B Ratio',      val: liveData.pbRatio   != null ? fmt(liveData.pbRatio, 1) + 'x' : '—' },
                  { label: '52W High',       val: liveData.weekHigh  != null ? '₹' + fmt(liveData.weekHigh) : '—' },
                  { label: '52W Low',        val: liveData.weekLow   != null ? '₹' + fmt(liveData.weekLow)  : '—' },
                  { label: 'Market Cap',     val: fmtCr(liveData.marketCap) },
                  { label: 'Day High',       val: liveData.dayHigh   != null ? '₹' + fmt(liveData.dayHigh)  : '—' },
                  { label: 'Day Low',        val: liveData.dayLow    != null ? '₹' + fmt(liveData.dayLow)   : '—' },
                  { label: 'Div. Yield',     val: liveData.dividendYield != null ? liveData.dividendYield + '%' : '—' },
                ].map(({ label, val }) => (
                  <div key={label} style={{ padding: '9px 11px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{val}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Volume & liquidity */}
          {liveData && (liveData.volume != null || liveData.avgVolume != null) && (
            <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
                Volume
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {liveData.volume    != null && (
                  <div style={{ padding: '9px 11px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Today's Volume</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{liveData.volume.toLocaleString('en-IN')}</div>
                  </div>
                )}
                {liveData.avgVolume != null && (
                  <div style={{ padding: '9px 11px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Avg Vol (3M)</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{liveData.avgVolume.toLocaleString('en-IN')}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Static instrument info */}
          <div style={{ padding: '12px 18px' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
              Instrument Info
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[
                { label: 'Type',         val: TYPE_LABELS[selected.instrument_type] ?? selected.instrument_type },
                { label: 'Series',       val: selected.series        || '—' },
                { label: 'Lot Size',     val: selected.lot_size      || '—' },
                { label: 'Tick Size',    val: selected.tick_size     || '—' },
                { label: 'Groww Symbol', val: selected.groww_symbol  || '—' },
                selected.expiry_date && { label: 'Expiry', val: selected.expiry_date },
              ].filter(Boolean).map(({ label, val }) => (
                <div key={label} style={{ padding: '9px 11px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-all' }}>{val}</div>
                </div>
              ))}
            </div>
            {(selected.buy_allowed === '0' || selected.sell_allowed === '0') && (
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--accent-rose)' }}>
                {selected.buy_allowed  === '0' && '⚠ Buy restricted  '}
                {selected.sell_allowed === '0' && '⚠ Sell restricted'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

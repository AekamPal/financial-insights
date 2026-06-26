// NSE India real-time index data — no API key, no broker account required.
// The Vite server plugin at /nse-api handles cookie refresh + CORS proxy.
// One call to /allIndices returns all 139 NSE indices simultaneously.

const NSE_PROXY = '/nse-api';

// Maps NSE index names → our internal quote keys
const NSE_KEY_MAP = {
  'NIFTY 50':          'nifty',
  'NIFTY BANK':        'niftyBank',
  'NIFTY IT':          'niftyIT',
  'NIFTY AUTO':        'niftyAuto',
  'NIFTY FMCG':        'niftyFMCG',
  'NIFTY PHARMA':      'niftyPhrm',
  'NIFTY REALTY':      'niftyRlty',
  'NIFTY METAL':       'niftyMtl',
  'INDIA VIX':         'vix',
  'NIFTY OIL & GAS':   'niftyOilGas',
  'NIFTY COMMODITIES': 'niftyCommodities',
};

/**
 * Fetches all NSE index quotes in a single request.
 * Returns a quote map keyed by our internal key:
 *   { price, changePct, change, prevClose, yearHigh, yearLow,
 *     dayHigh, dayLow, open, pe, pb, advances, declines, unchanged,
 *     currency, marketTime, source }
 */
export async function fetchNSEIndices() {
  const r = await fetch(`${NSE_PROXY}/allIndices`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`NSE allIndices HTTP ${r.status}`);
  const { data } = await r.json();
  const fetchedAt = Math.floor(Date.now() / 1000);   // real-time — use request time

  const result = {};
  for (const row of data) {
    const key = NSE_KEY_MAP[row.index];
    if (!key) continue;
    result[key] = {
      price:     row.last,
      changePct: row.percentChange,
      change:    row.variation,
      prevClose: row.previousClose,
      yearHigh:  row.yearHigh  ?? null,
      yearLow:   row.yearLow   ?? null,
      dayHigh:   row.high      ?? null,
      dayLow:    row.low       ?? null,
      open:      row.open      ?? null,
      pe:        row.pe        ?? null,
      pb:        row.pb        ?? null,
      advances:  row.advances  ?? null,
      declines:  row.declines  ?? null,
      unchanged: row.unchanged ?? null,
      currency:  'INR',
      marketTime: fetchedAt,
      source:    'nse',
    };
  }
  return result;
}

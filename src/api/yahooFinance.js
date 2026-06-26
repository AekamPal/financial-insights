// Yahoo Finance v8 API — free, no key needed
// In dev: requests go via Vite's /yf proxy → no CORS issue
// In production: would need a deployed proxy or backend

const YF_PROXY = '/yf/v8/finance/chart/';           // Vite dev proxy (same-origin, no CORS)
const YF_BASE  = 'https://query1.finance.yahoo.com/v8/finance/chart/';
const YF_BASE2 = 'https://query2.finance.yahoo.com/v8/finance/chart/';

// NSE / global tickers
export const TICKERS = {
  nifty:     '^NSEI',
  sensex:    '^BSESN',
  crude:     'BZ=F',        // Brent USD/bbl
  gold:      'GC=F',        // COMEX gold USD/oz (fallback)
  goldMCX:   'GOLDM.MCX',   // MCX Gold Mini INR/10g (India domestic price)
  silver:    'SI=F',        // COMEX silver USD/oz (fallback)
  silverMCX: 'SILVER.MCX',  // MCX Silver INR/kg (India domestic price)
  natgas:    'NG=F',
  copper:    'HG=F',
  usdinr:    'INR=X',
  vix:       '^INDIAVIX',
  // Sectors
  niftyIT:   '^CNXIT',
  niftyBank: '^NSEBANK',
  niftyPhrm: '^CNXPHARMA',
  niftyAuto: '^CNXAUTO',
  niftyFMCG: '^CNXFMCG',
  niftyRlty: '^CNXREALTY',
  niftyMtl:  '^CNXMETAL',
  // Top stocks
  reliance:  'RELIANCE.NS',
  tcs:       'TCS.NS',
  hdfc:      'HDFCBANK.NS',
  infy:      'INFY.NS',
  icici:     'ICICIBANK.NS',
  adani:     'ADANIENT.NS',
  lt:        'LT.NS',
  wipro:     'WIPRO.NS',
};

async function yfFetch(symbol, interval, range) {
  const qs = `?interval=${interval}&range=${range}&includeAdjustedClose=true`;
  const enc = encodeURIComponent(symbol);

  // 1. Try Vite dev proxy first (works in development, no CORS)
  try {
    const r = await fetch(YF_PROXY + enc + qs, { signal: AbortSignal.timeout(6000) });
    if (r.ok) return await r.json();
  } catch {}

  // 2. Direct fallback (works if Yahoo ever adds CORS headers, or in Node environments)
  for (const base of [YF_BASE, YF_BASE2]) {
    try {
      const r = await fetch(base + enc + qs, { signal: AbortSignal.timeout(5000) });
      if (r.ok) return await r.json();
    } catch {}
  }

  throw new Error(`YF fetch failed for ${symbol}`);
}

// Returns { price, prevClose, change, changePct, currency } for a ticker
export async function fetchQuote(symbol) {
  const data = await yfFetch(symbol, '1d', '2d');
  const meta = data.chart.result[0].meta;
  return {
    price:      meta.regularMarketPrice,
    prevClose:  meta.chartPreviousClose,
    change:     +(meta.regularMarketPrice - meta.chartPreviousClose).toFixed(2),
    changePct:  +(((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose) * 100).toFixed(2),
    currency:   meta.currency,
    marketTime: meta.regularMarketTime ?? null,   // Unix seconds — when Yahoo last ticked this price
    symbol,
  };
}

// Returns [{time, value, open, high, low, close, volume}] for chart display
export async function fetchHistory(symbol, interval = '1mo', range = '2y') {
  const data   = await yfFetch(symbol, interval, range);
  const res    = data.chart.result[0];
  const times  = res.timestamps ?? res.timestamp ?? [];
  const closes = res.indicators.quote[0].close  ?? [];
  const opens  = res.indicators.quote[0].open   ?? [];
  const highs  = res.indicators.quote[0].high   ?? [];
  const lows   = res.indicators.quote[0].low    ?? [];
  const vols   = res.indicators.quote[0].volume ?? [];

  return times.map((t, i) => {
    const d     = new Date(t * 1000);
    const month = d.toISOString().slice(0, 7);
    return {
      month,
      ts:     t * 1000,
      time:   interval.includes('m') && !interval.includes('mo')
        ? `${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`
        : month.slice(2),
      open:   opens[i]  ? +opens[i].toFixed(2)  : null,
      high:   highs[i]  ? +highs[i].toFixed(2)  : null,
      low:    lows[i]   ? +lows[i].toFixed(2)   : null,
      close:  closes[i] ? +closes[i].toFixed(2) : null,
      value:  closes[i] ? +closes[i].toFixed(2) : null,
      volume: vols[i]   ?? null,
    };
  }).filter(d => d.close !== null);
}

// Module-level cache — returned on YF failure so UI never goes blank
let _lastGoodQuotes = {};

// Batch-fetch all quotes in ONE request to avoid per-symbol rate limits
export async function fetchQuotes(pairs) {
  const tickers = pairs.map(([, sym]) => sym).join(',');
  const fields  = 'regularMarketPrice,regularMarketPreviousClose,regularMarketChange,regularMarketChangePercent,currency,regularMarketTime';
  const qs      = `?symbols=${encodeURIComponent(tickers)}&fields=${fields}&crumb=`;

  // Try batch endpoint — 1 request instead of N
  for (const base of ['/yf/v7/finance/quote', 'https://query1.finance.yahoo.com/v7/finance/quote', 'https://query2.finance.yahoo.com/v7/finance/quote']) {
    try {
      const r    = await fetch(base + qs, { signal: AbortSignal.timeout(8000) });
      if (!r.ok) continue;
      const json = await r.json();
      const list = json?.quoteResponse?.result;
      if (!list?.length) continue;

      const bySymbol = Object.fromEntries(list.map(q => [q.symbol, q]));
      const out = {};
      for (const [key, sym] of pairs) {
        const q = bySymbol[sym];
        if (!q) continue;
        const price     = q.regularMarketPrice;
        const prevClose = q.regularMarketPreviousClose ?? price;
        out[key] = {
          price,
          prevClose,
          change:    +(price - prevClose).toFixed(2),
          changePct: +((((price - prevClose) / prevClose) * 100) || q.regularMarketChangePercent || 0).toFixed(2),
          currency:  q.currency,
          marketTime: q.regularMarketTime ?? null,
          symbol:    sym,
        };
      }

      if (Object.keys(out).length > 0) {
        _lastGoodQuotes = { ..._lastGoodQuotes, ...out };
        return out;
      }
    } catch { /* try next */ }
  }

  // Batch failed — fall back to individual chart requests for critical symbols only
  const critical  = pairs.filter(([k]) => ['nifty', 'sensex', 'usdinr', 'crude', 'gold'].includes(k));
  const results   = await Promise.allSettled(critical.map(([key, sym]) => fetchQuote(sym).then(q => [key, q])));
  const fallback  = Object.fromEntries(results.filter(r => r.status === 'fulfilled').map(r => r.value));

  if (Object.keys(fallback).length > 0) {
    _lastGoodQuotes = { ..._lastGoodQuotes, ...fallback };
    return { ..._lastGoodQuotes, ...fallback };
  }

  // Everything failed — return last known good so UI doesn't go blank
  console.warn('[yf] all fetches failed, returning cached quotes');
  return _lastGoodQuotes;
}

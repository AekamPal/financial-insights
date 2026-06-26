// Fundamentals from Yahoo Finance
// Price + market data: /yf (v8 chart, no auth needed)
// Fundamentals: /yf v10/quoteSummary with corsDomain bypass (no crumb needed in many cases)

const STOCK_MAP = [
  ['reliance', 'RELIANCE.NS'],
  ['tcs',      'TCS.NS'],
  ['hdfc',     'HDFCBANK.NS'],
  ['infy',     'INFY.NS'],
  ['icici',    'ICICIBANK.NS'],
  ['adani',    'ADANIENT.NS'],
  ['lt',       'LT.NS'],
  ['wipro',    'WIPRO.NS'],
];

export { STOCK_MAP };

// Module sets to try — fall back to smaller set if large one fails
const MODULES_FULL  = 'defaultKeyStatistics,summaryDetail,assetProfile,financialData';
const MODULES_SMALL = 'defaultKeyStatistics,summaryDetail';

function raw(obj) {
  if (obj == null) return null;
  return typeof obj === 'object' ? (obj.raw ?? null) : obj;
}

function parseSummary(result) {
  if (!result) return {};
  const ks   = result.defaultKeyStatistics ?? {};
  const sd   = result.summaryDetail        ?? {};
  const prof = result.assetProfile         ?? {};

  const divYield = raw(sd.dividendYield);
  return {
    pe:            raw(ks.trailingPE)        ?? null,
    eps:           raw(ks.trailingEps)       ?? null,
    pbRatio:       raw(ks.priceToBook)       ?? null,
    weekHigh:      raw(sd.fiftyTwoWeekHigh)  ?? null,
    weekLow:       raw(sd.fiftyTwoWeekLow)   ?? null,
    marketCap:     raw(sd.marketCap)         ?? null,
    dividendYield: divYield != null ? +(divYield * 100).toFixed(2) : null,
    industry:      prof.industry             ?? null,
    sector:        prof.sector               ?? null,
  };
}

async function fetchQuoteSummary(symbol) {
  const enc = encodeURIComponent(symbol);

  // Attempt 1: Python yfinance via /py-fund (most reliable — handles Yahoo auth natively)
  try {
    const r = await fetch(`/py-fund?symbol=${enc}`, { signal: AbortSignal.timeout(35_000) });
    if (r.ok) {
      const data = await r.json();
      const d    = data?.[symbol] ?? data?.[Object.keys(data)[0]];
      if (d && !d.error && (d.trailingPE != null || d.fiftyTwoWeekHigh != null)) {
        return {
          pe:            d.trailingPE             ?? null,
          eps:           d.trailingEps            ?? null,
          pbRatio:       d.priceToBook            ?? null,
          weekHigh:      d.fiftyTwoWeekHigh       ?? null,
          weekLow:       d.fiftyTwoWeekLow        ?? null,
          marketCap:     d.marketCap              ?? null,
          dividendYield: d.dividendYield          ?? null,
          industry:      d.industry               ?? null,
          sector:        d.sector                 ?? null,
          dayHigh:       d.regularMarketDayHigh   ?? null,
          dayLow:        d.regularMarketDayLow    ?? null,
          volume:        d.regularMarketVolume    ?? null,
          avgVolume:     d.averageDailyVolume3Month ?? null,
        };
      }
    }
  } catch {}

  // Attempt 2: v10 quoteSummary via proxy (no crumb — works in some regions)
  for (const modules of [MODULES_FULL, MODULES_SMALL]) {
    try {
      const qs = `modules=${modules}&formatted=true&corsDomain=finance.yahoo.com&lang=en-US&region=IN`;
      const r  = await fetch(`/yf/v10/finance/quoteSummary/${enc}?${qs}`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(8_000),
      });
      if (r.ok) {
        const data   = await r.json();
        const result = data?.quoteSummary?.result?.[0];
        const parsed = parseSummary(result);
        if (parsed.pe != null || parsed.weekHigh != null) return parsed;
      }
    } catch {}
  }

  // Attempt 3: server-side /yf-fund (crumb-based, may fail if Yahoo blocks Node.js)
  try {
    const r = await fetch(`/yf-fund?symbol=${enc}`, { signal: AbortSignal.timeout(10_000) });
    if (r.ok) {
      const data   = await r.json();
      const result = data?.quoteSummary?.result?.[0];
      const parsed = parseSummary(result);
      if (parsed.pe != null || parsed.weekHigh != null) return parsed;
    }
  } catch {}

  return {};
}

export async function fetchAllFundamentals() {
  const results = await Promise.allSettled(
    STOCK_MAP.map(([key, sym]) =>
      fetchQuoteSummary(sym).then(f => [key, f])
    )
  );
  return Object.fromEntries(
    results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value)
      .filter(([, f]) => f && Object.keys(f).length > 0)
  );
}

// Full detail fetch for InstrumentSearch card
export async function fetchYFDetail(yfTicker) {
  try {
    const enc = encodeURIComponent(yfTicker);

    const [chartRes, fundRes] = await Promise.allSettled([
      fetch(`/yf/v8/finance/chart/${enc}?interval=1d&range=2d`, {
        signal: AbortSignal.timeout(7_000),
      }).then(r => r.json()),
      fetchQuoteSummary(yfTicker),
    ]);

    const meta = chartRes.status === 'fulfilled' ? chartRes.value?.chart?.result?.[0]?.meta : null;
    const fund = fundRes.status  === 'fulfilled' ? (fundRes.value ?? {}) : {};

    if (!meta) return null;

    const price     = meta.regularMarketPrice ?? null;
    const prev      = meta.chartPreviousClose ?? null;
    const changePct = price && prev ? +((price - prev) / prev * 100).toFixed(2) : null;

    return {
      price,
      change:        price && prev ? +(price - prev).toFixed(2) : null,
      changePct,
      currency:      meta.currency ?? 'INR',
      // Market data: prefer yfinance (via fund), fall back to v8 chart meta
      volume:        fund.volume   ?? meta.regularMarketVolume  ?? null,
      avgVolume:     fund.avgVolume ?? null,
      dayHigh:       fund.dayHigh  ?? meta.regularMarketDayHigh ?? null,
      dayLow:        fund.dayLow   ?? meta.regularMarketDayLow  ?? null,
      // 52W from fund (quoteSummary) or chart meta
      weekHigh:      fund.weekHigh  ?? meta.fiftyTwoWeekHigh ?? null,
      weekLow:       fund.weekLow   ?? meta.fiftyTwoWeekLow  ?? null,
      marketCap:     fund.marketCap ?? meta.marketCap        ?? null,
      // Fundamentals
      pe:            fund.pe            ?? null,
      eps:           fund.eps           ?? null,
      pbRatio:       fund.pbRatio       ?? null,
      dividendYield: fund.dividendYield ?? null,
      industry:      fund.industry      ?? null,
      sector:        fund.sector        ?? null,
    };
  } catch {
    return null;
  }
}

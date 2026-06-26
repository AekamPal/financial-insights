// Alpha Vantage — monthly commodity series + US economic indicators.
// All fetching is server-side (key stays secret). 9 requests per batch, 24-hour cache.
// Free tier: 25 req/day.

// ── Metadata ──────────────────────────────────────────────────────────────────

export const AV_COMMODITY_META = {
  BRENT:       { appKey: 'crude',   label: 'Brent Crude',    unit: 'USD/bbl',   color: '#f59e0b' },
  NATURAL_GAS: { appKey: 'natgas',  label: 'Natural Gas',    unit: 'USD/MMBtu', color: '#22d3ee' },
  COPPER:      { appKey: 'copper',  label: 'Copper',         unit: 'USD/lb',    color: '#fb923c' },
  GOLD:        { appKey: 'gold',    label: 'Gold',           unit: 'USD/oz',    color: '#fbbf24' },
  SILVER:      { appKey: 'silver',  label: 'Silver',         unit: 'USD/oz',    color: '#94a3b8' },
};

export const AV_INDICATOR_META = {
  CPI_YOY:            { label: 'US CPI Inflation',     unit: '% YoY', color: '#f87171',
    note: 'Year-over-year % change in US Consumer Price Index. Proxy for global inflation pressure and Fed policy direction.' },
  FEDERAL_FUNDS_RATE: { label: 'US Fed Funds Rate',    unit: '%',     color: '#60a5fa',
    note: 'US Federal Reserve overnight lending rate. Higher rates = stronger USD, tighter global liquidity, FII outflows from EMs including India.' },
  TREASURY_YIELD:     { label: 'US 10Y Treasury',      unit: '%',     color: '#a78bfa',
    note: '10-year US Treasury yield. Benchmark risk-free rate globally. Rising yields compress EM equity valuations and attract capital away from India.' },
  REAL_GDP_GROWTH:    { label: 'US Real GDP Growth',   unit: '% QoQ', color: '#34d399',
    note: 'US quarter-over-quarter real GDP growth. Strong US growth drives commodity demand (copper, crude) and benefits Indian IT exports.' },
};

// ── Fetch ─────────────────────────────────────────────────────────────────────

export async function fetchAVStatus() {
  try {
    const r = await fetch('/av-api/status', { signal: AbortSignal.timeout(5_000) });
    return r.ok ? r.json() : { configured: false };
  } catch { return { configured: false }; }
}

export async function fetchAVData() {
  const r = await fetch('/av-api', { signal: AbortSignal.timeout(90_000) });
  const d = await r.json();
  if (d.error === 'not_configured') return null;
  if (!r.ok) throw new Error(d.error ?? `AV ${r.status}`);
  return d;
}

// ── Transformers ──────────────────────────────────────────────────────────────

/**
 * Returns commodity monthly series keyed by appKey (crude, gold, silver, natgas, copper).
 * Each series: [{ month: '2024-01', value: 77.97, close: 77.97 }]
 */
export function getAVCommoditySeries(avData) {
  if (!avData?.commodities) return {};
  const result = {};
  for (const [avKey, meta] of Object.entries(AV_COMMODITY_META)) {
    const raw = avData.commodities[avKey];
    if (raw?.length) {
      result[meta.appKey] = raw.map(d => ({ month: d.month, value: d.value, close: d.value }));
    }
  }
  return result;
}

/**
 * Returns economic indicator series:
 *   CPI_YOY            — YoY % change in CPI (computed from raw CPI levels)
 *   FEDERAL_FUNDS_RATE — monthly rate (%)
 *   TREASURY_YIELD     — monthly 10Y yield (%)
 *   REAL_GDP_GROWTH    — QoQ % GDP growth
 * Each series: [{ month: '2024-01', value: 3.2 }]
 */
export function getAVIndicatorSeries(avData) {
  if (!avData?.indicators) return {};
  const result = {};

  // CPI → compute YoY % change (= actual inflation rate)
  const cpi = avData.indicators.CPI;
  if (cpi?.length >= 13) {
    result.CPI_YOY = cpi.slice(12).map((d, i) => ({
      month: d.month,
      value: +((d.value - cpi[i].value) / cpi[i].value * 100).toFixed(2),
    }));
  }

  // Federal Funds Rate — use as-is
  if (avData.indicators.FEDERAL_FUNDS_RATE?.length) {
    result.FEDERAL_FUNDS_RATE = avData.indicators.FEDERAL_FUNDS_RATE;
  }

  // 10Y Treasury Yield — use as-is
  if (avData.indicators.TREASURY_YIELD?.length) {
    result.TREASURY_YIELD = avData.indicators.TREASURY_YIELD;
  }

  // Real GDP → compute QoQ % growth
  const gdp = avData.indicators.REAL_GDP;
  if (gdp?.length >= 2) {
    result.REAL_GDP_GROWTH = gdp.slice(1).map((d, i) => ({
      month: d.month,
      value: +((d.value - gdp[i].value) / gdp[i].value * 100).toFixed(2),
    }));
  }

  return result;
}

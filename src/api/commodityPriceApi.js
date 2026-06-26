// Commodity Price API — commoditypriceapi.com
// All requests go through /cpa-api proxy (key stays server-side).
// Latest: 1 request for all 5 commodities.  History: 2 requests for 2-year series.

export const CPA_SYMBOL_MAP = {
  'BRENTOIL-SPOT': { key: 'crude',  label: 'Brent Crude',  unit: 'USD/bbl'   },
  'XAU':           { key: 'gold',   label: 'Gold',          unit: 'USD/oz'    },
  'XAG':           { key: 'silver', label: 'Silver',        unit: 'USD/oz'    },
  'NG-FUT':        { key: 'natgas', label: 'Natural Gas',   unit: 'USD/MMBtu' },
  'HG-SPOT':       { key: 'copper', label: 'Copper',        unit: 'USD/t'     },
};

// ── Fetch ─────────────────────────────────────────────────────────────────────

export async function fetchCPALatest() {
  const r = await fetch('/cpa-api/latest', { signal: AbortSignal.timeout(12_000) });
  const d = await r.json();
  if (d.error === 'not_configured') return null;
  if (!r.ok) throw new Error(d.error ?? `CPA ${r.status}`);
  return d;
}

export async function fetchCPAHistory() {
  const r = await fetch('/cpa-api/history', { signal: AbortSignal.timeout(30_000) });
  const d = await r.json();
  if (d.error === 'not_configured') return null;
  if (!r.ok) throw new Error(d.error ?? `CPA ${r.status}`);
  return d;
}

// ── Normalizers ───────────────────────────────────────────────────────────────

/**
 * Normalize /latest response → { crude, gold, silver, natgas, copper }
 * Each: { price, changePct: null }   (CPA latest doesn't include prev close)
 */
export function normalizeCPALatest(d) {
  if (!d?.rates) return {};
  const result = {};
  for (const [sym, meta] of Object.entries(CPA_SYMBOL_MAP)) {
    const price = d.rates[sym];
    if (price != null && !isNaN(price)) {
      result[meta.key] = { price: +price, changePct: null, change: null, source: 'cpa' };
    }
  }
  return result;
}

/**
 * Normalize /history response → { crude, gold, silver, natgas, copper }
 * Each: [{ month: '2024-01', value, close, open, high, low }] sorted oldest→newest
 *
 * CPA time-series can be either:
 *   { rates: { "2024-01-02": { "XAU": { open, close, ... }, ... } } }  ← per-date
 *   { rates: { "XAU": { "2024-01-02": { open, close, ... } } } }       ← per-symbol
 * We detect and handle both.
 */
export function normalizeCPAHistory(data) {
  if (!data) return {};
  const { period1, period2 } = data;

  // Merge both periods' raw rates
  const merged = {}; // symbol → { 'YYYY-MM': { open, high, low, close } }

  for (const period of [period2, period1].filter(Boolean)) {
    const rates = period?.rates ?? {};
    const firstKey = Object.keys(rates)[0] ?? '';
    const isPerDate = /^\d{4}-\d{2}-\d{2}$/.test(firstKey);

    if (isPerDate) {
      // { "2024-01-02": { "XAU": { close: ... } } }
      for (const [dateStr, symbols] of Object.entries(rates)) {
        const month = dateStr.slice(0, 7);
        for (const [sym, ohlc] of Object.entries(symbols ?? {})) {
          if (!CPA_SYMBOL_MAP[sym]) continue;
          if (!merged[sym]) merged[sym] = {};
          if (!merged[sym][month] || dateStr > Object.keys(merged[sym]).find(m => m === month)) {
            merged[sym][month] = ohlc;
          }
        }
      }
    } else {
      // { "XAU": { "2024-01-02": { close: ... } } }
      for (const [sym, dates] of Object.entries(rates)) {
        if (!CPA_SYMBOL_MAP[sym]) continue;
        if (!merged[sym]) merged[sym] = {};
        for (const [dateStr, ohlc] of Object.entries(dates ?? {})) {
          const month = dateStr.slice(0, 7);
          if (!merged[sym][month]) merged[sym][month] = ohlc;
        }
      }
    }
  }

  // Convert to sorted monthly arrays
  const result = {};
  for (const [sym, monthMap] of Object.entries(merged)) {
    const appKey = CPA_SYMBOL_MAP[sym]?.key;
    if (!appKey) continue;
    result[appKey] = Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, ohlc]) => {
        const close = parseFloat(ohlc?.close ?? ohlc?.value ?? 0);
        return {
          month,
          time:  month.slice(2),
          open:  parseFloat(ohlc?.open  ?? close),
          high:  parseFloat(ohlc?.high  ?? close),
          low:   parseFloat(ohlc?.low   ?? close),
          close,
          value: close,
        };
      })
      .filter(d => d.close > 0);
  }
  return result;
}

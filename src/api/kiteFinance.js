// Zerodha Kite Connect — client-side wrappers for Vite server-side proxy

export async function fetchKiteStatus() {
  try {
    const r = await fetch('/kite/status', { signal: AbortSignal.timeout(3_000) });
    if (!r.ok) return { configured: false };
    return r.json();
  } catch {
    return { configured: false };
  }
}

// Returns a map of { key → { price, prevClose, change, changePct, currency } }
// Keys: nifty, sensex, niftyIT, niftyBank, niftyPhrm, niftyAuto, niftyFMCG,
//       niftyRlty, niftyMtl, reliance, tcs, hdfc, infy, icici, adani, lt, wipro,
//       goldMCX, silverMCX, crudeMCX, natgasMCX, copperMCX
export async function fetchKiteQuotes() {
  const r = await fetch('/kite/quotes', { signal: AbortSignal.timeout(15_000) });
  if (!r.ok) throw new Error(`Kite /quotes HTTP ${r.status}`);
  const d = await r.json();
  if (d.error) throw new Error(d.error);
  return d;
}

// Returns OHLCV candles as [{ month, time, open, high, low, close, value, volume }]
export async function fetchKiteHistory(key, interval = 'day', fromDate, toDate) {
  const fmt = d => (d instanceof Date ? d.toISOString().slice(0, 10) : d);
  const qs  = `key=${encodeURIComponent(key)}&interval=${interval}&from=${fmt(fromDate)}&to=${fmt(toDate)}`;
  const r   = await fetch(`/kite/history?${qs}`, { signal: AbortSignal.timeout(20_000) });
  if (!r.ok) throw new Error(`Kite /history HTTP ${r.status}`);
  const d = await r.json();
  if (d.error) throw new Error(d.error);
  return d;
}

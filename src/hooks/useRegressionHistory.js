import { useState, useEffect } from 'react';
import { fetchHistory, TICKERS } from '../api/yahooFinance';

// Max-range monthly series for regression only (not chart display).
// Cached in localStorage for 24h so it doesn't re-fetch on every page load.
const CACHE_KEY = 'regressionHistory_v2';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

const REGRESSION_PAIRS = [
  ['nifty',      TICKERS.nifty],       // ^NSEI
  ['usdinr',     TICKERS.usdinr],      // INR=X
  ['niftyBank',  TICKERS.niftyBank],   // ^NSEBANK
  ['niftyIT',    TICKERS.niftyIT],     // ^CNXIT
  ['niftyRealty',TICKERS.niftyRlty],  // ^CNXREALTY
];

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null;
    return data;
  } catch { return null; }
}

function saveCache(data) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data })); } catch {}
}

function normSeries(bars) {
  return bars
    .filter(b => b.close != null)
    .map(b => ({ month: b.month, value: b.close }));
}

export function useRegressionHistory() {
  const [data, setData] = useState(() => loadCache() ?? {});

  useEffect(() => {
    const cached = loadCache();
    if (cached && Object.keys(cached).length > 0) {
      setData(cached);
      return;
    }
    Promise.allSettled(
      REGRESSION_PAIRS.map(([key, ticker]) =>
        fetchHistory(ticker, '1mo', 'max').then(bars => [key, normSeries(bars)])
      )
    ).then(results => {
      const out = {};
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value?.[1]?.length > 10) {
          const [key, series] = r.value;
          out[key] = series;
        }
      }
      if (Object.keys(out).length > 0) {
        saveCache(out);
        setData(out);
      }
    });
  }, []);

  return data; // { nifty, usdinr, niftyBank, niftyIT, niftyRealty } — max available monthly points
}

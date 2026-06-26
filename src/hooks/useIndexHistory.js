import { useState, useEffect } from 'react';
import { fetchHistory, TICKERS } from '../api/yahooFinance';
import { fetchKiteStatus, fetchKiteHistory } from '../api/kiteFinance';

// Returns daily candles resampled to one-per-month (last trading day wins)
function resampleMonthly(bars) {
  const byMonth = {};
  for (const bar of bars) byMonth[bar.month] = bar;
  return Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month));
}

function twoYearsAgo() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 2);
  return d.toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function fetchIndexSeries(key, yfTicker, kiteAvailable) {
  if (kiteAvailable) {
    try {
      const bars = await fetchKiteHistory(key, 'day', twoYearsAgo(), today());
      if (bars?.length > 10) return resampleMonthly(bars);
    } catch (e) {
      console.warn(`[useIndexHistory] Kite ${key} failed:`, e.message);
    }
  }
  // Yahoo Finance fallback
  const bars = await fetchHistory(yfTicker, '1mo', '2y');
  return bars;
}

export function useIndexHistory() {
  const [niftyHistory,  setNifty]  = useState(null);
  const [sensexHistory, setSensex] = useState(null);

  useEffect(() => {
    fetchKiteStatus().then(async ({ configured }) => {
      const [n, s] = await Promise.allSettled([
        fetchIndexSeries('nifty',  TICKERS.nifty,  configured),
        fetchIndexSeries('sensex', TICKERS.sensex, configured),
      ]);
      if (n.status === 'fulfilled' && n.value?.length > 2) setNifty(n.value);
      if (s.status === 'fulfilled' && s.value?.length > 2) setSensex(s.value);
    });
  }, []);

  return { niftyHistory, sensexHistory };
}

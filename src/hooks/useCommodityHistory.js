import { useState, useEffect } from 'react';
import { fetchHistory, TICKERS } from '../api/yahooFinance';

// Use COMEX/CME tickers for all commodities — these have 10Y history on Yahoo Finance.
// MCX tickers (GOLDM.MCX, SILVER.MCX) only have 2-3Y history and would break OLS fallback.
// Live prices from GoldAPI/Kite/CPA override the chart value regardless of history source.
const COMMODITY_TICKERS = {
  gold:   TICKERS.gold,    // GC=F — COMEX USD/oz (10Y+ history)
  silver: TICKERS.silver,  // SI=F — COMEX USD/oz (10Y+ history)
  crude:  TICKERS.crude,   // BZ=F — USD/bbl
  natgas: TICKERS.natgas,  // NG=F — USD/MMBtu
  copper: TICKERS.copper,  // HG=F — USD/lb
};

export function useCommodityHistory(disabled = false) {
  const [history, setHistory] = useState({});

  useEffect(() => {
    if (disabled) return;
    const pairs = Object.entries(COMMODITY_TICKERS);
    Promise.allSettled(
      pairs.map(([key, ticker]) =>
        fetchHistory(ticker, '1mo', '10y').then(bars => [key, bars])
      )
    ).then(results => {
      const out = {};
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value?.[1]?.length > 2) {
          const [key, bars] = r.value;
          out[key] = bars;
        }
      }
      if (Object.keys(out).length > 0) setHistory(out);
    });
  }, []);

  return history;  // { gold: [...], silver: [...], crude: [...], natgas: [...], copper: [...] }
}

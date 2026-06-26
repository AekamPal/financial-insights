import { useState, useEffect } from 'react';
import { fetchHistory, TICKERS } from '../api/yahooFinance';

// MCX commodity history uses Yahoo Finance (avoids Kite contract-rollover complexity
// for 2-year historical series). GOLDM.MCX / SILVER.MCX give India domestic INR prices.
// Brent/NG/copper from COMEX/CME — used for the chart shape; live price from Kite overrides.
const COMMODITY_TICKERS = {
  gold:   TICKERS.goldMCX,    // GOLDM.MCX — INR/10g
  silver: TICKERS.silverMCX,  // SILVER.MCX — INR/kg
  crude:  TICKERS.crude,       // BZ=F — USD/bbl
  natgas: TICKERS.natgas,      // NG=F — USD/MMBtu
  copper: TICKERS.copper,      // HG=F — USD/lb
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

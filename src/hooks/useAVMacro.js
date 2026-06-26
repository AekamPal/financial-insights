import { useState, useEffect } from 'react';
import { fetchAVData, getAVCommoditySeries, getAVIndicatorSeries } from '../api/alphaVantage';

/**
 * Fetches Alpha Vantage monthly commodity series + US economic indicators.
 * Fire-and-forget: starts in background, updates state when batch completes.
 * Returns:
 *   commodities — { crude, gold, silver, natgas, copper } monthly series
 *   indicators  — { CPI_YOY, FEDERAL_FUNDS_RATE, TREASURY_YIELD, REAL_GDP_GROWTH } series
 *   fetchedAt   — ISO string when batch completed (null while loading)
 *   configured  — whether AV key is present in env
 */
export function useAVMacro() {
  const [commodities, setCommodities] = useState({});
  const [indicators,  setIndicators]  = useState({});
  const [fetchedAt,   setFetchedAt]   = useState(null);
  const [configured,  setConfigured]  = useState(false);

  useEffect(() => {
    fetchAVData()
      .then(data => {
        if (!data) return;
        setCommodities(getAVCommoditySeries(data));
        setIndicators(getAVIndicatorSeries(data));
        setFetchedAt(data.fetchedAt);
        setConfigured(true);
      })
      .catch(e => console.warn('[useAVMacro]', e.message));
  }, []);

  return { commodities, indicators, fetchedAt, configured };
}

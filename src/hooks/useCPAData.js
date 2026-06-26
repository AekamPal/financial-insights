import { useState, useEffect } from 'react';
import { fetchCPAHistory, normalizeCPAHistory } from '../api/commodityPriceApi';

/**
 * Fetches 2-year commodity history from Commodity Price API.
 * Live prices are handled in useLiveData (merged into quotes).
 * Returns:
 *   history    — { crude, gold, silver, natgas, copper } monthly OHLC arrays
 *   configured — whether CPA key is present
 */
export function useCPAData() {
  const [history,    setHistory]    = useState({});
  const [configured, setConfigured] = useState(false);

  useEffect(() => {
    fetchCPAHistory()
      .then(d => {
        if (!d) return;
        const h = normalizeCPAHistory(d);
        setHistory(h);
        setConfigured(true);
        console.log('[cpa] history loaded:', Object.keys(h).join(', '));
      })
      .catch(e => console.warn('[cpa] history failed:', e.message));
  }, []);

  return { history, configured };
}

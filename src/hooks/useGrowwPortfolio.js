import { useState, useEffect, useRef } from 'react';
import { getHoldings, getPositions, getMargin, getUserProfile } from '../api/growwApi';

export function useGrowwPortfolio() {
  const [data,    setData]    = useState(null);  // { holdings, positions, margin, profile }
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const timer = useRef(null);

  async function load() {
    try {
      const [holdings, positions, margin, profile] = await Promise.allSettled([
        getHoldings(),
        getPositions(),
        getMargin(),
        getUserProfile(),
      ]);

      const ok = r => r.status === 'fulfilled' ? r.value : null;
      const h = ok(holdings);

      // If holdings returned an error object (not configured), bail out silently
      if (h?.error) {
        setData(null);
        setError('not_configured');
        setLoading(false);
        return;
      }

      setData({
        holdings: Array.isArray(h) ? h : [],
        positions: Array.isArray(ok(positions)) ? ok(positions) : [],
        margin:    ok(margin)  ?? null,
        profile:   ok(profile) ?? null,
      });
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Single attempt on mount — no polling. Groww portfolio auth is unreliable
    // and retrying causes rate-limit spam. User can manually refresh if needed.
    load();
    return () => clearInterval(timer.current);
  }, []);

  return { data, loading, error, refresh: load };
}

import { useState, useCallback, useRef } from 'react';

export function useInstrumentSearch() {
  const [results,  setResults]  = useState([]);
  const [loading,  setLoading]  = useState(false);
  const debounce = useRef(null);

  const search = useCallback((query, { segment = '', exchange = '', limit = 25 } = {}) => {
    clearTimeout(debounce.current);
    if (!query || query.length < 2) { setResults([]); return; }

    debounce.current = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ q: query, limit });
        if (segment)  params.set('segment',  segment);
        if (exchange) params.set('exchange', exchange);
        const r = await fetch(`/instruments-api/search?${params}`, { signal: AbortSignal.timeout(5000) });
        const data = await r.json();
        setResults(Array.isArray(data) ? data : []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
  }, []);

  const lookup = useCallback(async (exchange, symbol) => {
    const r = await fetch(`/instruments-api/lookup?exchange=${exchange}&symbol=${symbol}`);
    return r.ok ? r.json() : null;
  }, []);

  const clear = useCallback(() => setResults([]), []);

  return { results, loading, search, lookup, clear };
}

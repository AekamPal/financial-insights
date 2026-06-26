import { useState, useEffect } from 'react';

let _cache = null;
let _cacheTs = 0;

export function useNewsRss() {
  const [items,   setItems]   = useState(_cache ?? []);
  const [loading, setLoading] = useState(!_cache);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    // Return immediately if cache is fresh (< 5 min)
    if (_cache && Date.now() - _cacheTs < 5 * 60 * 1000) return;

    fetch('/news-api', { signal: AbortSignal.timeout(12000) })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          _cache = data;
          _cacheTs = Date.now();
          setItems(data);
          setError(null);
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Filter helpers
  const byTag = (tag) => items.filter(n => n.tags?.includes(tag));
  const byCommodity = (newsTag) => items.filter(n => n.tags?.includes(newsTag));

  return { items, loading, error, byTag, byCommodity };
}

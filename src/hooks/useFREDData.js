import { useState, useEffect } from 'react';

const CACHE_KEY = 'fredData_v1';
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours (CPI is monthly)

function loadCache() {
  try {
    const c = JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? 'null');
    if (c && Date.now() - c.ts < CACHE_TTL) return c;
  } catch {}
  return null;
}

export function useFREDData() {
  const cached = loadCache();
  const [cpiYoY,   setCpiYoY]   = useState(cached?.cpiYoY   ?? null);
  const [repoRate, setRepoRate] = useState(null);

  useEffect(() => {
    if (!cached?.cpiYoY) {
      // India CPI All Items — Percent Change from Year Ago (FRED series INDCPIALLMINMEI, units=pc1)
      fetch('/fred?series=INDCPIALLMINMEI&units=pc1&limit=2')
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          const obs = (d?.observations ?? []).filter(o => o.value !== '.' && o.value != null);
          if (obs.length < 1) return;
          const curr = parseFloat(obs[0].value);
          const prev = obs[1] ? parseFloat(obs[1].value) : null;
          if (isNaN(curr)) return;
          const data = { value: curr, prev: isNaN(prev) ? null : prev, date: obs[0].date };
          setCpiYoY(data);
          try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ cpiYoY: data, ts: Date.now() })); } catch {}
        })
        .catch(() => {});
    }

    fetch('/repo-rate')
      .then(r => r.json())
      .then(d => { if (d?.rate != null) setRepoRate(d.rate); })
      .catch(() => {});
  }, []);

  return { cpiYoY, repoRate };
}

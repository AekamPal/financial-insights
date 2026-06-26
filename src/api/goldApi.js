// GoldAPI.io — real-time gold price in INR.
// price_gram_24k × 10 gives the exact INR per 10g (matches India market price).
// Free tier: ~100 req/month. Server-side cache: 10 min.

export async function fetchGoldAPI() {
  const r = await fetch('/gold-api', { signal: AbortSignal.timeout(10_000) });
  const d = await r.json();
  if (d.error === 'not_configured') return null;
  if (d.error) throw new Error(d.error);
  if (!r.ok) throw new Error(`GoldAPI ${r.status}`);
  return d;
}

import { useState, useEffect, useRef } from 'react';
import { fetchQuotes, TICKERS } from '../api/yahooFinance';
import { fetchNSEIndices } from '../api/nseIndia';

// ── DEV TOGGLE: set true to skip Yahoo and verify AV-only data ────────────────
const DISABLE_YAHOO = false;
// ─────────────────────────────────────────────────────────────────────────────
import { fetchKiteStatus, fetchKiteQuotes } from '../api/kiteFinance';
import { fetchAVStatus } from '../api/alphaVantage';
import { fetchCPALatest, normalizeCPALatest } from '../api/commodityPriceApi';
import { fetchGoldAPI } from '../api/goldApi';

// Conversion helpers for Yahoo Finance USD prices → INR
const TROY_OZ_G = 31.1035;
const goldInrTenG = (usdOz, r)   => +((usdOz / TROY_OZ_G) * 10 * r).toFixed(0);
const silverInrKg = (usdOz, r)   => +((usdOz / TROY_OZ_G) * 1000 * r).toFixed(0);
const copperInrKg = (usdLb, r)   => +(usdLb * r * 2.2046).toFixed(1);
const natgasInrMm = (usdMm, r)   => +(usdMm * r).toFixed(1);

// Yahoo Finance fallback — fetches everything when Kite is not available
const YF_PAIRS = [
  ['nifty',     TICKERS.nifty],
  ['sensex',    TICKERS.sensex],
  ['crude',     TICKERS.crude],
  ['gold',      TICKERS.gold],
  ['goldMCX',   TICKERS.goldMCX],
  ['silver',    TICKERS.silver],
  ['silverMCX', TICKERS.silverMCX],
  ['natgas',    TICKERS.natgas],
  ['copper',    TICKERS.copper],
  ['usdinr',    TICKERS.usdinr],
  ['niftyIT',   TICKERS.niftyIT],
  ['niftyBank', TICKERS.niftyBank],
  ['niftyPhrm', TICKERS.niftyPhrm],
  ['niftyAuto', TICKERS.niftyAuto],
  ['niftyFMCG', TICKERS.niftyFMCG],
  ['niftyRlty', TICKERS.niftyRlty],
  ['niftyMtl',  TICKERS.niftyMtl],
  ['reliance',  TICKERS.reliance],
  ['tcs',       TICKERS.tcs],
  ['hdfc',      TICKERS.hdfc],
  ['infy',      TICKERS.infy],
  ['icici',     TICKERS.icici],
  ['adani',     TICKERS.adani],
  ['lt',        TICKERS.lt],
  ['wipro',     TICKERS.wipro],
];

// When Kite is active, only fetch USD/INR from Yahoo (Kite doesn't provide spot FX)
const YF_USDINR = [['usdinr', TICKERS.usdinr]];

export function useLiveData() {
  const [quotes,      setQuotes]      = useState(null);
  const [source,      setSource]      = useState(null);
  const [avStatus,    setAvStatus]    = useState(null);   // { configured, fetchedAt, ... }
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const kiteRef  = useRef(null);   // null = checking, true = configured, false = not
  const timerRef = useRef(null);

  async function load() {
    try {
      if (DISABLE_YAHOO) {
        setQuotes({});
        setSource('disabled');
        setLoading(false);
        return;
      }
      let q;
      if (kiteRef.current === true) {
        // Kite is most complete — covers NSE + MCX + Sensex in real-time
        try {
          const [kiteData, yfData] = await Promise.all([
            fetchKiteQuotes(),
            fetchQuotes(YF_USDINR),
          ]);
          q = { ...yfData, ...kiteData };
          setSource('kite');
        } catch (e) {
          console.warn('[useLiveData] Kite failed, falling back to Yahoo:', e.message);
          q = await fetchQuotes(YF_PAIRS);
          setSource('yahoo');
        }
      } else {
        // NSE API (real-time) + Yahoo Finance (Sensex, USD/INR, commodities, stocks) in parallel
        const [yfData, nseData] = await Promise.all([
          fetchQuotes(YF_PAIRS),
          fetchNSEIndices().catch(e => { console.warn('[nse]', e.message); return null; }),
        ]);
        // NSE overrides Yahoo for the NSE indices it covers (no delay vs Yahoo's ~15min)
        q = nseData ? { ...yfData, ...nseData } : yfData;
        setSource(nseData ? 'nse+yahoo' : 'yahoo');
      }

      setQuotes(q);
      setError(null);
      setLastUpdated(new Date());

      // GoldAPI — highest priority for gold. price_gram_24k × 10 = exact INR/10g.
      fetchGoldAPI()
        .then(d => {
          if (!d) return;
          const pricePerTenG = +(d.price_gram_24k * 10).toFixed(0);
          const changePct    = d.chp ?? null;
          setQuotes(prev => {
            if (!prev) return prev;
            const merged = { ...prev };
            // Store as goldMCX so buildDerived picks it up as INR/10g directly
            merged.goldMCX = { price: pricePerTenG, changePct, change: d.ch ? +(d.ch * 10).toFixed(0) : null, source: 'goldapi' };
            return merged;
          });
          console.log(`[goldapi] gold ₹${pricePerTenG}/10g (${changePct > 0 ? '+' : ''}${changePct}%)`);
        })
        .catch(e => console.warn('[goldapi] failed:', e.message));

      // CPA runs in background — overrides commodity prices with official spot prices.
      // Clears MCX keys so buildDerived uses CPA USD price → live USD/INR conversion.
      // Keeps Yahoo's changePct for the direction indicator.
      fetchCPALatest()
        .then(cpaData => {
          if (!cpaData) return;
          const cpaQuotes = normalizeCPALatest(cpaData);
          setQuotes(prev => {
            if (!prev) return prev;
            const merged = { ...prev };
            for (const [key, val] of Object.entries(cpaQuotes)) {
              // Override USD price, keep Yahoo changePct
              merged[key] = { ...(merged[key] ?? {}), price: val.price };
              // Clear MCX equivalents so buildDerived uses CPA → INR conversion,
              // but only if a higher-priority source (GoldAPI) hasn't already set them.
              if (key === 'gold'   && merged.goldMCX?.source   !== 'goldapi') merged.goldMCX   = null;
              if (key === 'silver' && !merged.silverMCX?.source) merged.silverMCX = null;
              if (key === 'crude'  && !merged.crudeMCX?.source)  merged.crudeMCX  = null;
              if (key === 'natgas' && !merged.natgasMCX?.source) merged.natgasMCX = null;
              if (key === 'copper' && !merged.copperMCX?.source) merged.copperMCX = null;
            }
            return merged;
          });
          console.log('[cpa] prices merged:', Object.keys(cpaQuotes).join(', '));
        })
        .catch(e => console.warn('[cpa] live prices failed:', e.message));

    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Check AV status (cheap — no batch) in parallel with Kite status
    fetchAVStatus().then(s => setAvStatus(s)).catch(() => {});

    fetchKiteStatus().then(s => {
      kiteRef.current = s.configured;
      load();
      timerRef.current = setInterval(load, 30_000);
    });
    return () => clearInterval(timerRef.current);
  }, []);

  const derived = quotes ? buildDerived(quotes) : null;
  return { quotes, derived, source, avStatus, loading, error, lastUpdated, refresh: load };
}

// ── Derived display data from raw quotes ──────────────────────────────────────
function buildDerived(q) {
  const usdInr    = q.usdinr?.price ?? 84;
  const price     = key => q[key]?.price     ?? null;
  const changePct = key => q[key]?.changePct ?? null;

  const macroOverrides = [];

  function addMetric(label, key, fmt, invertUp = false) {
    const p = price(key); if (p == null) return;
    const cp = changePct(key);
    macroOverrides.push({
      key: label,
      value: fmt(p),
      change: cp != null ? `${cp > 0 ? '+' : ''}${cp.toFixed(2)}%` : '—',
      up: cp != null ? (invertUp ? cp <= 0 : cp >= 0) : null,
    });
  }

  addMetric('Nifty 50', 'nifty',  p => p.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  addMetric('Sensex',   'sensex', p => p.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

  // Crude Oil: Kite MCX (INR/bbl) preferred over Yahoo Brent (USD/bbl)
  const crudeMCX = price('crudeMCX');
  const crudeYF  = price('crude');
  if (crudeMCX != null) {
    const cp = changePct('crudeMCX');
    macroOverrides.push({
      key: 'Crude Oil', value: `₹${Math.round(crudeMCX).toLocaleString('en-IN')}`,
      change: cp != null ? `${cp > 0 ? '+' : ''}${cp.toFixed(2)}%` : '—',
      up: cp != null ? cp >= 0 : null, sub: '₹/bbl MCX',
    });
  } else if (crudeYF != null) {
    addMetric('Crude Oil', 'crude', p => `$${p.toFixed(2)}`);
  }

  // Gold: show COMEX USD/oz (GC=F) directly
  const goldMCX = price('goldMCX');
  const goldYF  = price('gold');
  const goldChg = changePct('gold');
  if (goldYF != null) {
    macroOverrides.push({
      key: 'Gold', value: `$${Math.round(goldYF).toLocaleString('en-US')}`,
      change: goldChg != null ? `${goldChg > 0 ? '+' : ''}${goldChg.toFixed(2)}%` : '—',
      up: goldChg != null ? goldChg >= 0 : null, sub: 'COMEX USD/oz',
    });
  }

  // USD/INR (green = rupee strengthens = rate falling)
  if (price('usdinr') != null) {
    const cp  = changePct('usdinr');
    const rat = price('usdinr');
    macroOverrides.push({
      key: 'USD/INR', value: rat.toFixed(2),
      change: cp != null ? `${cp > 0 ? '+' : ''}${cp.toFixed(2)}%` : '—',
      up: cp != null ? cp <= 0 : null,
    });
    const inrCp = cp != null ? +(-cp).toFixed(3) : null;
    macroOverrides.push({
      key: 'INR/USD', value: `$${(1 / rat).toFixed(5)}`,
      change: inrCp != null ? `${inrCp > 0 ? '+' : ''}${inrCp.toFixed(2)}%` : '—',
      up: inrCp != null ? inrCp >= 0 : null,
    });
  }

  // Top NSE movers
  const STOCK_META = {
    reliance: { ticker: 'RELIANCE',  name: 'Reliance Inds',    mktCap: '19.9L Cr' },
    tcs:      { ticker: 'TCS',       name: 'Tata Consultancy', mktCap: '15.3L Cr' },
    hdfc:     { ticker: 'HDFC',      name: 'HDFC Bank',        mktCap: '13.1L Cr' },
    infy:     { ticker: 'INFY',      name: 'Infosys',          mktCap: '7.8L Cr'  },
    icici:    { ticker: 'ICICIBANK', name: 'ICICI Bank',       mktCap: '9.9L Cr'  },
    adani:    { ticker: 'ADANIGRP',  name: 'Adani Enterp.',    mktCap: '3.7L Cr'  },
    lt:       { ticker: 'LT',        name: 'L&T',              mktCap: '5.4L Cr'  },
    wipro:    { ticker: 'WIPRO',     name: 'Wipro',            mktCap: '3.2L Cr'  },
  };
  const liveMovers = Object.keys(STOCK_META)
    .filter(k => price(k) != null)
    .map(k => ({
      ...STOCK_META[k],
      price:  +price(k).toFixed(2),
      change: changePct(k) != null ? +changePct(k).toFixed(2) : 0,
    }));

  // Sector indices
  const SECTOR_MAP = [
    { name: 'IT',      key: 'niftyIT',   color: '#3b82f6' },
    { name: 'Banking', key: 'niftyBank', color: '#6366f1' },
    { name: 'Pharma',  key: 'niftyPhrm', color: '#14b8a6' },
    { name: 'Auto',    key: 'niftyAuto', color: '#f43f5e' },
    { name: 'FMCG',   key: 'niftyFMCG', color: '#22d3ee' },
    { name: 'Realty',  key: 'niftyRlty', color: '#22c55e' },
    { name: 'Metal',   key: 'niftyMtl',  color: '#94a3b8' },
  ];
  const liveSectors = SECTOR_MAP
    .filter(s => price(s.key) != null)
    .map(s => ({ name: s.name, value: +price(s.key).toFixed(0), change: changePct(s.key) ?? 0, ytd: null }));

  // Live commodities — prefer MCX INR values, fall back to Yahoo USD conversions
  const liveCommodities = [];

  // Crude
  const crudeVal = crudeMCX ?? crudeYF;
  const crudeChg = crudeMCX != null ? changePct('crudeMCX') : changePct('crude');
  if (crudeVal != null) liveCommodities.push({
    key: 'crude',
    value:  crudeMCX != null ? Math.round(crudeMCX) : +crudeYF.toFixed(2),
    change: crudeChg ?? 0,
    unit:   crudeMCX != null ? '₹/bbl' : 'USD/bbl',
  });

  // Gold — COMEX USD/oz
  const goldCChg = changePct('gold');
  if (goldYF != null) liveCommodities.push({ key: 'gold', value: +goldYF.toFixed(2), change: goldCChg ?? 0, unit: 'USD/oz' });

  // Silver
  const silverMCX = price('silverMCX');
  const silverYF  = price('silver');
  const silvVal   = silverMCX ?? (silverYF ? silverInrKg(silverYF, usdInr) : null);
  const silvChg   = silverMCX != null ? changePct('silverMCX') : changePct('silver');
  if (silvVal != null) liveCommodities.push({ key: 'silver', value: Math.round(silvVal), change: silvChg ?? 0, unit: '₹/kg' });

  // Natural Gas
  const natgasMCX = price('natgasMCX');
  const natgasYF  = price('natgas');
  const ngVal     = natgasMCX ?? (natgasYF ? natgasInrMm(natgasYF, usdInr) : null);
  const ngChg     = natgasMCX != null ? changePct('natgasMCX') : changePct('natgas');
  if (ngVal != null) liveCommodities.push({ key: 'natgas', value: +ngVal.toFixed(1), change: ngChg ?? 0, unit: '₹/MMBtu' });

  // Copper
  const copperMCX = price('copperMCX');
  const copperYF  = price('copper');
  const cuVal     = copperMCX ?? (copperYF ? copperInrKg(copperYF, usdInr) : null);
  const cuChg     = copperMCX != null ? changePct('copperMCX') : changePct('copper');
  if (cuVal != null) liveCommodities.push({ key: 'copper', value: +cuVal.toFixed(1), change: cuChg ?? 0, unit: '₹/kg' });

  return { macroOverrides, liveMovers, liveSectors, liveCommodities, usdInr, goldInr: goldCVal };
}

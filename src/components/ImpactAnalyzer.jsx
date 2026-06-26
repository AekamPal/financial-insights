import { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Activity, Info, ChevronDown, ChevronUp, Minus, ExternalLink, Sliders, RotateCcw } from 'lucide-react';
import { resolveModel, estimate } from '../utils/regressionModels';

// ── Tooltip ───────────────────────────────────────────────────────────────────

function Tip({ children, text, wide }) {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'help' }}
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 7px)', left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(8,14,36,0.98)',
          border: '1px solid rgba(99,102,241,0.35)',
          borderRadius: 10, padding: '10px 14px',
          fontSize: 11.5, color: 'rgba(255,255,255,0.80)', lineHeight: 1.65,
          width: wide ? 260 : 210,
          zIndex: 9999, boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          pointerEvents: 'none',
        }}>
          {text}
        </div>
      )}
    </span>
  );
}

// ── How to read legend ────────────────────────────────────────────────────────

const GLOSSARY = [
  {
    term: 'β (Beta / Slope)',
    def: 'For every 1% the source commodity moves, the indicator moves β units. E.g. β = 0.045 on Crude→CPI means crude rising 10% is associated with CPI rising 0.45 percentage points.',
  },
  {
    term: 'R² (R-squared)',
    def: 'The fraction of the indicator\'s monthly variation explained by the source. R²=0.47 means 47% of CPI\'s month-to-month swings correlate with crude. 0% = no relationship; 100% = perfect lockstep.',
  },
  {
    term: '95% CI (Confidence Interval)',
    def: 'We are 95% sure the true β lies inside this range. Wider CI = more uncertainty (thin data or noisy relationship). The estimated impact range uses CI bounds.',
  },
  {
    term: 'Lag (t + N mo)',
    def: 'Some impacts are delayed. Crude→CPI has a 1-month lag because OMC price revisions take 4–8 weeks. The model aligns source[t] with indicator[t+lag].',
  },
  {
    term: 'n (sample size)',
    def: 'Months of historical data used to fit the regression. Larger n → narrower CI → more reliable β. Below 10 months we fall back to empirical benchmarks from literature.',
  },
  {
    term: 'Signal Strength (dots)',
    def: '1–5 dot scale reflecting the overall evidence weight: data quality, R², academic consensus, and directional clarity. 5 dots = very high confidence (e.g. Copper→Nifty Metal).',
  },
  {
    term: 'BULLISH / BEARISH',
    def: 'Effect on equity markets given the current direction of the commodity. Flips automatically: if crude is falling and a rising crude would be bearish, then falling crude shows BULLISH.',
  },
];

function HowToRead() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      marginBottom: 20,
      border: '1px solid rgba(99,102,241,0.18)',
      borderRadius: 11,
      overflow: 'hidden',
      background: 'rgba(99,102,241,0.04)',
    }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', padding: '10px 14px', background: 'transparent',
        border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
        gap: 8, fontFamily: 'var(--font)', textAlign: 'left',
      }}>
        <Info size={13} color="#818cf8" />
        <span style={{ fontSize: 12, fontWeight: 600, color: '#a5b4fc', flex: 1 }}>
          How to read this — glossary of terms
        </span>
        {open ? <ChevronUp size={13} color="#818cf8" /> : <ChevronDown size={13} color="#818cf8" />}
      </button>
      {open && (
        <div style={{ padding: '0 14px 14px', borderTop: '1px solid rgba(99,102,241,0.12)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
            {GLOSSARY.map(g => (
              <div key={g.term} style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.025)', borderRadius: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#818cf8', marginBottom: 5 }}>{g.term}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{g.def}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Knowledge base ────────────────────────────────────────────────────────────
// Each source commodity → array of impacted indicators.
// sameDir=true  → indicator moves in SAME direction as the source commodity.
// mktBullish    → is the source RISING good for equity markets for this pair?
// strength      → 1 (weak) – 5 (very strong), for the visual indicator bar.

const KB = {
  crude: {
    label: 'Crude Oil',
    color: '#f59e0b',
    quoteKey: 'crudeMCX',      // prefer Kite MCX
    fallbackQuoteKey: 'crude',  // Yahoo USD
    seriesKey: 'crude',
    newsTag: 'crude',
    impacts: [
      {
        id: 'cpi', indicator: 'CPI Inflation', sector: 'Macro',
        modelKey: 'crude_cpi', destSeriesKey: 'inflation',
        sameDir: true, mktBullish: false, strength: 4,
        short: 'Fuel basket (8.2% CPI weight) + freight + HDPE packaging repricing with a ~4-week lag.',
        analysis: (pct, est) =>
          `Crude oil is the single most potent domestic inflation driver in India. It feeds CPI through four pathways: ` +
          `(1) the fuel & light sub-basket (8.2% CPI weight) via OMC-administered petrol/diesel prices; ` +
          `(2) transportation freight embedded in every manufactured and agricultural good; ` +
          `(3) petrochemical inputs like HDPE/PP in packaged-goods packaging; ` +
          `(4) power generation cost pass-through where gas and naphtha are substitutes. ` +
          `The transmission is not immediate — OMCs revise prices in cycles of 4–8 weeks, so the ` +
          `1-month lag used in this model reflects that revision cycle. ` +
          (est ? `At the current move of ${pct > 0 ? '+' : ''}${pct.toFixed(1)}%, the regression model estimates ` +
          `a ${est.point > 0 ? '+' : ''}${est.point.toFixed(2)} pp shift in headline CPI ` +
          `(95% CI: ${est.low.toFixed(2)} to ${est.high.toFixed(2)} pp). ` : '') +
          `RBI's tolerance band is 4±2% — a sustained crude rally above $95/bbl historically forces the MPC into ` +
          `a hawkish hold, raising the risk premium on rate-sensitive stocks.`,
      },
      {
        id: 'usdinr', indicator: 'USD/INR', sector: 'Macro',
        modelKey: 'crude_usdinr', destSeriesKey: 'usdinr',
        sameDir: true, mktBullish: false, strength: 4,
        short: 'India imports ~$145Bn/yr of crude — the largest single source of current account stress.',
        analysis: (pct, est) =>
          `India is structurally short crude oil, importing roughly 85% of its requirements (~5mn bpd). ` +
          `Every $10/bbl increase in Brent adds approximately $18 Billion to the annual import bill, ` +
          `which must be settled in USD, creating near-immediate demand for the dollar. ` +
          `The correlation is contemporaneous because FX markets reprice the current account trajectory in real time. ` +
          (est ? `The regression estimates a ${est.point > 0 ? '+' : ''}${est.point.toFixed(2)}% move in USD/INR ` +
          `(CI: ${est.low.toFixed(2)}% to ${est.high.toFixed(2)}%) from the current ${pct > 0 ? '+' : ''}${pct.toFixed(1)}% crude move. ` : '') +
          `A weaker rupee is a double-edged sword: it inflates import costs further (second-round inflation) ` +
          `but provides a revenue tailwind for export-oriented sectors — IT and pharma in particular. ` +
          `If crude sustains elevation, RBI typically intervenes via forex reserve drawdown, which can temporarily ` +
          `stabilise INR at the cost of depleting the buffer.`,
      },
      {
        id: 'nifty', indicator: 'Nifty 50', sector: 'Equity',
        modelKey: 'crude_nifty', destSeriesKey: 'nifty',
        sameDir: false, mktBullish: false, strength: 3,
        short: 'Energy cost is a margin tax on corporate India — negative for earnings across consumer, industrial, and financial sectors.',
        analysis: (pct, est) =>
          `The crude–Nifty relationship is moderately negative but context-dependent. ` +
          `When crude rises because of supply shocks (OPEC cuts, Middle East risk), the Nifty faces a clear headwind ` +
          `through three channels: (1) margin compression in consumer-facing industries (FMCG, paints, airlines, logistics); ` +
          `(2) tighter monetary policy from RBI as inflation risk rises; ` +
          `(3) FII outflows as global risk-off sentiment intensifies. ` +
          `However, if crude rises because of strong global demand (China re-opening, US growth), ` +
          `the demand signal can partially offset the cost shock. The model captures the average effect. ` +
          (est ? `At the current crude move of ${pct > 0 ? '+' : ''}${pct.toFixed(1)}%, the model suggests ` +
          `Nifty 50 impact of approximately ${est.point.toFixed(2)}% ` +
          `(CI: ${est.low.toFixed(2)}% to ${est.high.toFixed(2)}%). ` : '') +
          `Energy and upstream O&G stocks (ONGC, Oil India, Reliance) partially cushion the Nifty from the downside.`,
      },
      {
        id: 'auto', indicator: 'Nifty Auto', sector: 'Sector',
        modelKey: null, destSeriesKey: null,
        sameDir: false, mktBullish: false, strength: 4,
        short: 'Higher fuel prices directly suppress two-wheeler and entry-level car demand; raw material costs (rubber, plastic) also rise.',
        analysis: (pct) =>
          `Auto is one of the most crude-sensitive sectors on the NSE. The transmission runs on both the ` +
          `demand side and the cost side. On demand: rising petrol prices make vehicle ownership more expensive ` +
          `to operate, particularly for price-sensitive rural consumers of two-wheelers (Bajaj, Hero, TVS). ` +
          `Studies of SIAM data show that a 10% petrol price increase is associated with a 3–5% dip in ` +
          `two-wheeler retail volumes over 2–3 months. On cost: auto OEMs use large quantities of rubber ` +
          `(tyres, seals), polypropylene (interior plastics), and synthetic fibres — all crude derivatives. ` +
          `Margins at Maruti, Tata Motors, and M&M compress meaningfully in sustained high-oil environments. ` +
          (pct != null ? `The current crude move of ${pct > 0 ? '+' : ''}${pct.toFixed(1)}% creates ` +
          `${Math.abs(pct) > 5 ? 'a meaningful headwind' : 'mild pressure'} for auto sector earnings. ` : '') +
          `EV makers (Tata Motors, Ola Electric) are partially insulated from fuel demand effects.`,
      },
      {
        id: 'energy', indicator: 'Nifty Energy', sector: 'Sector',
        modelKey: null, destSeriesKey: null,
        sameDir: true, mktBullish: true, strength: 4,
        short: 'ONGC, Oil India, and Reliance see upstream realisation gains; refining margins (GRM) typically stay positive.',
        analysis: (pct) =>
          `When crude rises, the Nifty Energy index is one of the few beneficiaries on the NSE. ` +
          `Upstream producers — ONGC and Oil India — directly realise higher revenue per barrel extracted. ` +
          `Reliance Industries benefits via its large refining complex at Jamnagar: rising crude boosts gross ` +
          `refining margins (GRM) as long as product crack spreads stay wide. ` +
          `BPCL and HPCL are the key risk: if OMC retail pricing lags crude (as in administered-price eras), ` +
          `they absorb under-recoveries, which can drag the index. ` +
          `Post-2022 deregulation has improved the pass-through mechanism, reducing but not eliminating this risk. ` +
          (pct != null ? `At ${pct > 0 ? '+' : ''}${pct.toFixed(1)}% crude move, ` +
          `upstream realisations ${pct > 0 ? 'improve' : 'compress'} proportionally. ` : '') +
          `This sector typically acts as a natural hedge in a high-oil portfolio.`,
      },
      {
        id: 'fmcg', indicator: 'Nifty FMCG', sector: 'Sector',
        modelKey: null, destSeriesKey: null,
        sameDir: false, mktBullish: false, strength: 3,
        short: 'Freight and packaging (HDPE, PET) are crude derivatives — input cost pressure on FMCG margins.',
        analysis: (pct) =>
          `FMCG companies face crude exposure primarily through two indirect channels. ` +
          `First, last-mile freight: branded FMCG relies heavily on HCV/LCV logistics networks whose ` +
          `diesel costs translate directly to distribution expense — a cost that is difficult to fully ` +
          `pass through in competitive rural markets. ` +
          `Second, packaging materials: HDPE (Hindustan Unilever detergents, bottles), PET (beverages, personal care), ` +
          `and polypropylene (sachets, laminates) are all crude-linked. ` +
          `A 10% crude rise typically adds 50–80bps of EBITDA margin headwind for large FMCG companies, ` +
          `with the impact greatest for companies with premium rural distribution networks (Dabur, Marico). ` +
          (pct != null ? `The current ${pct > 0 ? '+' : ''}${pct.toFixed(1)}% crude move implies ` +
          `${pct > 0 ? 'modest margin pressure' : 'margin relief'} for the FMCG basket. ` : '') +
          `Premium categories (beauty, healthcare) with pricing power can partially offset this.`,
      },
    ],
  },

  gold: {
    label: 'Gold',
    color: '#fbbf24',
    quoteKey: 'goldMCX',
    fallbackQuoteKey: 'gold',
    seriesKey: 'gold',
    newsTag: 'gold',
    impacts: [
      {
        id: 'usdinr', indicator: 'USD/INR', sector: 'Macro',
        modelKey: 'gold_usdinr', destSeriesKey: 'usdinr',
        sameDir: true, mktBullish: false, strength: 3,
        short: 'India is the world\'s 2nd-largest gold importer — rising gold prices widen the current account deficit and pressure INR.',
        analysis: (pct, est) =>
          `Gold is India's second-largest import after crude oil, averaging $45–55 Billion annually. ` +
          `When global gold prices rise, India's import bill increases proportionally, ` +
          `creating net demand for USD to settle international gold purchases. ` +
          `The effect is contemporaneous — bullion dealers and jewellers hedge in the futures market instantly. ` +
          (est ? `At the current gold move of ${pct > 0 ? '+' : ''}${pct.toFixed(1)}%, ` +
          `the regression suggests a ${est.point.toFixed(2)}% shift in USD/INR ` +
          `(CI: ${est.low.toFixed(2)}% to ${est.high.toFixed(2)}%). ` : '') +
          `The relationship is stronger in festival seasons (Oct–Nov, Feb–Mar) when jewellery demand surges. ` +
          `Note that RBI occasionally imposes import duties to moderate this pressure (August 2024 duty cut ` +
          `from 15% to 6% showed this is a live policy lever).`,
      },
      {
        id: 'nifty', indicator: 'Nifty 50', sector: 'Equity',
        modelKey: 'gold_nifty', destSeriesKey: 'nifty',
        sameDir: false, mktBullish: false, strength: 3,
        short: 'Gold and equities exhibit classic risk-off/risk-on dynamics — gold rallies when investors flee equities.',
        analysis: (pct, est) =>
          `The gold–equity negative correlation is well-established globally but is particularly pronounced ` +
          `in India because: (1) retail investors treat gold as their primary safe-haven alternative ` +
          `(not government bonds, unlike in the West); (2) gold ETFs and sovereign gold bonds have ` +
          `institutionalised this rotation since 2010, making it faster. ` +
          `Gold tends to rally in four specific scenarios: global recession fears, domestic political uncertainty, ` +
          `currency depreciation expectations, and inflationary episodes — all of which are negative for equities. ` +
          (est ? `The model suggests Nifty 50 could move ${est.point.toFixed(2)}% ` +
          `from the current ${pct > 0 ? '+' : ''}${pct.toFixed(1)}% gold move ` +
          `(95% CI: ${est.low.toFixed(2)}% to ${est.high.toFixed(2)}%). ` : '') +
          `The inverse is equally important: sustained gold weakness often signals investors are rotating ` +
          `into risk assets, which is a good leading indicator for an equity rally.`,
      },
      {
        id: 'jewelry', indicator: 'Nifty Metal / Jewellery', sector: 'Sector',
        modelKey: null, destSeriesKey: null,
        sameDir: false, mktBullish: false, strength: 3,
        short: 'Jewellery demand is highly price-elastic — a gold price spike compresses volumes and margins for Kalyan, Titan, PCJL.',
        analysis: (pct) =>
          `Branded jewellery retailers (Titan, Kalyan Jewellers, PC Jeweller) face a complex relationship ` +
          `with gold prices. Higher gold prices generate inventory holding gains (bullion is marked up on balance sheet) ` +
          `but simultaneously compress demand volume, especially in the mass-market and bridal segments. ` +
          `Titan's Tanishq and Kalyan serve price-sensitive mid-market customers who postpone purchases ` +
          `when gold breaches psychological highs. ` +
          `The Nifty Metal index impact is indirect: silver, copper, and zinc miners are listed here, ` +
          `and gold's moves often reflect broader precious metals sentiment. ` +
          (pct != null ? `At the current gold move of ${pct > 0 ? '+' : ''}${pct.toFixed(1)}%, ` +
          `jewellery retailers are likely to see ${pct > 0 ? 'volume headwinds offsetting inventory gains' : 'volume recovery as affordability improves'}. ` : '') +
          `Watch hallmarking compliance data from BIS — penetration is still ~35% of organised retail.`,
      },
    ],
  },

  silver: {
    label: 'Silver',
    color: '#94a3b8',
    quoteKey: 'silverMCX',
    fallbackQuoteKey: 'silver',
    seriesKey: 'silver',
    newsTag: 'silver',
    impacts: [
      {
        id: 'metal', indicator: 'Nifty Metal', sector: 'Sector',
        modelKey: 'silver_metal', destSeriesKey: 'niftyMetal',
        sameDir: true, mktBullish: true, strength: 4,
        short: 'Silver has one of the strongest cross-asset correlations in India — it leads the NSE Metal index as a proxy for industrial demand.',
        analysis: (pct, est) =>
          `Silver is uniquely positioned at the intersection of precious metals and industrial materials. ` +
          `55–60% of global silver demand is industrial: photovoltaic solar panels (silver paste in PV cells ` +
          `is the highest-purity application), EV battery connections, 5G semiconductors, and medical equipment. ` +
          `This gives silver a tight relationship with the NSE Metal index, which houses steel, aluminium, ` +
          `copper, and zinc companies whose earnings cycle together with global manufacturing activity. ` +
          (est ? `At the current silver move of ${pct > 0 ? '+' : ''}${pct.toFixed(1)}%, ` +
          `the regression model (R² = ${est.unit === 'empirical' ? '0.64' : '—'}) estimates Nifty Metal ` +
          `moves approximately ${est.point.toFixed(2)}% ` +
          `(95% CI: ${est.low.toFixed(2)}% to ${est.high.toFixed(2)}%). ` : '') +
          `Tata Steel, Hindalco, and NALCO are the primary transmission stocks — they move on the same ` +
          `China PMI and US manufacturing ISM signals that drive silver on COMEX.`,
      },
      {
        id: 'capex', indicator: 'Nifty Capital Goods', sector: 'Sector',
        modelKey: 'copper_capex', destSeriesKey: 'niftyCapGoods',
        sameDir: true, mktBullish: true, strength: 3,
        short: 'Solar, EV, and power infrastructure build-out creates correlated demand for silver, driving Capital Goods order books.',
        analysis: (pct) =>
          `The India capex supercycle story — PLI schemes for solar manufacturing, NTPC\'s 50GW renewable target, ` +
          `PGCIL\'s ₹3.5 Trillion grid upgrade, the national EV push — all intensify silver demand ` +
          `for the same reason they drive orders for L&T, ABB, Siemens, and Polycab. ` +
          `Solar cells require 20mg silver per watt; at 50GW/year installation, that\'s roughly ` +
          `1,000 tonnes of silver demand from India\'s solar program alone by 2030. ` +
          `This creates a positive demand link: rising silver prices often reflect tightening supply ` +
          `in industrial silver, which is the same signal that drives capital goods order inflows. ` +
          (pct != null ? `A ${pct > 0 ? '+' : ''}${pct.toFixed(1)}% silver move is consistent with ` +
          `${pct > 0 ? 'accelerating industrial demand — a positive signal for capex stocks' : 'cooling industrial demand, a potential headwind for new order flows'}. ` : '') +
          `This pair has a 1-quarter lead typically — the correlation is more meaningful on a 3M timeframe.`,
      },
      {
        id: 'usdinr', indicator: 'USD/INR', sector: 'Macro',
        modelKey: null, destSeriesKey: null,
        sameDir: true, mktBullish: false, strength: 2,
        short: 'India imports ~5,000 tonnes of silver annually — a secondary current account pressure behind gold.',
        analysis: (pct) =>
          `India does not mine significant quantities of silver domestically (HZL's Zawar mines are small). ` +
          `The country imports approximately 5,000–6,000 metric tonnes of silver annually ` +
          `for jewellery, silverware, and industrial applications. ` +
          `While this is far smaller in value than gold imports, a sharp rally in silver still creates ` +
          `modest incremental USD demand. The effect is amplified when silver and gold rally together ` +
          `(as in risk-off episodes), as both import bills rise simultaneously. ` +
          (pct != null ? `The current ${pct > 0 ? '+' : ''}${pct.toFixed(1)}% silver move has ` +
          `a weak but real secondary pressure on USD/INR — manageable in isolation, but ` +
          `${pct > 0 ? 'additive to crude/gold pressures if they are also rising' : 'offers marginal relief on current account'}. ` : '') +
          `This pair's R² is low (~0.12) — other drivers dominate INR.`,
      },
    ],
  },

  natgas: {
    label: 'Natural Gas',
    color: '#22d3ee',
    quoteKey: 'natgasMCX',
    fallbackQuoteKey: 'natgas',
    seriesKey: 'natgas',
    newsTag: 'natgas',
    impacts: [
      {
        id: 'fert', indicator: 'Nifty Fertilisers / Chemicals', sector: 'Sector',
        modelKey: 'natgas_fert', destSeriesKey: null,
        sameDir: false, mktBullish: false, strength: 4,
        short: 'Gas is 40–60% of urea feedstock cost — rising gas prices directly compress fertiliser margins, offsetting subsidy tailwinds.',
        analysis: (pct, est) =>
          `Natural gas is the primary feedstock for urea production via the Haber-Bosch process. ` +
          `In Indian fertiliser plants (IFFCO, Chambal, GNFC, Coromandel), gas accounts for 40–60% ` +
          `of total urea production cost. The transmission follows a 1-month lag because ` +
          `plants purchase gas on short-term contracts repriced monthly. ` +
          `When global LNG prices spike (as in Europe\'s 2022 energy crisis), Indian spot LNG ` +
          `follows because Indian refiners compete with European buyers on spot markets. ` +
          (est ? `At the current gas move of ${pct > 0 ? '+' : ''}${pct.toFixed(1)}%, ` +
          `fertiliser stocks face an estimated ${est.point.toFixed(2)}% impact on margins ` +
          `(CI: ${est.low.toFixed(2)}% to ${est.high.toFixed(2)}%). Note: direction is negative ` +
          `(higher gas → lower margins). ` : '') +
          `Government subsidy policy acts as a buffer — but subsidy disbursement lags mean companies ` +
          `still face working capital pressure in a rising gas environment. ` +
          `CAGR in domestic gas pricing (APM) is typically lower than spot, partially insulating ONGC-fed plants.`,
      },
      {
        id: 'cpi', indicator: 'CPI / Household Energy', sector: 'Macro',
        modelKey: null, destSeriesKey: null,
        sameDir: true, mktBullish: false, strength: 2,
        short: 'CNG (compressed natural gas) prices and PNG (piped city gas) track gas prices — affects urban commuter household budgets.',
        analysis: (pct) =>
          `Piped natural gas through city gas distribution networks (Mahanagar Gas, Indraprastha Gas, Gujarat Gas) ` +
          `has expanded rapidly in India's Tier-1 and Tier-2 cities. CNG-powered autos and taxis and ` +
          `PNG for cooking are now significant household energy items for urban middle-class consumers. ` +
          `When international LNG prices rise, CGDs face a squeeze — they can pass costs to consumers ` +
          `after PNGRB regulatory lag, or absorb temporarily. ` +
          `The CPI "housing" and "transport" sub-indices reflect this with a 4–8 week lag. ` +
          (pct != null ? `A ${pct > 0 ? '+' : ''}${pct.toFixed(1)}% gas move has ` +
          `${Math.abs(pct) > 10 ? 'a material' : 'a modest'} flow-through to urban energy costs — ` +
          `${pct > 0 ? 'a headwind for urban consumption stocks' : 'mild relief'}. ` : '') +
          `The impact is much smaller than crude — gas is ~2–3% of CPI weight indirectly.`,
      },
      {
        id: 'power', indicator: 'Gas Power Plants / NTPC', sector: 'Sector',
        modelKey: null, destSeriesKey: null,
        sameDir: false, mktBullish: false, strength: 3,
        short: 'Gas-based power plants (Torrent, CESC) become uncompetitive vs coal/renewables when gas spikes — PLF and capacity utilisation fall.',
        analysis: (pct) =>
          `India has ~25 GW of gas-based power capacity, much of which is stranded or running at ` +
          `low plant load factors (PLF) because gas has been expensive relative to coal. ` +
          `When international LNG prices rise, this capacity becomes even less competitive ` +
          `against sub-critical coal plants (still ~60% of capacity) and the rapidly expanding ` +
          `solar+wind base. NTPC\'s gas capacity (Kayamkulam, Kawas, Gandhar) runs below 30% PLF ` +
          `in expensive-gas environments. ` +
          (pct != null ? `The current ${pct > 0 ? '+' : ''}${pct.toFixed(1)}% gas move ` +
          `${pct > 0 ? 'further reduces gas-power competitiveness and may push utilities to buy more spot power, affecting the exchange' : 'improves gas-power economics, potentially improving PLF at stranded plants'}. ` : '') +
          `Conversely, this is a long-term tailwind for renewables: every gas price spike accelerates ` +
          `the investment case for solar and wind by widening the cost-competitiveness gap.`,
      },
    ],
  },

  copper: {
    label: 'Copper',
    color: '#fb923c',
    quoteKey: 'copperMCX',
    fallbackQuoteKey: 'copper',
    seriesKey: 'copper',
    newsTag: 'copper',
    impacts: [
      {
        id: 'metal', indicator: 'Nifty Metal', sector: 'Sector',
        modelKey: 'copper_metal', destSeriesKey: 'niftyMetal',
        sameDir: true, mktBullish: true, strength: 5,
        short: '"Dr. Copper" — the highest-R² cross-asset pair in this analysis. Copper leads the NSE Metal index by 2–4 weeks.',
        analysis: (pct, est) =>
          `Copper has earned the moniker "Dr. Copper" because its price contains more global demand ` +
          `information than almost any other commodity — it is essential in every phase of economic ` +
          `development: electrical wiring, plumbing, motors, and now EV batteries and renewable energy. ` +
          `The NSE Metal index's major constituents — Tata Steel, Hindalco (which owns Novelis globally), ` +
          `Vedanta (copper smelter via Sterlite), and NALCO — all have earnings tightly linked to ` +
          `LME base metal cycles, of which copper is the bellwether. ` +
          (est ? `With the current copper move of ${pct > 0 ? '+' : ''}${pct.toFixed(1)}%, ` +
          `the regression model (one of the highest-confidence pairs, R² ≈ 0.71) estimates ` +
          `Nifty Metal moves ${est.point.toFixed(2)}% ` +
          `(95% CI: ${est.low.toFixed(2)}% to ${est.high.toFixed(2)}%). ` : '') +
          `China is the critical variable: it consumes ~55% of global copper. A slowdown in China PMI ` +
          `that breaks the copper price will typically hit the NSE Metal index within days, not weeks.`,
      },
      {
        id: 'capex', indicator: 'Nifty Capital Goods', sector: 'Sector',
        modelKey: 'copper_capex', destSeriesKey: null,
        sameDir: true, mktBullish: true, strength: 4,
        short: 'Every transformer, motor, and power cable uses copper — capex stocks and copper share the same demand cycle.',
        analysis: (pct, est) =>
          `The NSE Capital Goods index — dominated by L&T, ABB, Siemens, Polycab, and KEI Industries — ` +
          `derives order inflows from the same infrastructure and industrial capex cycle that drives copper. ` +
          `Power transformers (1–2 tonnes of copper per unit), motors, winding cables, ` +
          `switchgear busbars, and heat exchangers are all copper-intensive. ` +
          `Polycab and KEI are almost pure proxies for the copper price on the NSE. ` +
          `The government\'s PLI scheme for solar+batteries and the PGCIL grid upgrade drive ` +
          `simultaneous demand for both copper and capital goods — creating a correlated upcycle. ` +
          (est ? `At ${pct > 0 ? '+' : ''}${pct.toFixed(1)}% copper move, ` +
          `capital goods stocks are estimated to move ${est.point.toFixed(2)}% ` +
          `(CI: ${est.low.toFixed(2)}% to ${est.high.toFixed(2)}%). ` : '') +
          `The lagging effect here is small (0–1 month) because order book visibility is high and ` +
          `portfolio managers proactively re-rate these companies on copper signals.`,
      },
      {
        id: 'nifty', indicator: 'Nifty 50 (Global Growth Signal)', sector: 'Equity',
        modelKey: null, destSeriesKey: 'nifty',
        sameDir: true, mktBullish: true, strength: 3,
        short: 'Copper is a global growth barometer — a sustained copper rally signals improving world demand, which is broadly positive for emerging markets.',
        analysis: (pct) =>
          `Copper's relationship with the broader Nifty 50 is mediated through the global growth channel. ` +
          `When copper rises strongly (say, >5% in a month), it typically reflects improving demand ` +
          `from China\'s manufacturing sector, US industrial production, and global trade — ` +
          `all of which are positive for Indian exports (IT services, chemicals, pharma) and FII flows ` +
          `(global risk-on benefits EM equities). ` +
          `The Nifty 50 impact is positive but indirect — the metal and capex sub-sectors lead the move, ` +
          `with the broader index following 2–4 weeks later. ` +
          (pct != null ? `At ${pct > 0 ? '+' : ''}${pct.toFixed(1)}% copper move, ` +
          `${pct > 0
            ? 'the global growth signal is positive — expect FII interest in cyclicals and infrastructure plays to rise'
            : 'the slowdown signal is concerning for export-linked sectors and may dampen FII enthusiasm'}. ` : '') +
          `Watch LME copper inventories alongside price — rising price with rising stocks is speculative; ` +
          `rising price with falling stocks is genuine tightness.`,
      },
    ],
  },

  usdinr: {
    label: 'USD / INR',
    color: '#a78bfa',
    quoteKey: 'usdinr',
    fallbackQuoteKey: null,
    seriesKey: 'usdinr',
    newsTag: 'Rupee',
    impacts: [
      {
        id: 'it', indicator: 'Nifty IT', sector: 'Sector',
        modelKey: 'usdinr_it', destSeriesKey: 'niftyIT',
        sameDir: true, mktBullish: true, strength: 5,
        short: 'IT majors earn in USD, spend in INR — every 1% INR depreciation adds ~40–50bps to EBITDA margin.',
        analysis: (pct, est) =>
          `The USD/INR → Nifty IT relationship is the strongest and most direct cross-asset link in Indian markets. ` +
          `TCS, Infosys, HCL Tech, and Wipro earn 80–95% of revenue in USD (plus EUR, GBP), ` +
          `while nearly all employee costs, facilities, and domestic operations are in INR. ` +
          `This creates an operating leverage to currency: for every 1% INR depreciation, ` +
          `EBITDA margins expand by approximately 40–50 basis points (company guidance is typically ` +
          `"40–50bps per 1% depreciation, net of hedges"). Over a full year, this compounds significantly. ` +
          (est ? `At the current USD/INR move of ${pct > 0 ? '+' : ''}${pct.toFixed(1)}% ` +
          `(${pct > 0 ? 'INR depreciation' : 'INR appreciation'}), ` +
          `the regression estimates Nifty IT impact of ${est.point.toFixed(2)}% ` +
          `(CI: ${est.low.toFixed(2)}% to ${est.high.toFixed(2)}%). ` : '') +
          `Note: most large-cap IT companies hedge 6–12 months of receivables using forwards and options, ` +
          `so the full currency impact is realised with a delay. Q2 results typically show the first full ` +
          `quarter with unhedged exposure to a currency regime shift.`,
      },
      {
        id: 'pharma', indicator: 'Nifty Pharma', sector: 'Sector',
        modelKey: null, destSeriesKey: null,
        sameDir: true, mktBullish: true, strength: 4,
        short: 'Generic pharma majors (Sun, Dr. Reddy\'s, Cipla) export ~65% of production in USD — INR depreciation boosts reported INR earnings.',
        analysis: (pct) =>
          `Indian pharma is the world\'s largest generic drug exporter by volume, with the US market ` +
          `being the primary destination for Sun Pharma, Dr. Reddy\'s, Lupin, Cipla, and Divi\'s Laboratories. ` +
          `USD-denominated export revenues account for 50–70% of revenue for the large-caps. ` +
          `Unlike IT, pharma also has some USD-denominated raw material costs (APIs imported from China), ` +
          `partially offsetting the currency tailwind — the net exposure is approximately 30–40% of revenue. ` +
          (pct != null ? `A ${pct > 0 ? '+' : ''}${pct.toFixed(1)}% USD/INR move ` +
          `${pct > 0 ? 'improves reported INR earnings for pharma exporters' : 'compresses reported margins'}. ` : '') +
          `US price erosion (generic drug deflation) is the bigger structural risk for pharma — ` +
          `FX tailwinds can mask it temporarily but not sustainably.`,
      },
      {
        id: 'cpi', indicator: 'CPI Inflation (Imported)', sector: 'Macro',
        modelKey: 'usdinr_cpi', destSeriesKey: 'inflation',
        sameDir: true, mktBullish: false, strength: 3,
        short: 'A weaker rupee makes crude, edible oil, and electronics more expensive — feeding imported inflation into CPI.',
        analysis: (pct, est) =>
          `INR depreciation creates imported inflation through three primary channels. ` +
          `(1) Crude oil: priced in USD, so every 1% INR depreciation makes crude ~1% more expensive in ` +
          `INR terms, feeding through to fuel, freight, and petrochemicals. ` +
          `(2) Edible oils: India imports ~15mn tonnes of palm oil (from Malaysia, Indonesia) and ` +
          `soybean oil (from Argentina) annually — all USD-priced. ` +
          `(3) Electronics and capital goods: smartphones, semiconductors, and industrial machinery ` +
          `are largely imported; INR depreciation raises retail prices with a 1–2 month lag. ` +
          (est ? `At the current USD/INR move of ${pct > 0 ? '+' : ''}${pct.toFixed(1)}%, ` +
          `the model estimates a ${est.point.toFixed(2)} pp CPI impact ` +
          `(CI: ${est.low.toFixed(2)} to ${est.high.toFixed(2)} pp). ` : '') +
          `This creates a policy bind for RBI: INR depreciation that might logically call for ` +
          `easier monetary policy (to support growth) simultaneously raises inflation, complicating the rate decision.`,
      },
      {
        id: 'auto', indicator: 'Nifty Auto', sector: 'Sector',
        modelKey: null, destSeriesKey: null,
        sameDir: false, mktBullish: false, strength: 3,
        short: 'Auto OEMs import semiconductors, precision components, and steel alloys in USD — depreciation raises input costs.',
        analysis: (pct) =>
          `Auto manufacturers in India are large USD importers at the component level. ` +
          `Semiconductors (ECUs, ADAS chips, infotainment) are almost entirely USD-denominated imports. ` +
          `Premium steel grades (silicon steel for EV motors, high-strength body panels), ` +
          `speciality polymers, and precision machined components are also dollar-linked. ` +
          `For companies like Maruti (where ~18% of component value is imported, per its annual report), ` +
          `every 5% INR depreciation adds ~₹2,000–3,000 to per-vehicle material cost. ` +
          (pct != null ? `The current ${pct > 0 ? '+' : ''}${pct.toFixed(1)}% USD/INR move ` +
          `${pct > 0
            ? 'raises auto input costs; OEMs with higher localisation (Tata Motors) are better insulated than premium importers (BMW, Mercedes)'
            : 'provides input cost relief — a modest tailwind for auto margins'}. ` : '') +
          `Two-wheeler manufacturers like Hero and TVS have higher domestic content (>80%) ` +
          `and are more insulated from direct FX input cost pressure.`,
      },
      {
        id: 'fii', indicator: 'FII Flows', sector: 'Macro',
        modelKey: null, destSeriesKey: null,
        sameDir: false, mktBullish: false, strength: 3,
        short: 'INR depreciation reduces USD-equivalent returns for foreign investors, triggering risk reassessment of India EM allocation.',
        analysis: (pct) =>
          `For Foreign Institutional Investors (FIIs) allocating capital in USD, the total return ` +
          `from Indian equities includes both the equity return in INR and the USD/INR currency return. ` +
          `A 10% INR depreciation in a year wipes out ~10% of USD-equivalent equity gains, ` +
          `significantly impacting risk-adjusted returns versus EM peers with stable currencies. ` +
          `This creates a self-reinforcing dynamic: INR weakness → FII outflows → more INR selling → ` +
          `further INR weakness, which RBI must break with forex intervention. ` +
          (pct != null ? `The current ${pct > 0 ? '+' : ''}${pct.toFixed(1)}% USD/INR move ` +
          `${pct > 0
            ? 'may trigger cautious FII positioning — watch NSE FPI data for net selling in the coming sessions'
            : 'improves USD-equivalent returns for FIIs and could attract inflows, particularly if rate differentials are also favourable'}. ` : '') +
          `The impact is most acute for FIIs with shorter holding periods (hedge funds) vs. ` +
          `long-only EM equity funds that can ride through currency cycles.`,
      },
    ],
  },

  repoRate: {
    label: 'RBI Repo Rate',
    color: '#f43f5e',
    quoteKey: null,
    fallbackQuoteKey: null,
    seriesKey: 'repoRate',
    newsTag: 'RBI',
    isRate: true,
    impacts: [
      {
        id: 'nifty', indicator: 'Nifty 50', sector: 'Equity',
        modelKey: 'repo_nifty', destSeriesKey: 'nifty',
        sameDir: false, mktBullish: false, strength: 3,
        short: 'Rate hikes raise the discount rate applied to future earnings — compressing P/E multiples and Nifty valuations.',
        analysis: (pct, est) =>
          `The RBI repo rate is the primary lever of India's monetary policy. When the MPC raises the repo rate, ` +
          `the transmission to equity markets happens via three channels. ` +
          `(1) Discount rate: higher rates raise the risk-free return, compressing the P/E multiple investors ` +
          `are willing to pay for future earnings across all sectors. ` +
          `(2) Credit costs: borrowing costs rise for India Inc., compressing net interest margins and capex plans. ` +
          `(3) FII positioning: the growth-dampening signal often outweighs any carry-trade inflows. ` +
          (est ? `At a ${pct >= 0 ? '+' : ''}${pct.toFixed(2)}pp rate change, the empirical model estimates ` +
          `Nifty 50 moves approximately ${est.point >= 0 ? '+' : ''}${est.point.toFixed(2)}% ` +
          `(95% CI: ${est.low.toFixed(2)}% to ${est.high.toFixed(2)}%). ` : '') +
          `Rate-sensitive sectors (Real Estate, Auto, NBFCs) bear the brunt; exporters (IT, Pharma) are relatively insulated. ` +
          `The RBI MPC has a target band of 4±2% CPI — rate action typically begins when headline CPI breaches 6%.`,
      },
      {
        id: 'niftybank', indicator: 'Nifty Bank', sector: 'Banking',
        modelKey: 'repo_niftybank', destSeriesKey: 'niftyBank',
        sameDir: false, mktBullish: false, strength: 4,
        short: 'Rate hikes widen NIM initially but slow credit growth and compress asset quality — net negative short-term.',
        analysis: (pct, est) =>
          `Banking is the most directly rate-sensitive sector on the NSE. The relationship is nuanced: ` +
          `a rate hike initially benefits banks through Net Interest Margin (NIM) expansion — ` +
          `floating-rate loans (MCLR-linked) reprice up within 1–3 months while deposits are stickier. ` +
          `However, the medium-term effects are negative: loan growth slows as EMIs rise; ` +
          `asset quality deteriorates on leveraged borrowers; bond portfolios face MTM losses. ` +
          (est ? `For the current ${pct >= 0 ? '+' : ''}${pct.toFixed(2)}pp rate change, ` +
          `Nifty Bank is estimated to move ${est.point >= 0 ? '+' : ''}${est.point.toFixed(2)}% ` +
          `(CI: ${est.low.toFixed(2)}% to ${est.high.toFixed(2)}%). ` : '') +
          `PSU banks (SBI, Bank of Baroda) with large CASA ratios are relatively better positioned than ` +
          `retail-heavy private banks (IndusInd, RBL) in a rising rate environment.`,
      },
      {
        id: 'usdinr', indicator: 'USD/INR', sector: 'Currency',
        modelKey: 'repo_usdinr', destSeriesKey: 'usdinr',
        sameDir: false, mktBullish: true, strength: 2,
        short: 'Rate hike narrows India-US rate differential, theoretically supporting INR — but the effect is weak and often offset by growth concerns.',
        analysis: (pct, est) =>
          `A repo rate hike theoretically strengthens INR via interest rate parity: ` +
          `higher domestic rates attract carry trade inflows. ` +
          `However, the empirical relationship is weak (R²≈0.09) because: ` +
          `(1) the RBI-Fed rate differential is the more relevant measure; ` +
          `(2) a rate hike signalling recession risk can trigger FII equity outflows larger than carry inflows; ` +
          `(3) RBI often hikes when inflation is high — reducing the "real" yield advantage. ` +
          (est ? `The model estimates a ${est.point >= 0 ? '+' : ''}${est.point.toFixed(2)}% USD/INR move ` +
          `for a ${pct >= 0 ? '+' : ''}${pct.toFixed(2)}pp rate change. ` : '') +
          `For a strong INR signal, watch the real rate differential (India 10Y minus US 10Y minus inflation spread) ` +
          `rather than the repo rate in isolation.`,
      },
      {
        id: 'realty', indicator: 'Nifty Realty', sector: 'Real Estate',
        modelKey: 'repo_realty', destSeriesKey: 'niftyRealty',
        sameDir: false, mktBullish: false, strength: 4,
        short: 'Housing loans reprice within weeks — rising EMIs directly suppress home-buying demand. Most rate-sensitive NSE sector.',
        analysis: (pct, est) =>
          `Real estate is the most rate-sensitive sector in Indian equities. ` +
          `~80% of home purchases use bank loans at MCLR-linked floating rates. ` +
          `A 25 bps repo hike translates to ~₹600–900/month increase in EMI on a ₹50L loan. ` +
          `Historically, 100 bps of rate hikes reduces residential demand by 8–12% (NHB data), ` +
          `hurting DLF, Godrej Properties, Prestige Estates, and Sobha. ` +
          (est ? `For the current ${pct >= 0 ? '+' : ''}${pct.toFixed(2)}pp rate change, ` +
          `Nifty Realty is estimated to move ${est.point >= 0 ? '+' : ''}${est.point.toFixed(2)}% ` +
          `(CI: ${est.low.toFixed(2)}% to ${est.high.toFixed(2)}%). ` : '') +
          `Rate cuts are a powerful catalyst for real estate stocks — ` +
          `the sector typically moves 2–3× the Nifty in easing cycles.`,
      },
      {
        id: 'gold', indicator: 'Gold Price', sector: 'Commodity',
        modelKey: 'repo_gold', destSeriesKey: 'gold',
        sameDir: false, mktBullish: false, strength: 2,
        short: 'Rate hikes raise the opportunity cost of holding non-yielding gold — modest negative effect on domestic gold prices.',
        analysis: (pct, est) =>
          `Gold is a non-yielding asset; holding it comes at an opportunity cost equal to the risk-free rate. ` +
          `When RBI raises rates, bank FDs become relatively more attractive, reducing allocation to gold. ` +
          `However, the relationship is weaker in India than the US because: ` +
          `(1) Indian gold demand is culturally driven (festivals, weddings) and less purely financial; ` +
          `(2) domestic gold prices are also driven by USD/INR — a weaker INR raises INR gold regardless; ` +
          `(3) global safe-haven demand during rate hike-induced slowdowns can offset the rate effect. ` +
          (est ? `The model estimates a ${est.point >= 0 ? '+' : ''}${est.point.toFixed(2)}% gold price move ` +
          `for a ${pct >= 0 ? '+' : ''}${pct.toFixed(2)}pp rate change (CI: ${est.low.toFixed(2)}% to ${est.high.toFixed(2)}%). ` : '') +
          `For a stronger gold signal, watch US real yields (10Y TIPS) — these drive international gold far more than any domestic rate.`,
      },
    ],
  },

  fedRate: {
    label: 'US Fed Funds Rate',
    color: '#3b82f6',
    quoteKey: null,
    fallbackQuoteKey: null,
    seriesKey: 'fedRate',
    newsTag: 'Macro',
    isRate: true,
    impacts: [
      {
        id: 'usdinr', indicator: 'USD/INR', sector: 'Currency',
        modelKey: 'fed_usdinr', destSeriesKey: 'usdinr',
        sameDir: true, mktBullish: false, strength: 4,
        short: 'Fed hike strengthens USD globally — INR weakens as capital flows to higher-yielding US assets.',
        analysis: (pct, est) =>
          `The US Federal Funds Rate is the most powerful single variable for global currency dynamics. ` +
          `When the Fed raises rates, two mechanisms weaken the INR: ` +
          `(1) Carry reversal: investors who borrowed USD to invest in EM assets face higher funding costs, ` +
          `triggering de-carry trades — selling EM currencies to buy USD. ` +
          `(2) DXY appreciation: USD strengthens against almost all currencies simultaneously. ` +
          `The 2022 Fed tightening cycle (0% → 5.25%) drove USD/INR from 74 to 83 — ` +
          `an 11% depreciation that cost India ~$50Bn in forex reserves. ` +
          (est ? `At a ${pct >= 0 ? '+' : ''}${pct.toFixed(2)}pp Fed rate change, ` +
          `the model estimates USD/INR moves ${est.point >= 0 ? '+' : ''}${est.point.toFixed(2)}% ` +
          `(CI: ${est.low.toFixed(2)}% to ${est.high.toFixed(2)}%). ` : '') +
          `RBI typically responds with forex intervention and sometimes a sympathetic rate hike — ` +
          `putting the Nifty in a bind.`,
      },
      {
        id: 'nifty', indicator: 'Nifty 50', sector: 'Equity',
        modelKey: 'fed_nifty', destSeriesKey: 'nifty',
        sameDir: false, mktBullish: false, strength: 3,
        short: 'Fed hikes trigger FII outflows from India — higher US yields make India\'s risk-adjusted equity returns less attractive.',
        analysis: (pct, est) =>
          `The Nifty 50 is highly sensitive to Fed policy via FII flows. ` +
          `When US risk-free rates rise to 5%+, a 12% earnings yield on Nifty (P/E ~25) looks less compelling. ` +
          `SEBI FPI data shows aggressive Fed hiking cycles correlate with ₹50,000–80,000Cr FII outflows ` +
          `from Indian equities over 6-month windows. ` +
          (est ? `For a ${pct >= 0 ? '+' : ''}${pct.toFixed(2)}pp Fed rate change, ` +
          `Nifty 50 is estimated to move ${est.point >= 0 ? '+' : ''}${est.point.toFixed(2)}% ` +
          `(CI: ${est.low.toFixed(2)}% to ${est.high.toFixed(2)}%). ` : '') +
          `The impact is amplified when India's valuation premium (P/E vs EM peers) is high. ` +
          `Domestic SIP inflows and DIIs increasingly buffer FII selling — ` +
          `DIIs absorbed most FII selling during the 2022-23 hiking cycle, limiting Nifty downside.`,
      },
      {
        id: 'niftyit', indicator: 'Nifty IT', sector: 'IT',
        modelKey: 'fed_niftyit', destSeriesKey: 'niftyIT',
        sameDir: false, mktBullish: false, strength: 3,
        short: 'Mixed: strong USD helps INR margins, but Fed hikes signal US slowdown — reducing IT client tech budgets.',
        analysis: (pct, est) =>
          `IT faces opposing forces under Fed rate changes. ` +
          `POSITIVE: Fed hikes strengthen USD — TCS earns ~85% in USD, so every 1% USD/INR rise ≈ 40–50 bps EBITDA expansion. ` +
          `NEGATIVE: Fed hikes signal US economic slowdowns — enterprises cut discretionary IT spend; ` +
          `cloud migration, ERP upgrades, and digital transformation projects get deferred. ` +
          `The 2022-23 period proved this: despite 10%+ INR depreciation, IT earnings were pressured by client budget cuts. ` +
          (est ? `The net effect at the current ${pct >= 0 ? '+' : ''}${pct.toFixed(2)}pp rate change ` +
          `is estimated at ${est.point >= 0 ? '+' : ''}${est.point.toFixed(2)}% for Nifty IT ` +
          `(CI: ${est.low.toFixed(2)}% to ${est.high.toFixed(2)}%). ` : '') +
          `Near-term is USD-margin driven (positive); 2–3 quarter outlook depends on US hard vs. soft landing.`,
      },
      {
        id: 'gold', indicator: 'Gold Price', sector: 'Commodity',
        modelKey: 'fed_gold', destSeriesKey: 'gold',
        sameDir: false, mktBullish: false, strength: 4,
        short: 'Strongest rate-commodity link: Fed hikes raise US real yields, making non-yielding gold less attractive and pushing DXY up.',
        analysis: (pct, est) =>
          `The Fed Funds Rate → Gold relationship is the strongest and most studied rate-commodity link. ` +
          `Two mechanisms: ` +
          `(1) Real yield effect: gold competes with US TIPS. When real 10Y yields rise above 1–1.5%, ` +
          `gold historically underperforms sharply (2022: gold fell 20% from peak). ` +
          `(2) DXY: Fed hikes push USD higher, making gold more expensive in non-USD currencies. ` +
          `Central bank gold buying (China, India, Turkey) has provided structural support since 2022 ` +
          `but hasn't decoupled gold from rate dynamics. ` +
          (est ? `At a ${pct >= 0 ? '+' : ''}${pct.toFixed(2)}pp Fed rate change, ` +
          `gold is estimated to move ${est.point >= 0 ? '+' : ''}${est.point.toFixed(2)}% ` +
          `(CI: ${est.low.toFixed(2)}% to ${est.high.toFixed(2)}%). ` : '') +
          `Watch 10Y TIPS yield — the real rate is gold's true adversary. ` +
          `Fed rate cuts are the strongest single catalyst for a gold bull market.`,
      },
    ],
  },
};

// ── Strength indicator ────────────────────────────────────────────────────────

const STRENGTH_LABEL = ['', 'Weak', 'Moderate', 'Strong', 'Very strong', 'Very strong'];

function StrengthDots({ strength, color, showLabel }) {
  return (
    <Tip text={`Signal strength: ${STRENGTH_LABEL[strength]} (${strength}/5). Reflects R², data quality, and academic consensus.`}>
      <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{
            width: 6, height: 6, borderRadius: '50%',
            background: i <= strength ? color : 'rgba(255,255,255,0.10)',
            transition: 'background 0.3s',
          }} />
        ))}
        {showLabel && (
          <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 4, fontWeight: 600 }}>
            {STRENGTH_LABEL[strength]}
          </span>
        )}
      </div>
    </Tip>
  );
}

// ── Direction badge ───────────────────────────────────────────────────────────

function DirectionBadge({ isUp }) {
  const color = isUp ? '#22d3ee' : '#f43f5e';
  const bg    = isUp ? 'rgba(34,211,238,0.12)' : 'rgba(244,63,94,0.12)';
  return (
    <Tip text={isUp
      ? 'BULLISH for equity markets given the current direction. If the commodity reverses, this flips to BEARISH.'
      : 'BEARISH for equity markets given the current direction. If the commodity reverses, this flips to BULLISH.'}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '2px 8px', borderRadius: 6,
        background: bg, border: `1px solid ${color}30`,
        fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.06em',
      }}>
        {isUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
        {isUp ? 'BULLISH' : 'BEARISH'}
      </div>
    </Tip>
  );
}

// ── Regression block ──────────────────────────────────────────────────────────

function RegressionBlock({ model, est, changePct, sourceLabel, indicatorLabel, isSimulated, isRate }) {
  if (!model) return null;
  const r2Pct  = (model.r2 * 100).toFixed(0);
  const estDir = est ? (est.point >= 0 ? '+' : '') : '';

  const srcStr = isRate && changePct != null
    ? `${changePct >= 0 ? '+' : ''}${Math.round(changePct * 100)}bps (${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}pp) change in ${sourceLabel}`
    : changePct != null
      ? `${changePct >= 0 ? '+' : ''}${changePct.toFixed(1)}% move in ${sourceLabel}`
      : null;

  // Plain-english impact summary
  const plainEnglish = est && srcStr
    ? `A ${srcStr} ` +
      `is estimated to shift ${indicatorLabel} by ${estDir}${est.point.toFixed(2)} ${model.destUnit}` +
      (model.lag > 0 ? ` over the following month` : '') +
      `. Best-case: ${est.high >= 0 ? '+' : ''}${est.high.toFixed(2)}, worst-case: ${est.low >= 0 ? '+' : ''}${est.low.toFixed(2)} ${model.destUnit}.`
    : null;

  return (
    <div style={{
      marginTop: 16,
      background: isSimulated ? 'rgba(139,92,246,0.07)' : 'rgba(99,102,241,0.06)',
      border: `1px solid ${isSimulated ? 'rgba(139,92,246,0.30)' : 'rgba(99,102,241,0.20)'}`,
      borderRadius: 12,
      padding: '14px 16px',
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#a5b4fc', letterSpacing: '0.07em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Activity size={11} />
        {isRate ? 'EMPIRICAL MODEL — PER 1pp RATE CHANGE' : 'OLS REGRESSION — MoM % CHANGES'}
        {isSimulated && (
          <span style={{ marginLeft: 4, fontSize: 10, background: 'rgba(139,92,246,0.2)', color: '#c4b5fd', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
            SIMULATED
          </span>
        )}
      </div>

      {/* Plain-english summary row */}
      {plainEnglish && (
        <div style={{
          fontSize: 12, color: 'rgba(255,255,255,0.72)', lineHeight: 1.6,
          background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '9px 12px',
          marginBottom: 12, borderLeft: `3px solid ${est.point >= 0 ? '#34d399' : '#f87171'}`,
        }}>
          {plainEnglish}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
        {/* β card */}
        <div style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: 8 }}>
          <Tip wide text="β (beta/slope): for every 1% the source moves, the indicator moves β units. E.g. β = 0.045 means crude rising 1% → CPI rises 0.045 percentage points.">
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3, borderBottom: '1px dashed rgba(255,255,255,0.1)', paddingBottom: 3, cursor: 'help', display: 'flex', alignItems: 'center', gap: 4 }}>
              β (slope) <Info size={9} color="rgba(255,255,255,0.2)" />
            </div>
          </Tip>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em' }}>
            {model.beta >= 0 ? '+' : ''}{model.beta.toFixed(3)}
          </div>
          <Tip wide text={`95% confidence interval: the true β almost certainly lies between ${model.betaLow.toFixed(3)} and ${model.betaHigh.toFixed(3)}. Wider range = more uncertainty.`}>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2, cursor: 'help', display: 'flex', alignItems: 'center', gap: 3 }}>
              95% CI [{model.betaLow.toFixed(3)}, {model.betaHigh.toFixed(3)}] <Info size={8} color="rgba(255,255,255,0.15)" />
            </div>
          </Tip>
        </div>

        {/* R² card */}
        <div style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: 8 }}>
          <Tip wide text="R² (R-squared): the fraction of the indicator's monthly variation explained by this source. 0% = no explanatory power; 100% = perfect lockstep. Above 40% is considered meaningful for macro pairs.">
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3, borderBottom: '1px dashed rgba(255,255,255,0.1)', paddingBottom: 3, cursor: 'help', display: 'flex', alignItems: 'center', gap: 4 }}>
              R² (fit) <Info size={9} color="rgba(255,255,255,0.2)" />
            </div>
          </Tip>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', color: model.r2 >= 0.4 ? '#34d399' : model.r2 >= 0.2 ? '#fbbf24' : 'rgba(255,255,255,0.55)' }}>
            {r2Pct}%
          </div>
          <Tip text={model.n > 0 ? `${model.n} monthly data points used to fit the line. More data → narrower CI → more reliable β.` : 'β taken from peer-reviewed literature — no live series available.'}>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2, cursor: 'help', display: 'flex', alignItems: 'center', gap: 3 }}>
              {model.n > 0 ? `n = ${model.n} months` : 'empirical'} <Info size={8} color="rgba(255,255,255,0.15)" />
            </div>
          </Tip>
        </div>

        {/* Estimated impact card */}
        {est ? (
          <div style={{ padding: '8px 10px', background: 'rgba(99,102,241,0.10)', borderRadius: 8, border: '1px solid rgba(99,102,241,0.25)' }}>
            <Tip wide text={`Point estimate: β × changePct = ${model.beta.toFixed(3)} × ${changePct?.toFixed(2)} = ${estDir}${est.point.toFixed(2)} ${model.destUnit}. The CI range uses the upper and lower β bounds.`}>
              <div style={{ fontSize: 10, color: '#a5b4fc', marginBottom: 3, cursor: 'help', display: 'flex', alignItems: 'center', gap: 4 }}>
                Est. impact <Info size={9} color="#818cf8" />
              </div>
            </Tip>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', color: est.point >= 0 ? '#34d399' : '#f87171' }}>
              {estDir}{est.point.toFixed(2)} <span style={{ fontSize: 11, fontWeight: 500 }}>{model.destUnit}</span>
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>
              range [{est.low >= 0 ? '+' : ''}{est.low.toFixed(2)}, {est.high >= 0 ? '+' : ''}{est.high.toFixed(2)}]
            </div>
          </div>
        ) : (
          <div style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.4 }}>
              Select a time window or simulate a move to see the estimate
            </span>
          </div>
        )}
      </div>

      {/* Equation */}
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 8, fontFamily: 'monospace', background: 'rgba(0,0,0,0.2)', padding: '7px 10px', borderRadius: 7 }}>
        Δ{indicatorLabel} = {model.alpha?.toFixed(3) ?? '0.000'} + <strong style={{ color: '#a5b4fc' }}>{model.beta.toFixed(3)}</strong> × {isRate ? 'Δpp' : 'Δ%'}{sourceLabel}
        {model.lag > 0 && <span style={{ color: '#818cf8' }}> [lag {model.lag}mo]</span>}
        {est && changePct != null && (
          <span style={{ color: '#34d399' }}>
            {' '}= {model.alpha?.toFixed(3) ?? '0.000'} + {model.beta.toFixed(3)} × {changePct.toFixed(2)} = <strong>{estDir}{est.point.toFixed(2)} {model.destUnit}</strong>
          </span>
        )}
      </div>

      {model.isEmpirical && (
        <div style={{
          fontSize: 10.5, color: '#f59e0b',
          background: 'rgba(245,158,11,0.08)', borderRadius: 6, padding: '6px 10px',
          display: 'flex', gap: 6, alignItems: 'flex-start', marginBottom: 8,
        }}>
          <Info size={11} style={{ marginTop: 1, flexShrink: 0 }} />
          <span>
            <strong>Empirical model:</strong> insufficient live data for OLS — β is from peer-reviewed literature ({model.source}). The estimate is still valid; wider CI reflects cross-study variance.
          </span>
        </div>
      )}

      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', lineHeight: 1.55, marginTop: 4 }}>
        {model.note}
      </div>
    </div>
  );
}

// ── News mini list ────────────────────────────────────────────────────────────

function NewsMini({ items, color }) {
  if (!items?.length) return null;
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.07em', marginBottom: 8 }}>
        RECENT NEWS
      </div>
      {items.slice(0, 3).map((item, i) => (
        <a key={i} href={item.link ?? '#'} target="_blank" rel="noopener noreferrer"
          style={{ textDecoration: 'none', display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
          <div style={{ width: 3, height: 3, borderRadius: '50%', background: color, marginTop: 6, flexShrink: 0 }} />
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5, flex: 1 }}>{item.title}</div>
          <ExternalLink size={10} color="rgba(255,255,255,0.18)" style={{ marginTop: 4, flexShrink: 0 }} />
        </a>
      ))}
    </div>
  );
}

// ── Impact card ───────────────────────────────────────────────────────────────

function ImpactCard({ impact, sourceColor, sourcePct, xSeries, ySeries, newsItems, isSimulated, sourceLabel, isRate }) {
  const [open, setOpen] = useState(false);

  const indicatorUp = sourcePct != null
    ? (sourcePct >= 0 ? impact.sameDir : !impact.sameDir)
    : impact.sameDir;

  const isMarketPositive = sourcePct != null
    ? (sourcePct >= 0 ? impact.mktBullish : !impact.mktBullish)
    : impact.mktBullish;

  const model = impact.modelKey
    ? resolveModel(impact.modelKey, xSeries, ySeries)
    : null;

  const est = model && sourcePct != null
    ? estimate(model, sourcePct)
    : null;

  const analysisText = impact.analysis(sourcePct ?? 0, est);

  return (
    <div style={{
      borderRadius: 12,
      border: `1px solid ${open ? sourceColor + '30' : 'rgba(255,255,255,0.07)'}`,
      background: open ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.015)',
      transition: 'border-color 0.2s, background 0.2s',
    }}>
      {/* Card header — always visible */}
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', padding: '14px 16px', background: 'transparent',
        border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.88)', marginBottom: 2 }}>
              {impact.indicator}
            </div>
            <div style={{
              display: 'inline-block', fontSize: 9, fontWeight: 700, letterSpacing: '0.07em',
              padding: '1px 6px', borderRadius: 4,
              background: 'rgba(255,255,255,0.07)', color: 'var(--text-muted)',
            }}>
              {impact.sector.toUpperCase()}
            </div>
          </div>
          <DirectionBadge isUp={isMarketPositive} />
          <span style={{ color: open ? sourceColor : 'var(--text-muted)', flexShrink: 0 }}>
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <StrengthDots strength={impact.strength} color={sourceColor} showLabel />
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 11, color: indicatorUp ? '#34d399' : '#f87171',
          }}>
            {indicatorUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            <span style={{ fontWeight: 600 }}>{indicatorUp ? 'Likely higher' : 'Likely lower'}</span>
          </div>
        </div>

        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 7, lineHeight: 1.5 }}>
          {impact.short}
        </div>
      </button>

      {/* Expanded body */}
      {open && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.75, marginTop: 14 }}>
            {analysisText}
          </p>

          <RegressionBlock
            model={model}
            est={est}
            changePct={sourcePct}
            sourceLabel={sourceLabel}
            indicatorLabel={impact.indicator}
            isSimulated={isSimulated}
            isRate={isRate}
          />

          <NewsMini items={newsItems} color={sourceColor} />
        </div>
      )}
    </div>
  );
}

// ── Time-window change calculator ─────────────────────────────────────────────

function computeWindowChange(quotes, quoteKey, fallbackQuoteKey, seriesKey, commodityHistory, window) {
  if (window === '1D') {
    const q = quotes?.[quoteKey] ?? quotes?.[fallbackQuoteKey];
    return q?.changePct != null ? +q.changePct : null;
  }
  const series = commodityHistory?.[seriesKey];
  if (!series?.length) {
    const q = quotes?.[quoteKey] ?? quotes?.[fallbackQuoteKey];
    return q?.changePct != null ? +q.changePct : null;
  }
  const monthsBack = window === '1M' ? 1 : window === '3M' ? 3 : 6;
  const last  = series.at(-1);
  const start = series[Math.max(0, series.length - 1 - monthsBack)];
  const vLast  = last?.close ?? last?.value;
  const vStart = start?.close ?? start?.value;
  if (vLast == null || vStart == null || vStart === 0) return null;
  return (vLast - vStart) / vStart * 100;
}

// ── Multi-factor constants ────────────────────────────────────────────────────

const MF_MODEL_SERIES = {
  crude_cpi:      { xKey: 'BRENT',       yKey: 'inflation'     },
  crude_usdinr:   { xKey: 'BRENT',       yKey: 'usdinr'        },
  crude_nifty:    { xKey: 'BRENT',       yKey: 'nifty'         },
  gold_usdinr:    { xKey: 'GOLD',        yKey: 'usdinr'        },
  gold_nifty:     { xKey: 'GOLD',        yKey: 'nifty'         },
  silver_metal:   { xKey: 'SILVER',      yKey: 'niftyMetal'    },
  copper_capex:   { xKey: 'COPPER',      yKey: 'niftyCapGoods' },
  copper_metal:   { xKey: 'COPPER',      yKey: 'niftyMetal'    },
  usdinr_it:      { xKey: null,          yKey: 'niftyIT'       },
  usdinr_cpi:     { xKey: null,          yKey: 'inflation'     },
  natgas_fert:    { xKey: 'NATURAL_GAS', yKey: null            },
  repo_nifty:     { xKey: null,          yKey: 'nifty'         },
  repo_niftybank: { xKey: null,          yKey: 'niftyBank'     },
  repo_usdinr:    { xKey: null,          yKey: 'usdinr'        },
  repo_realty:    { xKey: null,          yKey: 'niftyRealty'   },
  repo_gold:      { xKey: null,          yKey: 'gold'          },
  fed_usdinr:     { xKey: null,          yKey: 'usdinr'        },
  fed_nifty:      { xKey: null,          yKey: 'nifty'         },
  fed_niftyit:    { xKey: null,          yKey: 'niftyIT'       },
  fed_gold:       { xKey: null,          yKey: 'gold'          },
};

// quoteKey = primary (Kite/MCX); fallbackKey = Yahoo Finance key used when primary is absent
const MF_TARGET_MAP = {
  'Nifty 50':         { unit: '%',  sources: [
    { label: 'Crude Oil',     key: 'crude',  modelKey: 'crude_nifty',    isRate: false, quoteKey: 'crudeMCX',  fallbackKey: 'crude',   min: -50, max: 50,  step: 1,    note: 'Higher crude → import cost shock + wider CAD → inflation & rate hike risk → equity multiple compression' },
    { label: 'Gold',          key: 'gold',   modelKey: 'gold_nifty',     isRate: false, quoteKey: 'goldMCX',   fallbackKey: 'gold',    min: -30, max: 30,  step: 1,    note: 'Gold rallies signal risk-off regimes → FII rotation out of equities into safe havens' },
    { label: 'RBI Repo Rate', key: 'repo',   modelKey: 'repo_nifty',     isRate: true,  rateKey:  'repoRate',                          min: -2,  max: 2,   step: 0.25, note: 'Higher rates raise cost of capital → compress P/E multiples → dampen earnings & credit growth' },
    { label: 'US Fed Rate',   key: 'fed',    modelKey: 'fed_nifty',      isRate: true,  rateKey:  'fedRate',                           min: -2,  max: 2,   step: 0.25, note: 'Fed hike → dollar strength → FII outflows from EM + INR weakness → dual macro headwind for Nifty' },
  ]},
  'USD/INR':          { unit: '%',  sources: [
    { label: 'Crude Oil',     key: 'crude',  modelKey: 'crude_usdinr',   isRate: false, quoteKey: 'crudeMCX',  fallbackKey: 'crude',   min: -50, max: 50,  step: 1,    note: 'India imports ~85% of crude; higher crude = wider current account deficit = INR selling pressure' },
    { label: 'Gold',          key: 'gold',   modelKey: 'gold_usdinr',    isRate: false, quoteKey: 'goldMCX',   fallbackKey: 'gold',    min: -30, max: 30,  step: 1,    note: 'Gold imports are ~35% of India\'s trade deficit; rising gold demand → INR depreciation' },
    { label: 'RBI Repo Rate', key: 'repo',   modelKey: 'repo_usdinr',    isRate: true,  rateKey:  'repoRate',                          min: -2,  max: 2,   step: 0.25, note: 'Higher repo → carry-trade inflows → INR appreciation (opposite of crude/gold)' },
    { label: 'US Fed Rate',   key: 'fed',    modelKey: 'fed_usdinr',     isRate: true,  rateKey:  'fedRate',                           min: -2,  max: 2,   step: 0.25, note: 'Fed hike narrows India-US rate spread → capital outflows → dollar demand → INR weakens' },
  ]},
  'CPI India':        { unit: 'pp', sources: [
    { label: 'Crude Oil',     key: 'crude',  modelKey: 'crude_cpi',      isRate: false, quoteKey: 'crudeMCX',  fallbackKey: 'crude',   min: -50, max: 50,  step: 1,    note: 'Direct fuel price pass-through + transport/freight inflation; OMC revision lag ~4–8 weeks' },
    { label: 'USD/INR',       key: 'usdinr', modelKey: 'usdinr_cpi',     isRate: false, quoteKey: 'usdinr',                            min: -20, max: 20,  step: 1,    note: 'Weaker INR makes all imports costlier; ~0.18pp CPI per 1% INR depreciation with 1M lag' },
  ]},
  'Nifty IT':         { unit: '%',  sources: [
    { label: 'USD/INR',       key: 'usdinr', modelKey: 'usdinr_it',      isRate: false, quoteKey: 'usdinr',                            min: -20, max: 20,  step: 1,    note: 'IT revenues priced in USD; weaker INR = higher INR realisation per dollar of export revenue' },
    { label: 'US Fed Rate',   key: 'fed',    modelKey: 'fed_niftyit',    isRate: true,  rateKey:  'fedRate',                           min: -2,  max: 2,   step: 0.25, note: 'Fed hike slows US growth → IT discretionary spend risk; also tightens global tech multiples' },
  ]},
  'Nifty Bank':       { unit: '%',  sources: [
    { label: 'RBI Repo Rate', key: 'repo',   modelKey: 'repo_niftybank', isRate: true,  rateKey:  'repoRate',                          min: -2,  max: 2,   step: 0.25, note: 'Repo directly sets interbank rates; hike → NIM compression, slower credit growth, higher NPAs' },
  ]},
  'Nifty Metal':      { unit: '%',  sources: [
    { label: 'Silver',        key: 'silver', modelKey: 'silver_metal',   isRate: false, quoteKey: 'silverMCX', fallbackKey: 'silver',  min: -30, max: 30,  step: 1,    note: '~40% industrial metal; co-moves with global manufacturing PMI and base metal indices' },
    { label: 'Copper',        key: 'copper', modelKey: 'copper_metal',   isRate: false, quoteKey: 'copperMCX', fallbackKey: 'copper',  min: -30, max: 30,  step: 1,    note: 'Primary cost input for Nifty Metal constituents; direct pass-through to sector P&L' },
  ]},
  'Nifty Realty':     { unit: '%',  sources: [
    { label: 'RBI Repo Rate', key: 'repo',   modelKey: 'repo_realty',    isRate: true,  rateKey:  'repoRate',                          min: -2,  max: 2,   step: 0.25, note: 'Higher repo → higher mortgage rates → weaker housing demand → realty earnings & launches slow' },
  ]},
  'Gold':             { unit: '%',  sources: [
    { label: 'RBI Repo Rate', key: 'repo',   modelKey: 'repo_gold',      isRate: true,  rateKey:  'repoRate',                          min: -2,  max: 2,   step: 0.25, note: 'Higher real rates raise the opportunity cost of holding gold (which earns no yield)' },
    { label: 'US Fed Rate',   key: 'fed',    modelKey: 'fed_gold',       isRate: true,  rateKey:  'fedRate',                           min: -2,  max: 2,   step: 0.25, note: 'Rising US real yields → dollar strength → gold selloff (inverse since Bretton Woods)' },
  ]},
  'Nifty CapEx':      { unit: '%',  sources: [
    { label: 'Copper',        key: 'copper', modelKey: 'copper_capex',   isRate: false, quoteKey: 'copperMCX', fallbackKey: 'copper',  min: -30, max: 30,  step: 1,    note: 'Copper is the leading indicator of capex; power & infra project demand drives both' },
  ]},
  'Nifty Fertilisers':{ unit: '%',  sources: [
    { label: 'Natural Gas',   key: 'natgas', modelKey: 'natgas_fert',    isRate: false, quoteKey: 'natgasMCX', fallbackKey: 'natgas',  min: -50, max: 50,  step: 1,    note: 'Natgas is 70–80% of urea production cost; price spike = direct margin erosion for fertiliser cos' },
  ]},
};
const MF_TARGETS = Object.keys(MF_TARGET_MAP);
const MF_SRC_COLOR = {
  crude: '#f59e0b', gold: '#eab308', silver: '#94a3b8', copper: '#fb923c',
  usdinr: '#22d3ee', natgas: '#4ade80', repo: '#f43f5e', fed: '#3b82f6',
};
function mfFmt(v, unit) {
  if (v == null) return '—';
  const s = v > 0 ? '+' : '';
  return unit === 'pp' ? `${s}${v.toFixed(2)} pp` : `${s}${v.toFixed(2)}%`;
}
function mfFmtChg(v, isRate) {
  if (!v) return '0';
  const s = v > 0 ? '+' : '';
  return isRate ? `${s}${v.toFixed(2)} pp` : `${s}${v.toFixed(0)}%`;
}

// ── Main component ────────────────────────────────────────────────────────────

const WINDOWS = ['1D', '1M', '3M', '6M'];
const SLIDER_MIN = -30;
const SLIDER_MAX = 30;
const RATE_SLIDER_MIN = -2;
const RATE_SLIDER_MAX = 2;

export default function ImpactAnalyzer({ quotes, commodityHistory, allSeries, rssNews }) {
  const [view, setView]             = useState('single');   // 'single' | 'multi'
  const [source, setSource]         = useState('crude');
  const [window, setWindow]         = useState('1D');
  const [customMode, setCustomMode] = useState(false);
  const [customPct, setCustomPct]   = useState(0);
  const kb                          = KB[source];

  // Multi-factor state — changes seeded with live 1D data when quotes first arrive
  const [mfTarget,  setMfTarget]  = useState('Nifty 50');
  const [mfChanges, setMfChanges] = useState(null);   // null = not yet seeded
  const [mfHidden,  setMfHidden]  = useState({});

  const mfCfg            = MF_TARGET_MAP[mfTarget];
  const mfVisible        = mfCfg.sources.filter(s => !mfHidden[s.key]);
  const mfHiddenSources  = mfCfg.sources.filter(s =>  mfHidden[s.key]);

  // Compute live 1D change for a source (commodity % or rate pp diff)
  function mfLiveChange(src) {
    if (src.isRate) {
      const series = allSeries?.[src.rateKey];
      if (!series?.length) return 0;
      const last = series.at(-1)?.value, prev = series.at(-2)?.value;
      return (last != null && prev != null) ? +(last - prev).toFixed(2) : 0;
    }
    const pct = (quotes?.[src.quoteKey]?.changePct ?? quotes?.[src.fallbackKey]?.changePct ?? 0);
    return +parseFloat(pct).toFixed(1);
  }

  // Seed changes with live data once quotes are available
  const seededChanges = useMemo(() => {
    if (mfChanges !== null) return mfChanges;
    if (!quotes) return {};
    return Object.fromEntries(mfCfg.sources.map(s => [s.key, mfLiveChange(s)]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mfChanges, quotes, allSeries, mfCfg]);

  const mfImpacts = useMemo(() => {
    return mfVisible.map(src => {
      const ms      = MF_MODEL_SERIES[src.modelKey] ?? {};
      const xSeries = ms.xKey ? (commodityHistory?.[ms.xKey] ?? []) : [];
      const ySeries = ms.yKey ? (allSeries?.[ms.yKey]         ?? []) : [];
      const model   = resolveModel(src.modelKey, xSeries, ySeries);
      const chg     = seededChanges[src.key] ?? 0;
      const impact  = model && chg !== 0 ? estimate(model, chg) : null;
      return { src, model, chg, impact };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mfVisible, seededChanges, commodityHistory, allSeries]);

  const mfTotals = useMemo(() => {
    const rows = mfImpacts.filter(r => r.impact);
    if (!rows.length) return null;
    const point = rows.reduce((s, r) => s + r.impact.point, 0);
    const lo    = rows.reduce((s, r) => s + r.impact.low,   0);
    const hi    = rows.reduce((s, r) => s + r.impact.high,  0);
    return { point, low: Math.min(lo, hi), high: Math.max(lo, hi) };
  }, [mfImpacts]);

  const mfMaxAbs = useMemo(() => {
    const vs = mfImpacts.filter(r => r.impact).map(r => Math.abs(r.impact.point));
    return vs.length ? Math.max(...vs) : 1;
  }, [mfImpacts]);

  function mfLiveDefaults(sources) {
    return Object.fromEntries(sources.map(s => [s.key, mfLiveChange(s)]));
  }
  function mfSelectTarget(t) {
    setMfTarget(t);
    setMfChanges(null);   // triggers re-seed from live data
    setMfHidden({});
  }
  function mfResetToLive() { setMfChanges(null); setMfHidden({}); }
  function mfSetChange(key, val) {
    setMfChanges(prev => ({ ...(prev ?? seededChanges), [key]: val }));
  }
  function mfRemove(key) { setMfHidden(h => ({ ...h, [key]: true })); setMfChanges(c => ({ ...(c ?? seededChanges), [key]: 0 })); }
  function mfAdd(key)    { setMfHidden(h => ({ ...h, [key]: false })); }

  const mfTotalColor = !mfTotals ? 'rgba(255,255,255,0.3)' : mfTotals.point >= 0 ? '#22c55e' : '#f87171';

  const changePct = useMemo(() => {
    if (kb.isRate) {
      // Rate sources: return pp difference (not % change)
      const series = allSeries?.[kb.seriesKey];
      if (!series?.length) return null;
      const monthsBack = window === '1D' ? 0 : window === '1M' ? 1 : window === '3M' ? 3 : 6;
      const vLast  = series.at(-1)?.value;
      const vStart = series[Math.max(0, series.length - 1 - monthsBack)]?.value;
      if (vLast == null || vStart == null) return null;
      return +(vLast - vStart).toFixed(2);
    }
    return computeWindowChange(quotes, kb.quoteKey, kb.fallbackQuoteKey, kb.seriesKey, commodityHistory, window);
  }, [quotes, kb, commodityHistory, allSeries, window]);

  // effectivePct is what gets used for all estimates — custom slider overrides the time-window value
  const effectivePct  = customMode ? customPct : changePct;
  const isSimulated   = customMode;

  const liveQ = kb.isRate ? null : (quotes?.[kb.quoteKey] ?? quotes?.[kb.fallbackQuoteKey]);

  // Current rate level for rate sources (from series last value)
  const currentRate = kb.isRate ? (allSeries?.[kb.seriesKey]?.at(-1)?.value ?? null) : null;

  // Hypothetical price / rate
  const hypotheticalPrice = !kb.isRate && liveQ?.price && customMode
    ? liveQ.price * (1 + customPct / 100)
    : null;
  const hypotheticalRate = kb.isRate && currentRate != null && customMode
    ? +(currentRate + customPct).toFixed(2)
    : null;

  const newsForSource = useMemo(() => {
    if (!rssNews?.length) return [];
    const tag = kb.newsTag;
    return rssNews.filter(n =>
      n.tags?.includes(tag) ||
      n.title?.toLowerCase().includes(tag.toLowerCase())
    ).slice(0, 6);
  }, [rssNews, kb.newsTag]);

  const xSeries = kb.isRate
    ? (allSeries?.[kb.seriesKey] ?? [])
    : (commodityHistory?.[kb.seriesKey] ?? []);

  return (
    <div className="glass" style={{ borderRadius: 'var(--radius-lg)', padding: '22px 24px', marginBottom: 24 }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Activity size={16} color="#818cf8" />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>Impact Analyzer</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {view === 'single'
                ? 'Select a commodity or rate → simulate a move → see OLS impact estimates with 95% CIs'
                : 'Select a target → combine multiple factors → see net estimated impact'}
            </div>
          </div>
        </div>

        {/* View toggle */}
        <div style={{ display: 'flex', gap: 3, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 3 }}>
          {[['single', 'Single Source'], ['multi', 'Multi-Factor']].map(([v, label]) => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: '6px 14px', fontSize: 11, fontWeight: 600, borderRadius: 8,
              border: 'none', cursor: 'pointer', fontFamily: 'var(--font)',
              background: view === v ? 'rgba(139,92,246,0.25)' : 'transparent',
              color: view === v ? '#c4b5fd' : 'var(--text-muted)',
              transition: 'all 0.15s',
            }}>{label}</button>
          ))}
        </div>
      </div>

      {view === 'single' && <HowToRead />}

      {/* ── Multi-factor view ───────────────────────────────────────────────── */}
      {view === 'multi' && (
        <div>
          {/* Target selector */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', fontWeight: 500, marginBottom: 8 }}>Select target</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {MF_TARGETS.map(t => (
                <button key={t} onClick={() => mfSelectTarget(t)} style={{
                  padding: '4px 13px', fontSize: 11, fontWeight: mfTarget === t ? 600 : 400,
                  borderRadius: 999, cursor: 'pointer', fontFamily: 'var(--font)',
                  border: `1px solid ${mfTarget === t ? 'rgba(139,92,246,0.6)' : 'rgba(255,255,255,0.09)'}`,
                  background: mfTarget === t ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.03)',
                  color: mfTarget === t ? '#c4b5fd' : 'rgba(255,255,255,0.38)',
                  transition: 'all 0.15s',
                }}>{t}</button>
              ))}
            </div>
          </div>

          {/* Factor chips */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', fontWeight: 500 }}>Factors</div>
              <button onClick={mfResetToLive} style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '2px 9px', cursor: 'pointer', fontFamily: 'var(--font)' }}>
                ↺ Reset to live 1D
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {mfVisible.map(src => {
                const col = MF_SRC_COLOR[src.key] ?? '#94a3b8';
                return (
                  <span key={src.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px 4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 500, background: col + '18', border: `1px solid ${col}40`, color: col }}>
                    {src.label}
                    <button onClick={() => mfRemove(src.key)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 14, height: 14, borderRadius: '50%', border: 'none', cursor: 'pointer', background: col + '30', color: col, fontSize: 9, fontWeight: 700, lineHeight: 1, padding: 0, fontFamily: 'var(--font)' }}>×</button>
                  </span>
                );
              })}
              {mfHiddenSources.map(src => (
                <button key={src.key} onClick={() => mfAdd(src.key)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 11px', borderRadius: 999, fontSize: 11, fontWeight: 400, background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontFamily: 'var(--font)' }}>
                  + {src.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '4px 0 4px' }} />

          {/* Slider rows */}
          {mfVisible.length === 0
            ? <div style={{ padding: '20px 0', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>Add factors above to begin</div>
            : mfImpacts.map(({ src, model, chg, impact }, i) => {
              const col   = MF_SRC_COLOR[src.key] ?? '#94a3b8';
              const impPt = impact?.point ?? 0;
              const r2    = model?.r2;
              const r2Color = r2 == null ? '#666' : r2 >= 0.5 ? '#4ade80' : r2 >= 0.25 ? '#fbbf24' : '#f87171';
              return (
                <div key={src.key}>
                  {/* Main row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: i === 0 ? 6 : 10, paddingBottom: 4 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: col, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.72)', minWidth: 120, flexShrink: 0 }}>{src.label}</span>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', minWidth: 24, textAlign: 'right' }}>{src.isRate ? `${src.min}` : `${src.min}%`}</span>
                      <input type="range" min={src.min} max={src.max} step={src.step} value={chg}
                        onChange={e => mfSetChange(src.key, parseFloat(e.target.value))}
                        style={{ flex: 1, accentColor: col, cursor: 'pointer', height: 3 }} />
                      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', minWidth: 24 }}>{src.isRate ? `+${src.max}` : `+${src.max}%`}</span>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, minWidth: 62, textAlign: 'right', color: chg === 0 ? 'rgba(255,255,255,0.22)' : chg > 0 ? '#4ade80' : '#f87171', fontVariantNumeric: 'tabular-nums' }}>{mfFmtChg(chg, src.isRate)}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, minWidth: 72, textAlign: 'right', color: impPt > 0 ? '#4ade80' : impPt < 0 ? '#f87171' : 'rgba(255,255,255,0.2)', fontVariantNumeric: 'tabular-nums' }}>{impact ? mfFmt(impPt, mfCfg.unit) : '—'}</span>
                  </div>
                  {/* Justification row */}
                  <div style={{ paddingBottom: 8, paddingLeft: 18 }}>
                    {src.note && (
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', lineHeight: 1.5, marginBottom: 4 }}>
                        {src.note}
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 9, color: r2Color, fontVariantNumeric: 'tabular-nums' }}>R²&thinsp;{r2 != null ? r2.toFixed(2) : '—'}</span>
                      {model?.isEmpirical && <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.28)', fontStyle: 'italic' }}>empirical</span>}
                      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.22)', fontVariantNumeric: 'tabular-nums' }}>β&thinsp;{model?.beta != null ? (model.beta > 0 ? '+' : '') + model.beta.toFixed(3) : '—'}</span>
                      {impact && <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.22)', fontVariantNumeric: 'tabular-nums' }}>95%&thinsp;CI&nbsp;{mfFmt(impact.low, mfCfg.unit)} to {mfFmt(impact.high, mfCfg.unit)}</span>}
                      {model?.n > 0 && <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.18)' }}>n={model.n}</span>}
                    </div>
                  </div>
                  {i < mfImpacts.length - 1 && <div style={{ height: 1, background: 'rgba(255,255,255,0.04)' }} />}
                </div>
              );
            })
          }

          {/* Combined result */}
          {mfTotals && (
            <>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '12px 0 16px' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', fontWeight: 500, marginBottom: 6 }}>Combined impact on {mfTarget}</div>
                  <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.04em', color: mfTotalColor, lineHeight: 1 }}>{mfFmt(mfTotals.point, mfCfg.unit)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginBottom: 3 }}>95% range</div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.45)', fontVariantNumeric: 'tabular-nums' }}>{mfFmt(mfTotals.low, mfCfg.unit)}&ensp;–&ensp;{mfFmt(mfTotals.high, mfCfg.unit)}</div>
                </div>
              </div>
              {/* CI range bar */}
              {(() => {
                const span  = Math.max(Math.abs(mfTotals.low), Math.abs(mfTotals.high)) * 2 || 1;
                const toPct = v => Math.max(0, Math.min(100, ((v + span / 2) / span) * 100));
                const pPt = toPct(mfTotals.point), pLo = toPct(mfTotals.low), pHi = toPct(mfTotals.high);
                const bLo = Math.min(pLo, pHi), bW = Math.abs(pHi - pLo);
                return (
                  <div style={{ position: 'relative', height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, marginBottom: 14 }}>
                    <div style={{ position: 'absolute', top: 0, height: '100%', borderRadius: 3, left: `${bLo}%`, width: `${bW}%`, background: mfTotalColor + '35' }} />
                    <div style={{ position: 'absolute', top: -3, width: 2, height: 12, borderRadius: 1, left: `${pPt}%`, transform: 'translateX(-50%)', background: mfTotalColor }} />
                    <div style={{ position: 'absolute', top: 0, width: 1, height: '100%', left: '50%', background: 'rgba(255,255,255,0.15)' }} />
                  </div>
                );
              })()}
              {/* Breakdown bars */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {mfImpacts.filter(r => r.impact).map(({ src, impact }) => {
                  const col = MF_SRC_COLOR[src.key] ?? '#94a3b8';
                  const pct = mfMaxAbs > 0 ? Math.abs(impact.point) / mfMaxAbs * 100 : 0;
                  const isP = impact.point >= 0;
                  return (
                    <div key={src.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 11, color: col, fontWeight: 400, minWidth: 104 }}>{src.label}</span>
                      <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 2, width: `${Math.min(100, pct)}%`, background: isP ? '#22c55e' : '#f87171', opacity: 0.8 }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 600, minWidth: 64, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: isP ? '#4ade80' : '#f87171' }}>{mfFmt(impact.point, mfCfg.unit)}</span>
                    </div>
                  );
                })}
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.4)' }}>Net</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: mfTotalColor, fontVariantNumeric: 'tabular-nums' }}>{mfFmt(mfTotals.point, mfCfg.unit)}</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Single-source view ──────────────────────────────────────────────── */}
      {view === 'single' && <>

      {/* Source pills row */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {Object.entries(KB).map(([key, kbEntry]) => {
          const active = source === key;
          const rateVal = kbEntry.isRate ? allSeries?.[kbEntry.seriesKey]?.at(-1)?.value : null;
          const q   = kbEntry.isRate ? null : (quotes?.[kbEntry.quoteKey] ?? quotes?.[kbEntry.fallbackQuoteKey]);
          const pct = q?.changePct ?? null;
          return (
            <button key={key} onClick={() => { setSource(key); setCustomMode(false); setCustomPct(0); }} style={{
              padding: '7px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font)', fontSize: 12, fontWeight: 600,
              background: active ? kbEntry.color + '22' : 'rgba(255,255,255,0.05)',
              color: active ? kbEntry.color : 'var(--text-secondary)',
              outline: active ? `1.5px solid ${kbEntry.color}50` : '1.5px solid transparent',
              transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', gap: 7,
            }}>
              <span>{kbEntry.label}</span>
              {kbEntry.isRate && rateVal != null && (
                <span style={{ fontSize: 10, fontWeight: 700, color: kbEntry.color }}>
                  {rateVal.toFixed(2)}%
                </span>
              )}
              {!kbEntry.isRate && pct != null && (
                <span style={{ fontSize: 10, fontWeight: 700, color: +pct >= 0 ? '#34d399' : '#f87171' }}>
                  {+pct >= 0 ? '+' : ''}{(+pct).toFixed(2)}%
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Time window + Simulate toggle row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Change window:</div>
        <div style={{ display: 'flex', gap: 3 }}>
          {WINDOWS.map(w => (
            <button key={w} onClick={() => { setWindow(w); setCustomMode(false); }} style={{
              padding: '5px 10px', fontSize: 11, fontWeight: 600, borderRadius: 7,
              border: `1px solid ${!customMode && window === w ? kb.color + '55' : 'transparent'}`,
              background: !customMode && window === w ? kb.color + '18' : 'rgba(255,255,255,0.04)',
              color: !customMode && window === w ? kb.color : 'var(--text-muted)',
              cursor: 'pointer', fontFamily: 'var(--font)',
              opacity: customMode ? 0.4 : 1,
            }}>{w}</button>
          ))}
        </div>
        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.08)', margin: '0 4px' }} />
        <button
          onClick={() => { setCustomMode(m => !m); if (!customMode) setCustomPct(kb.isRate ? 0.25 : (changePct ?? 5)); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 12px', fontSize: 11, fontWeight: 700, borderRadius: 8,
            border: `1px solid ${customMode ? '#8b5cf6' : 'rgba(255,255,255,0.12)'}`,
            background: customMode ? 'rgba(139,92,246,0.18)' : 'rgba(255,255,255,0.04)',
            color: customMode ? '#c4b5fd' : 'var(--text-muted)',
            cursor: 'pointer', fontFamily: 'var(--font)',
            transition: 'all 0.15s',
          }}>
          <Sliders size={11} />
          {customMode ? 'Simulating — click to use live data' : (kb.isRate ? 'Simulate a rate change' : 'Simulate a price move')}
        </button>
        {customMode && (
          <button onClick={() => { setCustomMode(false); setCustomPct(0); }} title="Reset"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
            <RotateCcw size={13} />
          </button>
        )}
      </div>

      {/* Simulator panel */}
      {customMode && (
        <div style={{
          marginBottom: 18, padding: '16px 18px',
          background: 'rgba(139,92,246,0.07)',
          border: '1px solid rgba(139,92,246,0.25)',
          borderRadius: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 10, color: '#a78bfa', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 2 }}>
                {kb.isRate ? 'RATE CHANGE' : 'HYPOTHETICAL MOVE'}
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', color: customPct >= 0 ? '#34d399' : '#f87171' }}>
                {customPct >= 0 ? '+' : ''}{kb.isRate ? `${Math.round(customPct * 100)}bps` : `${customPct.toFixed(1)}%`}
              </div>
              {kb.isRate && (
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                  {customPct >= 0 ? '+' : ''}{customPct.toFixed(2)} percentage points
                </div>
              )}
            </div>
            {kb.isRate && currentRate != null && (
              <>
                <div style={{ fontSize: 18, color: 'var(--text-muted)' }}>→</div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Current rate</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: kb.color }}>{currentRate.toFixed(2)}%</div>
                </div>
                <div style={{ fontSize: 18, color: 'var(--text-muted)' }}>→</div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Hypothetical rate</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: customPct >= 0 ? '#34d399' : '#f87171' }}>
                    {hypotheticalRate?.toFixed(2)}%
                  </div>
                </div>
              </>
            )}
            {!kb.isRate && liveQ?.price && (
              <>
                <div style={{ fontSize: 18, color: 'var(--text-muted)' }}>→</div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Current price</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: kb.color }}>
                    {liveQ.currency === 'INR'
                      ? `₹${Number(liveQ.price).toLocaleString('en-IN')}`
                      : `${Number(liveQ.price).toFixed(2)}`}
                  </div>
                </div>
                <div style={{ fontSize: 18, color: 'var(--text-muted)' }}>→</div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Hypothetical price</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: customPct >= 0 ? '#34d399' : '#f87171' }}>
                    {liveQ.currency === 'INR'
                      ? `₹${Math.round(liveQ.price * (1 + customPct / 100)).toLocaleString('en-IN')}`
                      : `${(liveQ.price * (1 + customPct / 100)).toFixed(2)}`}
                  </div>
                </div>
              </>
            )}
            <div style={{ marginLeft: 'auto', fontSize: 11, color: '#a78bfa', fontStyle: 'italic' }}>
              All impact estimates below update live as you drag
            </div>
          </div>

          {/* Slider */}
          <div style={{ position: 'relative', paddingBottom: 18 }}>
            <input
              type="range"
              min={kb.isRate ? RATE_SLIDER_MIN : SLIDER_MIN}
              max={kb.isRate ? RATE_SLIDER_MAX : SLIDER_MAX}
              step={kb.isRate ? 0.25 : 0.5}
              value={customPct}
              onChange={e => setCustomPct(+e.target.value)}
              style={{
                width: '100%', height: 4, cursor: 'pointer',
                accentColor: customPct >= 0 ? '#34d399' : '#f87171',
                outline: 'none',
              }}
            />
            {/* Scale markers */}
            <div style={{ display: 'flex', justifyContent: 'space-between', position: 'absolute', bottom: 0, left: 0, right: 0 }}>
              {kb.isRate
                ? [-2, -1, -0.5, 0, 0.5, 1, 2].map(v => (
                  <button key={v} onClick={() => setCustomPct(v)} style={{
                    background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                    fontSize: 9.5, color: v === 0 ? 'var(--text-muted)' : v === customPct ? '#c4b5fd' : 'rgba(255,255,255,0.2)',
                    fontFamily: 'var(--font)', fontWeight: v === 0 ? 700 : 500,
                  }}>
                    {v > 0 ? `+${v * 100}` : v === 0 ? '0' : `${v * 100}`}bps
                  </button>
                ))
                : [SLIDER_MIN, -15, -5, 0, 5, 15, SLIDER_MAX].map(v => (
                  <button key={v} onClick={() => setCustomPct(v)} style={{
                    background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                    fontSize: 9.5, color: v === 0 ? 'var(--text-muted)' : v === customPct ? '#c4b5fd' : 'rgba(255,255,255,0.2)',
                    fontFamily: 'var(--font)', fontWeight: v === 0 ? 700 : 500,
                  }}>
                    {v > 0 ? `+${v}` : v}%
                  </button>
                ))
              }
            </div>
          </div>

          {/* Quick preset buttons */}
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            {kb.isRate
              ? [
                  { label: 'Cut −100bps', v: -1.0 }, { label: 'Cut −50bps', v: -0.5 }, { label: 'Cut −25bps', v: -0.25 },
                  { label: 'Hold 0', v: 0 },
                  { label: 'Hike +25bps', v: 0.25 }, { label: 'Hike +50bps', v: 0.5 }, { label: 'Hike +100bps', v: 1.0 },
                ].map(p => (
                  <button key={p.v} onClick={() => setCustomPct(p.v)} style={{
                    padding: '3px 9px', fontSize: 10.5, fontWeight: 600, borderRadius: 6,
                    border: `1px solid ${customPct === p.v ? (p.v >= 0 ? '#34d399' : '#f87171') + '60' : 'rgba(255,255,255,0.08)'}`,
                    background: customPct === p.v ? (p.v >= 0 ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)') : 'rgba(255,255,255,0.03)',
                    color: customPct === p.v ? (p.v >= 0 ? '#34d399' : '#f87171') : 'var(--text-muted)',
                    cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all 0.1s',
                  }}>
                    {p.label}
                  </button>
                ))
              : [
                  { label: 'Crash −20%', v: -20 }, { label: 'Drop −10%', v: -10 }, { label: 'Down −5%', v: -5 },
                  { label: 'Flat 0%', v: 0 },
                  { label: 'Up +5%', v: 5 }, { label: 'Rally +10%', v: 10 }, { label: 'Surge +20%', v: 20 },
                ].map(p => (
                  <button key={p.v} onClick={() => setCustomPct(p.v)} style={{
                    padding: '3px 9px', fontSize: 10.5, fontWeight: 600, borderRadius: 6,
                    border: `1px solid ${customPct === p.v ? (p.v >= 0 ? '#34d399' : '#f87171') + '60' : 'rgba(255,255,255,0.08)'}`,
                    background: customPct === p.v ? (p.v >= 0 ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)') : 'rgba(255,255,255,0.03)',
                    color: customPct === p.v ? (p.v >= 0 ? '#34d399' : '#f87171') : 'var(--text-muted)',
                    cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all 0.1s',
                  }}>
                    {p.label}
                  </button>
                ))
            }
          </div>
        </div>
      )}

      {/* Selected source summary bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px',
        background: kb.color + '0e', borderRadius: 10, border: `1px solid ${isSimulated ? '#8b5cf650' : kb.color + '20'}`,
        marginBottom: 20,
      }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{kb.label} — Current</div>
          {kb.isRate ? (
            currentRate != null
              ? <div style={{ fontSize: 18, fontWeight: 700, color: kb.color, letterSpacing: '-0.02em' }}>{currentRate.toFixed(2)}%</div>
              : <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>—</div>
          ) : liveQ ? (
            <div style={{ fontSize: 18, fontWeight: 700, color: kb.color, letterSpacing: '-0.02em' }}>
              {liveQ.currency === 'INR'
                ? `₹${Number(liveQ.price).toLocaleString('en-IN')}`
                : `${Number(liveQ.price).toFixed(2)}`}
            </div>
          ) : (
            <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>—</div>
          )}
        </div>
        <div style={{ width: 1, height: 40, background: `${kb.color}25` }} />
        <div>
          <div style={{ fontSize: 11, color: isSimulated ? '#a78bfa' : 'var(--text-muted)' }}>
            {isSimulated ? (kb.isRate ? 'Simulated rate change' : 'Simulated change') : `${window} change`}
          </div>
          {effectivePct != null ? (
            <div style={{
              fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em',
              color: effectivePct >= 0 ? '#34d399' : '#f87171',
            }}>
              {effectivePct >= 0 ? '+' : ''}
              {kb.isRate
                ? `${Math.round(effectivePct * 100)}bps`
                : `${effectivePct.toFixed(2)}%`}
            </div>
          ) : (
            <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>—</div>
          )}
        </div>
        {hypotheticalRate != null && (
          <>
            <div style={{ width: 1, height: 40, background: 'rgba(139,92,246,0.25)' }} />
            <div>
              <div style={{ fontSize: 11, color: '#a78bfa' }}>Hypothetical rate</div>
              <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', color: customPct >= 0 ? '#34d399' : '#f87171' }}>
                {hypotheticalRate.toFixed(2)}%
              </div>
            </div>
          </>
        )}
        {hypotheticalPrice && (
          <>
            <div style={{ width: 1, height: 40, background: 'rgba(139,92,246,0.25)' }} />
            <div>
              <div style={{ fontSize: 11, color: '#a78bfa' }}>Hypothetical price</div>
              <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', color: customPct >= 0 ? '#34d399' : '#f87171' }}>
                {liveQ.currency === 'INR'
                  ? `₹${Math.round(hypotheticalPrice).toLocaleString('en-IN')}`
                  : hypotheticalPrice.toFixed(2)}
              </div>
            </div>
          </>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
          {effectivePct != null && (
            <>
              {effectivePct >= 0 ? <TrendingUp size={14} color="#34d399" /> : <TrendingDown size={14} color="#f87171" />}
              <span>
                {isSimulated ? 'Scenario: ' : ''}{kb.impacts.length} indicators recalculated
                {isSimulated && <span style={{ color: '#a78bfa' }}> in simulation mode</span>}
              </span>
            </>
          )}
          {effectivePct == null && <span>Load live data or simulate a move to see estimates</span>}
        </div>
      </div>

      {/* Impact cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {kb.impacts.map(impact => (
          <ImpactCard
            key={impact.id}
            impact={impact}
            sourceColor={kb.color}
            sourcePct={effectivePct}
            xSeries={xSeries}
            ySeries={allSeries?.[impact.destSeriesKey] ?? []}
            newsItems={newsForSource}
            isSimulated={isSimulated}
            sourceLabel={kb.label}
            isRate={kb.isRate}
          />
        ))}
      </div>

      {/* News section for the selected commodity */}
      {newsForSource.length > 0 && (
        <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.07em', marginBottom: 12 }}>
            {kb.label.toUpperCase()} NEWS
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            {newsForSource.map((item, i) => (
              <a key={i} href={item.link ?? '#'} target="_blank" rel="noopener noreferrer"
                style={{ textDecoration: 'none' }}>
                <div style={{
                  padding: '10px 12px', borderRadius: 9,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = kb.color + '40'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'}
                >
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)', lineHeight: 1.5, marginBottom: 6 }}>
                    {item.title}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {item.source} · {item.ago}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
      </>}
    </div>
  );
}

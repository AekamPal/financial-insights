// Generates realistic synthetic Indian financial data for the last N months
function monthsBack(n) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 7);
}

function genSeries(base, volatility, months, trend = 0) {
  const out = [];
  let v = base;
  for (let i = months; i >= 0; i--) {
    v = v * (1 + trend / 12) + (Math.random() - 0.5) * volatility;
    out.push({ month: monthsBack(i), value: parseFloat(v.toFixed(2)) });
  }
  return out;
}

function genOHLC(base, vol, months) {
  const out = [];
  let v = base;
  for (let i = months; i >= 0; i--) {
    const change = (Math.random() - 0.48) * vol;
    const open  = parseFloat(v.toFixed(2));
    const close = parseFloat((v + change).toFixed(2));
    const high  = parseFloat((Math.max(open, close) + Math.random() * vol * 0.4).toFixed(2));
    const low   = parseFloat((Math.min(open, close) - Math.random() * vol * 0.4).toFixed(2));
    v = close;
    out.push({ month: monthsBack(i), open, high, low, close, volume: Math.floor(Math.random() * 1e9 + 5e8) });
  }
  return out;
}

// ── Core datasets ─────────────────────────────────────────────────────────────

export const MONTHS = 24;

// NSE Nifty 50
export const nifty50 = genOHLC(21800, 420, MONTHS);

// BSE Sensex
export const sensex = genOHLC(72000, 1400, MONTHS);

// Crude Oil (Brent, USD/barrel)
export const crudeoil = genSeries(82, 8, MONTHS, -0.03);

// Gold (INR/10g)
export const gold = genSeries(62000, 1800, MONTHS, 0.08);

// Silver (INR/kg)
export const silver = genSeries(74000, 3200, MONTHS, 0.05);

// USD/INR
export const usdinr = genSeries(83.2, 1.2, MONTHS, 0.02);

// CPI Inflation (%)
export const inflation = genSeries(5.8, 0.6, MONTHS, -0.01);

// Repo Rate RBI (%)
export const repoRate = (() => {
  const rates = [6.5, 6.5, 6.5, 6.5, 6.25, 6.25, 6.0, 6.0, 6.0, 6.0, 5.75, 5.75,
                 5.75, 5.75, 6.0, 6.0, 6.25, 6.25, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5];
  return rates.slice(0, MONTHS + 1).map((v, i) => ({ month: monthsBack(MONTHS - i), value: v }));
})();

// India GDP growth YoY (%)
export const gdpGrowth = [
  { month: '2022-04', value: 8.4 }, { month: '2022-07', value: 7.2 },
  { month: '2022-10', value: 6.3 }, { month: '2023-01', value: 7.7 },
  { month: '2023-04', value: 8.2 }, { month: '2023-07', value: 7.6 },
  { month: '2023-10', value: 8.4 }, { month: '2024-01', value: 7.0 },
  { month: '2024-04', value: 6.7 }, { month: '2024-07', value: 6.5 },
];


// Sectoral indices
export const sectors = [
  { name: 'IT',       change: 2.34,  ytd: 18.2, value: 37842 },
  { name: 'Banking',  change: -0.82, ytd: 6.4,  value: 52140 },
  { name: 'Energy',   change: 1.12,  ytd: 22.1, value: 29380 },
  { name: 'Pharma',   change: 0.67,  ytd: 11.8, value: 18920 },
  { name: 'Auto',     change: -1.24, ytd: 4.2,  value: 54210 },
  { name: 'FMCG',     change: 0.45,  ytd: 3.1,  value: 22640 },
  { name: 'Realty',   change: 3.21,  ytd: 28.7, value: 8930  },
  { name: 'Metal',    change: -2.14, ytd: -5.2, value: 29180 },
];

// Top Nifty movers today
export const topMovers = [
  { ticker: 'RELIANCE', name: 'Reliance Inds',  price: 2948.55, change: 1.82,  mktCap: '19.9L Cr' },
  { ticker: 'TCS',      name: 'Tata Consultancy',price: 4218.40, change: 2.47, mktCap: '15.3L Cr' },
  { ticker: 'HDFC',     name: 'HDFC Bank',       price: 1723.80, change: -0.94, mktCap: '13.1L Cr' },
  { ticker: 'INFY',     name: 'Infosys',          price: 1895.65, change: 3.12, mktCap: '7.8L Cr' },
  { ticker: 'ICICIBANK',name: 'ICICI Bank',       price: 1412.30, change: -0.41, mktCap: '9.9L Cr' },
  { ticker: 'ADANIGRP', name: 'Adani Enterp.',   price: 3245.20, change: -2.88, mktCap: '3.7L Cr' },
  { ticker: 'LT',       name: 'L&T',              price: 3867.90, change: 0.92,  mktCap: '5.4L Cr' },
  { ticker: 'WIPRO',    name: 'Wipro',            price: 612.40,  change: 1.55,  mktCap: '3.2L Cr' },
];

// Key macroeconomic metrics
export const macroMetrics = [
  { label: 'Nifty 50',   value: '24,150.35',  change: '+0.74%', up: true,  sub: 'NSE India' },
  { label: 'Sensex',     value: '79,480.12',  change: '+0.68%', up: true,  sub: 'BSE India' },
  { label: 'Crude Oil',  value: '$82.40',  change: '-1.12%', up: false, sub: 'Brent USD/bbl' },
  { label: 'Gold',       value: '₹72,450', change: '+0.33%', up: true,  sub: 'MCX INR/10g' },
  { label: 'USD/INR',    value: '83.67',   change: '+0.12%', up: false, sub: 'Forex' },
  { label: 'Repo Rate',  value: '6.00%',   change: '0.00%',  up: null,  sub: 'RBI Policy' },
  { label: 'CPI Infl.',  value: '4.83%',   change: '-0.21%', up: true,  sub: 'YoY (FRED)' },
];

// Commodity basket
export const commodities = [
  { name: 'Crude Oil (Brent)', value: 82.4,  unit: 'USD/bbl', change: -1.12, series: crudeoil, color: '#f59e0b', newsTag: 'crude'   },
  { name: 'Gold',              value: 72450, unit: '₹/10g',   change: 0.33,  series: gold,     color: '#fbbf24', newsTag: 'gold'    },
  { name: 'Silver',            value: 89200, unit: '₹/kg',    change: 0.71,  series: silver,   color: '#94a3b8', newsTag: 'silver'  },
  { name: 'Natural Gas',       value: 198.4, unit: '₹/MMBtu', change: -2.34, series: genSeries(195, 18, MONTHS, 0), color: '#22d3ee', newsTag: 'natgas' },
  { name: 'Copper',            value: 812.5, unit: '₹/kg',    change: -1.84, series: genSeries(810, 45, MONTHS, 0.02), color: '#f97316', newsTag: 'copper' },
  { name: 'Aluminium',         value: 215.3, unit: '₹/kg',    change: 0.44,  series: genSeries(213, 12, MONTHS, 0.01), color: '#6366f1', newsTag: 'aluminium' },
];

// ── News headlines ────────────────────────────────────────────────────────────
export const news = [
  // Indices
  { id: 1,  tag: 'Nifty',   newsTag: null,        color: '#3b82f6', headline: 'Nifty 50 hits fresh all-time high as IT and banking stocks surge on strong earnings', source: 'Economic Times', ago: '12m ago' },
  { id: 2,  tag: 'Sensex',  newsTag: null,        color: '#6366f1', headline: 'Sensex rallies 500 points; Reliance, TCS lead broader market recovery', source: 'Mint', ago: '28m ago' },
  { id: 3,  tag: 'FII',     newsTag: null,        color: '#22d3ee', headline: 'Foreign investors net buyers for fourth consecutive session, pump ₹4,280 Cr into equities', source: 'Business Standard', ago: '1h ago' },
  { id: 4,  tag: 'Nifty',   newsTag: null,        color: '#3b82f6', headline: 'Midcap index outperforms benchmark; realty and infra stocks in focus ahead of budget', source: 'CNBC-TV18', ago: '2h ago' },
  // Crude Oil
  { id: 5,  tag: 'Crude Oil', newsTag: 'crude',   color: '#f59e0b', headline: 'Brent crude slips below $83 on demand concerns from China; IEA cuts 2025 growth forecast', source: 'Reuters India', ago: '35m ago' },
  { id: 6,  tag: 'Crude Oil', newsTag: 'crude',   color: '#f59e0b', headline: 'OPEC+ holds output steady; Saudi Arabia signals flexible approach on production quotas through Q3', source: 'Bloomberg', ago: '3h ago' },
  { id: 7,  tag: 'Crude Oil', newsTag: 'crude',   color: '#f59e0b', headline: 'India\'s crude import bill narrows as Brent softens; current account deficit expected to improve in Q1 FY26', source: 'Financial Express', ago: '4h ago' },
  { id: 8,  tag: 'Crude Oil', newsTag: 'crude',   color: '#f59e0b', headline: 'US crude inventories fall more than expected; WTI and Brent diverge on refinery demand outlook', source: 'Bloomberg Quint', ago: '6h ago' },
  // Gold
  { id: 9,  tag: 'Gold',    newsTag: 'gold',      color: '#fbbf24', headline: 'MCX Gold firms up to ₹72,450 on safe-haven demand; US Fed rate path remains key driver', source: 'Mint', ago: '45m ago' },
  { id: 10, tag: 'Gold',    newsTag: 'gold',      color: '#fbbf24', headline: 'RBI adds 8 tonnes to gold reserves in May; total holdings cross 840 tonnes', source: 'Economic Times', ago: '6h ago' },
  { id: 11, tag: 'Gold',    newsTag: 'gold',      color: '#fbbf24', headline: 'Gold ETF inflows hit 6-month high in India as retail investors seek inflation hedge', source: 'Business Standard', ago: '8h ago' },
  { id: 12, tag: 'Gold',    newsTag: 'gold',      color: '#fbbf24', headline: 'Central bank buying supports gold near $2,300; analysts see $2,500 by year-end on dollar weakness', source: 'Reuters India', ago: '10h ago' },
  // Silver
  { id: 13, tag: 'Silver',  newsTag: 'silver',    color: '#94a3b8', headline: 'MCX Silver trades sideways near ₹89,200; solar panel demand from India seen as long-term catalyst', source: 'Commodity Online', ago: '1h ago' },
  { id: 14, tag: 'Silver',  newsTag: 'silver',    color: '#94a3b8', headline: 'Gold-silver ratio widens to 80x as industrial demand outlook softens on China slowdown fears', source: 'Bloomberg', ago: '4h ago' },
  { id: 15, tag: 'Silver',  newsTag: 'silver',    color: '#94a3b8', headline: 'India\'s silver imports surge 30% YoY in FY25 driven by electronics and EV battery manufacturing', source: 'Economic Times', ago: '7h ago' },
  // Natural Gas
  { id: 16, tag: 'Nat Gas', newsTag: 'natgas',    color: '#22d3ee', headline: 'Henry Hub natural gas falls to 3-month low on mild weather forecast and ample US storage builds', source: 'Bloomberg', ago: '2h ago' },
  { id: 17, tag: 'Nat Gas', newsTag: 'natgas',    color: '#22d3ee', headline: 'GAIL reports strong LNG offtake; domestic city gas demand up 14% YoY as CNG adoption accelerates', source: 'Economic Times', ago: '5h ago' },
  { id: 18, tag: 'Nat Gas', newsTag: 'natgas',    color: '#22d3ee', headline: 'India eyes long-term LNG contracts with Qatar and Australia to lock in lower spot prices ahead of winter', source: 'Financial Express', ago: '9h ago' },
  // Copper
  { id: 19, tag: 'Copper',  newsTag: 'copper',    color: '#f97316', headline: 'LME copper retreats 1.8% as dollar strengthens post-Fed minutes; MCX copper down ₹15/kg', source: 'Commodity Online', ago: '1h ago' },
  { id: 20, tag: 'Copper',  newsTag: 'copper',    color: '#f97316', headline: 'Chile copper output misses estimates in April; supply tightness may support prices through Q3', source: 'Reuters India', ago: '3h ago' },
  { id: 21, tag: 'Copper',  newsTag: 'copper',    color: '#f97316', headline: 'India\'s copper demand to grow 8% in FY26 on power sector capex; Hindalco and Vedanta to benefit', source: 'Mint', ago: '6h ago' },
  // Aluminium
  { id: 22, tag: 'Aluminium', newsTag: 'aluminium', color: '#6366f1', headline: 'LME aluminium edges higher on China smelter curtailments; energy costs squeeze margins in Yunnan', source: 'Bloomberg', ago: '2h ago' },
  { id: 23, tag: 'Aluminium', newsTag: 'aluminium', color: '#6366f1', headline: 'NALCO raises aluminium prices by ₹3/kg citing higher input costs and firm global demand from auto sector', source: 'Business Standard', ago: '5h ago' },
  { id: 24, tag: 'Aluminium', newsTag: 'aluminium', color: '#6366f1', headline: 'EV and packaging sectors drive aluminium consumption growth; India to double capacity by 2028', source: 'Economic Times', ago: '8h ago' },
  // Macro
  { id: 25, tag: 'Macro',   newsTag: null,        color: '#14b8a6', headline: 'CPI inflation eases to 4.83% in May, lowest in 14 months; food prices show broad moderation', source: 'Business Standard', ago: '2h ago' },
  { id: 26, tag: 'RBI',     newsTag: null,        color: '#8b5cf6', headline: 'RBI MPC minutes signal cautious optimism; rate cut window may open in August policy meeting', source: 'Livemint', ago: '5h ago' },
  { id: 27, tag: 'Rupee',   newsTag: null,        color: '#22c55e', headline: 'Rupee strengthens to 83.50 on FII inflows and weak dollar; RBI likely to absorb gains', source: 'Bloomberg Quint', ago: '20m ago' },
];

export const newsByTag = (tags) => news.filter(n => tags.includes(n.tag));
export const newsByCommodity = (newsTag) => news.filter(n => n.newsTag === newsTag);

// ── Correlation matrix (simplified, for oil impact analysis) ─────────────────
export function computeCorrelation(xs, ys) {
  const n = Math.min(xs.length, ys.length);
  const xv = xs.slice(0, n).map(d => d.value);
  const yv = ys.slice(0, n).map(d => d.value);
  const mx = xv.reduce((a, b) => a + b, 0) / n;
  const my = yv.reduce((a, b) => a + b, 0) / n;
  const num = xv.reduce((s, x, i) => s + (x - mx) * (yv[i] - my), 0);
  const dx  = Math.sqrt(xv.reduce((s, x) => s + (x - mx) ** 2, 0));
  const dy  = Math.sqrt(yv.reduce((s, y) => s + (y - my) ** 2, 0));
  return dx && dy ? parseFloat((num / (dx * dy)).toFixed(3)) : 0;
}

export const oilImpacts = [
  { factor: 'USD/INR Exchange', corr: computeCorrelation(crudeoil, usdinr),   desc: 'Higher oil imports weaken the rupee' },
  { factor: 'CPI Inflation',    corr: computeCorrelation(crudeoil, inflation), desc: 'Fuel costs feed into consumer prices' },
  { factor: 'Nifty 50 Returns', corr: computeCorrelation(crudeoil, nifty50.map(d => ({ month: d.month, value: d.close }))), desc: 'Market sentiment vs. energy burden' },
  { factor: 'Gold Price (INR)', corr: computeCorrelation(crudeoil, gold),      desc: 'Both react to global risk appetite' },
];

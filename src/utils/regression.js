// Simple linear regression: y = mx + b
export function linearRegression(data) {
  const n = data.length;
  if (n < 2) return { slope: 0, intercept: data[0]?.value ?? 0, r2: 0, predict: () => data[0]?.value ?? 0 };
  const xs = data.map((_, i) => i);
  const ys = data.map(d => d.value);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
  const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  const slope = den ? num / den : 0;
  const intercept = my - slope * mx;
  const ssRes = ys.reduce((s, y, i) => s + (y - (slope * i + intercept)) ** 2, 0);
  const ssTot = ys.reduce((s, y) => s + (y - my) ** 2, 0);
  const r2 = ssTot ? parseFloat((1 - ssRes / ssTot).toFixed(4)) : 0;
  return {
    slope,
    intercept,
    r2,
    predict: (i) => slope * i + intercept,
    trendLine: data.map((d, i) => ({ month: d.month, value: parseFloat((slope * i + intercept).toFixed(2)) })),
    direction: slope > 0 ? 'up' : 'down',
    strength: Math.abs(r2),
  };
}

// Moving average
export function movingAverage(data, window = 3) {
  return data.map((d, i) => {
    if (i < window - 1) return { month: d.month, value: null };
    const slice = data.slice(i - window + 1, i + 1);
    const avg = slice.reduce((s, x) => s + x.value, 0) / window;
    return { month: d.month, value: parseFloat(avg.toFixed(2)) };
  });
}

// Volatility (rolling std dev)
export function volatility(data, window = 6) {
  return data.map((d, i) => {
    if (i < window - 1) return { month: d.month, value: null };
    const slice = data.slice(i - window + 1, i + 1).map(x => x.value);
    const mean = slice.reduce((a, b) => a + b, 0) / window;
    const std  = Math.sqrt(slice.reduce((s, v) => s + (v - mean) ** 2, 0) / window);
    return { month: d.month, value: parseFloat(std.toFixed(2)) };
  });
}

// Percent change series
export function pctChange(data) {
  return data.map((d, i) => {
    if (i === 0) return { month: d.month, value: 0 };
    const prev = data[i - 1].value;
    return { month: d.month, value: prev ? parseFloat(((d.value - prev) / prev * 100).toFixed(2)) : 0 };
  });
}

// Forecast next N periods via linear regression
export function forecast(data, n = 6) {
  const reg = linearRegression(data);
  const last = data[data.length - 1];
  const lastDate = new Date(last.month + '-01');
  const result = [];
  for (let i = 1; i <= n; i++) {
    const d = new Date(lastDate);
    d.setMonth(d.getMonth() + i);
    result.push({
      month: d.toISOString().slice(0, 7),
      value: parseFloat(reg.predict(data.length - 1 + i).toFixed(2)),
      forecast: true,
    });
  }
  return result;
}

// Generate natural-language insight from series
export function generateInsight(label, data, unit = '') {
  const reg   = linearRegression(data);
  const pct   = pctChange(data);
  const last6 = pct.slice(-6).map(d => d.value).filter(Boolean);
  const avg6  = last6.reduce((a, b) => a + b, 0) / (last6.length || 1);
  const latestVal = data[data.length - 1].value;
  const prevVal   = data[data.length - 2]?.value ?? latestVal;
  const mom       = ((latestVal - prevVal) / prevVal * 100).toFixed(1);
  const dir       = reg.direction === 'up' ? 'upward' : 'downward';
  const strength  = reg.strength > 0.7 ? 'strong' : reg.strength > 0.4 ? 'moderate' : 'weak';
  const trend     = `${strength} ${dir} trend (R²=${reg.r2})`;

  let insight = `${label} shows a ${trend} over the observed period. `;
  insight += `The most recent reading is ${latestVal}${unit}, `;
  insight += `a ${mom > 0 ? '+' : ''}${mom}% change month-on-month. `;
  if (Math.abs(avg6) > 1) {
    insight += `Average 6-month momentum is ${avg6 > 0 ? '+' : ''}${avg6.toFixed(1)}% — `;
    insight += avg6 > 0 ? 'suggesting continued accumulation pressure.' : 'indicating sustained selling pressure.';
  } else {
    insight += 'Short-term momentum is largely flat.';
  }
  return insight;
}

// Cross-impact narrative for oil
export function oilImpactNarrative(oilData, impacts) {
  const oilReg = linearRegression(oilData);
  const dir    = oilReg.direction === 'up' ? 'rising' : 'falling';
  const pctMov = ((oilData.at(-1).value - oilData.at(0).value) / oilData.at(0).value * 100).toFixed(1);
  const strong  = impacts.filter(i => Math.abs(i.corr) > 0.4);
  let narrative = `Crude oil has ${dir} ~${Math.abs(pctMov)}% over the analysis window. `;
  if (strong.length) {
    narrative += `Statistically significant correlations emerge with: `;
    narrative += strong.map(i => `${i.factor} (r=${i.corr}, ${i.desc.toLowerCase()})`).join('; ');
    narrative += '. ';
  }
  narrative += oilReg.direction === 'up'
    ? 'Sustained elevation could pressure the rupee, stoke imported inflation, and squeeze margins for energy-heavy sectors like Aviation and Paints.'
    : 'Easing crude prices may provide RBI room to cut rates, support consumption-led sectors, and narrow the current account deficit.';
  return narrative;
}

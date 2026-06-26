// Generates synthetic short-term price series anchored to a base value

function randomWalk(base, stepVol, n, labelFn) {
  const out = [];
  let v = base;
  for (let i = 0; i < n; i++) {
    v = Math.max(0, v + (Math.random() - 0.495) * stepVol);
    out.push({ time: labelFn(i), value: parseFloat(v.toFixed(2)) });
  }
  return out;
}

// 1H — 60 points, 1-min labels
export function gen1H(base, vol) {
  return randomWalk(base, vol * 0.008, 60, i => {
    const d = new Date(); d.setMinutes(d.getMinutes() - (59 - i));
    return `${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`;
  });
}

// 4H — 48 points, 5-min labels
export function gen4H(base, vol) {
  return randomWalk(base, vol * 0.018, 48, i => {
    const d = new Date(); d.setMinutes(d.getMinutes() - (47 - i) * 5);
    return `${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`;
  });
}

// 1D — 78 points (6.5h market day × 5-min), labelled by time
export function gen1D(base, vol) {
  return randomWalk(base, vol * 0.025, 78, i => {
    const mins = 9 * 60 + 15 + i * 5;
    return `${Math.floor(mins/60)}:${String(mins%60).padStart(2,'0')}`;
  });
}

// 1W — 5 trading days, daily close
export function gen1W(base, vol) {
  return randomWalk(base, vol * 0.12, 5, i => {
    const d = new Date();
    d.setDate(d.getDate() - (4 - i));
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' });
  });
}

// 1M — 21 trading days, daily close
export function gen1M(base, vol) {
  return randomWalk(base, vol * 0.12, 21, i => {
    const d = new Date();
    d.setDate(d.getDate() - (20 - i));
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  });
}

const INTRADAY_VOL = {
  // Commodity base volatilities (approx 1% of value)
  default: 1,
};

// Master function: given a span label, base value, and monthly series — return chart data
export function getSeriesForSpan(span, base, vol, monthlySeries) {
  const monthly = monthlySeries.map(d => ({
    time: d.month?.slice(2) ?? d.time,
    value: 'close' in d ? d.close : d.value,
  }));

  switch (span) {
    case '1H': return gen1H(base, vol);
    case '4H': return gen4H(base, vol);
    case '1D': return gen1D(base, vol);
    case '1W': return gen1W(base, vol);
    case '1M': return gen1M(base, vol);
    case '3M': return monthly.slice(-3);
    case '6M': return monthly.slice(-6);
    case '1Y': return monthly.slice(-12);
    case '2Y': return monthly;
    default:   return monthly.slice(-12);
  }
}

export const ALL_SPANS = ['1H', '4H', '1D', '1W', '1M', '3M', '6M', '1Y', '2Y'];

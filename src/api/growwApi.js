// Groww Trade API — browser client
// All requests go via /groww-api → Vite middleware → api.groww.in (with Bearer token)
// Docs: https://groww.in/trade-api/docs/curl

const BASE = '/groww-api'

// ── Groww symbol constants ────────────────────────────────────────────────────
// Format for LTP/OHLC: "{EXCHANGE}_{TRADING_SYMBOL}"
// Format for historical: groww_symbol = "{EXCHANGE}-{TRADING_SYMBOL}"
// NOTE: Index symbols may differ — verify with your account (NIFTY 50, SENSEX, etc.)
export const G_SYMBOLS = {
  // Indices (verify exact symbol with Groww; indices may need segment=INDICES)
  nifty:     { ltp: 'NSE_NIFTY 50',  hist: 'NSE-NIFTY 50',  exchange: 'NSE', segment: 'CASH', trading_symbol: 'NIFTY 50' },
  sensex:    { ltp: 'BSE_SENSEX',    hist: 'BSE-SENSEX',     exchange: 'BSE', segment: 'CASH', trading_symbol: 'SENSEX' },
  // Stocks
  reliance:  { ltp: 'NSE_RELIANCE',  hist: 'NSE-RELIANCE',  exchange: 'NSE', segment: 'CASH', trading_symbol: 'RELIANCE' },
  tcs:       { ltp: 'NSE_TCS',       hist: 'NSE-TCS',        exchange: 'NSE', segment: 'CASH', trading_symbol: 'TCS' },
  hdfc:      { ltp: 'NSE_HDFCBANK',  hist: 'NSE-HDFCBANK',  exchange: 'NSE', segment: 'CASH', trading_symbol: 'HDFCBANK' },
  infy:      { ltp: 'NSE_INFY',      hist: 'NSE-INFY',       exchange: 'NSE', segment: 'CASH', trading_symbol: 'INFY' },
  icici:     { ltp: 'NSE_ICICIBANK', hist: 'NSE-ICICIBANK',  exchange: 'NSE', segment: 'CASH', trading_symbol: 'ICICIBANK' },
  adani:     { ltp: 'NSE_ADANIENT',  hist: 'NSE-ADANIENT',  exchange: 'NSE', segment: 'CASH', trading_symbol: 'ADANIENT' },
  lt:        { ltp: 'NSE_LT',        hist: 'NSE-LT',         exchange: 'NSE', segment: 'CASH', trading_symbol: 'LT' },
  wipro:     { ltp: 'NSE_WIPRO',     hist: 'NSE-WIPRO',      exchange: 'NSE', segment: 'CASH', trading_symbol: 'WIPRO' },
  // Sector indices
  niftyIT:   { ltp: 'NSE_NIFTY IT',  hist: 'NSE-NIFTY IT',  exchange: 'NSE', segment: 'CASH', trading_symbol: 'NIFTY IT' },
  niftyBank: { ltp: 'NSE_NIFTY BANK',hist: 'NSE-NIFTY BANK',exchange: 'NSE', segment: 'CASH', trading_symbol: 'NIFTY BANK' },
}

async function req(path) {
  const r = await fetch(BASE + path, { signal: AbortSignal.timeout(8000) })
  if (!r.ok) {
    const body = await r.text()
    throw new Error(`Groww ${path}: ${r.status} ${body.slice(0, 120)}`)
  }
  return r.json()
}

// ── Live data ─────────────────────────────────────────────────────────────────

// Batch LTP for up to 50 symbols at once
// symbols: array of strings like ["NSE_RELIANCE", "NSE_TCS"]
export async function getLTP(segment, symbols) {
  const qs = `segment=${segment}&exchange_symbols=${encodeURIComponent(symbols.join(','))}`
  return req(`/live-data/ltp?${qs}`)
  // Response: { "NSE_RELIANCE": 1332.4, "NSE_TCS": 2188.8, ... }
}

// Full quote for one symbol — includes bid/ask, depth, volume, market cap, 52W H/L, circuit limits
export async function getQuote(exchange, segment, tradingSymbol) {
  const qs = `exchange=${exchange}&segment=${segment}&trading_symbol=${encodeURIComponent(tradingSymbol)}`
  return req(`/live-data/quote?${qs}`)
}

// Batch OHLC
export async function getOHLC(segment, symbols) {
  const qs = `segment=${segment}&exchange_symbols=${encodeURIComponent(symbols.join(','))}`
  return req(`/live-data/ohlc?${qs}`)
}

// ── Historical candles ────────────────────────────────────────────────────────
// candle_interval: '1min' | '5min' | '10min' | '15min' | '30min' | '1hour' | '4hour' | '1day' | '1week'
// start_time / end_time: 'YYYY-MM-DD HH:mm:ss'
export async function getHistoricalCandles(exchange, segment, growwSymbol, startTime, endTime, candleInterval = '1day') {
  const qs = new URLSearchParams({
    exchange,
    segment,
    groww_symbol: growwSymbol,
    start_time: startTime,
    end_time: endTime,
    candle_interval: candleInterval,
  }).toString()
  return req(`/historical/candles?${qs}`)
  // Response: { candles: [[timestamp, open, high, low, close, volume, oi], ...], ... }
}

// Convenience: fetch 2 years of daily candles and return as OHLC array
export async function fetchDailyHistory(sym) {
  const now   = new Date()
  const from  = new Date(now)
  from.setFullYear(from.getFullYear() - 2)
  const fmt = d => d.toISOString().slice(0, 10) + ' 00:00:00'

  const data = await getHistoricalCandles(
    sym.exchange, sym.segment, sym.hist, fmt(from), fmt(now), '1day'
  )

  return (data.candles ?? []).map(([ts, open, high, low, close, volume]) => {
    const d = new Date(ts * 1000)
    const month = d.toISOString().slice(0, 7)
    return { month, open: +open, high: +high, low: +low, close: +close, value: +close, volume: +volume }
  })
}

// ── Portfolio ─────────────────────────────────────────────────────────────────

export async function getHoldings() {
  return req('/portfolio/holdings')
  // Response array: [{ isin, trading_symbol, quantity, average_price, demat_free_quantity, ... }]
}

export async function getPositions(segment = null) {
  const qs = segment ? `?segment=${segment}` : ''
  return req(`/portfolio/positions${qs}`)
  // Response: [{ trading_symbol, segment, exchange, quantity, net_price, realised_pnl, ... }]
}

// ── Margin / Funds ────────────────────────────────────────────────────────────

export async function getMargin() {
  return req('/margin')
  // Response: { clear_cash, net_margin_used, cnc_balance_available, mis_balance_available, ... }
}

// ── User ──────────────────────────────────────────────────────────────────────

export async function getUserProfile() {
  return req('/user/profile')
  // Response: { vendor_user_id, ucc, nse_enabled, bse_enabled, active_segments, ... }
}

// ── Batch quote for all tracked stocks ───────────────────────────────────────

const EQUITY_SYMBOLS = Object.entries(G_SYMBOLS)
  .filter(([, v]) => v.segment === 'CASH')
  .map(([k, v]) => ({ key: k, ltp: v.ltp }))

export async function fetchAllLTP() {
  const symbols = EQUITY_SYMBOLS.map(s => s.ltp)
  const data = await getLTP('CASH', symbols)
  // Map back to our key names
  return Object.fromEntries(
    EQUITY_SYMBOLS
      .filter(({ ltp }) => data[ltp] != null)
      .map(({ key, ltp }) => [key, data[ltp]])
  )
}

// Check if Groww is configured (API key placeholder not yet filled in)
export async function isGrowwConfigured() {
  try {
    const r = await fetch(`${BASE}/user/profile`, { signal: AbortSignal.timeout(5000) })
    return r.ok
  } catch {
    return false
  }
}

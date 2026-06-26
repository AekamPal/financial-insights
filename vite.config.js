import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { execFile }   from 'node:child_process'
import { resolve }    from 'node:path'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
const GROWW_BASE = 'https://api.groww.in/v1'

// ── Groww token cache ─────────────────────────────────────────────────────────
// The approval token (GROWW_API_KEY) must be exchanged for a short-lived access
// token (expires daily at 06:00 IST). Checksum = SHA256(secret + timestamp).
// Promise coalescing prevents thundering-herd on concurrent startup requests.
let growwAccessToken  = null
let growwAccessExpiry = 0
let growwTokenPromise = null   // in-flight exchange (coalescing)
let growwBackoffUntil = 0      // don't retry before this timestamp

async function getGrowwToken(approvalToken, secret) {
  if (growwAccessToken && Date.now() < growwAccessExpiry - 60_000) return growwAccessToken
  if (Date.now() < growwBackoffUntil) throw new Error(`Groww rate-limited, retry after ${new Date(growwBackoffUntil).toLocaleTimeString()}`)
  if (growwTokenPromise) return growwTokenPromise

  growwTokenPromise = (async () => {
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const checksum  = createHash('sha256').update(secret + timestamp).digest('hex')

    const r = await fetch(`${GROWW_BASE}/token/api/access`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${approvalToken}`,
        'Content-Type': 'application/json',
        'X-API-VERSION': '1.0',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ key_type: 'approval', checksum, timestamp }),
      signal: AbortSignal.timeout(10000),
    })

    if (r.status === 429) {
      growwBackoffUntil = Date.now() + 10 * 60 * 1000  // back off 10 min on rate limit
      const body = await r.text()
      throw new Error(`Groww rate-limited (429) — backing off 10 min`)
    }

    if (!r.ok) {
      growwBackoffUntil = Date.now() + 5 * 60 * 1000   // back off 5 min on other errors
      const body = await r.text()
      throw new Error(`Groww token exchange failed ${r.status}: ${body.slice(0, 200)}`)
    }

    const data = await r.json()
    growwAccessToken = data.token ?? data.access_token
    if (!growwAccessToken) throw new Error('Groww: no token in exchange response')

    if (data.expiry) {
      growwAccessExpiry = new Date(data.expiry + '+05:30').getTime()
    } else {
      growwAccessExpiry = Date.now() + 12 * 60 * 60 * 1000
    }
    growwBackoffUntil = 0
    console.log('[groww] access token refreshed, expires:', new Date(growwAccessExpiry).toISOString())
    return growwAccessToken
  })().finally(() => { growwTokenPromise = null })

  return growwTokenPromise
}

// ── Groww proxy plugin ────────────────────────────────────────────────────────
function growwPlugin(env) {
  const approvalToken = env.GROWW_API_KEY
  const secret        = env.GROWW_SECRET
  const configured    = approvalToken && approvalToken !== 'YOUR_API_KEY_HERE'

  return {
    name: 'groww-proxy',
    configureServer(server) {
      server.middlewares.use('/groww-api', async (req, res) => {
        if (!configured) {
          res.writeHead(503, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'not_configured' }))
          return
        }

        try {
          const token = await getGrowwToken(approvalToken, secret)
          const url   = GROWW_BASE + req.url
          const r     = await fetch(url, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'X-API-VERSION': '1.0',
              'Accept': 'application/json',
            },
            signal: AbortSignal.timeout(8000),
          })

          const body = await r.text()
          res.writeHead(r.status, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          })
          res.end(body)
        } catch (e) {
          if (!e.message.includes('rate-limited')) console.error('[groww]', e.message)
          res.writeHead(503, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: e.message }))
        }
      })
    },
  }
}

// ── NSE cookie proxy plugin ───────────────────────────────────────────────────
let nseCookieJar = ''
let nseTs = 0

async function ensureNSECookies() {
  if (Date.now() - nseTs < 4 * 60 * 1000) return
  try {
    const r = await fetch('https://www.nseindia.com/', {
      headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml' },
      signal: AbortSignal.timeout(10000),
    })
    const raw = r.headers.getSetCookie?.() ?? []
    if (raw.length) {
      const jar = {}
      for (const c of raw) {
        const [kv] = c.split(';')
        const eq = kv.indexOf('=')
        if (eq > 0) jar[kv.slice(0, eq).trim()] = kv.slice(eq + 1)
      }
      nseCookieJar = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ')
      nseTs = Date.now()
    }
  } catch (e) {
    console.warn('[nse] cookie refresh failed:', e.message)
  }
}

function nsePlugin() {
  return {
    name: 'nse-cookie-proxy',
    configureServer(server) {
      server.middlewares.use('/nse-api', async (req, res) => {
        await ensureNSECookies()
        const url = 'https://www.nseindia.com/api' + req.url
        try {
          const r = await fetch(url, {
            headers: {
              'User-Agent': UA,
              'Referer': 'https://www.nseindia.com/',
              'Accept': 'application/json, text/plain, */*',
              ...(nseCookieJar ? { Cookie: nseCookieJar } : {}),
            },
            signal: AbortSignal.timeout(8000),
          })
          const body = await r.text()
          res.writeHead(r.status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
          res.end(body)
        } catch (e) {
          res.writeHead(503, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: e.message }))
        }
      })
    },
  }
}

// ── Alpha Vantage batch fetcher ───────────────────────────────────────────────
// Fetches monthly commodity series + US economic indicators.
// Free tier = 25 req/day.  This batch = 9 requests.  Cached 24 h.
// WARNING: every server restart triggers a fresh batch on the next /av-api call.
const AV_COMMODITY_FNS = ['BRENT', 'NATURAL_GAS', 'COPPER', 'GOLD', 'SILVER']
const AV_ECON_FNS = [
  { fn: 'CPI',                interval: 'monthly',   extra: {} },
  { fn: 'REAL_GDP',           interval: 'quarterly', extra: {} },
  { fn: 'FEDERAL_FUNDS_RATE', interval: 'monthly',   extra: {} },
  { fn: 'TREASURY_YIELD',     interval: 'monthly',   extra: { maturity: '10year' } },
]
const AV_REQ_GAP         = 13_000   // 5 req/min free tier → ≥12s between calls; 9 reqs = ~2 min batch
const AV_BATCH_CACHE_TTL = 24 * 60 * 60 * 1000

let avBatchCache   = null
let avBatchCacheTs = 0
let avBatchPromise = null

function parseAVSeries(d, limit = 240) {
  if (d?.Information || d?.Note) {
    console.warn('[av] rate-limited:', (d.Information ?? d.Note).slice(0, 80))
    return []
  }
  const arr = d?.data ?? []
  return arr
    .filter(x => x.value && x.value !== '.' && !isNaN(parseFloat(x.value)))
    .slice(0, limit)
    .map(x => ({ month: x.date.slice(0, 7), value: parseFloat(x.value) }))
    .reverse()   // oldest → newest
}

async function runAVBatch(apiKey) {
  if (avBatchCache && Date.now() - avBatchCacheTs < AV_BATCH_CACHE_TTL) return avBatchCache
  if (avBatchPromise) return avBatchPromise

  avBatchPromise = (async () => {
    const AV_BASE = 'https://www.alphavantage.co/query'
    const sleep   = ms => new Promise(r => setTimeout(r, ms))
    const avGet   = async params => {
      const qs = new URLSearchParams({ ...params, apikey: apiKey })
      const r  = await fetch(`${AV_BASE}?${qs}`, { signal: AbortSignal.timeout(15_000) })
      return r.json()
    }

    // ── Commodity monthly series ──────────────────────────────────────────
    const commodities = {}
    for (const fn of AV_COMMODITY_FNS) {
      try {
        const d = await avGet({ function: fn, interval: 'monthly' })
        const s = parseAVSeries(d)
        if (s.length > 0) { commodities[fn] = s; console.log(`[av] ${fn}: ${s.length} months`) }
        else console.warn(`[av] ${fn}: no data —`, JSON.stringify(d).slice(0, 120))
      } catch (e) { console.warn(`[av] ${fn}:`, e.message) }
      await sleep(AV_REQ_GAP)
    }

    // ── Economic indicators ───────────────────────────────────────────────
    const indicators = {}
    for (const { fn, interval, extra } of AV_ECON_FNS) {
      try {
        const d = await avGet({ function: fn, interval, ...extra })
        const s = parseAVSeries(d, 240)
        if (s.length > 0) { indicators[fn] = s; console.log(`[av] ${fn}: ${s.length} periods`) }
        else console.warn(`[av] ${fn}: no data —`, JSON.stringify(d).slice(0, 120))
      } catch (e) { console.warn(`[av] ${fn}:`, e.message) }
      await sleep(AV_REQ_GAP)
    }

    const result = { commodities, indicators, fetchedAt: new Date().toISOString() }
    avBatchCache   = result
    avBatchCacheTs = Date.now()
    console.log(`[av] batch complete — ${Object.keys(commodities).length} commodities, ${Object.keys(indicators).length} indicators`)
    return result
  })().finally(() => { avBatchPromise = null })

  return avBatchPromise
}

function alphaVantagePlugin(env) {
  const apiKey     = env.ALPHAVANTAGE_API_KEY
  const configured = !!(apiKey && apiKey !== 'YOUR_AV_KEY_HERE')

  return {
    name: 'alphavantage-proxy',
    configureServer(server) {
      server.middlewares.use('/av-api', async (req, res) => {
        const hdrs = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }

        // /av-api/status — lightweight, never triggers a batch fetch
        if (req.url === '/status') {
          res.writeHead(200, hdrs)
          res.end(JSON.stringify({
            configured,
            cacheAge: avBatchCacheTs ? Math.floor((Date.now() - avBatchCacheTs) / 1000) : null,
            fetchedAt: avBatchCache?.fetchedAt ?? null,
            commodityCount: avBatchCache ? Object.keys(avBatchCache.commodities ?? {}).length : 0,
            indicatorCount: avBatchCache ? Object.keys(avBatchCache.indicators ?? {}).length : 0,
          }))
          return
        }

        if (!configured) {
          res.writeHead(503, hdrs)
          res.end(JSON.stringify({ error: 'not_configured' }))
          return
        }
        try {
          const data = await runAVBatch(apiKey)
          res.writeHead(200, hdrs)
          res.end(JSON.stringify(data))
        } catch (e) {
          console.warn('[av]', e.message)
          res.writeHead(503, hdrs)
          res.end(JSON.stringify({ error: e.message }))
        }
      })
    },
  }
}

// ── RSS news aggregator plugin ────────────────────────────────────────────────
const RSS_FEEDS = [
  { url: 'https://economictimes.indiatimes.com/markets/rss.cms',         source: 'Economic Times' },
  { url: 'https://www.livemint.com/rss/markets',                          source: 'Mint'           },
  { url: 'https://www.business-standard.com/rss/markets-106.rss',        source: 'Business Std'   },
  { url: 'https://www.moneycontrol.com/rss/marketreports.xml',           source: 'MoneyControl'   },
]

// Keyword → newsTag mapping for commodity/topic filtering
const TAG_RULES = [
  { tag: 'crude',     kw: ['crude', 'brent', 'opec', 'petroleum', 'wti', 'oil price'] },
  { tag: 'gold',      kw: ['gold', 'yellow metal', 'mcx gold', 'bullion'] },
  { tag: 'silver',    kw: ['silver', 'mcx silver'] },
  { tag: 'natgas',    kw: ['natural gas', 'lng', 'cng', 'henry hub', 'gail'] },
  { tag: 'copper',    kw: ['copper', 'lme copper'] },
  { tag: 'aluminium', kw: ['aluminium', 'aluminum', 'nalco'] },
  { tag: 'Nifty',     kw: ['nifty', 'nse', 'sensex', 'bse', 'equity', 'stock market', 'dalal'] },
  { tag: 'FII',       kw: ['fii', 'fpi', 'foreign investor', 'dii', 'foreign portfolio'] },
  { tag: 'Macro',     kw: ['inflation', 'cpi', 'rbi', 'repo rate', 'gdp', 'fiscal deficit'] },
  { tag: 'Rupee',     kw: ['rupee', 'usd/inr', 'usdinr', 'forex', 'dollar'] },
  { tag: 'RBI',       kw: ['rbi', 'reserve bank', 'monetary policy', 'mpc'] },
]

function tagNews(title, desc) {
  const txt = (title + ' ' + desc).toLowerCase()
  const tags = TAG_RULES.filter(r => r.kw.some(k => txt.includes(k))).map(r => r.tag)
  return tags.length ? tags : ['Markets']
}

function parseRSS(xml, sourceName) {
  const items = []
  const blocks = xml.match(/<item[\s>]([\s\S]*?)<\/item>/g) ?? []
  const get = (block, tag) => {
    const m = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([^<]*)<\\/${tag}>`))
    return m ? (m[1] ?? m[2] ?? '').trim() : ''
  }
  for (const b of blocks.slice(0, 15)) {
    const title = get(b, 'title').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'")
    const link  = get(b, 'link') || get(b, 'guid')
    const date  = get(b, 'pubDate') || get(b, 'dc:date')
    const desc  = get(b, 'description').replace(/<[^>]+>/g, '').slice(0, 200)
    if (!title) continue
    const tags  = tagNews(title, desc)
    const ago   = date ? relTime(new Date(date)) : ''
    items.push({ title, link, date, desc, source: sourceName, tags, ago })
  }
  return items
}

function relTime(d) {
  if (isNaN(d)) return ''
  const diff = Math.floor((Date.now() - d) / 60000)
  if (diff < 1)   return 'just now'
  if (diff < 60)  return `${diff}m ago`
  if (diff < 1440)return `${Math.floor(diff / 60)}h ago`
  return `${Math.floor(diff / 1440)}d ago`
}

let rssCache = null
let rssCacheTs = 0

async function fetchAllRSS() {
  if (rssCache && Date.now() - rssCacheTs < 5 * 60 * 1000) return rssCache

  const results = await Promise.allSettled(
    RSS_FEEDS.map(({ url, source }) =>
      fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'application/rss+xml, application/xml, text/xml, */*' }, signal: AbortSignal.timeout(8000) })
        .then(r => r.text())
        .then(xml => parseRSS(xml, source))
        .catch(() => [])
    )
  )

  const all = results.flatMap(r => r.status === 'fulfilled' ? r.value : [])
  all.sort((a, b) => new Date(b.date) - new Date(a.date))
  rssCache = all
  rssCacheTs = Date.now()
  return all
}

function rssPlugin() {
  return {
    name: 'rss-aggregator',
    configureServer(server) {
      server.middlewares.use('/news-api', async (req, res) => {
        try {
          const items = await fetchAllRSS()
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
          res.end(JSON.stringify(items))
        } catch (e) {
          res.writeHead(503, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: e.message }))
        }
      })
    },
  }
}

// ── Groww Instruments plugin ──────────────────────────────────────────────────
// Public CSV — no auth required. Cached daily server-side.
// Endpoints:
//   GET /instruments-api/search?q=RELIANCE&limit=20
//   GET /instruments-api/lookup?exchange=NSE&symbol=RELIANCE
//   GET /instruments-api/by-isin?isin=INE002A01018

const INSTRUMENTS_CSV_URL = 'https://growwapi-assets.groww.in/instruments/instrument.csv'
let instrumentsData     = null
let instrumentsEtag     = ''   // track Last-Modified so we only re-download when Groww pushes a new file
let instrumentsPromise  = null // prevent concurrent fetches

function parseCSV(text) {
  const lines = text.split('\n').filter(Boolean)
  const headers = lines[0].split(',')
  return lines.slice(1).map(line => {
    const vals = line.split(',')
    const obj = {}
    headers.forEach((h, i) => { obj[h.trim()] = (vals[i] ?? '').trim() })
    return obj
  }).filter(r => r.exchange && r.trading_symbol)
}

async function fetchInstruments() {
  if (instrumentsPromise) return instrumentsPromise
  instrumentsPromise = (async () => {
    const headers = { 'User-Agent': UA }
    if (instrumentsEtag) headers['If-None-Match'] = instrumentsEtag

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 90_000)  // 90s — file is ~12MB
    try {
      const r = await fetch(INSTRUMENTS_CSV_URL, { headers, signal: controller.signal })
      if (r.status === 304) { console.log('[instruments] up to date'); return instrumentsData }
      if (!r.ok) throw new Error(`instruments CSV ${r.status}`)
      instrumentsEtag = r.headers.get('etag') ?? r.headers.get('last-modified') ?? ''
      const text = await r.text()
      const all = parseCSV(text)
      // Keep only CASH equities + indices — drops F&O (options/futures) which are 90% of the file
      instrumentsData = all.filter(r => r.segment === 'CASH' || r.segment === 'CD')
      console.log(`[instruments] loaded ${instrumentsData.length} CASH instruments from ${all.length} total`)
      return instrumentsData
    } finally {
      clearTimeout(timer)
    }
  })().finally(() => { instrumentsPromise = null })
  return instrumentsPromise
}

async function getInstruments() {
  if (instrumentsData) {
    // Refresh in the background every 6 hours; don't block the request
    fetchInstruments().catch(() => {})
    return instrumentsData
  }
  return fetchInstruments()
}

function instrumentsPlugin() {
  return {
    name: 'groww-instruments',
    configureServer(server) {
      // Pre-warm on startup so first search is instant
      fetchInstruments().catch(e => console.warn('[instruments] pre-warm failed:', e.message))

      server.middlewares.use('/instruments-api', async (req, res) => {
        const url   = new URL(req.url, 'http://localhost')
        const route = url.pathname.replace(/^\//, '')

        try {
          const all = await getInstruments()
          let result

          if (route === 'search' || route === '') {
            const q     = (url.searchParams.get('q') ?? '').toUpperCase()
            const seg   = url.searchParams.get('segment') ?? ''    // CASH | FNO
            const exch  = url.searchParams.get('exchange') ?? ''   // NSE | BSE
            const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '30'), 100)

            if (!q) { result = []; }
            else {
              result = all.filter(r => {
                if (seg  && r.segment  !== seg)  return false
                if (exch && r.exchange !== exch) return false
                return r.trading_symbol.includes(q) || r.name.toUpperCase().includes(q) || r.isin === q
              }).slice(0, limit)
            }
          } else if (route === 'lookup') {
            const exchange = (url.searchParams.get('exchange') ?? '').toUpperCase()
            const symbol   = (url.searchParams.get('symbol')   ?? '').toUpperCase()
            result = all.find(r => r.exchange === exchange && r.trading_symbol === symbol) ?? null
          } else if (route === 'by-isin') {
            const isin = (url.searchParams.get('isin') ?? '').toUpperCase()
            result = all.filter(r => r.isin === isin && r.segment === 'CASH')
          } else {
            res.writeHead(404); res.end('{}'); return
          }

          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
          res.end(JSON.stringify(result))
        } catch (e) {
          console.error('[instruments]', e.message)
          res.writeHead(503, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: e.message }))
        }
      })
    },
  }
}

// ── Yahoo Finance fundamentals plugin (server-side crumb + quoteSummary) ─────
// yfinance Python lib uses this same flow: cookie → crumb → v10/quoteSummary
let yfCrumb        = null
let yfCookies      = ''
let yfCrumbExpiry  = 0
let yfCrumbPromise = null

function isValidCrumb(s) {
  return s && s.length > 2 && s !== 'null' && !s.startsWith('<') && !s.startsWith('{') && !s.startsWith('<!') && !/\s/.test(s)
}

async function refreshYFCrumb() {
  const QUERY_HOSTS = [
    'https://query1.finance.yahoo.com',
    'https://query2.finance.yahoo.com',
  ]

  // Attempt 1: crumb endpoint directly — works in many regions without cookies
  for (const host of QUERY_HOSTS) {
    try {
      const r = await fetch(`${host}/v1/test/getcrumb`, {
        headers: { 'User-Agent': UA, 'Accept': '*/*' },
        signal: AbortSignal.timeout(8_000),
      })
      const crumb = (await r.text()).trim()
      if (isValidCrumb(crumb)) {
        yfCrumb = crumb; yfCookies = ''
        yfCrumbExpiry = Date.now() + 25 * 60 * 1000
        console.log('[yf-fund] crumb obtained (direct):', crumb)
        return { crumb: yfCrumb, cookies: yfCookies }
      }
    } catch (e) { console.warn(`[yf-fund] direct crumb ${host} failed:`, e.message) }
  }

  // Attempt 2: full cookie flow via finance.yahoo.com
  try {
    const r1 = await fetch('https://finance.yahoo.com/', {
      headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
      signal: AbortSignal.timeout(12_000),
    })
    const raw = r1.headers.getSetCookie?.() ?? []
    const jar = {}
    for (const c of raw) {
      const [kv] = c.split(';')
      const eq   = kv.indexOf('=')
      if (eq > 0) jar[kv.slice(0, eq).trim()] = kv.slice(eq + 1)
    }
    yfCookies = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ')

    for (const host of QUERY_HOSTS) {
      try {
        const r2 = await fetch(`${host}/v1/test/getcrumb`, {
          headers: { 'User-Agent': UA, 'Cookie': yfCookies },
          signal: AbortSignal.timeout(8_000),
        })
        const crumb = (await r2.text()).trim()
        if (isValidCrumb(crumb)) {
          yfCrumb = crumb
          yfCrumbExpiry = Date.now() + 25 * 60 * 1000
          console.log('[yf-fund] crumb obtained (cookie flow):', crumb)
          return { crumb: yfCrumb, cookies: yfCookies }
        }
      } catch (e) { console.warn(`[yf-fund] cookie crumb ${host} failed:`, e.message) }
    }
  } catch (e) { console.warn('[yf-fund] finance.yahoo.com cookie fetch failed:', e.message) }

  throw new Error('YF crumb unavailable after all attempts')
}

async function getYFCrumb() {
  if (yfCrumb && Date.now() < yfCrumbExpiry) return { crumb: yfCrumb, cookies: yfCookies }
  if (yfCrumbPromise) return yfCrumbPromise
  yfCrumbPromise = refreshYFCrumb().finally(() => { yfCrumbPromise = null })
  return yfCrumbPromise
}

function yfFundamentalsPlugin() {
  return {
    name: 'yf-fundamentals',
    configureServer(server) {
      // Pre-warm crumb on startup
      getYFCrumb().catch(e => console.warn('[yf-fund] startup crumb failed:', e.message))

      server.middlewares.use('/yf-fund', async (req, res) => {
        const url    = new URL(req.url, 'http://localhost')
        const symbol = url.searchParams.get('symbol')
        if (!symbol) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'missing symbol' }))
          return
        }

        try {
          const { crumb, cookies } = await getYFCrumb()
          const modules = 'defaultKeyStatistics,summaryDetail,assetProfile,financialData'
          const yfUrl   = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}&crumb=${encodeURIComponent(crumb)}`

          const r    = await fetch(yfUrl, {
            headers: { 'User-Agent': UA, 'Cookie': cookies },
            signal: AbortSignal.timeout(10_000),
          })
          const data = await r.json()

          // If crumb expired, reset and let next request retry
          if (data?.quoteSummary?.error?.code === 'Unauthorized') {
            yfCrumb = null; yfCrumbExpiry = 0
            throw new Error('YF crumb expired — will refresh on next request')
          }

          res.writeHead(r.ok ? 200 : r.status, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          })
          res.end(JSON.stringify(data))
        } catch (e) {
          console.warn('[yf-fund]', symbol, e.message)
          if (e.message.includes('crumb')) { yfCrumb = null; yfCrumbExpiry = 0 }
          res.writeHead(503, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: e.message }))
        }
      })
    },
  }
}

// ── Python yfinance fundamentals plugin ───────────────────────────────────────
// Calls fetch_fundamentals.py which uses yfinance (handles Yahoo auth properly)
// Results cached 15 min server-side to avoid repeated Python spawns

const pyFundCache   = new Map()   // symbol → { data, ts }
const PY_CACHE_TTL  = 15 * 60 * 1000
const SCRIPT_PATH   = resolve(process.cwd(), 'fetch_fundamentals.py')

function spawnPython(symbols) {
  return new Promise((resolve, reject) => {
    // Try 'python' then 'python3'
    const tryCmd = (cmds) => {
      if (!cmds.length) { reject(new Error('python not found')); return }
      const [cmd, ...rest] = cmds
      execFile(cmd, ['fetch_fundamentals.py', ...symbols], {
        cwd: process.cwd(), timeout: 30_000, maxBuffer: 512 * 1024,
      }, (err, stdout, stderr) => {
        if (err && (err.code === 'ENOENT' || err.code === 127)) { tryCmd(rest); return }
        if (err) { reject(new Error(stderr || err.message)); return }
        try { resolve(JSON.parse(stdout.trim())) }
        catch { reject(new Error('Python output is not valid JSON: ' + stdout.slice(0, 200))) }
      })
    }
    tryCmd(['python', 'python3', 'py'])
  })
}

function pyFundamentalsPlugin() {
  return {
    name: 'py-fundamentals',
    configureServer(server) {
      server.middlewares.use('/py-fund', async (req, res) => {
        const url     = new URL(req.url, 'http://localhost')
        const symbol  = url.searchParams.get('symbol')
        const symbols = symbol
          ? [symbol]
          : (url.searchParams.get('symbols') ?? '').split(',').filter(Boolean)

        if (!symbols.length) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'missing symbol(s)' }))
          return
        }

        // Check cache for all symbols
        const now   = Date.now()
        const fresh = symbols.filter(s => {
          const c = pyFundCache.get(s)
          return c && now - c.ts < PY_CACHE_TTL
        })
        const stale = symbols.filter(s => !fresh.includes(s))

        try {
          if (stale.length) {
            const fetched = await spawnPython(stale)
            for (const sym of stale) {
              if (fetched[sym]) pyFundCache.set(sym, { data: fetched[sym], ts: now })
            }
          }

          const result = {}
          for (const s of symbols) {
            const c = pyFundCache.get(s)
            if (c) result[s] = c.data
          }

          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
          res.end(JSON.stringify(result))
        } catch (e) {
          console.warn('[py-fund]', e.message)
          res.writeHead(503, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: e.message }))
        }
      })
    },
  }
}

// ── GoldAPI.io plugin ─────────────────────────────────────────────────────────
// GET /gold-api/quote  →  { price_gram_24k, price_gram_22k, ch, chp, timestamp }
// price_gram_24k × 10 = INR per 10g of 24k gold (exact India market price)
// Free tier: ~100 req/month. Cached 10 min.

let goldApiCache = null, goldApiCacheTs = 0
const GOLD_API_TTL = 10 * 60 * 1000

function goldApiPlugin(env) {
  const KEY = env.GOLDAPI_KEY ?? ''
  const configured = !!(KEY && KEY !== 'YOUR_GOLDAPI_KEY')
  const hdrs = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }

  return {
    name: 'gold-api',
    configureServer(server) {
      server.middlewares.use('/gold-api', async (req, res) => {
        if (!configured) {
          res.writeHead(503, hdrs)
          res.end(JSON.stringify({ error: 'not_configured' }))
          return
        }
        try {
          if (goldApiCache && Date.now() - goldApiCacheTs < GOLD_API_TTL) {
            res.writeHead(200, hdrs); res.end(JSON.stringify(goldApiCache)); return
          }
          const r = await fetch('https://www.goldapi.io/api/XAU/INR', {
            headers: { 'x-access-token': KEY, 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(10_000),
          })
          const d = await r.json()
          if (d.error) throw new Error(d.error)
          goldApiCache   = d
          goldApiCacheTs = Date.now()
          console.log(`[goldapi] XAU/INR — ₹${d.price_gram_24k}/g  chg: ${d.chp}%`)
          res.writeHead(200, hdrs); res.end(JSON.stringify(d))
        } catch (e) {
          console.warn('[goldapi]', e.message)
          res.writeHead(500, hdrs); res.end(JSON.stringify({ error: e.message }))
        }
      })
    },
  }
}

// ── Commodity Price API plugin ────────────────────────────────────────────────
// Proxies https://api.commoditypriceapi.com/v2 — key never leaves the server.
// Endpoints:
//   GET /cpa-api/latest   — current prices for all 5 commodities (1 request, 10-min cache)
//   GET /cpa-api/history  — 2-year monthly history, all 5 symbols (2 requests, 24-h cache)

const CPA_BASE    = 'https://api.commoditypriceapi.com/v2'
const CPA_SYMBOLS = 'BRENTOIL-SPOT,XAU,XAG,NG-FUT,HG-SPOT'

let cpaLatestCache   = null, cpaLatestCacheTs   = 0
let cpaHistoryCache  = null, cpaHistoryCacheTs  = 0
const CPA_LATEST_TTL  = 10 * 60 * 1000
const CPA_HISTORY_TTL = 24 * 60 * 60 * 1000

function cpaPricePlugin(env) {
  const CPA_KEY  = env.COMMODITY_PRICE_API_KEY ?? ''
  const configured = !!(CPA_KEY && CPA_KEY !== 'YOUR_CPA_KEY')
  const hdrs = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }

  async function cpaGet(path) {
    const r = await fetch(`${CPA_BASE}${path}`, {
      headers: { 'x-api-key': CPA_KEY, 'Accept': 'application/json' },
      signal: AbortSignal.timeout(12_000),
    })
    const d = await r.json()
    if (!r.ok || d.success === false) throw new Error(d.message ?? d.error ?? `CPA HTTP ${r.status}`)
    return d
  }

  return {
    name: 'cpa-price',
    configureServer(server) {
      server.middlewares.use('/cpa-api', async (req, res) => {
        if (!configured) {
          res.writeHead(503, hdrs)
          res.end(JSON.stringify({ error: 'not_configured' }))
          return
        }

        const route = (req.url ?? '/').replace(/^\//, '').split('?')[0] || 'latest'
        try {
          // ── /cpa-api/latest ───────────────────────────────────────────
          if (route === 'latest' || route === '') {
            if (cpaLatestCache && Date.now() - cpaLatestCacheTs < CPA_LATEST_TTL) {
              res.writeHead(200, hdrs); res.end(JSON.stringify(cpaLatestCache)); return
            }
            const d = await cpaGet(`/rates/latest?symbols=${CPA_SYMBOLS}`)
            cpaLatestCache   = d
            cpaLatestCacheTs = Date.now()
            console.log('[cpa] latest fetched:', Object.keys(d.rates ?? {}).join(', '))
            res.writeHead(200, hdrs); res.end(JSON.stringify(d)); return
          }

          // ── /cpa-api/history ──────────────────────────────────────────
          if (route === 'history') {
            if (cpaHistoryCache && Date.now() - cpaHistoryCacheTs < CPA_HISTORY_TTL) {
              res.writeHead(200, hdrs); res.end(JSON.stringify(cpaHistoryCache)); return
            }
            const fmt  = d => d.toISOString().slice(0, 10)
            const now  = new Date()
            const end1 = fmt(now)
            const mid  = new Date(now); mid.setFullYear(mid.getFullYear() - 1)
            const end2 = fmt(mid)
            const start1 = end2
            const start2 = fmt(new Date(now.setFullYear(now.getFullYear() - 1)))
            const [p1, p2] = await Promise.all([
              cpaGet(`/rates/time-series?symbols=${CPA_SYMBOLS}&startDate=${start1}&endDate=${end1}`),
              cpaGet(`/rates/time-series?symbols=${CPA_SYMBOLS}&startDate=${start2}&endDate=${end2}`),
            ])
            const result = { period1: p1, period2: p2, fetchedAt: new Date().toISOString() }
            cpaHistoryCache   = result
            cpaHistoryCacheTs = Date.now()
            console.log('[cpa] history fetched — 2 years, 5 symbols')
            res.writeHead(200, hdrs); res.end(JSON.stringify(result)); return
          }

          res.writeHead(404, hdrs); res.end(JSON.stringify({ error: 'unknown route' }))
        } catch (e) {
          console.warn('[cpa]', e.message)
          res.writeHead(500, hdrs); res.end(JSON.stringify({ error: e.message }))
        }
      })
    },
  }
}

// ── Zerodha Kite Connect plugin ───────────────────────────────────────────────
// Proxies Kite Connect v3 API server-side (API key stays secret).
// Endpoints:
//   GET /kite/status   — { configured, tokensLoaded }
//   GET /kite/quotes   — all market quotes (NSE stocks, indices, MCX commodities)
//   GET /kite/history?key=nifty&interval=day&from=YYYY-MM-DD&to=YYYY-MM-DD

const KITE_BASE = 'https://api.kite.trade'

// NSE/BSE equity symbols (static — these don't change)
const KITE_EQUITY = {
  nifty:     'NSE:NIFTY 50',
  sensex:    'BSE:SENSEX',
  niftyIT:   'NSE:NIFTY IT',
  niftyBank: 'NSE:NIFTY BANK',
  niftyPhrm: 'NSE:NIFTY PHARMA',
  niftyAuto: 'NSE:NIFTY AUTO',
  niftyFMCG: 'NSE:NIFTY FMCG',
  niftyRlty: 'NSE:NIFTY REALTY',
  niftyMtl:  'NSE:NIFTY METAL',
  reliance:  'NSE:RELIANCE',
  tcs:       'NSE:TCS',
  hdfc:      'NSE:HDFCBANK',
  infy:      'NSE:INFY',
  icici:     'NSE:ICICIBANK',
  adani:     'NSE:ADANIENT',
  lt:        'NSE:LT',
  wipro:     'NSE:WIPRO',
}

// MCX futures — base tradingsymbol prefix to find the nearest active contract
const MCX_BASES = {
  crudeMCX:  'CRUDEOIL',
  goldMCX:   'GOLD',
  silverMCX: 'SILVERM',   // Silver Mini
  natgasMCX: 'NATURALGAS',
  copperMCX: 'COPPER',
}

function kitePlugin(env) {
  const apiKey      = env.KITE_API_KEY
  const accessToken = env.KITE_ACCESS_TOKEN
  const configured  = !!(
    apiKey && apiKey !== 'YOUR_KITE_API_KEY' &&
    accessToken && accessToken !== 'YOUR_KITE_ACCESS_TOKEN'
  )

  const kiteHdrs = () => ({
    'Authorization': `token ${apiKey}:${accessToken}`,
    'X-Kite-Version': '3',
  })

  let mcxContracts = {}   // key → { token, symbol, expiry }
  let mcxLoadedAt  = 0
  const MCX_TTL    = 4 * 60 * 60 * 1000

  const tokenMap = {}     // internal key → instrument_token (for /kite/history)

  // Parse a row from Kite instruments CSV — fields: token,exch_token,symbol,name,price,expiry,strike,tick,lot,type,segment,exchange
  function parseRow(row) {
    const p = row.split(',')
    return { token: parseInt(p[0]), symbol: p[2]?.trim(), expiry: p[5]?.trim(), type: p[9]?.trim() }
  }

  async function loadMCXContracts() {
    if (mcxLoadedAt && Date.now() - mcxLoadedAt < MCX_TTL) return
    try {
      const r   = await fetch(`${KITE_BASE}/instruments/MCX`, { headers: kiteHdrs(), signal: AbortSignal.timeout(30_000) })
      if (!r.ok) throw new Error(`MCX instruments ${r.status}`)
      const now  = new Date()
      const rows = (await r.text()).split('\n').slice(1).filter(Boolean)

      for (const [key, base] of Object.entries(MCX_BASES)) {
        const matches = rows
          .map(parseRow)
          .filter(r => r.symbol?.startsWith(base) && r.type === 'FUT' && r.expiry && new Date(r.expiry) >= now)
          .sort((a, b) => new Date(a.expiry) - new Date(b.expiry))

        if (matches.length > 0) {
          mcxContracts[key] = matches[0]
          tokenMap[key]     = matches[0].token
          console.log(`[kite] MCX ${key}: ${matches[0].symbol} (exp ${matches[0].expiry})`)
        }
      }
      mcxLoadedAt = Date.now()
    } catch (e) {
      console.warn('[kite] MCX contract load failed:', e.message)
    }
  }

  async function loadEquityTokens() {
    try {
      // NSE instruments (for stocks + indices)
      const nr   = await fetch(`${KITE_BASE}/instruments/NSE`, { headers: kiteHdrs(), signal: AbortSignal.timeout(30_000) })
      if (nr.ok) {
        const rows = (await nr.text()).split('\n').slice(1).filter(Boolean)
        for (const [key, sym] of Object.entries(KITE_EQUITY)) {
          if (!sym.startsWith('NSE:')) continue
          const nseSym = sym.slice(4)
          const row    = rows.find(r => r.split(',')[2]?.trim() === nseSym)
          if (row) tokenMap[key] = parseInt(row.split(',')[0])
        }
      }
      // BSE instruments (for Sensex)
      const br   = await fetch(`${KITE_BASE}/instruments/BSE`, { headers: kiteHdrs(), signal: AbortSignal.timeout(30_000) })
      if (br.ok) {
        const rows  = (await br.text()).split('\n').slice(1).filter(Boolean)
        const match = rows.find(r => r.split(',')[2]?.trim() === 'SENSEX')
        if (match) tokenMap['sensex'] = parseInt(match.split(',')[0])
      }
      console.log(`[kite] equity tokens loaded (${Object.keys(tokenMap).length} total)`)
    } catch (e) {
      console.warn('[kite] equity token load failed:', e.message)
    }
  }

  function normalizeQuote(raw) {
    if (!raw) return null
    const price     = raw.last_price
    const prevClose = raw.ohlc?.close ?? price
    const change    = raw.change ?? (price - prevClose)
    const changePct = prevClose ? +((change / prevClose) * 100).toFixed(2) : 0
    return { price, prevClose, change: +change.toFixed(2), changePct, currency: 'INR' }
  }

  return {
    name: 'kite-proxy',
    configureServer(server) {
      if (configured) {
        Promise.all([loadMCXContracts(), loadEquityTokens()]).catch(() => {})
      }

      server.middlewares.use('/kite', async (req, res) => {
        const url   = new URL(req.url, 'http://localhost')
        const route = url.pathname.replace(/^\//, '')
        const hdrs  = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        const send  = (status, body) => { res.writeHead(status, hdrs); res.end(JSON.stringify(body)) }

        // ── /kite/status ──────────────────────────────────────────────
        if (route === 'status') {
          send(200, { configured, tokensLoaded: Object.keys(tokenMap).length })
          return
        }

        if (!configured) { send(503, { error: 'kite_not_configured' }); return }

        // ── /kite/quotes ──────────────────────────────────────────────
        if (route === 'quotes') {
          await loadMCXContracts()  // refresh if stale
          const equitySyms = Object.values(KITE_EQUITY)
          const mcxSyms    = Object.entries(mcxContracts).map(([, t]) => `MCX:${t.symbol}`)
          const qs         = [...equitySyms, ...mcxSyms].map(s => `i=${encodeURIComponent(s)}`).join('&')
          try {
            const r    = await fetch(`${KITE_BASE}/quote?${qs}`, { headers: kiteHdrs(), signal: AbortSignal.timeout(12_000) })
            if (!r.ok) throw new Error(`Kite /quote HTTP ${r.status}`)
            const data = await r.json()
            if (data.status !== 'success') throw new Error(data.message ?? 'unknown error')

            const result = {}
            for (const [key, sym] of Object.entries(KITE_EQUITY)) {
              const q = data.data?.[sym]
              if (q) result[key] = normalizeQuote(q)
            }
            for (const [key, info] of Object.entries(mcxContracts)) {
              const q = data.data?.[`MCX:${info.symbol}`]
              if (q) result[key] = normalizeQuote(q)
            }
            send(200, result)
          } catch (e) {
            console.warn('[kite] /quotes error:', e.message)
            send(503, { error: e.message })
          }
          return
        }

        // ── /kite/history ─────────────────────────────────────────────
        if (route === 'history') {
          const key      = url.searchParams.get('key')
          const interval = url.searchParams.get('interval') ?? 'day'
          const from     = url.searchParams.get('from')
          const to       = url.searchParams.get('to')
          if (!key || !from || !to) { send(400, { error: 'missing key/from/to' }); return }

          const token = tokenMap[key]
          if (!token) { send(404, { error: `no token for: ${key}` }); return }

          try {
            const qs  = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
            const r   = await fetch(`${KITE_BASE}/instruments/historical/${token}/${interval}?${qs}`, {
              headers: kiteHdrs(), signal: AbortSignal.timeout(20_000),
            })
            if (!r.ok) throw new Error(`Kite /historical HTTP ${r.status}`)
            const data = await r.json()

            const candles = (data.data?.candles ?? []).map(([ts, o, h, l, c, v]) => {
              const d     = new Date(ts)
              const month = d.toISOString().slice(0, 7)
              return { month, time: month.slice(2), open: +o, high: +h, low: +l, close: +c, value: +c, volume: v ?? null }
            })
            send(200, candles)
          } catch (e) {
            console.warn('[kite] /history error:', e.message)
            send(503, { error: e.message })
          }
          return
        }

        send(404, {})
      })
    },
  }
}

// ── Vite config ───────────────────────────────────────────────────────────────
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), growwPlugin(env), alphaVantagePlugin(env), cpaPricePlugin(env), goldApiPlugin(env), nsePlugin(), rssPlugin(), instrumentsPlugin(), yfFundamentalsPlugin(), pyFundamentalsPlugin(), kitePlugin(env)],
    server: {
      proxy: {
        '/yf': {
          target: 'https://query1.finance.yahoo.com',
          changeOrigin: true,
          rewrite: path => path.replace(/^\/yf/, ''),
          headers: { 'User-Agent': UA },
        },
      },
    },
  }
})

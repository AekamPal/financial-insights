import { useState, useCallback } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, RefreshCw, WifiOff } from 'lucide-react';
import { getSeriesForSpan, ALL_SPANS } from './utils/shortTermData';
import { useLiveData } from './hooks/useLiveData';
import { useAVMacro } from './hooks/useAVMacro';
import { useCPAData } from './hooks/useCPAData';
import { useIndexHistory } from './hooks/useIndexHistory';
import { useCommodityHistory } from './hooks/useCommodityHistory';
import { useFundamentals } from './hooks/useFundamentals';
import { useGrowwPortfolio } from './hooks/useGrowwPortfolio';
import { useNewsRss } from './hooks/useNewsRss';
import { useRegressionHistory } from './hooks/useRegressionHistory';
import PortfolioPanel from './components/PortfolioPanel';
import Navbar from './components/Navbar';
import ParallaxHero from './components/ParallaxHero';
import MetricCard from './components/MetricCard';
import IndexChart from './components/IndexChart';
import CommodityPanel from './components/CommodityPanel';
import SectorGrid from './components/SectorGrid';
import MacroCharts from './components/MacroCharts';
import ImpactAnalyzer from './components/ImpactAnalyzer';
import GlobalMacroPanel from './components/GlobalMacroPanel';
import TopMovers from './components/TopMovers';
import SectionHeader from './components/SectionHeader';
import ChartMini from './components/ChartMini';
import GdpChart from './components/GdpChart';
import NewsSection from './components/NewsSection';
import HistoryModal from './components/HistoryModal';
import InstrumentSearch from './components/InstrumentSearch';

import {
  macroMetrics as mockMacroMetrics, nifty50, sensex, commodities as mockCommodities, sectors as mockSectors,
  topMovers as mockMovers, inflation, repoRate, usdinr, fiiFlow, gold,
} from './data/financialData';

// ── DEV TOGGLE: empty out mock/Yahoo fallbacks to verify AV-only data ─────────
const DISABLE_MOCK_DATA = false;
// ─────────────────────────────────────────────────────────────────────────────

const TABS = ['Overview', 'Commodities', 'Macro', 'Insights'];

export default function App() {
  const [activeTab, setActiveTab] = useState('Overview');
  const [tick, setTick] = useState(0);
  const [modal, setModal] = useState(null);
  const { quotes, derived, source: liveSource, avStatus, loading: liveLoading, error: liveError, lastUpdated, refresh: refreshLive } = useLiveData();
  const { commodities: avCommodities, indicators: avIndicators, fetchedAt: avFetchedAt } = useAVMacro();
  const { history: cpaHistory, configured: cpaConfigured } = useCPAData();
  const { niftyHistory, sensexHistory } = useIndexHistory();
  const commodityHistory = useCommodityHistory(DISABLE_MOCK_DATA);
  const { data: fundamentals } = useFundamentals();
  const { data: portfolio, loading: portLoading, error: portError, refresh: refreshPortfolio } = useGrowwPortfolio();
  const { items: rssNews, loading: rssLoading, byTag: newsByTag, byCommodity: newsByCommodityRss } = useNewsRss();
  const regressionHistory = useRegressionHistory();

  const refresh = useCallback(() => {
    setTick(t => t + 1);
    refreshLive();
    refreshPortfolio();
  }, [refreshLive, refreshPortfolio]);

  // Merge live data over mock data
  const macroMetrics = derived ? buildMacroMetrics(derived, DISABLE_MOCK_DATA ? [] : mockMacroMetrics) : (DISABLE_MOCK_DATA ? [] : mockMacroMetrics);
  const topMovers    = (derived?.liveMovers?.length > 0) ? derived.liveMovers : (DISABLE_MOCK_DATA ? [] : mockMovers);
  const sectors      = (derived?.liveSectors?.length > 0) ? derived.liveSectors : (DISABLE_MOCK_DATA ? [] : mockSectors);
  // History priority: CPA (official, purpose-built) → AV monthly → Yahoo
  const mergedCommodityHistory = DISABLE_MOCK_DATA
    ? { ...avCommodities, ...cpaHistory }
    : { ...commodityHistory, ...avCommodities, ...cpaHistory };

  const commodities  = derived ? buildCommodities(derived, DISABLE_MOCK_DATA ? [] : mockCommodities, mergedCommodityHistory) : (DISABLE_MOCK_DATA ? [] : mockCommodities);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-deep)' }}>
      <HistoryModal item={modal} onClose={() => setModal(null)} />
      <Navbar onRefresh={refresh} quotes={quotes} />
      <ParallaxHero
        onInsightsClick={() => { setActiveTab('Insights'); window.scrollTo({ top: window.innerHeight, behavior: 'smooth' }); }}
        quotes={quotes}
      />

      {/* Tab bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4, padding: '0 32px 0',
        borderBottom: '1px solid rgba(99,160,255,0.07)',
        position: 'sticky', top: 56, zIndex: 90,
        background: 'rgba(6,13,31,0.88)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
      }}>
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '12px 18px',
            fontSize: 13, fontWeight: 500, borderRadius: 0, border: 'none', cursor: 'pointer',
            background: 'transparent',
            color: activeTab === tab ? 'var(--accent-blue)' : 'var(--text-secondary)',
            borderBottom: activeTab === tab ? '2px solid var(--accent-blue)' : '2px solid transparent',
            transition: 'all 0.2s', fontFamily: 'var(--font)',
          }}>{tab}</button>
        ))}
        {/* Live data status */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {liveLoading && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', display: 'inline-block', animation: 'pulse 1s infinite' }} />
              Fetching live data…
            </span>
          )}
          {!liveLoading && liveSource === 'kite' && (
            <span style={{ fontSize: 11, color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span className="dot-pulse" style={{ width: 6, height: 6 }} />
              Kite Live · {lastUpdated?.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {!liveLoading && liveSource === 'yahoo' && (
            <span style={{ fontSize: 11, color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-green)', display: 'inline-block' }} />
              Yahoo{avStatus?.fetchedAt ? ' + AV' : ''} Live · {lastUpdated?.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {!liveLoading && liveError && (
            <span style={{ fontSize: 11, color: 'var(--accent-rose)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <WifiOff size={11} color="var(--accent-rose)" />
              No live data
            </span>
          )}
          {/* CPA status dot */}
          {cpaConfigured && (
            <span title={`Commodity Price API: ${Object.keys(cpaHistory).length} commodity series loaded`}
              style={{ fontSize: 10, color: '#4ade80', display: 'flex', alignItems: 'center', gap: 4, cursor: 'default' }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
              CPA
            </span>
          )}
          {/* AV loading indicator — shows while background batch is in flight */}
          {avStatus?.configured && !avFetchedAt && !liveLoading && (
            <span title="Alpha Vantage: fetching commodity &amp; macro data (first load ~30 s)…"
              style={{ fontSize: 10, color: 'rgba(99,160,255,0.35)', display: 'flex', alignItems: 'center', gap: 4, cursor: 'default' }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#6366f1', display: 'inline-block', opacity: 0.5, animation: 'pulse 1.5s infinite' }} />
              AV…
            </span>
          )}
          {/* AV loaded — hover for detail */}
          {avFetchedAt && (
            <span title={`Alpha Vantage: ${Object.keys(avCommodities).length} commodity series · ${Object.keys(avIndicators).length} indicators · fetched ${new Date(avFetchedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} · cached 24 h`}
              style={{ fontSize: 10, color: '#818cf8', display: 'flex', alignItems: 'center', gap: 4, cursor: 'default' }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#6366f1', display: 'inline-block' }} />
              AV
            </span>
          )}
          <button onClick={refresh} title="Refresh" style={{
            width: 26, height: 26, borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.04)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <RefreshCw size={11} color="var(--text-muted)" />
          </button>
        </div>
      </div>

      <main style={{ padding: '32px 32px 80px', maxWidth: 1400, margin: '0 auto' }}>
        {activeTab === 'Overview' && (
          <div key={tick} className="stagger">
            {/* Instrument search — z-index 500 so dropdown clears the metric card grid */}
            <div style={{ marginBottom: 28, position: 'relative', zIndex: 500 }}>
              <InstrumentSearch />
            </div>

            {/* Metric cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 36 }}>
              {macroMetrics.map((m, i) => (
                <MetricCard key={m.label} {...m} delay={i * 0.05} />
              ))}
            </div>

            {/* Index Charts */}
            <SectionHeader title="Market Indices" subtitle="NSE Nifty 50 & BSE Sensex — 24 months" accent="var(--accent-blue)" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <IndexChart data={niftyHistory} label="Nifty 50" color="#3b82f6"
                ticker="^NSEI"
                livePrice={quotes?.nifty?.price}
                liveChangePct={quotes?.nifty?.changePct}
                liveMarketTime={quotes?.nifty?.marketTime}
                onCardClick={() => setModal({ name: 'Nifty 50', series: niftyHistory ?? nifty50, color: '#3b82f6', unit: 'NSE India' })} />
              <IndexChart data={sensexHistory} label="Sensex" color="#6366f1"
                ticker="^BSESN"
                livePrice={quotes?.sensex?.price}
                liveChangePct={quotes?.sensex?.changePct}
                liveMarketTime={quotes?.sensex?.marketTime}
                onCardClick={() => setModal({ name: 'Sensex', series: sensexHistory ?? sensex, color: '#6366f1', unit: 'BSE India' })} />
            </div>

            <div style={{ marginBottom: 36 }}>
              <NewsSection
                items={rssNews.filter(n =>
                  ['Nifty', 'Sensex', 'FII', 'Rupee', 'Macro', 'RBI'].some(t => n.tags?.includes(t))
                ).slice(0, 8)}
                loading={rssLoading}
                title="Market & Equity News"
              />
            </div>

            {/* Sectors + Movers + Portfolio */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 36, alignItems: 'start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <SectionHeader title="Sectoral Indices" accent="var(--accent-indigo)" />
                <SectorGrid sectors={sectors} />
                <MarketBreadth />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <TopMovers movers={topMovers} fundamentals={fundamentals} />
                <PortfolioPanel
                  data={portfolio}
                  loading={portLoading}
                  error={portError}
                  onRefresh={refreshPortfolio}
                />
              </div>
            </div>

          </div>
        )}

        {activeTab === 'Commodities' && (
          <div key={`comm-${tick}`} className="stagger">
            <SectionHeader title="Commodities Dashboard" subtitle="24-month price series — MCX & global benchmarks" accent="var(--accent-amber)" />
            <CommodityCards
              commodities={commodities}
              newsByCommodity={newsByCommodityRss}
              onHistoryClick={c => setModal({ name: c.name, series: c.series, color: c.color, unit: c.unit })}
            />
          </div>
        )}

        {activeTab === 'Macro' && (
          <div key={`macro-${tick}`} className="stagger">
            <SectionHeader title="Macroeconomic Indicators" subtitle="RBI policy rates, inflation, currency and capital flows" accent="var(--accent-violet)" />
            <GlobalMacroPanel avIndicators={avIndicators} avCommodities={avCommodities} fetchedAt={avFetchedAt} />
            <MacroCharts
              inflation={DISABLE_MOCK_DATA ? [] : inflation}
              repoRate={DISABLE_MOCK_DATA ? [] : repoRate}
              usdinr={DISABLE_MOCK_DATA ? [] : usdinr}
              fiiFlow={DISABLE_MOCK_DATA ? [] : fiiFlow}
            />

            <div style={{ marginTop: 32 }}>
              <SectionHeader title="Equity Benchmarks" subtitle="Close price history with moving average and trend overlay" accent="var(--accent-blue)" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <IndexChart data={niftyHistory} label="Nifty 50" color="#3b82f6"
                  ticker="^NSEI"
                  livePrice={quotes?.nifty?.price}
                  liveChangePct={quotes?.nifty?.changePct}
                  liveMarketTime={quotes?.nifty?.marketTime}
                  onCardClick={() => setModal({ name: 'Nifty 50', series: niftyHistory ?? nifty50, color: '#3b82f6', unit: 'NSE India' })} />
                <IndexChart data={sensexHistory} label="Sensex" color="#6366f1"
                  ticker="^BSESN"
                  livePrice={quotes?.sensex?.price}
                  liveChangePct={quotes?.sensex?.changePct}
                  liveMarketTime={quotes?.sensex?.marketTime}
                  onCardClick={() => setModal({ name: 'Sensex', series: sensexHistory ?? sensex, color: '#6366f1', unit: 'BSE India' })} />
              </div>
            </div>

            <div style={{ marginTop: 32 }}>
              <SectionHeader title="GDP Growth" subtitle="Year-on-year real GDP growth (%)" accent="var(--accent-teal)" />
              <GdpChart />
            </div>
          </div>
        )}

        {activeTab === 'Insights' && (
          <div key={`ai-${tick}`} className="stagger">
            <SectionHeader
              title="Insights"
              subtitle="Linear regression, correlation analysis, and forward projections"
              accent="var(--accent-violet)"
              right={
                <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#8b5cf6', display: 'inline-block' }} />
                  In-browser regression engine
                </span>
              }
            />
            <ImpactAnalyzer
              quotes={quotes}
              commodityHistory={commodityHistory}
              allSeries={buildAllSeries(niftyHistory ?? nifty50, usdinr, inflation, avIndicators, avCommodities, repoRate, regressionHistory)}
              rssNews={rssNews}
            />
          </div>
        )}
      </main>
    </div>
  );
}

// ── Live-data merge helpers ────────────────────────────────────────────────────

function buildMacroMetrics(derived, mock) {
  // Map from live override key → mock label (handles renames like 'Gold (24K)' → 'Gold')
  const KEY_ALIASES = { 'Gold (24K)': 'Gold' };

  const overridden = mock.map(m => {
    const override = derived.macroOverrides.find(o =>
      o.key === m.label || KEY_ALIASES[o.key] === m.label
    );
    if (override) return { ...m, label: override.key, value: override.value, change: override.change, up: override.up };
    return m;
  });
  // Append live-only cards not in mock (e.g. INR/USD)
  const mockKeys = new Set(mock.map(m => m.label));
  const extra    = derived.macroOverrides
    .filter(o => !mockKeys.has(o.key) && !Object.keys(KEY_ALIASES).includes(o.key))
    .map(o => ({ label: o.key, value: o.value, change: o.change, up: o.up }));
  return [...overridden, ...extra];
}

function buildAllSeries(niftyHistory, usdinr, inflation, avIndicators, avCommodities, repoRateData, regHistory = {}) {
  const norm = s => s?.map(d => ({ month: d.month, value: d.close ?? d.value })) ?? [];
  // Use 10Y regression history when available, fall back to shorter chart history
  const regNifty  = regHistory?.nifty?.length  > 0 ? regHistory.nifty  : norm(niftyHistory);
  const regUsdinr = regHistory?.usdinr?.length > 0 ? regHistory.usdinr : norm(usdinr);
  return {
    nifty:     regNifty,
    usdinr:    regUsdinr,
    // Prefer real AV CPI YoY data; fall back to mock if AV hasn't loaded yet
    inflation: avIndicators?.CPI_YOY?.length ? avIndicators.CPI_YOY : norm(inflation),
    // AV commodity monthly series for regression (official, clean)
    crude:     avCommodities?.crude  ?? [],
    gold:      avCommodities?.gold   ?? [],
    silver:    avCommodities?.silver ?? [],
    natgas:    avCommodities?.natgas ?? [],
    copper:    avCommodities?.copper ?? [],
    // Rate series: RBI repo (mock) + Fed Funds (AV when available)
    repoRate:  norm(repoRateData) ?? [],
    fedRate:   avIndicators?.FEDERAL_FUNDS_RATE ?? [],
    // Sector indices from 10Y regression history
    niftyBank:  regHistory?.niftyBank  ?? [],
    niftyIT:    regHistory?.niftyIT    ?? [],
    niftyRealty:regHistory?.niftyRealty ?? [],
  };
}

function buildCommodities(derived, mock, liveHistory = {}) {
  const map = { crude: 'Crude Oil (Brent)', gold: 'Gold', silver: 'Silver', natgas: 'Natural Gas', copper: 'Copper' };
  return mock.map(c => {
    const key    = Object.entries(map).find(([, n]) => n === c.name)?.[0];
    const live   = key && derived.liveCommodities.find(l => l.key === key);
    const series = key && liveHistory[key] ? liveHistory[key] : c.series;
    if (live) return { ...c, series, value: live.value, change: +live.change.toFixed(2), ...(live.unit ? { unit: live.unit } : {}) };
    return { ...c, series };
  });
}

// ─────────────────────────────────────────────────────────────────────────────

function CommodityCards({ commodities, newsByCommodity, onHistoryClick }) {
  const [openNews, setOpenNews] = useState(null);
  const [spans,    setSpans]    = useState({});

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      {commodities.map(c => {
        const span      = spans[c.name] ?? '1Y';
        const baseVal   = c.value;
        const baseVol   = baseVal * 0.012;
        const series    = getSeriesForSpan(span, baseVal, baseVol, c.series);
        const chartData = series.map(d => ({ month: d.time ?? d.month?.slice(2) ?? '', value: d.value }));
        const cNews     = newsByCommodity(c.newsTag);
        const isOpen    = openNews === c.name;

        return (
          <div key={c.name} className="glass" style={{
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            transition: 'border-color 0.2s',
            borderColor: isOpen ? `${c.color}35` : undefined,
          }}>
            {/* Card body */}
            <div style={{ padding: '20px 22px', cursor: 'pointer' }} onClick={() => onHistoryClick(c)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{c.name}</div>
                  <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', color: c.color }}>
                    {c.value.toLocaleString('en-IN')}{' '}
                    <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)' }}>{c.unit}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                  <span className={`tag ${c.change >= 0 ? 'tag-up' : 'tag-down'}`}>
                    {c.change >= 0 ? '+' : ''}{c.change}%
                  </span>
                </div>
              </div>
              {/* Span selector */}
              <div style={{ display: 'flex', gap: 3, marginBottom: 12 }} onClick={e => e.stopPropagation()}>
                {ALL_SPANS.map(s => (
                  <button key={s} onClick={() => setSpans(prev => ({ ...prev, [c.name]: s }))} style={{
                    padding: '2px 8px', fontSize: 10, fontWeight: 600, borderRadius: 5,
                    border: `1px solid ${span === s ? c.color + '55' : 'transparent'}`,
                    background: span === s ? c.color + '18' : 'rgba(255,255,255,0.04)',
                    color: span === s ? c.color : 'var(--text-muted)',
                    cursor: 'pointer', fontFamily: 'var(--font)',
                  }}>{s}</button>
                ))}
              </div>
              <ChartMini data={chartData} color={c.color} />
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8, textAlign: 'center', letterSpacing: '0.03em' }}>
                Click to view full history & stats
              </div>
            </div>

            {/* News toggle */}
            <button
              onClick={() => setOpenNews(isOpen ? null : c.name)}
              style={{
                width: '100%', padding: '10px 22px',
                background: isOpen ? `${c.color}0c` : 'rgba(255,255,255,0.02)',
                border: 'none', borderTop: '1px solid rgba(255,255,255,0.05)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                transition: 'background 0.2s', fontFamily: 'var(--font)',
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 600, color: isOpen ? c.color : 'var(--text-muted)', letterSpacing: '0.04em', flex: 1, textAlign: 'left' }}>
                LATEST NEWS · {cNews.length} ARTICLES
              </span>
              {isOpen
                ? <ChevronUp size={13} color={c.color} />
                : <ChevronDown size={13} color="var(--text-muted)" />
              }
            </button>

            {/* News dropdown */}
            {isOpen && (
              <div style={{ borderTop: `1px solid ${c.color}20`, padding: '4px 0 8px' }}>
                {cNews.length === 0 && (
                  <div style={{ padding: '16px 22px', fontSize: 12, color: 'var(--text-muted)' }}>
                    No recent news for this commodity.
                  </div>
                )}
                {cNews.map((item, i) => (
                  <a
                    key={item.link ?? item.id ?? i}
                    href={item.link ?? '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ textDecoration: 'none', display: 'block' }}
                  >
                    <div style={{
                      display: 'grid', gridTemplateColumns: '1fr auto',
                      alignItems: 'start', gap: 12,
                      padding: '11px 22px',
                      borderBottom: i < cNews.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div>
                        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.82)', lineHeight: 1.5, marginBottom: 4 }}>
                          {item.title ?? item.headline}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {item.source} · {item.ago}
                        </div>
                      </div>
                      <ExternalLink size={11} color="rgba(255,255,255,0.18)" style={{ marginTop: 3, flexShrink: 0 }} />
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MarketBreadth() {
  const advancing = 31, declining = 18, unchanged = 1;
  const total = advancing + declining + unchanged;
  const advPct = (advancing / total * 100).toFixed(0);

  const items = [
    { label: 'India VIX',   value: '13.42', change: '-4.2%', up: true,  note: 'Fear gauge' },
    { label: 'P/E Ratio',   value: '22.8x', change: '+0.3x', up: false, note: 'Nifty 50 TTM' },
    { label: 'Delivery %',  value: '58.3%', change: '+2.1%', up: true,  note: 'NSE cash' },
    { label: '52W Highs',   value: '38',    change: null,    up: true,  note: 'Nifty 500 stocks' },
  ];

  return (
    <div className="glass" style={{ borderRadius: 'var(--radius-md)', padding: '16px 18px' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>
        Market Breadth
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', height: 5, borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${advPct}%`, background: 'var(--accent-green)', transition: 'width 1s ease' }} />
          <div style={{ flex: 1, background: 'var(--accent-rose)' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11 }}>
          <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>{advancing} Adv</span>
          <span style={{ color: 'var(--text-muted)' }}>{unchanged} Unch</span>
          <span style={{ color: 'var(--accent-rose)', fontWeight: 600 }}>{declining} Dec</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {items.map(item => (
          <div key={item.label} style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{item.label}</div>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>{item.value}</div>
            <div style={{ fontSize: 10, marginTop: 3 }}>
              {item.change
                ? <><span style={{ color: item.up ? 'var(--accent-green)' : 'var(--accent-rose)' }}>{item.change}</span><span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>{item.note}</span></>
                : <span style={{ color: 'var(--text-muted)' }}>{item.note}</span>
              }
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// FinPulse Price Proxy Server
// Fetches from Finnhub once per cache window, serves all users from cache
// Requires Node.js 18+ (built-in fetch)

const express = require('express');
const cors    = require('cors');

const app  = express();
app.use(cors()); // allow requests from any origin (including the artifact)

const KEY      = process.env.FINNHUB_KEY;
const PORT     = process.env.PORT || 3001;
const CACHE_TTL = 30_000; // ms — refresh Finnhub data every 30 s

// ── Symbol map: our internal key → Finnhub symbol ─────────────────────────────
const SYMBOLS = {
  // US Indices
  SPX: '^GSPC',  NDX: '^NDX',   DJI: '^DJI',
  RUT: '^RUT',   VIX: '^VIX',

  // International Indices
  TSX:  '^GSPTSE',
  N225: '^N225',

  // Index Futures (CME — may require Finnhub premium; will skip gracefully if unavailable)
  ES:  'CME_MINI:ES1!',  NQ:  'CME_MINI:NQ1!',
  YM:  'CBOT_MINI:YM1!', RTY: 'CME_MINI:RTY1!',

  // Metals (via OANDA forex endpoint — free tier)
  XAU: 'OANDA:XAU_USD',  // Gold $/oz
  XAG: 'OANDA:XAG_USD',  // Silver $/oz

  // Crude Oil
  WTI:   'NYMEX:CL1!',
  BRENT: 'ICE:BRN1!',

  // Forex
  EURUSD: 'OANDA:EUR_USD',  USDJPY: 'OANDA:USD_JPY',
  GBPUSD: 'OANDA:GBP_USD',  USDCAD: 'OANDA:USD_CAD',

  // Crypto (Binance — free tier)
  BTC:  'BINANCE:BTCUSDT',  ETH:  'BINANCE:ETHUSDT',
  SOL:  'BINANCE:SOLUSDT',  XRP:  'BINANCE:XRPUSDT',
  BNB:  'BINANCE:BNBUSDT',  DOGE: 'BINANCE:DOGEUSDT',
  ZEC:  'BINANCE:ZECUSDT',

  // US Stocks
  AAPL: 'AAPL',  NVDA: 'NVDA',  TSLA: 'TSLA',  AMZN: 'AMZN',
  GOOGL:'GOOGL', MSFT: 'MSFT',  META: 'META',  NFLX: 'NFLX',
  SPY:  'SPY',   QQQ:  'QQQ',   AMD:  'AMD',   INTC: 'INTC',
  PLTR: 'PLTR',  COIN: 'COIN',  JPM:  'JPM',   V:    'V',
  WMT:  'WMT',   XOM:  'XOM',   PFE:  'PFE',   BA:   'BA',
  DIS:  'DIS',   UBER: 'UBER',  SHOP: 'SHOP',  MA:   'MA',
  MSTR: 'MSTR',  GS:   'GS',    LLY:  'LLY',   AVGO: 'AVGO',
  ORCL: 'ORCL',  CRM:  'CRM',   ADBE: 'ADBE',  PYPL: 'PYPL',
};

// ── Finnhub quote fetch ────────────────────────────────────────────────────────
async function fetchQuote(sym, fhSym) {
  try {
    const r = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(fhSym)}&token=${KEY}`
    );
    if (!r.ok) return { sym, price: null };
    const d = await r.json();
    // d.c = current price; 0 means the symbol is unsupported / market closed with no data
    return { sym, price: d.c > 0 ? d.c : null };
  } catch {
    return { sym, price: null };
  }
}

// ── Cache ──────────────────────────────────────────────────────────────────────
let cache = { prices: {}, ts: 0 };

async function refreshCache() {
  const start = Date.now();
  // All symbols fetched in parallel — ~50 calls, well within 60/min free-tier limit
  const results = await Promise.allSettled(
    Object.entries(SYMBOLS).map(([sym, fhSym]) => fetchQuote(sym, fhSym))
  );
  const prices = {};
  results.forEach(r => {
    if (r.status === 'fulfilled' && r.value.price !== null)
      prices[r.value.sym] = r.value.price;
  });
  cache = { prices, ts: Date.now() };
  console.log(
    `[${new Date().toISOString()}] Refreshed: ${Object.keys(prices).length}/${Object.keys(SYMBOLS).length} symbols in ${Date.now() - start}ms`
  );
}

// ── Routes ─────────────────────────────────────────────────────────────────────
app.get('/prices', async (req, res) => {
  if (!KEY) return res.status(500).json({ error: 'FINNHUB_KEY env var not set' });
  try {
    if (Date.now() - cache.ts > CACHE_TTL) await refreshCache();
    res.json({ prices: cache.prices, updatedAt: cache.ts });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Price fetch failed' });
  }
});

app.get('/health', (_req, res) => res.json({
  ok: true,
  symbolsCached: Object.keys(cache.prices).length,
  cacheAgeSeconds: Math.round((Date.now() - cache.ts) / 1000),
}));

app.listen(PORT, () => console.log(`FinPulse price server running on port ${PORT}`));
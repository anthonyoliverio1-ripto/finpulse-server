const express = require('express');
const cors = require('cors');
const https = require('https');

const app = express();
app.use(cors());

const KEY = process.env.FINNHUB_KEY;
const PORT = process.env.PORT || 3000;

const STOCKS = [
  'AAPL','NVDA','TSLA','AMZN','GOOGL','MSFT','META','AMD','INTC','COIN',
  'V','MA','WMT','PFE','BA','DIS','UBER','SHOP','JPM','PLTR','NFLX','GME',
  'MSTR','GS','LLY','AVGO','ORCL','CRM','ADBE','PYPL',
  'SPY','QQQ','DIA','IWM','GLD','SLV','USO','UNG'
];

const CRYPTO = {
  BTC:'BINANCE:BTCUSDT', ETH:'BINANCE:ETHUSDT', SOL:'BINANCE:SOLUSDT',
  XRP:'BINANCE:XRPUSDT', BNB:'BINANCE:BNBUSDT', DOGE:'BINANCE:DOGEUSDT', ZEC:'BINANCE:ZECUSDT'
};

const YAHOO = {
  ES:'ES=F', NQ:'NQ=F', YM:'YM=F', RTY:'RTY=F',
  GC:'GC=F', CL:'CL=F', SI:'SI=F', NG:'NG=F', BZ:'BZ=F', HG:'HG=F'
};

let cache = { prices: {}, updatedAt: null };

const httpsGet = (url) => new Promise((resolve) => {
  https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
  }).on('error', () => resolve(null));
});

const fetchFinnhub = async (sym) => {
  const d = await httpsGet(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(sym)}&token=${KEY}`);
  return d?.c > 0 ? d.c : null;
};

const fetchYahoo = async () => {
  const syms = Object.values(YAHOO).join(',');
  const d = await httpsGet(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${syms}`);
  const result = {};
  for (const q of d?.quoteResponse?.result || []) {
    for (const [key, yahooSym] of Object.entries(YAHOO)) {
      if (q.symbol === yahooSym && q.regularMarketPrice > 0) {
        result[key] = q.regularMarketPrice;
        break;
      }
    }
  }
  console.log('Yahoo prices:', result);
  return result;
};

const refresh = async () => {
  const prices = {};
  for (const sym of STOCKS) {
    const p = await fetchFinnhub(sym);
    if (p) prices[sym] = p;
    await new Promise(r => setTimeout(r, 250));
  }
  for (const [sym, finnSym] of Object.entries(CRYPTO)) {
    const p = await fetchFinnhub(finnSym);
    if (p) prices[sym] = p;
    await new Promise(r => setTimeout(r, 250));
  }
  const yahooPrices = await fetchYahoo();
  Object.assign(prices, yahooPrices);
  if (Object.keys(prices).length > 5) {
    cache = { prices, updatedAt: Date.now() };
    console.log(`Refreshed: ${Object.keys(prices).length} prices`);
  }
};

app.get('/prices', (req, res) => res.json(cache));
app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`FinPulse server on port ${PORT}`);
  refresh();
  setInterval(refresh, 60000);
});

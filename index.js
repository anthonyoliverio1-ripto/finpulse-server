const express = require('express');
const cors = require('cors');

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

let cache = { prices: {}, updatedAt: null };

const fetchQ = async (sym) => {
  try {
    const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(sym)}&token=${KEY}`);
    const d = await r.json();
    return d.c > 0 ? d.c : null;
  } catch { return null; }
};

const refresh = async () => {
  const prices = {};
  for (const sym of STOCKS) {
    const p = await fetchQ(sym);
    if (p) prices[sym] = p;
    await new Promise(r => setTimeout(r, 250));
  }
  for (const [sym, finnSym] of Object.entries(CRYPTO)) {
    const p = await fetchQ(finnSym);
    if (p) prices[sym] = p;
    await new Promise(r => setTimeout(r, 250));
  }
  if (Object.keys(prices).length > 5) {
    cache = { prices, updatedAt: Date.now() };
    console.log(`Updated ${Object.keys(prices).length} prices`);
  }
};

app.get('/prices', (req, res) => res.json(cache));
app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`FinPulse server on port ${PORT}`);
  refresh();
  setInterval(refresh, 60000);
});

/* =========================================
   News Filter V3.1
   功能：
   1. 過濾與 FCN / 市場高度相關的新聞
   2. 自動分成 macro / market / industry / stock
   3. 強化 market 類新聞判斷
   4. 保留 market news list 供 debug / dashboard 使用
========================================= */

const MACRO_KEYWORDS = [
  "fed", "federal reserve", "rate", "rates", "interest rate",
  "yield", "treasury", "bond yield", "10-year yield", "10 year yield",
  "inflation", "cpi", "ppi",
  "jobs", "employment", "payroll", "jobless", "labor market",
  "oil", "crude", "brent", "wti", "energy price",
  "war", "geopolitical", "geopolitics", "middle east", "tension",
  "vix", "volatility", "fear gauge",
  "dollar", "usd", "dxy"
];

const MARKET_KEYWORDS = [
  "stock market", "market rally", "market selloff", "selloff", "correction",
  "risk-on", "risk off", "risk-off", "risk-on mood", "risk-off mood",
  "risk appetite", "risk aversion",
  "s&p 500", "s&p", "nasdaq", "dow jones", "dow", "wall street",
  "u.s. stocks", "stocks rise", "stocks fall", "stocks tumble",
  "equities", "broad market", "benchmark index", "indexes",
  "index futures", "futures", "trading session",
  "market slump", "market drop", "market gains", "market falls",
  "market breadth", "market sentiment", "investor sentiment",
  "tech selloff", "market turmoil", "market volatility",
  "qqq", "spy", "dia", "iwm"
];

const INDUSTRY_KEYWORDS = [
  "ai", "artificial intelligence", "semiconductor", "chip", "chips", "gpu",
  "cloud", "software", "datacenter", "data center", "server",
  "travel demand", "airline demand", "cruise demand",
  "banking sector", "fintech", "healthcare sector",
  "consumer spending", "retail demand",
  "ev demand", "factory output", "supply chain"
];

const NOISE_KEYWORDS = [
  "celebrity", "movie review", "recipe", "dating", "restaurant",
  "school event", "campus only", "lifestyle", "fashion", "horoscope",
  "sports rumor", "wedding", "pet care", "travel guide"
];

function normalizeText(raw = "") {
  return String(raw).toLowerCase().replace(/\s+/g, " ").trim();
}

function countHits(text, keywords = []) {
  return keywords.reduce((count, kw) => count + (text.includes(kw) ? 1 : 0), 0);
}

function buildTickerKeywords(stockPool = []) {
  const symbols = stockPool.map((s) => String(s.symbol || "").toLowerCase());
  const names = stockPool
    .map((s) => String(s.name || "").toLowerCase())
    .filter(Boolean);

  return [...new Set([...symbols, ...names])];
}

function hasETFKeyword(text) {
  return (
    text.includes("qqq") ||
    text.includes("spy") ||
    text.includes("dia") ||
    text.includes("iwm") ||
    text.includes("etf") ||
    text.includes("index")
  );
}

function classifyNewsType(text, stockPool = []) {
  const tickerKeywords = buildTickerKeywords(stockPool);

  const macroHits = countHits(text, MACRO_KEYWORDS);
  const marketHits = countHits(text, MARKET_KEYWORDS);
  const industryHits = countHits(text, INDUSTRY_KEYWORDS);
  const tickerHits = countHits(text, tickerKeywords);
  const etfHit = hasETFKeyword(text);

  let type = "stock";
  let reason = "ticker";

  // ✅ V3.1：market 優先再提高
  if (marketHits >= 2) {
    type = "market";
    reason = "market";
  } else if (marketHits >= 1 && etfHit) {
    type = "market";
    reason = "market+etf";
  } else if (marketHits >= 1 && macroHits >= 1) {
    type = "market";
    reason = "market+macro";
  } else if (marketHits >= 1 && tickerHits >= 1) {
    type = "market";
    reason = "market+ticker";
  } else if (macroHits >= 2) {
    type = "macro";
    reason = "macro";
  } else if (industryHits >= 2) {
    type = "industry";
    reason = "industry";
  } else if (macroHits >= 1 && industryHits >= 1) {
    type = "macro";
    reason = "macro+industry";
  } else if (tickerHits >= 1 && industryHits >= 1) {
    type = "stock";
    reason = "ticker+industry";
  } else if (industryHits >= 1) {
    type = "industry";
    reason = "industry";
  } else if (macroHits >= 1) {
    type = "macro";
    reason = "macro";
  } else if (tickerHits >= 1) {
    type = "stock";
    reason = "ticker";
  }

  return {
    type,
    reason,
    macroHits,
    marketHits,
    industryHits,
    tickerHits,
    etfHit
  };
}

/* -----------------------------------------
   單則新聞評分
----------------------------------------- */
export function scoreNewsRelevance(news, stockPool = []) {
  const title = normalizeText(news.title || "");
  const summary = normalizeText(news.summary || "");
  const source = normalizeText(news.source || "");
  const text = `${title} ${summary} ${source}`;

  const tickerKeywords = buildTickerKeywords(stockPool);

  const macroHits = countHits(text, MACRO_KEYWORDS);
  const marketHits = countHits(text, MARKET_KEYWORDS);
  const industryHits = countHits(text, INDUSTRY_KEYWORDS);
  const tickerHits = countHits(text, tickerKeywords);
  const noiseHits = countHits(text, NOISE_KEYWORDS);
  const etfHit = hasETFKeyword(text);

  let score = 0;

  score += macroHits * 2;
  score += marketHits * 3;
  score += industryHits * 2;
  score += tickerHits * 3;
  score -= noiseHits * 4;

  if (etfHit) score += 2;

  const cls = classifyNewsType(text, stockPool);

  if (cls.type === "market") score += 3;
  if (cls.type === "macro") score += 1;

  return {
    score,
    macroHits,
    marketHits,
    industryHits,
    tickerHits,
    noiseHits,
    etfHit,
    type: cls.type,
    type_reason: cls.reason
  };
}

/* -----------------------------------------
   主過濾器
----------------------------------------- */
export function filterNews(rawNewsList = [], stockPool = [], options = {}) {
  const {
    minScore = 2,
    maxItems = 10,
    debug = true
  } = options;

  const scored = rawNewsList.map((item) => {
    const meta = scoreNewsRelevance(item, stockPool);
    return {
      ...item,
      detected_type: meta.type,
      _filter_score: meta.score,
      _filter_meta: meta
    };
  });

  const passed = scored
  .filter((item) => item._filter_score >= minScore)
  .sort((a, b) => b._filter_score - a._filter_score);

const macroBucket = passed.filter(x => x.detected_type === "macro").slice(0, 3);
const marketBucket = passed.filter(x => x.detected_type === "market").slice(0, 3);
const industryBucket = passed.filter(x => x.detected_type === "industry").slice(0, 3);
const stockBucket = passed.filter(x => x.detected_type === "stock").slice(0, 1);

const kept = [...macroBucket, ...marketBucket, ...industryBucket, ...stockBucket]
  .slice(0, maxItems);

  const marketNews = kept.filter((x) => x.detected_type === "market");
  const macroNews = kept.filter((x) => x.detected_type === "macro");
  const industryNews = kept.filter((x) => x.detected_type === "industry");
  const stockNews = kept.filter((x) => x.detected_type === "stock");

  const summary = {
    raw_count: rawNewsList.length,
    kept_count: kept.length,
    macro_count: macroNews.length,
    market_count: marketNews.length,
    industry_count: industryNews.length,
    stock_count: stockNews.length
  };

  if (debug) {
    console.log("🧹 Filter scored =", scored);
    console.log("✅ Filter kept =", kept);
    console.log("📊 Filter summary =", summary);
    console.log(
      "🔥 Market news titles =",
      marketNews.map((x) => ({
        title: x.title,
        score: x._filter_score,
        reason: x._filter_meta?.type_reason || ""
      }))
    );
  }

  return {
    kept,
    summary,
    scored,
    marketNews,
    macroNews,
    industryNews,
    stockNews
  };
}

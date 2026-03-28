/* =========================================
   News Filter V3
   功能：
   1. 過濾與 FCN / 市場高度相關的新聞
   2. 自動分成 macro / market / industry / stock
   3. 強化 market 類新聞判斷
   4. 回傳 summary 給 main / dashboard 使用
========================================= */

const MACRO_KEYWORDS = [
  "fed", "federal reserve", "rate", "rates", "interest rate",
  "yield", "treasury", "bond yield",
  "inflation", "cpi", "ppi",
  "jobs", "employment", "payroll", "jobless",
  "oil", "crude", "energy",
  "war", "geopolitical", "geopolitics",
  "vix", "volatility"
];

const MARKET_KEYWORDS = [
  "stock market", "market rally", "market selloff", "selloff", "correction",
  "risk-on", "risk off", "risk off mood", "risk-on mood",
  "risk appetite", "risk aversion",
  "s&p 500", "s&p", "nasdaq", "dow jones", "dow", "wall street",
  "equities", "u.s. stocks", "stocks rise", "stocks fall", "futures",
  "market slump", "market drop", "market gains", "broad market",
  "benchmark index", "indexes", "index futures", "trading session"
];

const INDUSTRY_KEYWORDS = [
  "ai", "artificial intelligence", "semiconductor", "chip", "chips", "gpu",
  "cloud", "software", "datacenter", "data center", "server",
  "travel demand", "airline demand", "cruise demand",
  "banking sector", "fintech", "healthcare sector",
  "consumer spending", "retail demand",
  "ev demand", "factory output"
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

function classifyNewsType(text, stockPool = []) {
  const tickerKeywords = buildTickerKeywords(stockPool);

  const macroHits = countHits(text, MACRO_KEYWORDS);
  const marketHits = countHits(text, MARKET_KEYWORDS);
  const industryHits = countHits(text, INDUSTRY_KEYWORDS);
  const tickerHits = countHits(text, tickerKeywords);

  let type = "stock";
  let reason = "ticker";

  // ⭐ V3: market 優先權提高
  if (marketHits >= 2) {
    type = "market";
    reason = "market";
  } else if (macroHits >= 2) {
    type = "macro";
    reason = "macro";
  } else if (industryHits >= 2) {
    type = "industry";
    reason = "industry";
  } else if (marketHits >= 1 && macroHits >= 1) {
    type = "market";
    reason = "market+macro";
  } else if (marketHits >= 1 && tickerHits >= 1) {
    type = "market";
    reason = "market+ticker";
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
    tickerHits
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

  let score = 0;

  // ⭐ V3: market 權重提高
  score += macroHits * 2;
  score += marketHits * 3;
  score += industryHits * 2;
  score += tickerHits * 3;
  score -= noiseHits * 4;

  const cls = classifyNewsType(text, stockPool);

  // 類型加權
  if (cls.type === "market") score += 2;
  if (cls.type === "macro") score += 1;

  return {
    score,
    macroHits,
    marketHits,
    industryHits,
    tickerHits,
    noiseHits,
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

  const kept = scored
    .filter((item) => item._filter_score >= minScore)
    .sort((a, b) => b._filter_score - a._filter_score)
    .slice(0, maxItems);

  const summary = {
    raw_count: rawNewsList.length,
    kept_count: kept.length,
    macro_count: kept.filter((x) => x.detected_type === "macro").length,
    market_count: kept.filter((x) => x.detected_type === "market").length,
    industry_count: kept.filter((x) => x.detected_type === "industry").length,
    stock_count: kept.filter((x) => x.detected_type === "stock").length
  };

  if (debug) {
    console.log("🧹 Filter scored =", scored);
    console.log("✅ Filter kept =", kept);
    console.log("📊 Filter summary =", summary);
  }

  return {
    kept,
    summary,
    scored
  };
}


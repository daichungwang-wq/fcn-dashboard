/* =========================================
   News Filter V2
   功能：
   1. 過濾與 FCN / 市場高度相關的新聞
   2. 支援關鍵字 + 股票池 ticker filter
=========================================*/
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
  "stock market", "market rally", "market selloff",
  "risk-on", "risk off",
  "s&p 500", "nasdaq", "dow jones", "dow", "wall street",
  "equities", "stocks rise", "stocks fall", "futures"
];

const INDUSTRY_KEYWORDS = [
  "ai", "artificial intelligence", "semiconductor", "chip", "gpu",
  "cloud", "software", "datacenter",
  "travel demand", "airline", "cruise",
  "banking", "fintech",
  "consumer spending", "retail"
];

const NOISE_KEYWORDS = [
  "celebrity", "movie", "recipe", "dating",
  "lifestyle", "fashion", "restaurant",
  "horoscope", "wedding", "pet"
];

function normalizeText(raw = "") {
  return String(raw).toLowerCase().replace(/\s+/g, " ").trim();
}

function countHits(text, keywords = []) {
  return keywords.reduce((count, kw) => count + (text.includes(kw) ? 1 : 0), 0);
}

function buildTickerKeywords(stockPool = []) {
  const symbols = stockPool.map(s => String(s.symbol || "").toLowerCase());
  const names = stockPool.map(s => String(s.name || "").toLowerCase());

  return [...new Set([...symbols, ...names])];
}

function classifyNewsType(text, stockPool = []) {
  const tickerKeywords = buildTickerKeywords(stockPool);

  const macroHits = countHits(text, MACRO_KEYWORDS);
  const marketHits = countHits(text, MARKET_KEYWORDS);
  const industryHits = countHits(text, INDUSTRY_KEYWORDS);
  const tickerHits = countHits(text, tickerKeywords);

  let type = "stock";

  if (macroHits >= 2) type = "macro";
  else if (marketHits >= 2) type = "market";
  else if (industryHits >= 2) type = "industry";
  else if (tickerHits >= 1) type = "stock";
  else if (industryHits >= 1) type = "industry";
  else if (marketHits >= 1) type = "market";
  else if (macroHits >= 1) type = "macro";

  return {
    type,
    macroHits,
    marketHits,
    industryHits,
    tickerHits
  };
}

export function scoreNewsRelevance(news, stockPool = []) {
  const text = normalizeText(
    (news.title || "") + " " +
    (news.summary || "") + " " +
    (news.source || "")
  );

  const tickerKeywords = buildTickerKeywords(stockPool);

  const macroHits = countHits(text, MACRO_KEYWORDS);
  const marketHits = countHits(text, MARKET_KEYWORDS);
  const industryHits = countHits(text, INDUSTRY_KEYWORDS);
  const tickerHits = countHits(text, tickerKeywords);
  const noiseHits = countHits(text, NOISE_KEYWORDS);

  let score = 0;

  score += macroHits * 2;
  score += marketHits * 2;
  score += industryHits * 2;
  score += tickerHits * 3;
  score -= noiseHits * 4;

  const cls = classifyNewsType(text, stockPool);

  return {
    score,
    type: cls.type
  };
}
export function filterNews(rawNewsList = [], stockPool = [], options = {}) {
  const {
    minScore = 2,
    maxItems = 10,
    debug = true
  } = options;

  const scored = rawNewsList.map(item => {
    const meta = scoreNewsRelevance(item, stockPool);

    return {
      ...item,
      detected_type: meta.type,
      _filter_score: meta.score
    };
  });

  const kept = scored
    .filter(x => x._filter_score >= minScore)
    .sort((a, b) => b._filter_score - a._filter_score)
    .slice(0, maxItems);

  if (debug) {
    const summary = {
      raw: rawNewsList.length,
      kept: kept.length,
      macro: kept.filter(x => x.detected_type === "macro").length,
      market: kept.filter(x => x.detected_type === "market").length,
      industry: kept.filter(x => x.detected_type === "industry").length,
      stock: kept.filter(x => x.detected_type === "stock").length
    };

    console.log("📊 Filter summary =", summary);
    console.log("✅ Filter kept =", kept);
  }

  return kept;
}






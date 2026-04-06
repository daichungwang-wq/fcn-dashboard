// ==========================================
// M4 - Learning Engine（外在單評估 + 儲存）
// 自含版：不依賴 fcn_engine.js export
// ==========================================

import { evaluateStock } from "../core/stock_engine.js";

const STORAGE_KEY = "fcn_m4_records_v10";

// ------------------------------------------
// 基本工具
// ------------------------------------------
function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round(value, digits = 2) {
  return Number(toNumber(value, 0).toFixed(digits));
}

function safeUpper(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeBasket(input = "") {
  return String(input)
    .split(",")
    .map(v => safeUpper(v))
    .filter(Boolean);
}

// ------------------------------------------
// 支援資料
// ------------------------------------------
let SUPPORT_DATA = {
  pool30: [],
  pool30Map: {},
  stockRuntime: {},
  stockRuntimeMap: {},
  runtimeCacheStocks: {}
};

async function loadJson(path, fallback = null) {
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`${path} not found`);
    return await res.json();
  } catch (err) {
    console.warn(`⚠️ load failed: ${path}`, err);
    return fallback;
  }
}

function loadRuntimeCache() {
  try {
    const raw = JSON.parse(localStorage.getItem("runtime_cache_v1") || "{}");
    const stocks = raw?.stocks || {};
    const normalized = {};
    Object.keys(stocks).forEach(sym => {
      normalized[safeUpper(sym)] = stocks[sym];
    });
    return normalized;
  } catch (err) {
    console.warn("⚠️ runtime_cache_v1 parse failed", err);
    return {};
  }
}

export async function loadSupportData() {
  const pool30 = await loadJson("./data/pool30.json", []);
  const stockRuntime = await loadJson("./data/stock_runtime.json", {});
  const runtimeCacheStocks = loadRuntimeCache();

  const pool30Map = {};
  (Array.isArray(pool30) ? pool30 : []).forEach(item => {
    const symbol = safeUpper(item.symbol);
    if (symbol) pool30Map[symbol] = item;
  });

  const stockRuntimeMap = {};
  Object.keys(stockRuntime || {}).forEach(sym => {
    stockRuntimeMap[safeUpper(sym)] = stockRuntime[sym];
  });

  SUPPORT_DATA = {
    pool30: Array.isArray(pool30) ? pool30 : [],
    pool30Map,
    stockRuntime,
    stockRuntimeMap,
    runtimeCacheStocks
  };

  return SUPPORT_DATA;
}

// ------------------------------------------
// 合併股票資料
// ------------------------------------------
function getMergedStock(symbol) {
  const sym = safeUpper(symbol);
  const base = SUPPORT_DATA.pool30Map[sym] || {};
  const runtime = SUPPORT_DATA.stockRuntimeMap[sym] || {};
  const cache = SUPPORT_DATA.runtimeCacheStocks[sym] || {};

  return {
    ...base,
    ...runtime,
    ...cache,
    symbol: sym
  };
}

export function buildStockBlocksData(basketInput = "") {
  const symbols = Array.isArray(basketInput) ? basketInput : normalizeBasket(basketInput);

  return symbols.map(symbol => {
    const stock = getMergedStock(symbol);
    const evalRes = evaluateStock(stock);

    return {
      ...stock,
      ...evalRes,
      event_news_score: 0,
      event_news_reason: "M1 轉換尚未正式接入，暫不納入總分"
    };
  });
}

// ------------------------------------------
// FCN 規則
// ------------------------------------------
function getWorstGroup(stocks = []) {
  const sorted = [...stocks].sort(
    (a, b) => toNumber(a.pure_stock_score, 0) - toNumber(b.pure_stock_score, 0)
  );

  const n = sorted.length;
  if (n <= 3) return sorted.slice(0, 1);
  if (n === 4) return sorted.slice(0, 2);
  if (n >= 5) return sorted.slice(0, 3);
  return sorted.slice(0, 1);
}

function getWorstStock(stocks = []) {
  const worstGroup = getWorstGroup(stocks);
  return worstGroup[0] || null;
}

function getCategoryPenalty(category) {
  switch (String(category || "").toLowerCase()) {
    case "core":
      return { worst: 3, assy: 2 };
    case "defensive":
      return { worst: 2, assy: 1 };
    case "growth":
      return { worst: 2, assy: 0 };
    case "income":
      return { worst: 1, assy: 0 };
    case "speculative":
      return { worst: -2, assy: -2 };
    default:
      return { worst: 0, assy: 0 };
  }
}

function calcSRI(stocks = []) {
  if (!stocks.length) return 0;

  const worstGroup = getWorstGroup(stocks);

  const worstPenalty =
    worstGroup.reduce((sum, s) => sum + getCategoryPenalty(s.category).worst, 0) / worstGroup.length;

  const assyPenalty =
    stocks.reduce((sum, s) => sum + getCategoryPenalty(s.category).assy, 0) / stocks.length;

  return round(0.6 * worstPenalty + 0.4 * assyPenalty, 2);
}

function scoreKI(ki) {
  const k = toNumber(ki);
  if (k <= 55) return 8;
  if (k <= 60) return 4;
  if (k <= 65) return 0;
  if (k <= 70) return -4;
  if (k <= 75) return -8;
  return -999;
}

function scoreStrike(strike) {
  const s = toNumber(strike);
  if (s <= 60) return 10;
  if (s <= 65) return 5;
  if (s <= 67) return -1;
  if (s <= 70) return -3;
  if (s <= 75) return -5;
  if (s <= 80) return -10;
  return -999;
}

function calcRateScore(rate) {
  const r = toNumber(rate);
  if (r < 10) return -999;
  if (r < 12) return -4;
  if (r < 15) return -2;
  if (r < 16) return 0;
  if (r < 18) return 3;
  if (r < 20) return 5;
  if (r < 24) return 8;
  return 10;
}

function calcPeriodScore(period) {
  const m = toNumber(period);
  if (m <= 3) return 5;
  if (m <= 6) return 2;
  if (m <= 9) return -2;
  if (m <= 12) return -5;
  return -999;
}

function calcPRiskScore(strike, ki) {
  const gap = toNumber(strike) - toNumber(ki);

  if (gap === 0) return 5;
  if (gap < 10) return -7;
  if (gap === 10) return 5;
  if (gap <= 13) return 4;
  if (gap <= 15) return 3;
  if (gap <= 18) return 0;
  if (gap <= 20) return -4;
  if (gap <= 22) return -5;
  if (gap < 25) return -8;
  return -999;
}

function calcProductTypeScore(productType = "") {
  const t = safeUpper(productType);
  if (t === "EKI") return 2;
  if (t === "DACN") return -1;
  if (t === "AKI" || t === "MKI" || t === "AKI / MKI") return 0;
  return 0;
}

function calcAvgPureStock(stocks = []) {
  if (!stocks.length) return 0;
  return round(
    stocks.reduce((sum, s) => sum + toNumber(s.pure_stock_score, 0), 0) / stocks.length,
    2
  );
}

function calcAvgEventStock(stocks = []) {
  if (!stocks.length) return 0;
  return round(
    stocks.reduce((sum, s) => sum + toNumber(s.event_stock_score, 0), 0) / stocks.length,
    2
  );
}

function calcAvgEventSnapshot(stocks = []) {
  if (!stocks.length) return 0;
  return round(
    stocks.reduce((sum, s) => sum + toNumber(s.snapshot_score, 0), 0) / stocks.length,
    2
  );
}

function calcWorstOfEventSnapshot(stocks = []) {
  const worstGroup = getWorstGroup(stocks);
  if (!worstGroup.length) return 0;
  return round(
    worstGroup.reduce((sum, s) => sum + toNumber(s.snapshot_score, 0), 0) / worstGroup.length,
    2
  );
}

function calcEventFCNSnapshot(stocks = []) {
  const worst = calcWorstOfEventSnapshot(stocks);
  const avg = calcAvgEventSnapshot(stocks);
  return round(0.6 * worst + 0.4 * avg, 2);
}

function calcAvgEventNewsScore(stocks = []) {
  if (!stocks.length) return 0;
  return round(
    stocks.reduce((sum, s) => sum + toNumber(s.event_news_score, 0), 0) / stocks.length,
    2
  );
}

function calcAvgPureVolatility(stocks = []) {
  if (!stocks.length) return 0;
  return round(
    stocks.reduce((sum, s) => sum + toNumber(s.vol_score, 0), 0) / stocks.length,
    2
  );
}

function calcWorstOfPureVolatility(stocks = []) {
  const worstGroup = getWorstGroup(stocks);
  if (!worstGroup.length) return 0;
  return round(
    worstGroup.reduce((sum, s) => sum + toNumber(s.vol_score, 0), 0) / worstGroup.length,
    2
  );
}

function calcPureFcnVolatility(stocks = []) {
  const worst = calcWorstOfPureVolatility(stocks);
  const avg = calcAvgPureVolatility(stocks);
  return round(0.6 * worst + 0.4 * avg, 2);
}

function calcFCNByBaseStock(baseStockScore, deal, sri) {
  const rateScore = calcRateScore(deal.coupon);
  const periodScore = calcPeriodScore(deal.tenor);
  const priskScore = calcPRiskScore(deal.strike, deal.ki);
  const productTypeScore = calcProductTypeScore(deal.product_type);

  if (rateScore === -999 || periodScore === -999 || priskScore === -999) {
    return -999;
  }

  const score =
    0.4 * toNumber(baseStockScore, 0) +
    0.2 * rateScore +
    0.1 * periodScore +
    0.1 * priskScore +
    0.1 * sri +
    productTypeScore;

  return round(score, 2);
}

function calcDeltaFCN(pureFcn, eventFcn) {
  const p = toNumber(pureFcn, 0);
  const e = toNumber(eventFcn, 0);
  if (p === 0) return 0;
  return round(((e - p) / Math.abs(p)) * 100, 2);
}

function getDeltaLabel(deltaPct) {
  const d = toNumber(deltaPct, 0);
  if (d > 100) return "非常甜";
  if (d > 50) return "偏甜";
  if (d >= -20) return "合理";
  if (d >= -50) return "偏貴";
  return "很貴";
}

function getSuggestion(pureFcn, eventFcn, deltaPct) {
  if (pureFcn === -999 || eventFcn === -999) return "不做";
  if (pureFcn >= 7 && eventFcn >= 7.5 && deltaPct > 0) return "可做";
  if (pureFcn >= 4 && eventFcn >= 4) return "觀察";
  return "不做";
}

// ------------------------------------------
// 主評分
// ------------------------------------------
export function evaluateDeal(deal = {}) {
  const basket = Array.isArray(deal.basket) ? deal.basket : normalizeBasket(deal.basket || "");
  const stocks = buildStockBlocksData(basket);

  const avgPureStock = calcAvgPureStock(stocks);
  const avgEventStock = calcAvgEventStock(stocks);
  const avgEventSnapshot = calcAvgEventSnapshot(stocks);
  const worstOfEventSnapshot = calcWorstOfEventSnapshot(stocks);
  const eventFcnSnapshot = calcEventFCNSnapshot(stocks);
  const avgEventNewsScore = calcAvgEventNewsScore(stocks);

  const avgPureVol = calcAvgPureVolatility(stocks);
  const worstOfPureVol = calcWorstOfPureVolatility(stocks);
  const pureFcnVolatility = calcPureFcnVolatility(stocks);

  const sri = calcSRI(stocks);
  const worstStock = getWorstStock(stocks);
  const gap = round(toNumber(deal.strike) - toNumber(deal.ki), 2);

  const pureFcn = calcFCNByBaseStock(avgPureStock, deal, sri);
  const eventFcn = calcFCNByBaseStock(avgEventStock, deal, sri);
  const deltaFcnPct = calcDeltaFCN(pureFcn, eventFcn);
  const deltaLabel = getDeltaLabel(deltaFcnPct);

  const kiScore = scoreKI(deal.ki);
  const strikeScore = scoreStrike(deal.strike);
  const rateScore = calcRateScore(deal.coupon);
  const periodScore = calcPeriodScore(deal.tenor);
  const priskScore = calcPRiskScore(deal.strike, deal.ki);
  const productTypeScore = calcProductTypeScore(deal.product_type);

  return {
    basket,
    stocks,

    pure_fcn_score: pureFcn,
    pure_fcn_comment: `Avg Pure Stock=${avgPureStock} | Pure FCN Volatility=${pureFcnVolatility} | SRI=${sri} | Product Type Score=${productTypeScore}`,

    event_fcn_score: eventFcn,
    event_fcn_comment: `Avg Event Stock=${avgEventStock} | Event FCN Snapshot=${eventFcnSnapshot} | Avg Event / News Score=${avgEventNewsScore} | SRI=${sri}`,

    delta_fcn_score: deltaFcnPct,
    delta_fcn_comment: deltaLabel,

    avg_pure_stock: avgPureStock,
    avg_event_stock: avgEventStock,
    avg_event_snapshot: avgEventSnapshot,
    worst_of_event_snapshot: worstOfEventSnapshot,
    event_fcn_snapshot: eventFcnSnapshot,
    avg_event_news_score: avgEventNewsScore,

    avg_pure_volatility: avgPureVol,
    worst_of_pure_volatility: worstOfPureVol,
    pure_fcn_volatility: pureFcnVolatility,

    sri,
    worst_of: worstStock?.symbol || "",

    l2: {
      ki_value: toNumber(deal.ki),
      ki_score: kiScore,
      ki_comment: "KI 安全性分數，僅供結構參考",

      strike_value: toNumber(deal.strike),
      strike_score: strikeScore,
      strike_comment: "Strike 安全性分數，僅供結構參考",

      coupon_value: toNumber(deal.coupon),
      coupon_score: rateScore,
      coupon_comment: "",

      tenor_value: toNumber(deal.tenor),
      tenor_score: periodScore,
      tenor_comment: "",

      gap_value: gap,
      gap_score: priskScore,
      gap_comment: "",

      avg_pure_stock_value: avgPureStock,
      avg_event_stock_value: avgEventStock,
      pure_fcn_volatility_value: pureFcnVolatility,
      event_fcn_snapshot_value: eventFcnSnapshot,
      avg_event_news_score_value: avgEventNewsScore,
      sri_value: sri,
      worst_of_value: worstStock?.symbol || "",

      summary_comment:
        `KI Score=${kiScore} | Strike Score=${strikeScore} | ` +
        `Rate Score=${rateScore} | Period Score=${periodScore} | P-Risk Score=${priskScore} | ` +
        `Product Type Score=${productTypeScore} | ` +
        `Avg Pure Stock=${avgPureStock} | Avg Event Stock=${avgEventStock} | ` +
        `Pure FCN Volatility=${pureFcnVolatility} | Event FCN Snapshot=${eventFcnSnapshot} | ` +
        `Avg Event / News Score=${avgEventNewsScore} | SRI=${sri}`
    },

    product_type_score: productTypeScore,
    rate_score: rateScore,
    period_score: periodScore,
    prisk_score: priskScore,

    suggestion: getSuggestion(pureFcn, eventFcn, deltaFcnPct)
  };
}

// ------------------------------------------
// 儲存
// ------------------------------------------
export async function saveExternalDeal(deal, result) {
  const record = {
    deal_id: "FCN_" + Date.now(),
    created_at: new Date().toISOString(),
    source: "M4",

    basic: {
      deal_name: deal.deal_name || "",
      bank: deal.bank || "",
      product_type: deal.product_type || "",
      basket: deal.basket || [],
      quote_date: deal.quote_date || "",
      tenor: deal.tenor ?? null,
      coupon: deal.coupon ?? null,
      strike: deal.strike ?? null,
      ki: deal.ki ?? null,
      currency: deal.currency || "USD",
      memo: deal.memo || ""
    },

    fcn_score: {
      pure_fcn_score: result.pure_fcn_score,
      event_fcn_score: result.event_fcn_score,
      delta_fcn: result.delta_fcn_score,
      avg_pure_stock: result.avg_pure_stock,
      avg_event_stock: result.avg_event_stock,
      pure_fcn_volatility: result.pure_fcn_volatility,
      event_fcn_snapshot: result.event_fcn_snapshot,
      avg_event_news_score: result.avg_event_news_score,
      sri: result.sri,
      worst_of: result.worst_of,
      product_type_score: result.product_type_score
    },

    fcn_breakdown: {
      rate_score: result.rate_score,
      period_score: result.period_score,
      p_risk_score: result.prisk_score,
      ki_score: result.l2?.ki_score,
      strike_score: result.l2?.strike_score,
      gap: result.l2?.gap_value,
      gap_score: result.l2?.gap_score
    },

    stocks: result.stocks || [],

    analysis: {
      decision: result.suggestion || "",
      key_advantage: "",
      key_risk: "",
      final_reason: ""
    }
  };

  const history = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  history.unshift(record);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));

  return record;
}

export function getExternalDeals() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
}

export function clearExternalDeals() {
  localStorage.removeItem(STORAGE_KEY);
}

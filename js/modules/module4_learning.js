// ==========================================
// module4_learning.js V1 FINAL
// 專門給 M4 用（外在單評分 + 存檔）
// ==========================================

import {
  calcRateScore,
  calcPeriodScore,
  calcPRiskScore,
  calcEKIBonus,
  calcAvgPureStock,
  calcAvgEventStock,
  calcSRI,
  getWorstStock,
  getWorstGroup
} from "../core/fcn_engine.js";

function toNumber(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function round(v, d = 2) {
  return Number(v.toFixed(d));
}

// ==========================================
// 🧠 Snapshot Basket（短期波動）
// ==========================================
function calcEventSnapshot(stocks) {
  if (!stocks.length) return 0;

  const worstGroup = getWorstGroup(stocks);

  const worstAvg =
    worstGroup.reduce((s, x) => s + toNumber(x.snapshot_score, 0), 0) /
    worstGroup.length;

  const avg =
    stocks.reduce((s, x) => s + toNumber(x.snapshot_score, 0), 0) /
    stocks.length;

  return round(0.6 * worstAvg + 0.4 * avg);
}

// ==========================================
// 📊 Volatility Basket（中期波動）
// ==========================================
function calcPureVolatility(stocks) {
  if (!stocks.length) return 0;

  const worstGroup = getWorstGroup(stocks);

  const worstAvg =
    worstGroup.reduce((s, x) => s + toNumber(x.vol_score, 0), 0) /
    worstGroup.length;

  const avg =
    stocks.reduce((s, x) => s + toNumber(x.vol_score, 0), 0) /
    stocks.length;

  return round(0.6 * worstAvg + 0.4 * avg);
}

// ==========================================
// 🎯 主函數（給 M4 UI 呼叫）
// ==========================================
export function evaluateFCNDeal(dealInput, stocksInput = []) {
  const {
    coupon,
    tenor,
    strike,
    ki,
    product_type
  } = dealInput;

  // ---------------------------
  // 1. 基本計算
  // ---------------------------
  const rateScore = calcRateScore(coupon);
  const periodScore = calcPeriodScore(tenor);
  const priskScore = calcPRiskScore(strike, ki);
  const sri = calcSRI(stocksInput);

  // ---------------------------
  // 2. Product Type
  // ---------------------------
  let productTypeScore = 0;
  if (product_type === "EKI") productTypeScore = 2;
  else if (product_type === "DACN") productTypeScore = -1;
  else productTypeScore = 0;

  // ---------------------------
  // 3. Stock Aggregation
  // ---------------------------
  const avgPureStock = calcAvgPureStock(stocksInput);
  const avgEventStock = calcAvgEventStock(stocksInput);

  const pureVol = calcPureVolatility(stocksInput);
  const eventSnapshot = calcEventSnapshot(stocksInput);

  const avgNews = round(
    stocksInput.reduce((s, x) => s + toNumber(x.event_news_score, 0), 0) /
      (stocksInput.length || 1)
  );

  const worst = getWorstStock(stocksInput);

  // ---------------------------
  // 4. Pure FCN
  // ---------------------------
  const pureFCN =
    0.4 * avgPureStock +
    0.2 * rateScore +
    0.1 * periodScore +
    0.1 * priskScore +
    0.1 * sri +
    productTypeScore;

  // ---------------------------
  // 5. Event FCN
  // ---------------------------
  const eventFCN =
    0.4 * avgEventStock +
    0.2 * rateScore +
    0.1 * periodScore +
    0.1 * priskScore +
    0.1 * sri +
    productTypeScore;

  // ---------------------------
  // 6. Delta
  // ---------------------------
  const delta = round(eventFCN - pureFCN);

  // ---------------------------
  // 7. Output（對齊 external_deals）
  // ---------------------------
  return {
    pure_fcn_score: round(pureFCN),
    event_fcn_score: round(eventFCN),
    delta_fcn: delta,

    avg_pure_stock: round(avgPureStock),
    avg_event_stock: round(avgEventStock),

    pure_fcn_volatility: pureVol,
    event_fcn_snapshot: eventSnapshot,

    avg_event_news_score: avgNews,

    sri: round(sri),
    worst_of: worst?.symbol || "",

    product_type_score: productTypeScore,

    breakdown: {
      rate_score: rateScore,
      period_score: periodScore,
      p_risk_score: priskScore,
      gap: strike - ki
    }
  };
}

// ==========================================
// 🧾 生成完整 external_deal record
// ==========================================
export function buildExternalDealRecord({
  basic,
  stocks,
  analysis = {}
}) {
  const fcn = evaluateFCNDeal(basic, stocks);

  return {
    deal_id: "FCN_" + Date.now(),
    created_at: new Date().toISOString(),
    source: "M4",

    basic,

    fcn_score: fcn,

    fcn_breakdown: fcn.breakdown,

    stocks,

    analysis
  };
}

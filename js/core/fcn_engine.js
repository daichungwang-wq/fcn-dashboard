// ==========================================
// fcn_engine.js V2
// 振宇 FCN 系統｜FCN Pure Engine
// ==========================================

import {
  evaluateStock
} from "./stock_engine.js";

// ------------------------------------------
// 工具
// ------------------------------------------
function toNumber(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

// ------------------------------------------
// 1. Worst-of 計算（核心邏輯）
// ------------------------------------------
export function calcWorstOf(stocks = []) {
  if (!Array.isArray(stocks) || stocks.length === 0) return null;

  // 先依 pure_score 排序（越低越差）
  const sorted = [...stocks].sort((a, b) => a.pure_score - b.pure_score);

  // 規則：
  // 2檔 → 最差1檔
  // 4~5檔 → 最差2檔
  if (stocks.length <= 2) {
    return {
      worst: [sorted[0]],
      score: sorted[0].pure_score
    };
  }

  const worstTwo = sorted.slice(0, 2);

  return {
    worst: worstTwo,
    score: Math.min(worstTwo[0].pure_score, worstTwo[1].pure_score)
  };
}

// ------------------------------------------
// 2. 利率 scoring（你定義）
// ------------------------------------------
export function scoreCoupon(coupon = 0) {
  const c = toNumber(coupon, 0);

  if (c < 10) return -999; // 不做
  if (c < 12) return -4;
  if (c < 15) return -2;
  if (c < 16) return 0;
  if (c < 18) return 3;
  if (c < 20) return 5;
  if (c < 24) return 8;
  return 10;
}

// ------------------------------------------
// 3. 天期 scoring
// ------------------------------------------
export function scoreTenor(months = 6) {
  const m = toNumber(months, 6);

  if (m <= 3) return 5;
  if (m <= 6) return 2;
  if (m === 6) return 0;
  if (m <= 9) return -2;
  if (m <= 12) return -5;
  return -999;
}

// ------------------------------------------
// 4. KI scoring
// ------------------------------------------
export function scoreKI(ki = 60) {
  const k = toNumber(ki, 60);

  if (k <= 55) return 8;
  if (k <= 60) return 4;
  if (k <= 65) return 0;
  if (k <= 70) return -4;
  if (k <= 75) return -8;
  return -999;
}

// ------------------------------------------
// 5. Strike scoring
// ------------------------------------------
export function scoreStrike(strike = 70) {
  const s = toNumber(strike, 70);

  if (s <= 60) return 10;
  if (s <= 65) return 5;
  if (s <= 67) return -1;
  if (s <= 70) return -3;
  if (s <= 75) return -5;
  if (s <= 80) return -10;
  return -999;
}

// ------------------------------------------
// 6. FCN Pure Score（核心公式）
// ------------------------------------------
export function calcFCNPureScore({
  stockScore,
  coupon,
  tenor,
  ki,
  strike
}) {
  return (
    0.4 * stockScore +
    0.2 * coupon +
    0.1 * tenor +
    0.2 * ki +
    0.1 * strike
  );
}

// ------------------------------------------
// 7. 主入口（最重要）
// ------------------------------------------
export function evaluateFCN({
  stocks = [],
  coupon = 0,
  tenor = 6,
  ki = 60,
  strike = 70
}) {

  // 1️⃣ 股票先丟進 stock_engine
  const evaluatedStocks = stocks.map(s => evaluateStock(s));

  // 2️⃣ Worst-of
  const worst = calcWorstOf(evaluatedStocks);

  if (!worst) {
    return { error: "No stocks" };
  }

  const stockScore = worst.score;

  // 3️⃣ 各項 scoring
  const couponScore = scoreCoupon(coupon);
  const tenorScore = scoreTenor(tenor);
  const kiScore = scoreKI(ki);
  const strikeScore = scoreStrike(strike);

  // 過濾不可做
  if (
    couponScore === -999 ||
    tenorScore === -999 ||
    kiScore === -999 ||
    strikeScore === -999
  ) {
    return {
      valid: false,
      reason: "條件不合"
    };
  }

  // 4️⃣ FCN Pure Score
  const fcnScore = calcFCNPureScore({
    stockScore,
    coupon: couponScore,
    tenor: tenorScore,
    ki: kiScore,
    strike: strikeScore
  });

  return {
    valid: true,

    // 股票
    worst_of: worst.worst.map(s => s.symbol),
    stock_score: stockScore,

    // 條件
    coupon_score: couponScore,
    tenor_score: tenorScore,
    ki_score: kiScore,
    strike_score: strikeScore,

    // 最終
    fcn_pure_score: Number(fcnScore.toFixed(4))
  };
}

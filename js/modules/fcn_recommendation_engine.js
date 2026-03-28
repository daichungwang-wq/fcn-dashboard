import { calcFCNPure, calcBasketEventScore, calcVolatilityScore } from "./fcn_engine.js";

/* =========================================
   工具
========================================= */

// 產生組合（4~5檔）
function generateCombinations(pool, size = 4) {
  const results = [];

  function helper(start, combo) {
    if (combo.length === size) {
      results.push([...combo]);
      return;
    }

    for (let i = start; i < pool.length; i++) {
      combo.push(pool[i]);
      helper(i + 1, combo);
      combo.pop();
    }
  }

  helper(0, []);
  return results;
}

// 簡單分類
function classifyCombo(stocks) {
  const symbols = stocks.map(s => s.symbol);

  if (symbols.includes("CCL") || symbols.includes("COIN")) {
    return "高收益型";
  }

  if (symbols.includes("UNH") || symbols.includes("KO")) {
    return "防禦型";
  }

  return "核心收益型";
}

/* =========================================
   主引擎
========================================= */

export function generateFCNRecommendations({
  pool = [],
  runtime,
  rate = 18,
  period = 6,
  ki = 60,
  strike = 75,
  eki = false,
  topN = 5
}) {
  const results = [];

  // 👉 產生 4檔組合（先用4，效能OK）
  const combos = generateCombinations(pool, 4);

  for (const stocks of combos) {
    const eventScore = calcBasketEventScore(
      stocks,
      runtime.stock_event_map
    );

    const volatility = calcVolatilityScore(stocks);

    const fcn = calcFCNPure({
      stocks,
      rate,
      period,
      ki,
      strike,
      eki,
      eventScore,
      volatility
    });

    results.push({
      stocks: stocks.map(s => s.symbol),
      score: fcn.total,
      breakdown: fcn.breakdown,
      type: classifyCombo(stocks)
    });
  }

  // 👉 排序
  results.sort((a, b) => b.score - a.score);

  return results.slice(0, topN);
}

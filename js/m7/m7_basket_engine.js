// ==========================================
// M7 Basket Engine - Manual Review Version
// 目的：
// 1. 讀取 m7_new_stock_today.json
// 2. 根據 today_highlight / watch / simulation pool
// 3. 產出三組 basket 建議：積極 / 理性 / 保守
// 4. 固定 FCN 條件：55 / 65 / 6m / AKI / 3~5檔
// 5. 初期先人工檢視，不直接串 M8 rate engine
// ==========================================

async function loadBasketData() {
  const res = await fetch("./data/m7/m7_new_stock_today.json?v=" + Date.now());
  if (!res.ok) throw new Error("無法讀取 m7_new_stock_today.json");
  return await res.json();
}

function n(v, d = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}

function avg(arr, key) {
  if (!arr.length) return 0;
  return arr.reduce((s, x) => s + n(x[key]), 0) / arr.length;
}

function getPool(data) {
  return {
    highlight: Array.isArray(data.today_highlight_pool) ? data.today_highlight_pool : [],
    watch: Array.isArray(data.watch_pool) ? data.watch_pool : [],
    simulation: Array.isArray(data.simulation_pool) ? data.simulation_pool : [],
    reject: Array.isArray(data.reject_pool) ? data.reject_pool : []
  };
}

function getCategory(stock) {
  const c = String(stock["分類"] || "").toLowerCase();
  if (c.includes("core")) return "CORE";
  if (c.includes("defensive")) return "DEFENSIVE";
  if (c.includes("income")) return "INCOME";
  if (c.includes("cyclical")) return "EVENT";
  if (c.includes("speculative")) return "EVENT";
  return "GROWTH";
}

function buildStockProfile(stock) {
  const category = getCategory(stock);
  const total = n(stock.today_score);
  const valuation = n(stock.valuation_score);
  const trend = n(stock.trend_score);
  const structure = n(stock.structure_score);
  const timing = n(stock.timing_score);
  const money = n(stock.money_score);

  const trendState = stock["趨勢判讀"]?.["趨勢狀態"] || "";
  const structureState = stock["趨勢判讀"]?.["結構狀態"] || "";
  const timingState = stock["趨勢判讀"]?.["時機狀態"] || "";
  const exposureLevel = stock["曝險警示"]?.level || "normal";

  return {
    symbol: stock["股號"],
    name: stock["股名"],
    category,
    total,
    valuation,
    trend,
    structure,
    timing,
    money,
    trendState,
    structureState,
    timingState,
    exposureLevel,
    source: stock,
    aggressive_fit: scoreAggressiveFit(stock, category),
    rational_fit: scoreRationalFit(stock, category),
    conservative_fit: scoreConservativeFit(stock, category)
  };
}

function scoreAggressiveFit(stock, category) {
  let score = 0;
  score += n(stock.today_score) * 0.35;
  score += n(stock.structure_score) * 1.2;
  score += n(stock.trend_score) * 1.0;
  score += n(stock.timing_score) * 0.6;
  if (category === "GROWTH") score += 8;
  if (category === "CORE") score += 5;
  if (category === "EVENT") score -= 6;
  if ((stock["趨勢判讀"]?.["時機狀態"] || "") === "hot") score -= 4;
  if ((stock["曝險警示"]?.level || "") === "high") score -= 12;
  return score;
}

function scoreRationalFit(stock, category) {
  let score = 0;
  score += n(stock.today_score) * 0.4;
  score += n(stock.valuation_score) * 0.8;
  score += n(stock.trend_score) * 0.9;
  score += n(stock.structure_score) * 0.9;
  if (category === "CORE") score += 10;
  if (category === "GROWTH") score += 4;
  if (category === "DEFENSIVE") score += 3;
  if (category === "EVENT") score -= 10;
  if ((stock["趨勢判讀"]?.["時機狀態"] || "") === "hot") score -= 3;
  if ((stock["曝險警示"]?.level || "") === "high") score -= 10;
  return score;
}

function scoreConservativeFit(stock, category) {
  let score = 0;
  score += n(stock.today_score) * 0.35;
  score += n(stock.valuation_score) * 1.0;
  score += n(stock.money_score) * 0.6;
  if (category === "CORE") score += 9;
  if (category === "DEFENSIVE") score += 8;
  if (category === "INCOME") score += 5;
  if (category === "GROWTH") score -= 2;
  if (category === "EVENT") score -= 15;
  if ((stock["趨勢判讀"]?.["時機狀態"] || "") === "hot") score -= 4;
  if ((stock["曝險警示"]?.level || "") === "high") score -= 12;
  return score;
}

function dedupeBySymbol(list) {
  const seen = new Set();
  return list.filter(x => {
    if (seen.has(x.symbol)) return false;
    seen.add(x.symbol);
    return true;
  });
}

function sortByFit(list, key) {
  return [...list].sort((a, b) => b[key] - a[key]);
}

function topByCategory(list, category, fitKey, limit = 10) {
  return sortByFit(list.filter(x => x.category === category), fitKey).slice(0, limit);
}

function buildUniverse(data) {
  const pools = getPool(data);
  const raw = [
    ...pools.highlight,
    ...pools.watch,
    ...pools.simulation
  ];

  return dedupeBySymbol(raw)
    .filter(x => !x.reject_type)
    .map(buildStockProfile)
    .filter(x => x.exposureLevel !== "high");
}

function pickAggressive(universe) {
  const core = topByCategory(universe, "CORE", "aggressive_fit", 10);
  const growth = topByCategory(universe, "GROWTH", "aggressive_fit", 10);
  const defensive = topByCategory(universe, "DEFENSIVE", "aggressive_fit", 10);

  const picked = [];
  if (core[0]) picked.push(core[0]);
  if (core[1]) picked.push(core[1]);
  if (growth[0]) picked.push(growth[0]);
  if (growth[1]) picked.push(growth[1]);
  if (defensive[0]) picked.push(defensive[0]);

  const finalList = dedupeBySymbol(picked).slice(0, 5);

  return buildBasketResult("積極型", finalList, {
    targetRate: "19% ~ 25%",
    strategyLogic: "以 CORE 為骨幹，加入 1~2 檔 GROWTH 拉升利率，保留少量穩定器壓低 worst-of 失控風險。",
    basketLogic: "2 CORE + 2 GROWTH + 1 DEFENSIVE",
    expectation: "追求較高利率，但接受較高波動與接股風險。"
  });
}

function pickRational(universe) {
  const core = topByCategory(universe, "CORE", "rational_fit", 10);
  const growth = topByCategory(universe, "GROWTH", "rational_fit", 10);
  const defensive = topByCategory(universe, "DEFENSIVE", "rational_fit", 10);
  const income = topByCategory(universe, "INCOME", "rational_fit", 10);

  const picked = [];
  if (core[0]) picked.push(core[0]);
  if (core[1]) picked.push(core[1]);
  if (growth[0]) picked.push(growth[0]);
  if (defensive[0]) picked.push(defensive[0]);
  else if (income[0]) picked.push(income[0]);

  const finalList = dedupeBySymbol(picked).slice(0, 4);

  return buildBasketResult("理性型", finalList, {
    targetRate: "15% ~ 19%",
    strategyLogic: "以 CORE 為主，搭配少量 GROWTH 提升收益，避免 EVENT，讓利率與可接性取得平衡。",
    basketLogic: "2 CORE + 1 GROWTH + 1 DEFENSIVE/INCOME",
    expectation: "這是最標準、最可持續的 FCN 組合邏輯。"
  });
}

function pickConservative(universe) {
  const core = topByCategory(universe, "CORE", "conservative_fit", 10);
  const defensive = topByCategory(universe, "DEFENSIVE", "conservative_fit", 10);
  const income = topByCategory(universe, "INCOME", "conservative_fit", 10);

  const picked = [];
  if (core[0]) picked.push(core[0]);
  if (core[1]) picked.push(core[1]);
  if (defensive[0]) picked.push(defensive[0]);
  else if (income[0]) picked.push(income[0]);

  const finalList = dedupeBySymbol(picked).slice(0, 3);

  return buildBasketResult("保守型", finalList, {
    targetRate: "12% ~ 15%",
    strategyLogic: "以 CORE 與 DEFENSIVE/INCOME 為主，重點不是拉高利率，而是提高未來接股可接受度。",
    basketLogic: "2 CORE + 1 DEFENSIVE/INCOME",
    expectation: "優先保護品質與接股安全性，把 FCN 當成偏收益型部位。"
  });
}

function buildBasketResult(styleName, stocks, meta) {
  const symbols = stocks.map(x => x.symbol);
  const categories = summarizeCategories(stocks);

  const basketScore = round2(avg(stocks, "total"));
  const valuationAvg = round2(avg(stocks, "valuation"));
  const trendAvg = round2(avg(stocks, "trend"));
  const structureAvg = round2(avg(stocks, "structure"));
  const timingAvg = round2(avg(stocks, "timing"));
  const moneyAvg = round2(avg(stocks, "money"));

  const qualityComment = buildBasketQualityComment(styleName, {
    valuationAvg,
    trendAvg,
    structureAvg,
    timingAvg,
    moneyAvg,
    categories
  });

  const manualRateHint = inferManualRateHint(styleName, {
    valuationAvg,
    trendAvg,
    structureAvg,
    timingAvg,
    moneyAvg,
    categories
  });

  return {
    style_name: styleName,
    target_rate: meta.targetRate,
    fcn_condition: {
      KI: 55,
      strike: 65,
      tenor: "6m",
      type: "AKI",
      names: `${stocks.length}檔`
    },
    basket_logic: meta.basketLogic,
    strategy_logic: meta.strategyLogic,
    expectation: meta.expectation,
    symbols,
    categories,
    basket_score: basketScore,
    component_score: {
      valuation: valuationAvg,
      trend: trendAvg,
      structure: structureAvg,
      timing: timingAvg,
      money: moneyAvg
    },
    quality_comment: qualityComment,
    rate_support_comment: manualRateHint,
    stocks: stocks.map(x => ({
      symbol: x.symbol,
      name: x.name,
      category: x.category,
      total: round2(x.total),
      valuation: round2(x.valuation),
      trend: round2(x.trend),
      structure: round2(x.structure),
      timing: round2(x.timing),
      money: round2(x.money),
      source: x.source
    }))
  };
}

function summarizeCategories(stocks) {
  const result = { CORE: 0, GROWTH: 0, DEFENSIVE: 0, INCOME: 0, EVENT: 0 };
  for (const s of stocks) {
    result[s.category] = (result[s.category] || 0) + 1;
  }
  return result;
}

function buildBasketQualityComment(styleName, stats) {
  const parts = [];

  if (stats.trendAvg >= 8) parts.push("整體中期趨勢強");
  else if (stats.trendAvg >= 6) parts.push("整體中期趨勢穩定");
  else parts.push("整體趨勢力道一般");

  if (stats.structureAvg >= 7) parts.push("價格甜度足夠");
  else if (stats.structureAvg >= 5.5) parts.push("價格甜度中等");
  else parts.push("切入甜度不足");

  if (stats.timingAvg >= 8) parts.push("短線偏熱");
  else if (stats.timingAvg >= 6) parts.push("短線節奏尚可");
  else parts.push("短線偏冷");

  if (styleName === "保守型") {
    if (stats.categories.EVENT > 0 || stats.categories.GROWTH > 1) {
      parts.push("但保守組合中成長 / 事件成分偏高");
    } else {
      parts.push("且結構偏向可接型股票");
    }
  }

  if (styleName === "積極型" && stats.categories.GROWTH >= 2) {
    parts.push("利率彈性主要來自成長股波動");
  }

  return parts.join("，") + "。";
}

function inferManualRateHint(styleName, stats) {
  let supported = false;
  let reason = "";

  if (styleName === "積極型") {
    supported =
      stats.categories.GROWTH >= 1 &&
      stats.structureAvg >= 6.5 &&
      stats.trendAvg >= 7;
    reason = supported
      ? "結構與波動條件支持 19%~25% 的高收益假設，可進一步交由 M8 驗證。"
      : "若要達到 19%~25%，目前 basket 的波動與結構力道可能不足。";
  }

  if (styleName === "理性型") {
    supported =
      stats.categories.CORE >= 2 &&
      stats.structureAvg >= 6 &&
      stats.valuationAvg >= 20;
    reason = supported
      ? "品質與結構大致支持 15%~19% 區間，屬合理可驗證範圍。"
      : "目前品質或甜度不足，15%~19% 區間需要進一步確認。";
  }

  if (styleName === "保守型") {
    supported =
      stats.categories.CORE >= 2 &&
      stats.categories.EVENT === 0 &&
      stats.structureAvg >= 5.5;
    reason = supported
      ? "以品質股為主，12%~15% 區間有邏輯基礎。"
      : "若含較多成長 / 事件股，12%~15% 的保守利率假設不夠一致。";
  }

  return {
    is_supported_preliminarily: supported,
    comment: reason
  };
}

function round2(v) {
  const x = Number(v);
  return Number.isFinite(x) ? Math.round(x * 100) / 100 : 0;
}

function buildTodayStructure(universe) {
  const counts = { CORE: 0, GROWTH: 0, DEFENSIVE: 0, INCOME: 0, EVENT: 0 };
  for (const s of universe) counts[s.category] = (counts[s.category] || 0) + 1;

  let conclusion = "今日結構均衡。";
  if (counts.CORE >= counts.GROWTH && counts.EVENT === 0) {
    conclusion = "今日結構偏核心，可優先做理性型與保守型。";
  } else if (counts.GROWTH >= 2 && counts.CORE >= 2) {
    conclusion = "今日結構偏核心 + 成長混合，適合先檢視理性型，再評估積極型。";
  } else if (counts.EVENT > 0) {
    conclusion = "今日候選中帶有事件 / 高波動成分，做 FCN 時應降低進攻性。";
  }

  return {
    counts,
    conclusion
  };
}

function buildOutput(data) {
  const universe = buildUniverse(data);

  const aggressive = pickAggressive(universe);
  const rational = pickRational(universe);
  const conservative = pickConservative(universe);

  return {
    generated_at: new Date().toISOString(),
    source_generated_at: data.generated_at || null,
    mode: "manual_review",
    purpose: "M7 最後考驗：先人工檢視積極 / 理性 / 保守各一組，再決定是否導入 M8 rate engine。",
    today_structure: buildTodayStructure(universe),
    basket_recommendations: {
      aggressive,
      rational,
      conservative
    }
  };
}

function renderBasketPage(payload) {
  renderStructure(payload.today_structure);
  renderBasketCard("aggressive-card", payload.basket_recommendations.aggressive);
  renderBasketCard("rational-card", payload.basket_recommendations.rational);
  renderBasketCard("conservative-card", payload.basket_recommendations.conservative);
}

function renderStructure(structure) {
  const el = document.getElementById("today-structure");
  if (!el) return;

  const c = structure.counts || {};
  el.innerHTML = `
    <div class="summary-grid">
      <div class="summary-item"><span>CORE</span><strong>${c.CORE || 0}</strong></div>
      <div class="summary-item"><span>GROWTH</span><strong>${c.GROWTH || 0}</strong></div>
      <div class="summary-item"><span>DEFENSIVE</span><strong>${c.DEFENSIVE || 0}</strong></div>
      <div class="summary-item"><span>INCOME</span><strong>${c.INCOME || 0}</strong></div>
      <div class="summary-item"><span>EVENT</span><strong>${c.EVENT || 0}</strong></div>
    </div>
    <div class="structure-comment">${structure.conclusion || ""}</div>
  `;
}

function renderBasketCard(targetId, basket) {
  const el = document.getElementById(targetId);
  if (!el || !basket) return;

  const support = basket.rate_support_comment || {};
  const c = basket.categories || {};
  const cs = basket.component_score || {};

  el.innerHTML = `
    <div class="basket-top">
      <div>
        <div class="basket-title">${basket.style_name}</div>
        <div class="basket-sub">目標利率：${basket.target_rate}</div>
      </div>
      <div class="basket-score">Basket Score ${basket.basket_score}</div>
    </div>

    <div class="basket-condition">
      FCN條件：KI ${basket.fcn_condition.KI} / Strike ${basket.fcn_condition.strike} / ${basket.fcn_condition.tenor} / ${basket.fcn_condition.type} / ${basket.fcn_condition.names}
    </div>

    <div class="basket-block">
      <div class="block-title">組合邏輯</div>
      <div>${basket.strategy_logic}</div>
      <div class="muted">${basket.basket_logic}</div>
    </div>

    <div class="basket-block">
      <div class="block-title">品質說明</div>
      <div>${basket.quality_comment}</div>
    </div>

    <div class="basket-block">
      <div class="block-title">利率支持度（M7 預判）</div>
      <div class="${support.is_supported_preliminarily ? "ok" : "warn"}">
        ${support.is_supported_preliminarily ? "✅" : "⚠️"} ${support.comment}
      </div>
    </div>

    <div class="basket-block">
      <div class="block-title">結構統計</div>
      <div class="stats-line">
        CORE ${c.CORE || 0} ｜ GROWTH ${c.GROWTH || 0} ｜ DEFENSIVE ${c.DEFENSIVE || 0} ｜ INCOME ${c.INCOME || 0} ｜ EVENT ${c.EVENT || 0}
      </div>
      <div class="stats-line">
        Valuation ${round2(cs.valuation)} ｜ Trend ${round2(cs.trend)} ｜ Structure ${round2(cs.structure)} ｜ Timing ${round2(cs.timing)} ｜ Money ${round2(cs.money)}
      </div>
    </div>

    <div class="basket-block">
      <div class="block-title">推薦股票</div>
      ${basket.stocks.map(renderStockLine).join("")}
    </div>
  `;
}

function renderStockLine(s) {
  return `
    <div class="stock-line">
      <div class="stock-main">
        <strong>${s.symbol}</strong> ${s.name}
        <span class="pill">${s.category}</span>
      </div>
      <div class="stock-score">
        Total ${round2(s.total)} ｜ V ${round2(s.valuation)} ｜ T ${round2(s.trend)} ｜ S ${round2(s.structure)} ｜ Ti ${round2(s.timing)} ｜ M ${round2(s.money)}
      </div>
    </div>
  `;
}

async function initBasketPage() {
  try {
    const data = await loadBasketData();
    const payload = buildOutput(data);
    renderBasketPage(payload);
    window.__M7_BASKET_OUTPUT__ = payload;
  } catch (err) {
    const el = document.getElementById("basket-error");
    if (el) el.textContent = `載入失敗：${err.message}`;
  }
}

document.addEventListener("DOMContentLoaded", initBasketPage);

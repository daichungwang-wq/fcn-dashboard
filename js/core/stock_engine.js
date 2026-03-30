/* ==========================================
   stock_engine.js V4 Freeze
   振宇 FCN 系統｜Stock Engine
   功能：
   1. 合併 pool + market runtime
   2. 計算 Pure Stock Score / Event Stock Score
   3. 提供趨勢解釋 / Pure解釋 / Event解釋
   4. 輸出單股 / 全部股票 / 查詢
========================================== */

// ------------------------------------------
// 五大類固定順序與分數（定稿）
// 核心 → 成長 → 防禦 → 收益 → 投機
// ------------------------------------------
const CATEGORY_MAP = {
  core: {
    order: 1,
    label: "核心",
    score: 10,
    factor: 1.0
  },
  growth: {
    order: 2,
    label: "成長",
    score: 8,
    factor: 1.2
  },
  defensive: {
    order: 3,
    label: "防禦",
    score: 7,
    factor: 0.8
  },
  income: {
    order: 4,
    label: "收益",
    score: 6,
    factor: 1.4
  },
  speculative: {
    order: 5,
    label: "投機",
    score: 4,
    factor: 0.7
  }
};

// ------------------------------------------
// 工具
// ------------------------------------------
function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round(value, digits = 4) {
  return Number(toNumber(value, 0).toFixed(digits));
}

function safeString(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

// ------------------------------------------
// 1. 合併單一股票資料
// ------------------------------------------
export function mergeStockData(poolStock = {}, marketMap = {}) {
  const symbol = String(poolStock.symbol || "").trim().toUpperCase();
  const market = marketMap[symbol] || {};

  return {
    ...poolStock,
    ...market,
    symbol,

    baseline_label:
      poolStock.baseline_label ||
      CATEGORY_MAP[poolStock.category]?.label ||
      "投機",

    baseline_score:
      poolStock.baseline_score ??
      CATEGORY_MAP[poolStock.category]?.score ??
      4,

    category_order:
      poolStock.category_order ??
      CATEGORY_MAP[poolStock.category]?.order ??
      5,

    event_bias:
      poolStock.event_bias ?? 0,

    event_weight:
      poolStock.event_weight ?? 0.3,

    allow_fcn:
      poolStock.allow_fcn ?? true,

    can_hold:
      poolStock.can_hold ?? true
  };
}

// ------------------------------------------
// 2. 批量合併
// ------------------------------------------
export function mergeStockUniverse(pool = [], marketMap = {}) {
  if (!Array.isArray(pool)) return [];
  return pool.map(stock => mergeStockData(stock, marketMap));
}

// ------------------------------------------
// 3. Baseline
// ------------------------------------------
export function calcBaselineScore(stock = {}) {
  if (stock.baseline_score != null) {
    return toNumber(stock.baseline_score, 4);
  }
  return CATEGORY_MAP[stock.category]?.score ?? 4;
}

export function calcBaselineLabel(stock = {}) {
  if (stock.baseline_label) return String(stock.baseline_label);
  return CATEGORY_MAP[stock.category]?.label ?? "投機";
}

export function getCategoryFactor(stock = {}) {
  return CATEGORY_MAP[stock.category]?.factor ?? 0.7;
}

// ------------------------------------------
// 4. 中期波動度（Pure 用）
// ------------------------------------------
export function calcVolatility(stock = {}) {
  const r1m = Math.abs(toNumber(stock.ret_1m, 0));
  const r6m = Math.abs(toNumber(stock.ret_6m, 0));
  const r12m = Math.abs(toNumber(stock.ret_12m, 0));

  return round(0.1 * r1m + 0.3 * r6m + 0.6 * r12m);
}

// ------------------------------------------
// 5. 波動分數
// ------------------------------------------
export function calcVolScore(volatility = 0) {
  const v = Math.abs(toNumber(volatility, 0));

  if (v <= 0.10) return -2;
  if (v <= 0.20) return -1;
  if (v <= 0.40) return 1;
  if (v <= 0.60) return -1;
  if (v <= 0.80) return -2;
  return -3;
}

export function calcVolLabel(volatility = 0) {
  const v = Math.abs(toNumber(volatility, 0));

  if (v <= 0.10) return "太低";
  if (v <= 0.20) return "過低";
  if (v <= 0.40) return "合理";
  if (v <= 0.60) return "過高";
  if (v <= 0.80) return "太高";
  return "異常";
}

// ------------------------------------------
// 6. Trend / Adjustment 輸入
// ------------------------------------------
export function getTrendInputs(stock = {}) {
  return {
    ret_1d: toNumber(stock.ret_1d, 0),
    ret_1w: toNumber(stock.ret_1w, 0),
    ret_1m: toNumber(stock.ret_1m, 0),
    ret_6m: toNumber(stock.ret_6m, 0),
    ret_12m: toNumber(stock.ret_12m, 0)
  };
}

// ------------------------------------------
// 7. 趨勢分類（解釋層）
// ------------------------------------------
export function classifyTrend(stock = {}) {
  const { ret_1d, ret_1w, ret_1m, ret_6m, ret_12m } = getTrendInputs(stock);

  if (
    ret_12m >= 0.25 &&
    ret_6m >= -0.10 &&
    ret_1m <= -0.08
  ) {
    return {
      trend: "pullback_in_uptrend",
      label: "長多回檔",
      trend_score: 9,
      trend_note: "長期上升趨勢仍在，短期進入健康回檔，適合觀察 FCN 甜蜜點"
    };
  }

  if (
    ret_12m >= 0.25 &&
    ret_6m > 0 &&
    ret_1m > 0 &&
    ret_1w >= 0
  ) {
    return {
      trend: "strong_uptrend",
      label: "高位強勢",
      trend_score: 6,
      trend_note: "趨勢很強，但位置偏高，FCN 利率與進場點需更保守"
    };
  }

  if (
    ret_12m > 0 &&
    ret_6m > 0 &&
    ret_1m > 0.05 &&
    ret_1w > 0.02
  ) {
    return {
      trend: "breakout",
      label: "突破轉強",
      trend_score: 5,
      trend_note: "近期動能明顯轉強，適合追蹤，但不一定是 FCN 最佳切入型態"
    };
  }

  if (
    ret_12m >= -0.05 &&
    ret_12m < 0.25 &&
    Math.abs(ret_1m) <= 0.08 &&
    Math.abs(ret_1w) <= 0.05
  ) {
    return {
      trend: "sideways",
      label: "區間整理",
      trend_score: 4,
      trend_note: "趨勢不明顯，屬整理盤，適合搭配收益導向 FCN 但需看標的品質"
    };
  }

  if (
    ret_12m < 0 &&
    ret_6m < 0 &&
    ret_1m < -0.08
  ) {
    return {
      trend: "downtrend",
      label: "弱勢下跌",
      trend_score: -8,
      trend_note: "中長期趨勢轉弱且短期續跌，避免做 FCN"
    };
  }

  if (
    ret_12m > 0 &&
    ret_1w < -0.08 &&
    ret_1m < -0.12
  ) {
    return {
      trend: "sharp_pullback",
      label: "急跌修正",
      trend_score: -2,
      trend_note: "雖然長期未壞，但短期跌速過快，先觀察是否止穩"
    };
  }

  if (
    ret_12m < 0 &&
    ret_1m > 0.05 &&
    ret_1w > 0
  ) {
    return {
      trend: "dead_cat_bounce",
      label: "弱勢反彈",
      trend_score: -4,
      trend_note: "長期仍弱，短期反彈可能只是技術性，FCN 應保守"
    };
  }

  return {
    trend: "neutral",
    label: "中性",
    trend_score: 0,
    trend_note: "暫無明確優勢趨勢，需結合 Pure 與 Event 綜合判斷"
  };
}

// ------------------------------------------
// 8. Trend / Adjustment 分數
// ------------------------------------------
export function calcAdjustmentScore(stock = {}) {
  const r1d = toNumber(stock.ret_1d, 0);
  const r1w = toNumber(stock.ret_1w, 0);
  const r1m = toNumber(stock.ret_1m, 0);

  const vol = 0.6 * r1d + 0.3 * r1w + 0.1 * r1m;
  const volPct = vol * 100;

  if (volPct <= -30) return 10;
  if (volPct <= -20) return 8;
  if (volPct <= -15) return 5;
  if (volPct <= -10) return 4;
  if (volPct < 0) return 1;

  if (volPct <= 5) return -5;
  if (volPct <= 10) return -1;
  if (volPct <= 15) return -2;
  if (volPct <= 20) return -3;
  if (volPct <= 30) return -5;

  return -10;
}

export function getAdjustmentReason(stock = {}) {
  const trendInfo = classifyTrend(stock);
  const score = calcAdjustmentScore(stock);

  switch (trendInfo.trend) {
    case "pullback_in_uptrend":
      return `1M 回檔明顯，但 12M 仍維持強勢，屬健康修正（Adjustment=${score}）`;
    case "strong_uptrend":
      return `股價維持強勢上升，但位置偏高，短線進場需保守（Adjustment=${score}）`;
    case "breakout":
      return `近期動能轉強，屬突破型態，但 FCN 不一定是最佳追價工具（Adjustment=${score}）`;
    case "sideways":
      return `股價處於區間整理，價格動能中性（Adjustment=${score}）`;
    case "downtrend":
      return `中長期走弱且短期續跌，屬不利 FCN 型態（Adjustment=${score}）`;
    case "sharp_pullback":
      return `短期跌速過快，先觀察是否止穩（Adjustment=${score}）`;
    case "dead_cat_bounce":
      return `長期仍弱，短期反彈可能只是技術性修正（Adjustment=${score}）`;
    default:
      return `短期價格動能無明確優勢（Adjustment=${score}）`;
  }
}

// ------------------------------------------
// 9. Pure adjustment
// ------------------------------------------
export function calcPureAdjustment(stock = {}) {
  const factor = getCategoryFactor(stock);
  const volatility = calcVolatility(stock);
  const vol_score = calcVolScore(volatility);
  const adjustment = factor * vol_score;

  return {
    factor: round(factor),
    volatility,
    vol_score,
    vol_label: calcVolLabel(volatility),
    adjustment: round(adjustment)
  };
}

// ------------------------------------------
// 10. Pure Score
// Pure = Baseline + Vol Adjustment
// ------------------------------------------
export function calcPureScore(stock = {}) {
  const baseline = calcBaselineScore(stock);
  const adj = calcPureAdjustment(stock);

  return round(baseline + adj.adjustment);
}

export function getPureReason(stock = {}) {
  const baseline = calcBaselineScore(stock);
  const baselineLabel = calcBaselineLabel(stock);
  const pureAdj = calcPureAdjustment(stock);

  const parts = [
    `${baselineLabel}股`,
    stock.can_hold === false ? "不可接" : "可接",
    `Baseline=${baseline}`,
    `波動=${pureAdj.vol_label}`,
    `Pure調整=${pureAdj.adjustment}`
  ];

  return parts.join("、");
}

// ------------------------------------------
// 11. Event Impact
// context.eventImpactMap 優先
// stock.event_impact 次之
// stock.event_bias 最後
// ------------------------------------------
export function calcEventImpact(stock = {}, context = {}) {
  if (context.eventImpactMap && stock.symbol in context.eventImpactMap) {
    return toNumber(context.eventImpactMap[stock.symbol], 0);
  }

  if (stock.event_impact != null) {
    return toNumber(stock.event_impact, 0);
  }

  return toNumber(stock.event_bias, 0);
}

export function getEventReason(stock = {}, context = {}) {
  const score = calcEventImpact(stock, context);

  if (score >= 3) return `事件面顯著正向（Event Impact=${score}）`;
  if (score >= 1) return `事件面偏正向（Event Impact=${score}）`;
  if (score <= -3) return `事件面顯著負向（Event Impact=${score}）`;
  if (score <= -1) return `事件面偏負向（Event Impact=${score}）`;

  return `事件面中性（Event Impact=${score}）`;
}

// ------------------------------------------
// 12. Event Stock Score（進攻版定稿）
// Event Stock Score
// = 0.40 × Pure Stock Score
// + 0.35 × Adjustment Score
// + 0.25 × Event Impact Score
// Pure < 5 → 不做
// ------------------------------------------
export function calcEventStockScore(stock = {}, context = {}) {
  const pure = calcPureScore(stock);

  if (pure < 5) {
    return round(pure);
  }

  const adjustment = calcAdjustmentScore(stock);
  const eventImpact = calcEventImpact(stock, context);

  const score =
    0.40 * pure +
    0.35 * adjustment +
    0.25 * eventImpact;

  return round(score);
}

// ------------------------------------------
// 13. 短期價格動能（顯示用）
// ------------------------------------------
export function calcPriceMomentum(stock = {}) {
  const ret1d = toNumber(stock.ret_1d, 0);
  const ret1w = toNumber(stock.ret_1w, 0);
  const ret1m = toNumber(stock.ret_1m, 0);

  return round(0.6 * ret1d + 0.3 * ret1w + 0.1 * ret1m);
}

// ------------------------------------------
// 14. 可否納入 FCN
// ------------------------------------------
export function isEligibleForFCN(stock = {}, context = {}) {
  if (stock.allow_fcn === false) return false;
  if (stock.can_hold === false) return false;

  const pure = calcPureScore(stock);
  if (pure < 5) return false;

  const trend = classifyTrend(stock);
  if (trend.trend === "downtrend") return false;
  if (trend.trend === "dead_cat_bounce") return false;

  const eventImpact = calcEventImpact(stock, context);
  if (eventImpact <= -4) return false;

  return true;
}

// 保留舊名稱相容
export function isTradable(stock = {}) {
  if (stock.allow_fcn === false) return false;
  if (stock.can_hold === false) return false;
  return true;
}

// ------------------------------------------
// 15. Bias 與建議
// ------------------------------------------
export function getTotalBias(stock = {}, context = {}) {
  const pure = calcPureScore(stock);
  const eventStock = calcEventStockScore(stock, context);

  if (pure < 5) return "negative";
  if (eventStock >= 8) return "very_positive";
  if (eventStock >= 6) return "positive";
  if (eventStock >= 4) return "neutral";
  if (eventStock >= 2) return "cautious";
  return "negative";
}

export function getSuggestion(stock = {}, context = {}) {
  const eligible = isEligibleForFCN(stock, context);
  const bias = getTotalBias(stock, context);

  if (!eligible) return "避免納入 FCN";
  if (bias === "very_positive") return "優先納入 FCN 候選";
  if (bias === "positive") return "可納入 FCN 候選";
  if (bias === "neutral") return "中性觀察";
  if (bias === "cautious") return "保守觀察";
  return "避免納入 FCN";
}

// ------------------------------------------
// 16. 單檔完整評估
// ------------------------------------------
export function evaluateStock(stock = {}, context = {}) {
  const baseline_score = calcBaselineScore(stock);
  const baseline_label = calcBaselineLabel(stock);
  const pureAdj = calcPureAdjustment(stock);
  const pure_score = calcPureScore(stock);

  const trendInfo = classifyTrend(stock);

  const adjustment_score = calcAdjustmentScore(stock);
  const adjustment_reason = getAdjustmentReason(stock);

  const event_impact_score = calcEventImpact(stock, context);
  const event_reason = getEventReason(stock, context);

  const event_stock_score = calcEventStockScore(stock, context);

  const eligible = isEligibleForFCN(stock, context);
  const total_bias = getTotalBias(stock, context);
  const suggestion = getSuggestion(stock, context);

  return {
    symbol: stock.symbol || "",
    name: stock.name || "",
    sector: stock.sector || "",
    subsector: stock.subsector || "",

    category: stock.category || "speculative",
    category_order: stock.category_order ?? 5,

    baseline_label,
    baseline_score,

    price_now: stock.price_now ?? null,
    ret_1d: toNumber(stock.ret_1d, 0),
    ret_1w: toNumber(stock.ret_1w, 0),
    ret_1m: toNumber(stock.ret_1m, 0),
    ret_6m: toNumber(stock.ret_6m, 0),
    ret_12m: toNumber(stock.ret_12m, 0),
    volume: stock.volume ?? null,
    last_update: stock.last_update ?? null,

    trend: trendInfo.trend,
    trend_label: trendInfo.label,
    trend_score: round(trendInfo.trend_score),
    trend_note: trendInfo.trend_note,

    volatility: pureAdj.volatility,
    vol_score: pureAdj.vol_score,
    vol_label: pureAdj.vol_label,
    pure_adjustment_factor: pureAdj.factor,
    pure_adjustment: pureAdj.adjustment,

    pure_score,
    pure_reason: getPureReason(stock),

    price_momentum: calcPriceMomentum(stock),

    adjustment_score,
    adjustment_reason,

    event_impact_score,
    event_reason,

    event_stock_score,

    total_bias,
    eligible,

    event_bias: event_impact_score,

    allow_fcn: stock.allow_fcn ?? true,
    can_hold: stock.can_hold ?? true,
    tradable: isTradable(stock),

    basket_role: stock.basket_role || null,
    correlation_cluster: stock.correlation_cluster || null,
    downside_risk_level: stock.downside_risk_level || null,

    suggestion
  };
}

// ------------------------------------------
// 17. 批量完整評估
// ------------------------------------------
export function evaluateStockUniverse(pool = [], marketMap = {}, context = {}) {
  const merged = mergeStockUniverse(pool, marketMap);
  return merged.map(stock => evaluateStock(stock, context));
}

// ------------------------------------------
// 18. 依 symbol 查詢
// ------------------------------------------
export function findStockBySymbol(pool = [], symbol = "") {
  if (!Array.isArray(pool)) return null;
  const target = String(symbol || "").trim().toUpperCase();

  return (
    pool.find(s => String(s.symbol || "").trim().toUpperCase() === target) || null
  );
}

// ------------------------------------------
// 19. 單筆查詢（自動 merge 後計算）
// ------------------------------------------
export function queryStock(pool = [], marketMap = {}, symbol = "", context = {}) {
  const stock = findStockBySymbol(pool, symbol);
  if (!stock) return null;

  const merged = mergeStockData(stock, marketMap);
  return evaluateStock(merged, context);
}

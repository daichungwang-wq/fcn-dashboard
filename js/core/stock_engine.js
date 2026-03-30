/* ==========================================
   stock_engine.js V5
   振宇 FCN 系統｜Stock Engine
   目的：
   1. 只處理個股，不處理 FCN 結構
   2. 輸出 pure_stock_score / event_stock_score
   3. Pure 看中期穩定度（abs）
   4. Event 看短期動能（signed）
   5. 提供可解釋欄位
========================================== */

// ------------------------------------------
// 五大分類（定稿）
// ------------------------------------------
const CATEGORY_MAP = {
  core: {
    label: "核心",
    base: 10
  },
  defensive: {
    label: "防禦",
    base: 8
  },
  growth: {
    label: "成長",
    base: 7
  },
  income: {
    label: "收益",
    base: 4
  },
  speculative: {
    label: "投機",
    base: 1
  }
};

// ------------------------------------------
// 工具
// ------------------------------------------
function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round(value, digits = 2) {
  return Number(toNumber(value, 0).toFixed(digits));
}

function abs(value) {
  return Math.abs(toNumber(value, 0));
}

// ------------------------------------------
// 合併 market runtime
// ------------------------------------------
export function mergeStockData(stock = {}, marketRuntime = {}) {
  const symbol = String(stock.symbol || "").trim().toUpperCase();
  const runtime = marketRuntime?.[symbol] || {};

  return {
    ...stock,
    ...runtime,
    symbol
  };
}

// ------------------------------------------
// 1. 分類 / baseline
// ------------------------------------------
export function getCategory(stock = {}) {
  return stock.category || "speculative";
}

export function getBaselineLabel(stock = {}) {
  return CATEGORY_MAP[getCategory(stock)]?.label || "投機";
}

export function calcBaselineScore(stock = {}) {
  return CATEGORY_MAP[getCategory(stock)]?.base ?? 1;
}

// ------------------------------------------
// 2. Pure 用：中期波動度
// 公式：0.1*|1m| + 0.3*|6m| + 0.6*|12m|
// ------------------------------------------
export function calcMidTermVolatility(stock = {}) {
  const r1m = abs(stock.ret_1m);
  const r6m = abs(stock.ret_6m);
  const r12m = abs(stock.ret_12m);

  return round(0.1 * r1m + 0.3 * r6m + 0.6 * r12m, 4);
}

// ------------------------------------------
// 3. Pure 用：中期波動分數
// 規則：
// 0%~5% = 0
// 5%~60% 每5%一格，總共到 -2
// 60%~80% 到 -2.5
// >80% = -3
// ------------------------------------------
export function calcVolScore(volatility = 0) {
  const v = abs(volatility);
  let score = 0;

  if (v <= 0.05) {
    score = 0;
  } else if (v <= 0.6) {
    const step = Math.floor((v - 0.05) / 0.05) + 1;
    score = -step * (2 / 11); // 60% 時精準到 -2
  } else if (v <= 0.8) {
    const step = Math.floor((v - 0.6) / 0.05) + 1;
    score = -2 - step * 0.125; // 80% 時到 -2.5
  } else {
    score = -3;
  }

  if (score < -3) score = -3;
  return round(score, 3);
}

export function calcVolLabel(volatility = 0) {
  const v = abs(volatility);

  if (v <= 0.05) return "極穩定";
  if (v <= 0.10) return "穩定";
  if (v <= 0.20) return "偏穩";
  if (v <= 0.40) return "中等波動";
  if (v <= 0.60) return "偏高波動";
  if (v <= 0.80) return "高波動";
  return "極高波動";
}

// ------------------------------------------
// 4. Pure Stock Score
// Pure = Baseline + Vol Score
// ------------------------------------------
export function calcPureStockScore(stock = {}) {
  const baseline = calcBaselineScore(stock);
  const midVol = calcMidTermVolatility(stock);
  const volScore = calcVolScore(midVol);

  return round(baseline + volScore, 2);
}

export function getPureReason(stock = {}) {
  const baselineLabel = getBaselineLabel(stock);
  const baseline = calcBaselineScore(stock);
  const midVol = calcMidTermVolatility(stock);
  const volScore = calcVolScore(midVol);
  const volLabel = calcVolLabel(midVol);

  return `${baselineLabel}股、Baseline=${baseline}、中期波動=${(midVol * 100).toFixed(1)}%、${volLabel}、VolScore=${volScore}`;
}

// ------------------------------------------
// 5. Event 用：短期動能
// 保留正負，不可 abs
// move = 0.6*1d + 0.3*1w + 0.1*1m
// ------------------------------------------
export function calcEventMove(stock = {}) {
  const r1d = toNumber(stock.ret_1d, 0);
  const r1w = toNumber(stock.ret_1w, 0);
  const r1m = toNumber(stock.ret_1m, 0);

  return round(0.6 * r1d + 0.3 * r1w + 0.1 * r1m, 4);
}

// ------------------------------------------
// 6. Event 用：短期動能分數（5%級距）
// 跌 = 加分
// 漲 = 扣分
// ------------------------------------------
export function calcEventMomentumScore(stock = {}) {
  const movePct = calcEventMove(stock) * 100;

  if (movePct <= -30) return 10;
  if (movePct <= -25) return 9;
  if (movePct <= -20) return 8;
  if (movePct <= -15) return 7;
  if (movePct <= -10) return 5;
  if (movePct <= -5) return 3;

  if (movePct < 5) return 0;

  if (movePct <= 10) return -1;
  if (movePct <= 15) return -2;
  if (movePct <= 20) return -3;
  if (movePct <= 25) return -4;
  if (movePct <= 30) return -5;

  return -8;
}

export function getAdjustmentReason(stock = {}) {
  const movePct = calcEventMove(stock) * 100;
  const score = calcEventMomentumScore(stock);

  if (movePct <= -20) {
    return `短期跌幅很深，FCN 利率可能轉甜，但要確認非結構性風險（EventMomentum=${score}）`;
  }
  if (movePct <= -10) {
    return `短期明顯回檔，屬 FCN 較佳觀察區（EventMomentum=${score}）`;
  }
  if (movePct < 5) {
    return `短期價格接近中性區，時點普通（EventMomentum=${score}）`;
  }
  if (movePct <= 15) {
    return `短期偏強，位置開始偏高（EventMomentum=${score}）`;
  }
  return `短期漲幅過大，不利 FCN 進場（EventMomentum=${score}）`;
}

// ------------------------------------------
// 7. Trend 分類（解釋層）
// ------------------------------------------
export function classifyTrend(stock = {}) {
  const r1m = toNumber(stock.ret_1m, 0);
  const r6m = toNumber(stock.ret_6m, 0);
  const r12m = toNumber(stock.ret_12m, 0);

  if (r12m > 0.2 && r6m > 0 && r1m < 0) {
    return {
      trend: "pullback_in_uptrend",
      trend_label: "長多回檔",
      trend_note: "長期趨勢仍強，短期回檔，較符合 FCN 觀察時點",
      trend_score: 3
    };
  }

  if (r12m > 0.2 && r1m > 0.05) {
    return {
      trend: "strong_uptrend",
      trend_label: "高位強勢",
      trend_note: "中長期很強，但位置偏高，FCN 不宜追價",
      trend_score: -2
    };
  }

  if (r12m > 0 && r6m > 0 && r1m > 0) {
    return {
      trend: "breakout",
      trend_label: "突破轉強",
      trend_note: "近期轉強，但 FCN 時點不一定最好",
      trend_score: -1
    };
  }

  if (r12m < 0 && r6m < 0 && r1m < 0) {
    return {
      trend: "downtrend",
      trend_label: "弱勢下跌",
      trend_note: "中長期偏弱，需避免當成 FCN 核心標的",
      trend_score: -4
    };
  }

  if (r12m < 0 && r1m > 0) {
    return {
      trend: "dead_cat_bounce",
      trend_label: "弱勢反彈",
      trend_note: "長期仍弱，短期反彈不代表安全",
      trend_score: -3
    };
  }

  if (r1m < -0.12 && r12m > 0) {
    return {
      trend: "sharp_pullback",
      trend_label: "急跌修正",
      trend_note: "跌得夠深，利率可能轉甜，但要小心不是壞掉",
      trend_score: 1
    };
  }

  return {
    trend: "neutral",
    trend_label: "中性",
    trend_note: "沒有明顯趨勢優勢，需要搭配事件與結構判斷",
    trend_score: 0
  };
}

// ------------------------------------------
// 8. Event Impact（新聞）
// context.eventImpactMap[symbol]
// ------------------------------------------
export function calcEventImpactScore(stock = {}, context = {}) {
  const symbol = String(stock.symbol || "").trim().toUpperCase();
  const map = context?.eventImpactMap || {};

  return toNumber(map[symbol], 0);
}

export function getEventReason(stock = {}, context = {}) {
  const eventImpact = calcEventImpactScore(stock, context);

  if (eventImpact >= 3) return `事件面顯著正向（News=${eventImpact}）`;
  if (eventImpact >= 1) return `事件面偏正向（News=${eventImpact}）`;
  if (eventImpact <= -3) return `事件面顯著負向（News=${eventImpact}）`;
  if (eventImpact <= -1) return `事件面偏負向（News=${eventImpact}）`;
  return `事件面中性（News=${eventImpact}）`;
}

// ------------------------------------------
// 9. Event Stock Score
// Event = 動能 + trend + 新聞
// 權重先固定，之後再調
// ------------------------------------------
export function calcEventStockScore(stock = {}, context = {}) {
  const momentum = calcEventMomentumScore(stock);
  const trend = classifyTrend(stock).trend_score;
  const news = calcEventImpactScore(stock, context);

  const score =
    0.5 * momentum +
    0.3 * trend +
    0.2 * news;

  return round(score, 2);
}

// ------------------------------------------
// 10. Bias / suggestion
// ------------------------------------------
export function getStockBias(stock = {}, context = {}) {
  const pure = calcPureStockScore(stock);
  const event = calcEventStockScore(stock, context);
  const total = pure + event;

  if (total >= 12) return "very_positive";
  if (total >= 9) return "positive";
  if (total >= 6) return "neutral";
  if (total >= 3) return "cautious";
  return "negative";
}

export function getSuggestion(stock = {}, context = {}) {
  const pure = calcPureStockScore(stock);
  const trend = classifyTrend(stock).trend;

  if (pure < 3) return "避免納入 FCN";
  if (trend === "downtrend") return "避免納入 FCN";
  if (trend === "dead_cat_bounce") return "避免納入 FCN";

  const bias = getStockBias(stock, context);

  if (bias === "very_positive") return "優先列入 FCN 候選";
  if (bias === "positive") return "可列入 FCN 候選";
  if (bias === "neutral") return "中性觀察";
  if (bias === "cautious") return "保守觀察";
  return "避免納入 FCN";
}

// ------------------------------------------
// 11. 主輸出：單股完整評估
// ------------------------------------------
export function evaluateStock(stock = {}, context = {}) {
  const baseline_score = calcBaselineScore(stock);
  const baseline_label = getBaselineLabel(stock);

  const mid_term_volatility = calcMidTermVolatility(stock);
  const vol_score = calcVolScore(mid_term_volatility);
  const vol_label = calcVolLabel(mid_term_volatility);

  const pure_stock_score = calcPureStockScore(stock);

  const trendInfo = classifyTrend(stock);

  const event_move = calcEventMove(stock);
  const event_momentum_score = calcEventMomentumScore(stock);
  const event_impact_score = calcEventImpactScore(stock, context);
  const event_stock_score = calcEventStockScore(stock, context);

  const stock_bias = getStockBias(stock, context);
  const suggestion = getSuggestion(stock, context);

  return {
    symbol: stock.symbol || "",
    name: stock.name || "",
    sector: stock.sector || "",
    subsector: stock.subsector || "",
    category: getCategory(stock),

    price_now: stock.price_now ?? null,
    ret_1d: toNumber(stock.ret_1d, 0),
    ret_1w: toNumber(stock.ret_1w, 0),
    ret_1m: toNumber(stock.ret_1m, 0),
    ret_6m: toNumber(stock.ret_6m, 0),
    ret_12m: toNumber(stock.ret_12m, 0),
    volume: stock.volume ?? null,
    last_update: stock.last_update ?? null,

    baseline_label,
    baseline_score,

    mid_term_volatility,
    vol_score,
    vol_label,

    pure_stock_score,
    pure_reason: getPureReason(stock),

    trend: trendInfo.trend,
    trend_label: trendInfo.trend_label,
    trend_score: trendInfo.trend_score,
    trend_note: trendInfo.trend_note,

    event_move,
    event_momentum_score,
    adjustment_reason: getAdjustmentReason(stock),

    event_impact_score,
    event_reason: getEventReason(stock, context),

    event_stock_score,

    stock_bias,
    suggestion
  };
}

// ------------------------------------------
// 12. 批量
// ------------------------------------------
export function evaluateStockUniverse(pool = [], marketRuntime = {}, context = {}) {
  return (pool || [])
    .map(stock => mergeStockData(stock, marketRuntime))
    .map(stock => evaluateStock(stock, context));
}

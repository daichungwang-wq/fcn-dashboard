// ==========================================
// stock_engine.js V1
// 振宇 FCN 系統｜股票核心引擎
// ==========================================

// 說明：
// 1. 只做股票層的判斷，不做 FCN 結構判斷
// 2. 供 fcn_engine.js / module3_decision.js / module4_review_query.js 共用
// 3. 所有輸出盡量標準化，避免 UI 自己亂算

// ------------------------------------------
// 基礎工具
// ------------------------------------------
function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function avg(values = []) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const valid = values.map(v => toNumber(v, NaN)).filter(v => Number.isFinite(v));
  if (valid.length === 0) return 0;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

// ------------------------------------------
// 類別映射（可依你未來 pool 再調）
// ------------------------------------------
const BASELINE_MAP = {
  core: { label: "核心", score: 10 },
  defensive: { label: "防禦", score: 7 },
  growth: { label: "成長", score: 8 },
  income: { label: "收益", score: 4 },
  financial: { label: "收益", score: 4 },
  cyclical: { label: "收益", score: 4 },
  speculative: { label: "投機", score: 1 },
  high_beta: { label: "投機", score: 1 },
  turnaround: { label: "投機", score: 1 },
  etf: { label: "防禦", score: 7 },
  bond: { label: "防禦", score: 7 }
};

const CATEGORY_VOL_FACTOR = {
  核心: 0.85,
  防禦: 1.0,
  成長: 1.2,
  收益: 1.1,
  投機: 1.3
};

// ------------------------------------------
// 1. Baseline 定義
// ------------------------------------------
export function getBaselineDefinition(category = "") {
  const key = String(category || "").trim().toLowerCase();
  return BASELINE_MAP[key] || { label: "投機", score: 1 };
}

export function calcBaselineScore(stock = {}) {
  if (stock.baseline_score != null) {
    return toNumber(stock.baseline_score, 1);
  }

  const def = getBaselineDefinition(stock.category || stock.group_baseline || stock.type);
  return def.score;
}

export function calcBaselineLabel(stock = {}) {
  if (stock.baseline_label) return String(stock.baseline_label);
  const def = getBaselineDefinition(stock.category || stock.group_baseline || stock.type);
  return def.label;
}

// ------------------------------------------
// 2. 報酬 / 波動度
// ------------------------------------------
// 說明：
// ret_1m / ret_6m / ret_12m 用來推估 pure 調整
// vol_1m / vol_6m / vol_12m 若沒有，就先用 ret 的絕對值代替

export function calcReturnBundle(stock = {}) {
  return {
    ret_1d: toNumber(stock.ret_1d, 0),
    ret_1w: toNumber(stock.ret_1w, 0),
    ret_1m: toNumber(stock.ret_1m, 0),
    ret_6m: toNumber(stock.ret_6m, 0),
    ret_12m: toNumber(stock.ret_12m, 0)
  };
}

export function calcVolatilityBundle(stock = {}) {
  const ret = calcReturnBundle(stock);

  const vol_1m = stock.vol_1m != null ? toNumber(stock.vol_1m, 0) : Math.abs(ret.ret_1m);
  const vol_6m = stock.vol_6m != null ? toNumber(stock.vol_6m, 0) : Math.abs(ret.ret_6m);
  const vol_12m = stock.vol_12m != null ? toNumber(stock.vol_12m, 0) : Math.abs(ret.ret_12m);

  // 這裡沿用你之前討論的概念：越長期權重越高
  const vol_score = 0.1 * Math.abs(vol_1m) + 0.3 * Math.abs(vol_6m) + 0.6 * Math.abs(vol_12m);

  return {
    vol_1m,
    vol_6m,
    vol_12m,
    vol_score: Number(vol_score.toFixed(4))
  };
}

export function getRiskLevelByVol(volScore = 0) {
  const v = Math.abs(toNumber(volScore, 0));

  if (v <= 10) return "低";
  if (v <= 25) return "中低";
  if (v <= 40) return "中";
  if (v <= 60) return "中高";
  return "高";
}

// ------------------------------------------
// 3. 報酬分數（供 Pure 調整）
// ------------------------------------------
// 這裡不是 FCN 分數，而是「股票本身最近走勢」帶來的調整
// 邏輯：過低可能沒動能；過高也可能過熱；中間較合理
export function scoreReturnForPure(value = 0) {
  const v = toNumber(value, 0);

  if (v <= -60) return -3;
  if (v <= -40) return -2;
  if (v <= -20) return -1;
  if (v < 20) return 1;
  if (v < 40) return 2;
  if (v < 60) return 1;
  if (v < 80) return -1;
  return -2;
}

export function calcReturnScoreBundle(stock = {}) {
  const ret = calcReturnBundle(stock);

  const score_1m = scoreReturnForPure(ret.ret_1m);
  const score_6m = scoreReturnForPure(ret.ret_6m);
  const score_12m = scoreReturnForPure(ret.ret_12m);

  const weighted = 0.1 * score_1m + 0.3 * score_6m + 0.6 * score_12m;

  return {
    score_1m,
    score_6m,
    score_12m,
    weighted_return_score: Number(weighted.toFixed(4))
  };
}

// ------------------------------------------
// 4. Pure Score
// ------------------------------------------
// Pure = baseline + adjustment_model
// adjustment_model = 報酬評分 × 分類波動修正因子
export function calcPureAdjustment(stock = {}) {
  const baselineLabel = calcBaselineLabel(stock);
  const returnScores = calcReturnScoreBundle(stock);
  const factor = CATEGORY_VOL_FACTOR[baselineLabel] ?? 1.0;

  const adjustment = returnScores.weighted_return_score * factor;

  return {
    factor,
    adjustment: Number(adjustment.toFixed(4)),
    ...returnScores
  };
}

export function calcPureScore(stock = {}) {
  if (stock.pure_score != null) {
    return toNumber(stock.pure_score, 0);
  }

  const baseline = calcBaselineScore(stock);
  const adj = calcPureAdjustment(stock);

  return Number((baseline + adj.adjustment).toFixed(4));
}

// ------------------------------------------
// 5. Event Score
// ------------------------------------------
// 先留標準介面，之後 M1 新聞進來直接接
export function calcEventImpact(stock = {}, context = {}) {
  // 優先用外部傳入
  if (context.eventImpact != null) {
    return toNumber(context.eventImpact, 0);
  }

  // 再看 stock 本身有沒有預留欄位
  if (stock.event_bias != null) {
    return toNumber(stock.event_bias, 0);
  }

  return 0;
}

export function calcEventWeight(stock = {}, context = {}) {
  // 預設 0.3，之後可由 M1 模組或新聞引擎覆蓋
  if (context.eventWeight != null) {
    return toNumber(context.eventWeight, 0.3);
  }

  return 0.3;
}

export function calcEventScore(stock = {}, context = {}) {
  const pure = calcPureScore(stock);
  const impact = calcEventImpact(stock, context);
  const weight = calcEventWeight(stock, context);

  return Number((pure + impact * weight).toFixed(4));
}

// ------------------------------------------
// 6. 股票是否可進 FCN Pool
// ------------------------------------------
export function isTradable(stock = {}, context = {}) {
  // 若明確指定 can_hold = false，直接不做
  if (stock.can_hold === false) return false;
  if (stock.allow_fcn === false) return false;

  const baseline = calcBaselineScore(stock);
  const vol = calcVolatilityBundle(stock).vol_score;
  const riskLevel = getRiskLevelByVol(vol);

  // 基本原則：投機 / 極高波動先擋
  if (baseline <= 1) return false;
  if (riskLevel === "高" && context.allowHighVol !== true) return false;

  return true;
}

// ------------------------------------------
// 7. 封裝：輸出標準化股票分析結果
// ------------------------------------------
export function evaluateStock(stock = {}, context = {}) {
  const baseline_score = calcBaselineScore(stock);
  const baseline_label = calcBaselineLabel(stock);

  const volatility = calcVolatilityBundle(stock);
  const pureAdjustment = calcPureAdjustment(stock);
  const pure_score = calcPureScore(stock);
  const event_score = calcEventScore(stock, context);
  const tradable = isTradable(stock, context);

  return {
    symbol: stock.symbol || "",
    name: stock.name || "",
    category: stock.category || stock.group_baseline || stock.type || "",
    sector: stock.sector || "",
    price_now: stock.price_now ?? stock.price ?? null,

    baseline_label,
    baseline_score,

    ret_1d: calcReturnBundle(stock).ret_1d,
    ret_1w: calcReturnBundle(stock).ret_1w,
    ret_1m: calcReturnBundle(stock).ret_1m,
    ret_6m: calcReturnBundle(stock).ret_6m,
    ret_12m: calcReturnBundle(stock).ret_12m,

    vol_1m: volatility.vol_1m,
    vol_6m: volatility.vol_6m,
    vol_12m: volatility.vol_12m,
    vol_score: volatility.vol_score,
    risk_level: getRiskLevelByVol(volatility.vol_score),

    pure_adjustment_factor: pureAdjustment.factor,
    pure_adjustment: pureAdjustment.adjustment,
    weighted_return_score: pureAdjustment.weighted_return_score,

    pure_score,
    event_score,
    event_impact: calcEventImpact(stock, context),
    event_weight: calcEventWeight(stock, context),

    tradable
  };
}

// ------------------------------------------
// 8. 批量評估
// ------------------------------------------
export function evaluateStockPool(pool = [], context = {}) {
  if (!Array.isArray(pool)) return [];
  return pool.map(stock => evaluateStock(stock, context));
}

// ------------------------------------------
// 9. 查詢工具
// ------------------------------------------
export function findStockBySymbol(pool = [], symbol = "") {
  if (!Array.isArray(pool)) return null;
  const target = String(symbol || "").trim().toUpperCase();
  return pool.find(s => String(s.symbol || "").trim().toUpperCase() === target) || null;
}

export function queryStock(pool = [], symbol = "", context = {}) {
  const stock = findStockBySymbol(pool, symbol);
  if (!stock) return null;
  return evaluateStock(stock, context);
}

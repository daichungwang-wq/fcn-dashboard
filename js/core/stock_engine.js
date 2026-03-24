// ==========================================
// stock_engine.js V2
// 振宇 FCN 系統｜股票核心引擎
// Pure 完全對齊定稿版
// ==========================================

// ------------------------------------------
// 工具
// ------------------------------------------
function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

// ------------------------------------------
// 1. Baseline 定義
// 你的定稿：
// 核心 = 10
// 防禦 = 8
// 成長 = 7
// 收益 = 4
// 投機(避免) = 1
// ------------------------------------------
const BASELINE_MAP = {
  core: { label: "核心", score: 10 },
  defensive: { label: "防禦", score: 8 },
  growth: { label: "成長", score: 7 },
  income: { label: "收益", score: 4 },
  financial: { label: "收益", score: 4 },
  cyclical: { label: "收益", score: 4 },
  speculative: { label: "投機", score: 1 },
  high_beta: { label: "投機", score: 1 },
  turnaround: { label: "投機", score: 1 },
  etf: { label: "防禦", score: 8 },
  bond: { label: "防禦", score: 8 }
};

export function getBaselineDefinition(category = "") {
  const key = String(category || "").trim().toLowerCase();
  return BASELINE_MAP[key] || { label: "投機", score: 1 };
}

export function calcBaselineScore(stock = {}) {
  if (stock.baseline_score != null) {
    return toNumber(stock.baseline_score, 1);
  }

  const def = getBaselineDefinition(
    stock.category || stock.group_baseline || stock.type
  );
  return def.score;
}

export function calcBaselineLabel(stock = {}) {
  if (stock.baseline_label) return String(stock.baseline_label);

  const def = getBaselineDefinition(
    stock.category || stock.group_baseline || stock.type
  );
  return def.label;
}

// ------------------------------------------
// 2. 五大分類波動調整因子
// 完全對齊你定稿
// ------------------------------------------
const CATEGORY_VOL_FACTOR = {
  核心: 1.0,
  防禦: 0.8,
  成長: 1.2,
  收益: 1.4,
  投機: 0.7
};

export function getCategoryVolFactor(stock = {}) {
  const label = calcBaselineLabel(stock);
  return CATEGORY_VOL_FACTOR[label] ?? 0.7;
}

// ------------------------------------------
// 3. 報酬資料
// 用於波動度計算
// ------------------------------------------
export function calcReturnBundle(stock = {}) {
  return {
    ret_1d: toNumber(stock.ret_1d, 0),
    ret_1w: toNumber(stock.ret_1w, 0),
    ret_1m: toNumber(stock.ret_1m, 0),
    ret_6m: toNumber(stock.ret_6m, 0),
    ret_12m: toNumber(stock.ret_12m, 0)
  };
}

// ------------------------------------------
// 4. 波動度
// 完全對齊你定稿：
// 波動度 = 0.1*|1m| + 0.3*|6m| + 0.6*|12m|
// ------------------------------------------
export function calcVolatility(stock = {}) {
  const ret = calcReturnBundle(stock);

  const vol =
    0.1 * Math.abs(ret.ret_1m) +
    0.3 * Math.abs(ret.ret_6m) +
    0.6 * Math.abs(ret.ret_12m);

  return Number(vol.toFixed(4));
}

// ------------------------------------------
// 5. 波動分數
// 完全對齊你定稿
// <=10      太低   -2
// >10~<=20  過低   -1
// >20~<=40  合理   +1
// >40~<=60  過高   -1
// >60~<=80  太高   -2
// >80       異常   -3
// ------------------------------------------
export function calcVolScore(volatility = 0) {
  const v = Math.abs(toNumber(volatility, 0));

  if (v <= 10) return -2;
  if (v <= 20) return -1;
  if (v <= 40) return 1;
  if (v <= 60) return -1;
  if (v <= 80) return -2;
  return -3;
}

export function calcVolLabel(volatility = 0) {
  const v = Math.abs(toNumber(volatility, 0));

  if (v <= 10) return "太低";
  if (v <= 20) return "過低";
  if (v <= 40) return "合理";
  if (v <= 60) return "過高";
  if (v <= 80) return "太高";
  return "異常";
}

// ------------------------------------------
// 6. Pure Adjustment
// 完全對齊你定稿：
// adjustment = 波動調整因子 × 波動分數
//
// 注意：你圖上雖然寫了「五大分類 * 波動度調整因子 * 波動分數」
// 但五大分類已經映射成 baseline 與 factor，
// 所以實際落地就是：factor × volScore
// ------------------------------------------
export function calcPureAdjustment(stock = {}) {
  const factor = getCategoryVolFactor(stock);
  const volatility = calcVolatility(stock);
  const volScore = calcVolScore(volatility);

  const adjustment = factor * volScore;

  return {
    factor,
    volatility,
    vol_score: volScore,
    vol_label: calcVolLabel(volatility),
    adjustment: Number(adjustment.toFixed(4))
  };
}

// ------------------------------------------
// 7. Pure Score
// 完全對齊你定稿：
// Pure = Baseline + Adjustment
// ------------------------------------------
export function calcPureScore(stock = {}) {
  if (stock.pure_score != null) {
    return toNumber(stock.pure_score, 0);
  }

  const baseline = calcBaselineScore(stock);
  const adj = calcPureAdjustment(stock);

  return Number((baseline + adj.adjustment).toFixed(4));
}

// ------------------------------------------
// 8. Event Score
// 定稿：
// Event Score = Pure Score + Event Impact × Event Weight
// 事件來源未來由 M1 提供
// ------------------------------------------
export function calcEventImpact(stock = {}, context = {}) {
  if (context.eventImpact != null) {
    return toNumber(context.eventImpact, 0);
  }

  if (stock.event_impact != null) {
    return toNumber(stock.event_impact, 0);
  }

  if (stock.event_bias != null) {
    return toNumber(stock.event_bias, 0);
  }

  return 0;
}

export function calcEventWeight(stock = {}, context = {}) {
  if (context.eventWeight != null) {
    return toNumber(context.eventWeight, 0.3);
  }

  if (stock.event_weight != null) {
    return toNumber(stock.event_weight, 0.3);
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
// 9. 可否納入 FCN Pool
// 先用簡化版：投機 / allow_fcn=false / can_hold=false 直接擋
// ------------------------------------------
export function isTradable(stock = {}) {
  if (stock.can_hold === false) return false;
  if (stock.allow_fcn === false) return false;

  const baseline = calcBaselineScore(stock);
  if (baseline <= 1) return false;

  return true;
}

// ------------------------------------------
// 10. 單檔評估輸出
// ------------------------------------------
export function evaluateStock(stock = {}, context = {}) {
  const ret = calcReturnBundle(stock);
  const baseline_label = calcBaselineLabel(stock);
  const baseline_score = calcBaselineScore(stock);
  const pureAdj = calcPureAdjustment(stock);
  const pure_score = calcPureScore(stock);
  const event_score = calcEventScore(stock, context);

  return {
    symbol: stock.symbol || "",
    name: stock.name || "",
    category: stock.category || stock.group_baseline || stock.type || "",
    sector: stock.sector || "",
    price_now: stock.price_now ?? stock.price ?? null,

    baseline_label,
    baseline_score,

    ret_1d: ret.ret_1d,
    ret_1w: ret.ret_1w,
    ret_1m: ret.ret_1m,
    ret_6m: ret.ret_6m,
    ret_12m: ret.ret_12m,

    volatility: pureAdj.volatility,
    vol_score: pureAdj.vol_score,
    vol_label: pureAdj.vol_label,
    pure_adjustment_factor: pureAdj.factor,
    pure_adjustment: pureAdj.adjustment,

    pure_score,
    event_impact: calcEventImpact(stock, context),
    event_weight: calcEventWeight(stock, context),
    event_score,

    tradable: isTradable(stock)
  };
}

// ------------------------------------------
// 11. 批量評估
// ------------------------------------------
export function evaluateStockPool(pool = [], context = {}) {
  if (!Array.isArray(pool)) return [];
  return pool.map(stock => evaluateStock(stock, context));
}

// ------------------------------------------
// 12. 查詢工具
// ------------------------------------------
export function findStockBySymbol(pool = [], symbol = "") {
  if (!Array.isArray(pool)) return null;
  const target = String(symbol || "").trim().toUpperCase();

  return (
    pool.find(
      s => String(s.symbol || "").trim().toUpperCase() === target
    ) || null
  );
}

export function queryStock(pool = [], symbol = "", context = {}) {
  const stock = findStockBySymbol(pool, symbol);
  if (!stock) return null;
  return evaluateStock(stock, context);
}

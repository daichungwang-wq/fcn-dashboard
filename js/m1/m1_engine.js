// ==========================================
// M1 Engine V2
// 振宇 FCN 系統｜Pool30 體質選股引擎
// Level 1: scoring all stocks
// Level 2: category stats
// ==========================================

// ---------- 基本工具 ----------
function toNum(v, d = null) {
  if (v === null || v === undefined || v === "") return d;
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}

function avg(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function std(arr) {
  if (arr.length <= 1) return 0;
  const m = avg(arr);
  const variance =
    arr.reduce((sum, x) => sum + Math.pow(x - m, 2), 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

function percentile(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

function safeMin(arr) {
  return arr.length ? Math.min(...arr) : 0;
}

function safeMax(arr) {
  return arr.length ? Math.max(...arr) : 0;
}

function round2(v) {
  return Math.round((Number(v) || 0) * 100) / 100;
}

// ---------- ETF 白名單 ----------
const ETF_FORCE_DEFENSIVE = ["QQQ", "SMH", "SPY", "LQD"];

// ---------- Category normalize ----------
function normalizeCategory(stock) {
  const symbol = String(stock.symbol || "").toUpperCase().trim();
  if (ETF_FORCE_DEFENSIVE.includes(symbol)) return "defensive";

  const raw = String(stock.category || stock["分類"] || "")
    .toLowerCase()
    .trim();

  if (raw.includes("core")) return "core";
  if (raw.includes("growth")) return "growth";
  if (raw.includes("income")) return "income";
  if (raw.includes("defensive")) return "defensive";
  if (raw.includes("speculative")) return "speculative";

  // 常見實務補位
  if (raw.includes("cyclical")) return "speculative";
  if (raw.includes("high_beta")) return "speculative";
  if (raw.includes("others")) return "speculative";

  return "speculative";
}

// ---------- Capex to Profit ----------
function capexScore(stock) {
  const capex = toNum(stock.capex);
  const profit = toNum(stock.profit);

  if (!Number.isFinite(capex) || !Number.isFinite(profit) || profit <= 0) {
    return null;
  }

  const ratio = capex / profit;

  if (ratio >= 2.0) return 10;
  if (ratio >= 1.5) return 8;
  if (ratio >= 1.0) return 6;
  if (ratio >= 0.5) return 4;
  if (ratio >= 0.2) return 2;
  return 1;
}

// ---------- M3 (without baseline) ----------
// 先保留接口：如果未來有 pure/snapshot/event 就能直接吃
function m3Score(stock) {
  const pure = toNum(stock.pure_stock_score);
  const snapshot = toNum(stock.snapshot_score ?? stock.snapshot);
  const event = toNum(stock.event_stock_score);

  const parts = [];
  if (pure !== null) parts.push({ w: 0.5, v: pure });
  if (snapshot !== null) parts.push({ w: 0.3, v: snapshot });
  if (event !== null) parts.push({ w: 0.2, v: event });

  if (!parts.length) return null;

  const sumW = parts.reduce((s, x) => s + x.w, 0);
  const sumV = parts.reduce((s, x) => s + x.w * x.v, 0);
  return sumV / sumW;
}

// ---------- M7 long-term only ----------
// 嚴格只借 valuation / trend / quality
function m7Score(stock) {
  const val = toNum(stock.valuation_score);
  const trend = toNum(stock.trend_score);
  const quality = toNum(stock.quality_score);

  const parts = [];
  if (val !== null) parts.push({ w: 0.4, v: val });
  if (trend !== null) parts.push({ w: 0.3, v: trend });
  if (quality !== null) parts.push({ w: 0.3, v: quality });

  if (!parts.length) return null;

  const sumW = parts.reduce((s, x) => s + x.w, 0);
  const sumV = parts.reduce((s, x) => s + x.w * x.v, 0);
  return sumV / sumW;
}

// ---------- M1 score ----------
// 權重先照目前版本：
// a = 0.5 capex_to_profit
// b = 0.25 M3 without baseline
// c = 0.25 M7 (valuation/trend/quality)
function calcM1(stock) {
  const capex = capexScore(stock);
  const m3 = m3Score(stock);
  const m7 = m7Score(stock);

  let weighted = 0;
  let totalWeight = 0;

  if (capex !== null) {
    weighted += 0.5 * capex;
    totalWeight += 0.5;
  }
  if (m3 !== null) {
    weighted += 0.25 * m3;
    totalWeight += 0.25;
  }
  if (m7 !== null) {
    weighted += 0.25 * m7;
    totalWeight += 0.25;
  }

  const score = totalWeight > 0 ? weighted / totalWeight : 0;

  return {
    M1_score: round2(score),
    capex_score: capex !== null ? round2(capex) : null,
    m3_score: m3 !== null ? round2(m3) : null,
    m7_score: m7 !== null ? round2(m7) : null,
    score_source_weight: round2(totalWeight)
  };
}

// ---------- Level 2 stats ----------
function buildCategoryStats(results) {
  const groups = {
    core: [],
    growth: [],
    income: [],
    defensive: [],
    speculative: []
  };

  for (const row of results) {
    if (!groups[row.category]) groups[row.category] = [];
    if (Number.isFinite(row.M1_score)) {
      groups[row.category].push(row.M1_score);
    }
  }

  const stats = {};

  for (const key of Object.keys(groups)) {
    const arr = groups[key];
    stats[key] = {
      count: arr.length,
      mean: round2(avg(arr)),
      std: round2(std(arr)),
      min: round2(safeMin(arr)),
      max: round2(safeMax(arr)),
      p25: round2(percentile(arr, 25)),
      p50: round2(percentile(arr, 50)),
      p75: round2(percentile(arr, 75))
    };
  }

  return stats;
}

// ---------- Level 3 初步 bucket（先簡版） ----------
function buildInitialBuckets(results, stats) {
  return results.map((row) => {
    const catStats = stats[row.category] || { mean: 0, std: 0 };
    const mean = catStats.mean || 0;
    const s = catStats.std || 0;

    let bucket = "watch";

    if (row.M1_score >= mean + 0.5 * s) bucket = "pool30";
    else if (row.M1_score >= mean) bucket = "stock_pool";
    else if (row.M1_score >= mean - 0.75 * s) bucket = "watch";
    else bucket = "reject";

    return {
      ...row,
      initial_bucket: bucket
    };
  });
}

// ---------- 主函式 ----------
export function runM1Engine(stockList) {
  const results = stockList.map((stock) => {
    const category = normalizeCategory(stock);

    const {
      M1_score,
      capex_score,
      m3_score,
      m7_score,
      score_source_weight
    } = calcM1(stock);

    return {
      symbol: String(stock.symbol || "").toUpperCase().trim(),
      name: stock.name || stock["股名"] || "",
      category,
      raw_category: stock.category || stock["分類"] || "",
      M1_score,
      breakdown: {
        capex_score,
        m3_score,
        m7_score
      },
      debug: {
        score_source_weight,
        valuation_score: toNum(stock.valuation_score),
        trend_score: toNum(stock.trend_score),
        quality_score: toNum(stock.quality_score),
        snapshot: toNum(stock.snapshot),
        growth: toNum(stock.growth),
        capex: toNum(stock.capex),
        profit: toNum(stock.profit)
      }
    };
  });

  const stats = buildCategoryStats(results);
  const scored = buildInitialBuckets(results, stats);

  return {
    updated_at: new Date().toISOString(),
    total_count: scored.length,
    scores: scored.sort((a, b) => b.M1_score - a.M1_score),
    stats
  };
}

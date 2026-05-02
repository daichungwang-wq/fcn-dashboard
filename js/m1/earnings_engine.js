// =====================================================
// M1 Earnings / Competitive Score Engine
// Path in repo: js/m1/earnings_engine.js
// Data source expected by page: data/m1/eps_history_ai.json
//
// v1 = baseline earnings power
// v3 = four-step earnings power model
// competitive = EPS-driven M1 competitive score layer
// =====================================================

function clamp(v, min = 0, max = 10) {
  if (!Number.isFinite(v)) return 0;
  return Math.max(min, Math.min(max, v));
}

function round(v, digits = 2) {
  if (!Number.isFinite(v)) return null;
  return Number(v.toFixed(digits));
}

function mean(arr) {
  if (!arr || !arr.length) return null;
  return arr.reduce((s, x) => s + x, 0) / arr.length;
}

function isFiniteNumber(v) {
  return Number.isFinite(Number(v));
}

function safeGrowth(next, base) {
  if (!isFiniteNumber(next) || !isFiniteNumber(base) || Number(base) === 0) return null;
  return Number(next) / Number(base) - 1;
}

function linearRegression(x, y) {
  const n = x.length;
  if (!n || n !== y.length) return null;

  const mx = mean(x);
  const my = mean(y);
  if (!Number.isFinite(mx) || !Number.isFinite(my)) return null;

  let num = 0;
  let den = 0;

  for (let i = 0; i < n; i++) {
    num += (x[i] - mx) * (y[i] - my);
    den += (x[i] - mx) ** 2;
  }

  if (den === 0) return null;

  const slope = num / den;
  const intercept = my - slope * mx;

  let ssTot = 0;
  let ssRes = 0;

  for (let i = 0; i < n; i++) {
    const pred = slope * x[i] + intercept;
    ssTot += (y[i] - my) ** 2;
    ssRes += (y[i] - pred) ** 2;
  }

  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

  return {
    model: "linear",
    slope,
    intercept,
    r2: clamp(r2, 0, 1)
  };
}

function expRegression(x, y) {
  if (!y.every(v => v > 0)) return null;

  const logY = y.map(v => Math.log(v));
  const reg = linearRegression(x, logY);
  if (!reg) return null;

  return {
    model: "exponential",
    slope: Math.exp(reg.slope) - 1,
    intercept: reg.intercept,
    r2: reg.r2
  };
}

function logRegression(x, y) {
  if (!x.every(v => v > 0)) return null;

  const logX = x.map(v => Math.log(v));
  const reg = linearRegression(logX, y);
  if (!reg) return null;

  return {
    model: "log",
    slope: reg.slope,
    intercept: reg.intercept,
    r2: reg.r2
  };
}

function pickBestModel(x, y) {
  const models = [];

  const linear = linearRegression(x, y);
  if (linear) models.push(linear);

  const exp = expRegression(x, y);
  if (exp && exp.slope <= 1.0) models.push(exp);

  const log = logRegression(x.map(v => v + 1), y);
  if (log) models.push(log);

  if (!models.length) return null;

  models.sort((a, b) => b.r2 - a.r2);
  return models[0];
}

function normalizeHistory(stock) {
  return (stock?.eps_history || [])
    .filter(x => x && isFiniteNumber(x.eps))
    .map(x => ({
      fiscal_year: Number(x.fiscal_year),
      eps: Number(x.eps)
    }))
    .filter(x => Number.isFinite(x.fiscal_year))
    .sort((a, b) => a.fiscal_year - b.fiscal_year);
}

function isForwardEstimateUsable(row, strictAnalystCount = false) {
  if (!row || !isFiniteNumber(row.eps_estimate) || !Number.isFinite(Number(row.fiscal_year))) return false;
  if (!strictAnalystCount) return true;
  return Number(row.analyst_count) >= 5;
}

function getForwardRows(stock, options = {}) {
  const strictAnalystCount = Boolean(options.strictAnalystCount);
  return (stock?.eps_forward || [])
    .filter(x => isForwardEstimateUsable(x, strictAnalystCount))
    .map(x => ({
      fiscal_year: Number(x.fiscal_year),
      eps_estimate: Number(x.eps_estimate),
      analyst_count: Number.isFinite(Number(x.analyst_count)) ? Number(x.analyst_count) : null
    }))
    .sort((a, b) => a.fiscal_year - b.fiscal_year);
}

function getForwardMap(stock, options = {}) {
  const map = {};
  getForwardRows(stock, options).forEach(x => {
    map[x.fiscal_year] = x.eps_estimate;
  });
  return map;
}

function growthScoreFromRate(g) {
  if (!Number.isFinite(g)) return 0;
  return clamp(5 + g * 10, 0, 10);
}

function futureProfitScore(stock, hist, forwardRows) {
  const latest = [...hist].reverse().find(x => isFiniteNumber(x.eps));
  const latestEPS = latest ? latest.eps : null;
  const usableForward = forwardRows.filter(x => isFiniteNumber(x.eps_estimate));
  const positiveCount = usableForward.filter(x => x.eps_estimate > 0).length;

  if (!usableForward.length && !isFiniteNumber(latestEPS)) return 0;
  if (usableForward.length && positiveCount === usableForward.length) return 10;
  if (usableForward.length && positiveCount > 0) return 6;
  if (isFiniteNumber(latestEPS) && latestEPS > 0) return 5;
  return 2;
}

function qualityPenalty(stock, y) {
  let penalty = 0;
  const flags = stock?.quality_flag || [];
  const basis = stock?.eps_basis || "";

  if (y.some(v => v < 0)) penalty += 1.5;
  if (flags.includes("high_volatility")) penalty += 1.0;
  if (flags.includes("volatile")) penalty += 1.0;
  if (flags.includes("negative_eps")) penalty += 1.5;
  if (flags.includes("cyclical")) penalty += 1.0;
  if (flags.includes("adjusted_eps") || basis === "adjusted_eps") penalty += 0.5;
  if (flags.includes("rebound")) penalty += 0.5;

  return penalty;
}

function shouldSkipEPS(stock) {
  return Boolean(stock?.skip_eps) || stock?.type === "ETF" || stock?.eps_basis === "not_applicable";
}

// =====================================================
// V1 baseline
// =====================================================
export function calcEarningsPowerV1(stock) {
  if (shouldSkipEPS(stock)) {
    return {
      earnings_power_score: null,
      status: "eps_not_applicable",
      version: "v1"
    };
  }

  const hist = normalizeHistory(stock);

  if (hist.length < 5) {
    return {
      earnings_power_score: null,
      status: "insufficient_eps_history",
      version: "v1"
    };
  }

  const x = hist.map((_, i) => i);
  const y = hist.map(d => d.eps);
  const bestModel = pickBestModel(x, y);

  const fwd = getForwardMap(stock);
  const e26 = fwd[2026];
  const e27 = fwd[2027];

  let growthRaw = 0;
  if (Number.isFinite(e26) && Number.isFinite(e27) && e26 !== 0) {
    growthRaw = e27 / e26 - 1;
  }

  const growthScore = clamp((growthRaw / 0.5) * 10, 0, 10);

  const avgEPS = mean(y);
  let consistencyRaw = 0;

  if (bestModel && Number.isFinite(avgEPS) && avgEPS !== 0) {
    consistencyRaw =
      bestModel.model === "exponential"
        ? bestModel.slope
        : bestModel.slope / avgEPS;
  }

  const consistencyScore = clamp((consistencyRaw / 0.2) * 10, 0, 10);
  const qualityScore = bestModel ? bestModel.r2 * 10 : 0;

  const earningsPower =
    0.4 * growthScore +
    0.35 * consistencyScore +
    0.25 * qualityScore;

  return {
    earnings_power_score: round(earningsPower),
    version: "v1",
    status: "ok",
    components: {
      growth: round(growthScore),
      consistency: round(consistencyScore),
      quality: round(qualityScore)
    },
    meta: {
      best_model: bestModel?.model || null,
      r2: bestModel ? round(bestModel.r2, 3) : null,
      slope: bestModel ? round(bestModel.slope, 4) : null,
      history_years: hist.length
    }
  };
}

// =====================================================
// V3 four-step model
// Growth + Short Consistency + Middle Consistency + Quality
// =====================================================
export function calcEarningsPowerV3(stock, options = {}) {
  const EPS_MIN_YEARS = options.minHistoryYears || 5;
  const strictAnalystCount = Boolean(options.strictAnalystCount);

  const WEIGHTS = {
    growth: 0.30,
    shortConsistency: 0.25,
    middleConsistency: 0.25,
    quality: 0.20
  };

  if (shouldSkipEPS(stock)) {
    return {
      earnings_power_score: null,
      version: "v3",
      status: "eps_not_applicable",
      components: {
        growth: null,
        short_consistency: null,
        middle_consistency: null,
        quality: null
      },
      meta: {
        reason: "ETF/no single-company EPS"
      }
    };
  }

  const hist = normalizeHistory(stock);

  if (hist.length < EPS_MIN_YEARS) {
    return {
      earnings_power_score: null,
      version: "v3",
      status: "insufficient_eps_history",
      components: {
        growth: null,
        short_consistency: null,
        middle_consistency: null,
        quality: null
      },
      meta: {
        history_years: hist.length,
        required_years: EPS_MIN_YEARS
      }
    };
  }

  const x = hist.map((_, i) => i);
  const y = hist.map(d => d.eps);
  const bestModel = pickBestModel(x, y);
  const forwardRows = getForwardRows(stock, { strictAnalystCount });
  const fwd = getForwardMap(stock, { strictAnalystCount });

  const e25 = fwd[2025];
  const e26 = fwd[2026];
  const e27 = fwd[2027];

  // Step 1: Growth, prefer 2026→2027. If 2027 is missing, fallback to 2025→2026.
  let growthRaw = null;
  let growthScore = 0;
  let growthBasis = "missing_forward_data";

  const g26to27 = safeGrowth(e27, e26);
  const g25to26 = safeGrowth(e26, e25);

  if (Number.isFinite(g26to27)) {
    growthRaw = g26to27;
    growthScore = growthScoreFromRate(growthRaw);
    growthBasis = "2026_to_2027";
  } else if (Number.isFinite(g25to26)) {
    growthRaw = g25to26;
    growthScore = growthScoreFromRate(growthRaw);
    growthBasis = "fallback_2025_to_2026";
  }

  // Step 2: Short Consistency = 2025→2026 + 2026→2027 when both exist; otherwise single-forward fallback.
  let shortScore = 0;
  let g1 = null;
  let g2 = null;
  let shortBasis = "missing_forward_data";

  if (Number.isFinite(g25to26) && Number.isFinite(g26to27)) {
    g1 = g25to26;
    g2 = g26to27;

    shortScore =
      0.55 * growthScoreFromRate(g1) +
      0.45 * growthScoreFromRate(g2);

    shortScore = clamp(shortScore, 0, 10);
    shortBasis = "2025_to_2026_and_2026_to_2027";
  } else if (Number.isFinite(g25to26)) {
    g1 = g25to26;
    shortScore = growthScoreFromRate(g1);
    shortBasis = "fallback_2025_to_2026";
  } else if (Number.isFinite(g26to27)) {
    g2 = g26to27;
    shortScore = growthScoreFromRate(g2);
    shortBasis = "fallback_2026_to_2027";
  }

  // Step 3: Middle Consistency = historical slope / mean EPS
  const avgEPS = mean(y);
  let middleRaw = null;
  let middleScore = 0;
  let middleBasis = "invalid_history";

  if (bestModel && Number.isFinite(avgEPS) && avgEPS !== 0) {
    if (bestModel.model === "exponential") {
      middleRaw = bestModel.slope;
    } else {
      middleRaw = bestModel.slope / Math.abs(avgEPS);
    }

    middleScore = clamp(5 + middleRaw * 20, 0, 10);
    middleBasis = `${bestModel.model}_slope`;
  }

  // Step 4: Quality = best model R² minus penalty
  const penalty = qualityPenalty(stock, y);
  const qualityBase = bestModel ? bestModel.r2 * 10 : 0;
  const qualityScore = clamp(qualityBase - penalty, 0, 10);

  const earningsPower =
    WEIGHTS.growth * growthScore +
    WEIGHTS.shortConsistency * shortScore +
    WEIGHTS.middleConsistency * middleScore +
    WEIGHTS.quality * qualityScore;

  return {
    earnings_power_score: round(earningsPower),
    version: "v3",
    status: "ok",

    components: {
      growth: round(growthScore),
      short_consistency: round(shortScore),
      middle_consistency: round(middleScore),
      quality: round(qualityScore)
    },

    raw: {
      growth_raw: growthRaw,
      short_g1_2026_vs_2025: g1,
      short_g2_2027_vs_2026: g2,
      middle_raw: middleRaw,
      r2: bestModel ? bestModel.r2 : null,
      quality_base: qualityBase,
      quality_penalty: penalty
    },

    meta: {
      weights: WEIGHTS,
      best_model: bestModel ? bestModel.model : null,
      history_years: hist.length,
      forward_years_used: forwardRows.map(x => x.fiscal_year),
      strict_analyst_count: strictAnalystCount,
      growth_basis: growthBasis,
      short_consistency_basis: shortBasis,
      middle_consistency_basis: middleBasis,
      quality_basis: bestModel ? `${bestModel.model}_r2_minus_penalty` : "no_model",
      flags: stock?.quality_flag || [],
      data_quality: stock?.data_quality || null,
      engine_flags: stock?.engine_flags || null
    }
  };
}

// =====================================================
// Competitive Score Layer
// Purpose: connect EPS data to M1 competitive sandbox.
// This is intentionally EPS-only. It can be mixed later with capex/M3/M7.
// =====================================================
export function calcM1CompetitiveScore(stock, options = {}) {
  const COMPETITIVE_WEIGHTS = {
    futureProfit: 0.20,
    futureGrowth: 0.30,
    middleConsistency: 0.25,
    quality: 0.25
  };

  const hist = normalizeHistory(stock);
  const forwardRows = getForwardRows(stock, {
    strictAnalystCount: Boolean(options.strictAnalystCount)
  });

  if (shouldSkipEPS(stock)) {
    return {
      symbol: stock?.symbol || null,
      name: stock?.name || null,
      competitive_score: null,
      earnings_power_score: null,
      status: "eps_not_applicable",
      components: {
        future_profit: null,
        future_growth: null,
        middle_consistency: null,
        quality: null
      },
      meta: {
        reason: "ETF/no single-company EPS"
      }
    };
  }

  const v3 = calcEarningsPowerV3(stock, options);
  if (v3.status !== "ok") {
    return {
      symbol: stock?.symbol || null,
      name: stock?.name || null,
      competitive_score: null,
      earnings_power_score: v3.earnings_power_score,
      status: v3.status,
      components: {
        future_profit: null,
        future_growth: null,
        middle_consistency: null,
        quality: null
      },
      meta: v3.meta
    };
  }

  const futureProfit = futureProfitScore(stock, hist, forwardRows);
  const futureGrowth = v3.components.growth;
  const middleConsistency = v3.components.middle_consistency;
  const quality = v3.components.quality;

  const competitiveScore =
    COMPETITIVE_WEIGHTS.futureProfit * futureProfit +
    COMPETITIVE_WEIGHTS.futureGrowth * futureGrowth +
    COMPETITIVE_WEIGHTS.middleConsistency * middleConsistency +
    COMPETITIVE_WEIGHTS.quality * quality;

  return {
    symbol: stock?.symbol || null,
    name: stock?.name || null,
    competitive_score: round(competitiveScore),
    earnings_power_score: v3.earnings_power_score,
    version: "competitive_v1_eps",
    status: "ok",
    components: {
      future_profit: round(futureProfit),
      future_growth: round(futureGrowth),
      short_consistency: v3.components.short_consistency,
      middle_consistency: round(middleConsistency),
      quality: round(quality)
    },
    raw: v3.raw,
    meta: {
      weights: COMPETITIVE_WEIGHTS,
      earnings_power_v3_meta: v3.meta,
      source_symbol: stock?.symbol || null,
      eps_basis: stock?.eps_basis || null,
      data_quality: stock?.data_quality || null,
      engine_flags: stock?.engine_flags || null
    }
  };
}

// =====================================================
// Batch helpers for HTML pages
// =====================================================
export function normalizeEPSDataset(payload) {
  const data = payload?.data || payload || {};
  if (Array.isArray(data)) return data;

  return Object.entries(data).map(([symbol, stock]) => ({
    symbol: stock?.symbol || symbol,
    ...stock
  }));
}

export function calcCompetitiveBatch(payload, options = {}) {
  return normalizeEPSDataset(payload).map(stock => {
    const result = calcM1CompetitiveScore(stock, options);
    return {
      ...result,
      symbol: result.symbol || stock.symbol,
      name: result.name || stock.name || stock.symbol
    };
  });
}

// =====================================================
// Engine map
// =====================================================
export const EarningsEngine = {
  v1: calcEarningsPowerV1,
  v3: calcEarningsPowerV3,
  competitive: calcM1CompetitiveScore,
  batchCompetitive: calcCompetitiveBatch,
  normalizeEPSDataset
};


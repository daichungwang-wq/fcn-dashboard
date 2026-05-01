// =====================================================
// M1 Earnings Engine
// Single file / multi-version
// v1 = baseline
// v3 = four-step earnings power model
// =====================================================

function clamp(v, min = 0, max = 10) {
  if (!Number.isFinite(v)) return 0;
  return Math.max(min, Math.min(max, v));
}

function mean(arr) {
  if (!arr || !arr.length) return null;
  return arr.reduce((s, x) => s + x, 0) / arr.length;
}

function linearRegression(x, y) {
  const n = x.length;
  const mx = mean(x);
  const my = mean(y);

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
  return (stock.eps_history || [])
    .filter(x => x && Number.isFinite(Number(x.eps)))
    .map(x => ({
      fiscal_year: Number(x.fiscal_year),
      eps: Number(x.eps)
    }))
    .sort((a, b) => a.fiscal_year - b.fiscal_year);
}

function getForwardMap(stock) {
  const map = {};
  (stock.eps_forward || []).forEach(x => {
    if (x && Number.isFinite(Number(x.eps_estimate))) {
      map[Number(x.fiscal_year)] = Number(x.eps_estimate);
    }
  });
  return map;
}

function growthScoreFromRate(g) {
  return clamp(5 + g * 10, 0, 10);
}

// =====================================================
// V1 baseline
// =====================================================
export function calcEarningsPowerV1(stock) {
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
    earnings_power_score: Number(earningsPower.toFixed(2)),
    version: "v1",
    status: "ok",
    components: {
      growth: Number(growthScore.toFixed(2)),
      consistency: Number(consistencyScore.toFixed(2)),
      quality: Number(qualityScore.toFixed(2))
    },
    meta: {
      best_model: bestModel?.model || null,
      r2: bestModel ? Number(bestModel.r2.toFixed(3)) : null,
      slope: bestModel ? Number(bestModel.slope.toFixed(4)) : null,
      history_years: hist.length
    }
  };
}

// =====================================================
// V3 four-step model
// Growth + Short Consistency + Middle Consistency + Quality
// =====================================================
export function calcEarningsPowerV3(stock) {
  const EPS_MIN_YEARS = 5;

  const WEIGHTS = {
    growth: 0.30,
    shortConsistency: 0.25,
    middleConsistency: 0.25,
    quality: 0.20
  };

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
  const fwd = getForwardMap(stock);

  const e25 = fwd[2025];
  const e26 = fwd[2026];
  const e27 = fwd[2027];

  // Step 1: Growth = 2026 -> 2027
  let growthRaw = null;
  let growthScore = 0;
  let growthBasis = "missing_2026_or_2027";

  if (Number.isFinite(e26) && Number.isFinite(e27) && e26 !== 0) {
    growthRaw = e27 / e26 - 1;
    growthScore = growthScoreFromRate(growthRaw);
    growthBasis = "2026_to_2027";
  }

  // Step 2: Short Consistency = 2025->2026 + 2026->2027
  let shortScore = 0;
  let g1 = null;
  let g2 = null;
  let shortBasis = "missing_forward_data";

  if (
    Number.isFinite(e25) &&
    Number.isFinite(e26) &&
    Number.isFinite(e27) &&
    e25 !== 0 &&
    e26 !== 0
  ) {
    g1 = e26 / e25 - 1;
    g2 = e27 / e26 - 1;

    shortScore =
      0.55 * growthScoreFromRate(g1) +
      0.45 * growthScoreFromRate(g2);

    shortScore = clamp(shortScore, 0, 10);
    shortBasis = "2025_to_2026_and_2026_to_2027";
  } else if (Number.isFinite(e26) && Number.isFinite(e27) && e26 !== 0) {
    g2 = e27 / e26 - 1;
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
      middleRaw = bestModel.slope / avgEPS;
    }

    middleScore = clamp(5 + middleRaw * 20, 0, 10);
    middleBasis = `${bestModel.model}_slope`;
  }

  // Step 4: Quality = best model R² minus penalty
  let qualityPenalty = 0;
  const flags = stock.quality_flag || [];

  if (y.some(v => v < 0)) qualityPenalty += 1.5;
  if (flags.includes("high_volatility")) qualityPenalty += 1.0;
  if (flags.includes("volatile")) qualityPenalty += 1.0;
  if (flags.includes("negative_eps")) qualityPenalty += 1.5;
  if (flags.includes("cyclical")) qualityPenalty += 1.0;
  if (flags.includes("adjusted_eps")) qualityPenalty += 0.5;
  if (flags.includes("rebound")) qualityPenalty += 0.5;

  const qualityBase = bestModel ? bestModel.r2 * 10 : 0;
  const qualityScore = clamp(qualityBase - qualityPenalty, 0, 10);

  const earningsPower =
    WEIGHTS.growth * growthScore +
    WEIGHTS.shortConsistency * shortScore +
    WEIGHTS.middleConsistency * middleScore +
    WEIGHTS.quality * qualityScore;

  return {
    earnings_power_score: Number(earningsPower.toFixed(2)),
    version: "v3",
    status: "ok",

    components: {
      growth: Number(growthScore.toFixed(2)),
      short_consistency: Number(shortScore.toFixed(2)),
      middle_consistency: Number(middleScore.toFixed(2)),
      quality: Number(qualityScore.toFixed(2))
    },

    raw: {
      growth_raw: growthRaw,
      short_g1_2026_vs_2025: g1,
      short_g2_2027_vs_2026: g2,
      middle_raw: middleRaw,
      r2: bestModel ? bestModel.r2 : null,
      quality_base: qualityBase,
      quality_penalty: qualityPenalty
    },

    meta: {
      weights: WEIGHTS,
      best_model: bestModel ? bestModel.model : null,
      history_years: hist.length,
      growth_basis: growthBasis,
      short_consistency_basis: shortBasis,
      middle_consistency_basis: middleBasis,
      quality_basis: bestModel ? `${bestModel.model}_r2_minus_penalty` : "no_model",
      flags
    }
  };
}

// =====================================================
// Engine map
// =====================================================
export const EarningsEngine = {
  v1: calcEarningsPowerV1,
  v3: calcEarningsPowerV3
};

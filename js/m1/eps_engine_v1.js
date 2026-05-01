// =====================================================
// M1 Earnings Power Engine v3
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

  function clamp(v, min = 0, max = 10) {
    if (!Number.isFinite(v)) return 0;
    return Math.max(min, Math.min(max, v));
  }

  function mean(arr) {
    if (!arr.length) return null;
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

  function scoreGrowthRate(g) {
    return clamp(5 + g * 10, 0, 10);
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

  function calcGrowthScore(fwd) {
    const e26 = fwd[2026];
    const e27 = fwd[2027];

    if (!Number.isFinite(e26) || !Number.isFinite(e27) || e26 === 0) {
      return {
        score: 0,
        raw: null,
        basis: "missing_2026_or_2027"
      };
    }

    const g = e27 / e26 - 1;

    return {
      score: scoreGrowthRate(g),
      raw: g,
      basis: "2026_to_2027"
    };
  }

  function calcShortConsistencyScore(fwd) {
    const e25 = fwd[2025];
    const e26 = fwd[2026];
    const e27 = fwd[2027];

    if (
      Number.isFinite(e25) &&
      Number.isFinite(e26) &&
      Number.isFinite(e27) &&
      e25 !== 0 &&
      e26 !== 0
    ) {
      const g1 = e26 / e25 - 1;
      const g2 = e27 / e26 - 1;

      const s1 = scoreGrowthRate(g1);
      const s2 = scoreGrowthRate(g2);

      return {
        score: clamp(0.55 * s1 + 0.45 * s2, 0, 10),
        g1,
        g2,
        basis: "2025_to_2026_and_2026_to_2027"
      };
    }

    if (Number.isFinite(e26) && Number.isFinite(e27) && e26 !== 0) {
      const g2 = e27 / e26 - 1;

      return {
        score: scoreGrowthRate(g2),
        g1: null,
        g2,
        basis: "fallback_2026_to_2027"
      };
    }

    return {
      score: 0,
      g1: null,
      g2: null,
      basis: "missing_forward_data"
    };
  }

  function calcMiddleConsistencyScore(hist, bestModel) {
    const eps = hist.map(x => x.eps);
    const avg = mean(eps);

    if (!bestModel || !Number.isFinite(avg) || avg === 0) {
      return {
        score: 0,
        raw: null,
        basis: "invalid_history"
      };
    }

    let c;

    if (bestModel.model === "exponential") {
      c = bestModel.slope;
    } else {
      c = bestModel.slope / avg;
    }

    return {
      score: clamp(5 + c * 20, 0, 10),
      raw: c,
      basis: `${bestModel.model}_slope`
    };
  }

  function calcQualityScore(bestModel, hist, stock) {
    if (!bestModel) {
      return {
        score: 0,
        r2: null,
        penalty: 0,
        basis: "no_model"
      };
    }

    let score = bestModel.r2 * 10;
    let penalty = 0;

    const eps = hist.map(x => x.eps);

    if (eps.some(v => v < 0)) penalty += 1.5;

    const flags = stock.quality_flag || [];

    if (flags.includes("high_volatility")) penalty += 1.0;
    if (flags.includes("volatile")) penalty += 1.0;
    if (flags.includes("negative_eps")) penalty += 1.5;
    if (flags.includes("cyclical")) penalty += 1.0;
    if (flags.includes("adjusted_eps")) penalty += 0.5;
    if (flags.includes("rebound")) penalty += 0.5;

    score = clamp(score - penalty, 0, 10);

    return {
      score,
      r2: bestModel.r2,
      penalty,
      basis: `${bestModel.model}_r2_minus_penalty`
    };
  }

  const hist = (stock.eps_history || [])
    .filter(x => x && Number.isFinite(Number(x.eps)))
    .map(x => ({
      fiscal_year: Number(x.fiscal_year),
      eps: Number(x.eps)
    }))
    .sort((a, b) => a.fiscal_year - b.fiscal_year);

  if (hist.length < EPS_MIN_YEARS) {
    return {
      earnings_power_score: null,
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

  const growth = calcGrowthScore(fwd);
  const shortConsistency = calcShortConsistencyScore(fwd);
  const middleConsistency = calcMiddleConsistencyScore(hist, bestModel);
  const quality = calcQualityScore(bestModel, hist, stock);

  const earningsPower =
    WEIGHTS.growth * growth.score +
    WEIGHTS.shortConsistency * shortConsistency.score +
    WEIGHTS.middleConsistency * middleConsistency.score +
    WEIGHTS.quality * quality.score;

  return {
    earnings_power_score: Number(earningsPower.toFixed(2)),
    status: "ok",

    components: {
      growth: Number(growth.score.toFixed(2)),
      short_consistency: Number(shortConsistency.score.toFixed(2)),
      middle_consistency: Number(middleConsistency.score.toFixed(2)),
      quality: Number(quality.score.toFixed(2))
    },

    raw: {
      growth_raw: growth.raw,
      short_g1_2026_vs_2025: shortConsistency.g1,
      short_g2_2027_vs_2026: shortConsistency.g2,
      middle_raw: middleConsistency.raw,
      r2: bestModel ? bestModel.r2 : null,
      quality_penalty: quality.penalty
    },

    meta: {
      weights: WEIGHTS,
      best_model: bestModel ? bestModel.model : null,
      history_years: hist.length,
      growth_basis: growth.basis,
      short_consistency_basis: shortConsistency.basis,
      middle_consistency_basis: middleConsistency.basis,
      quality_basis: quality.basis,
      flags: stock.quality_flag || []
    }
  };
}

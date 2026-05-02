// =====================================================
// M1 Earnings Engine
// (SAFE VERSION - keep original + add JSON batch runner)
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
// V3 Earnings Power（原版保留）
// =====================================================
export function calcEarningsPowerV3(stock) {
  const hist = normalizeHistory(stock);
  if (hist.length < 5) return null;

  const x = hist.map((_, i) => i);
  const y = hist.map(d => d.eps);
  const bestModel = pickBestModel(x, y);
  const fwd = getForwardMap(stock);

  const e25 = fwd[2025];
  const e26 = fwd[2026];
  const e27 = fwd[2027];

  let growth = 0;
  if (e26 && e27 && e26 !== 0) {
    growth = growthScoreFromRate(e27 / e26 - 1);
  }

  let short = 0;
  if (e25 && e26 && e27 && e25 !== 0 && e26 !== 0) {
    const g1 = e26 / e25 - 1;
    const g2 = e27 / e26 - 1;
    short = clamp(
      0.55 * growthScoreFromRate(g1) +
      0.45 * growthScoreFromRate(g2)
    );
  }

  let middle = 0;
  const avg = mean(y);
  if (bestModel && avg) {
    const raw =
      bestModel.model === "exponential"
        ? bestModel.slope
        : bestModel.slope / avg;

    middle = clamp(5 + raw * 20);
  }

  let penalty = 0;
  const flags = stock.quality_flag || [];

  if (y.some(v => v < 0)) penalty += 1.5;
  if (flags.includes("high_volatility")) penalty += 1;
  if (flags.includes("volatile")) penalty += 1;
  if (flags.includes("cyclical")) penalty += 1;
  if (flags.includes("adjusted_eps")) penalty += 0.5;

  const quality = clamp((bestModel ? bestModel.r2 * 10 : 0) - penalty);

  const score =
    0.30 * growth +
    0.25 * short +
    0.25 * middle +
    0.20 * quality;

  return {
    score: Number(score.toFixed(2)),
    growth,
    short,
    middle,
    quality
  };
}

// =====================================================
// ⭐ NEW：JSON 批次運算（唯一新增）
// =====================================================
export function runM1CompetitiveFromJSON(jsonData) {
  const stocks = jsonData.data;

  const results = Object.keys(stocks).map(symbol => {
    const s = stocks[symbol];

    if (s.skip_eps) return null;

    const r = calcEarningsPowerV3(s);
    if (!r) return null;

    return {
      symbol,
      score: r.score,
      growth: r.growth,
      short: r.short,
      middle: r.middle,
      quality: r.quality
    };
  }).filter(Boolean);

  results.sort((a, b) => b.score - a.score);

  return results;
}

// =====================================================
// 保留原 API（避免壞掉）
// =====================================================
export const EarningsEngine = {
  v3: calcEarningsPowerV3
};

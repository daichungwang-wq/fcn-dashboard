/*
  M7 Formula Test Engine
  Path in repo: js/mm/modules/mm_formula_test_engine.js

  Purpose:
  - Independent formula debug page for M7 what-if calculation.
  - Does NOT modify data files.
  - Does NOT re-rank or re-normalize cross-stock distribution during what-if.
  - Missing sub-factors use fallback rules and are explicitly shown in trace.
*/

(function () {
  "use strict";

  const DATA_PATHS = {
    scores: "../data/m7_sandbox/m7_v2_scores.json",
    compare: "../data/m7_sandbox/m7_v2_ab_compare.json",
    manifest: "../data/m7_sandbox/m7_v2_run_manifest.json",
    runtime: "../data/market_runtime.json",
    fundamentals: "../data/m7/m7_fundamental_data.json"
  };

  const DEFAULT_PARAMS = Object.freeze({
    // Match current Python M7 v2 formula:
    // 0.45*valuation + 0.25*trend + 0.20*structure + 0.00*timing + 0.10*money
    raw_valuation_weight: 0.45,
    raw_trend_weight: 0.25,
    raw_structure_weight: 0.20,
    raw_timing_weight: 0.00,
    raw_money_weight: 0.10,

    // Match current Python trend formula:
    // 0.35*linear + 0.50*ma200/ma_window + 0.15*acceleration
    // Important: trend sub-score is allowed to exceed 10 in Python output.
    trend_linear_weight: 0.35,
    trend_ma_weight: 0.50,
    trend_acceleration_weight: 0.15,

    // Match current Python money formula:
    // liquidity * money_liquidity_weight + flow * money_flow_weight
    money_liquidity_weight: 0.70,
    money_flow_weight: 0.30,

    top_adjustment_weight: 1.00,
    top_adjustment_cap: 1.50
  });

  const PARAM_DEFS = [
    ["raw_valuation_weight", "M7 Raw - Valuation Weight", 0, 0.60, 0.01],
    ["raw_trend_weight", "M7 Raw - Trend Weight", 0, 0.60, 0.01],
    ["raw_structure_weight", "M7 Raw - Structure Weight", 0, 0.60, 0.01],
    ["raw_timing_weight", "M7 Raw - Timing Weight", 0, 0.40, 0.01],
    ["raw_money_weight", "M7 Raw - Money Weight", 0, 0.40, 0.01],
    ["trend_linear_weight", "Trend - Linear Slope Weight", 0, 1, 0.01],
    ["trend_ma_weight", "Trend - MA / MA200 Weight", 0, 1, 0.01],
    ["trend_acceleration_weight", "Trend - Acceleration Weight", 0, 1, 0.01],
    ["money_liquidity_weight", "Money - Liquidity Weight", 0, 1, 0.01],
    ["money_flow_weight", "Money - Flow Weight", 0, 1, 0.01],
    ["top_adjustment_weight", "Final - Top Adjustment Weight", 0, 2, 0.01],
    ["top_adjustment_cap", "Final - Top Adjustment Cap", 0, 3, 0.05]
  ];

  const state = {
    scores: [],
    compare: [],
    manifest: null,
    runtime: [],
    fundamentals: [],
    selectedSymbol: null,
    params: { ...DEFAULT_PARAMS },
    decimals: 2
  };

  const $ = (id) => document.getElementById(id);

  function num(v, fallback = null) {
    const x = Number(v);
    return Number.isFinite(x) ? x : fallback;
  }

  function clamp(x, lo, hi) {
    const n = num(x, 0);
    return Math.max(lo, Math.min(hi, n));
  }

  function fmt(v, d = state.decimals) {
    const x = num(v, null);
    if (x === null) return "--";
    return x.toFixed(d);
  }

  function fmtPct(v, d = 1) {
    const x = num(v, null);
    if (x === null || !Number.isFinite(x)) return "--";
    return `${x.toFixed(d)}%`;
  }

  function pctChange(now, newer) {
    const a = num(now, null);
    const b = num(newer, null);
    if (a === null || b === null || Math.abs(a) < 0.000001) return null;
    return ((b - a) / Math.abs(a)) * 100;
  }

  function deltaClass(v) {
    const x = num(v, 0);
    if (Math.abs(x) < 0.00001) return "zero";
    return x > 0 ? "pos" : "neg";
  }

  function field(row, keys, fallback = null) {
    if (!row) return fallback;
    for (const k of keys) {
      if (row[k] !== undefined && row[k] !== null && row[k] !== "") return row[k];
    }
    return fallback;
  }

  function symbolOf(row) {
    return String(field(row, ["symbol", "ticker", "Symbol"], "")).toUpperCase();
  }

  function asArray(payload) {
    // case 1: already array
    if (Array.isArray(payload)) return payload;

    if (!payload || typeof payload !== "object") return [];

    // common wrapper keys
    if (Array.isArray(payload.data)) return payload.data;
    if (Array.isArray(payload.scores)) return payload.scores;
    if (Array.isArray(payload.items)) return payload.items;
    if (Array.isArray(payload.rows)) return payload.rows;
    if (Array.isArray(payload.results)) return payload.results;
    if (Array.isArray(payload.records)) return payload.records;
    if (Array.isArray(payload.output)) return payload.output;

    // fallback: if any first-level property is array → take first array
    const values = Object.values(payload);
    const firstArray = values.find(v => Array.isArray(v));
    if (firstArray) return firstArray;

    // fallback: object map format, e.g. { NVDA:{...}, TSM:{...} }
    const objectValues = values.filter(v => v && typeof v === "object" && !Array.isArray(v));
    if (objectValues.length && objectValues.length === values.length) return objectValues;

    console.warn("Unknown JSON structure:", payload);
    return [];
  }

  async function loadJson(path, optional = false) {
    try {
      const res = await fetch(path, { cache: "no-store" });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return await res.json();
    } catch (err) {
      if (optional) return null;
      throw new Error(`Load failed: ${path} / ${err.message}`);
    }
  }

  function findBySymbol(arr, sym) {
    const s = String(sym || "").toUpperCase();
    return arr.find(x => symbolOf(x) === s) || null;
  }

  function getRows() {
    return state.scores.map(row => {
      const sym = symbolOf(row);
      const cmp = findBySymbol(state.compare, sym);
      const rt = findBySymbol(state.runtime, sym);
      const fd = findBySymbol(state.fundamentals, sym);
      return { row, cmp, rt, fd, sym };
    }).filter(x => x.sym);
  }

  function getBaseScores(ctx) {
    const { row, cmp } = ctx;
    const valuation = num(field(row, ["valuation_score", "valuation", "m7_valuation_score"], field(cmp, ["valuation_score"])), 0);
    const trend = num(field(row, ["trend_score", "trend", "m7_trend_score"], field(cmp, ["trend_score"])), 0);
    const structure = num(field(row, ["structure_score", "structure", "m7_structure_score"], field(cmp, ["structure_score"])), 0);
    const timing = num(field(row, ["timing_score", "timing", "event_score", "short_swing_score"], field(cmp, ["timing_score"])), 0);
    const money = num(field(row, ["money_score", "money", "flow_score"], field(cmp, ["money_score"])), 0);
    const top = num(field(row, ["top_score", "top_adjustment", "compare_adjustment", "zscore_adjustment"], field(cmp, ["top_score", "top_adjustment", "compare_adjustment"])), 0);
    const m7Now = num(field(row, ["m7_v2_score", "m7_final_score", "final_score", "score"], field(cmp, ["m7_v2_score", "m7_final_score", "score"])), null);
    return { valuation, trend, structure, timing, money, top, m7Now };
  }

  function normalizeWeights(obj, keys) {
    const vals = keys.map(k => Math.max(0, num(obj[k], 0)));
    const sum = vals.reduce((a, b) => a + b, 0);
    if (sum <= 0) {
      const equal = 1 / keys.length;
      return Object.fromEntries(keys.map(k => [k, equal]));
    }
    return Object.fromEntries(keys.map((k, i) => [k, vals[i] / sum]));
  }

  function scoreFromRawFactor(value, fallbackScore, scale, center = 0) {
    const v = num(value, null);
    if (v === null) return { score: fallbackScore, usedFallback: true };
    return { score: clamp((v - center) * scale + 5, 0, 10), usedFallback: false };
  }

  function computeTrend(ctx, base, params) {
    const { row, rt } = ctx;
    const audit = [];

    const linearDirect = num(field(row, [
      "trend_linear_score",
      "linear_trend_score",
      "long_term_linear_score"
    ], null), null);

    const maDirect = num(field(row, [
      "trend_ma_score",
      "trend_ma200_score",
      "trend_ma100_score",
      "ma200_score",
      "ma100_score",
      "ma20w_score",
      "ma_trend_score"
    ], null), null);

    const accelDirect = num(field(row, [
      "trend_acceleration_score",
      "acceleration_score",
      "quadratic_acceleration_score"
    ], null), null);

    let linear = linearDirect;
    if (linear === null) {
      const slope = field(row, ["trend_linear_slope", "linear_slope", "structure_slope"], null);
      const res = scoreFromRawFactor(slope, base.trend, 500, 0);
      linear = res.score;
      audit.push(res.usedFallback ? "trend.linear: missing direct score/slope; fallback to current trend_score" : "trend.linear: derived from slope");
    } else audit.push("trend.linear: direct trend_linear_score used");

    let ma = maDirect;
    if (ma === null) {
      const maSlope = field(row, ["trend_ma_slope", "ma_slope", "ma200_slope", "ma100_slope"], null);
      if (num(maSlope, null) !== null) {
        const res = scoreFromRawFactor(maSlope, base.trend, 500, 0);
        ma = res.score;
        audit.push("trend.ma: derived from trend_ma_slope");
      } else {
        const ret6m = field(row, ["ret_6m"], field(rt, ["ret_6m"], null));
        const ret12m = field(row, ["ret_12m"], field(rt, ["ret_12m"], null));
        const proxy = num(ret6m, null) !== null ? ret6m : ret12m;
        const res = scoreFromRawFactor(proxy, base.trend, 18, 0);
        ma = res.score;
        audit.push(res.usedFallback ? "trend.ma: missing MA/proxy return; fallback to current trend_score" : "trend.ma: proxy from 6M/12M return");
      }
    } else audit.push("trend.ma: direct trend_ma_score used");

    let accel = accelDirect;
    if (accel === null) {
      const acc = field(row, ["trend_acceleration", "trend_acceleration_annualized_delta_pct", "quadratic_a", "trend_quadratic_a", "acceleration"], null);
      const res = scoreFromRawFactor(acc, base.trend, 0.25, 0);
      accel = res.score;
      audit.push(res.usedFallback ? "trend.acceleration: missing acceleration factor; fallback to current trend_score" : "trend.acceleration: derived from acceleration factor");
    } else audit.push("trend.acceleration: direct trend_acceleration_score used");

    const w = normalizeWeights(params, ["trend_linear_weight", "trend_ma_weight", "trend_acceleration_weight"]);

    // Important: do NOT clamp trend to 0~10 here.
    // Python M7 v2 allows strong trend scores above 10, e.g. NVDA trend_score = 11.97.
    const newScore =
      linear * w.trend_linear_weight +
      ma * w.trend_ma_weight +
      accel * w.trend_acceleration_weight;

    return { now: base.trend, new: newScore, parts: { linear, ma, accel, weights: w }, audit };
  }

  function computeMoney(ctx, base, params) {
    const { row, rt } = ctx;
    const audit = [];

    // Current Python M7 v2 output uses:
    // money_score, money_liquidity_score, money_flow_score,
    // money_volume_ratio_score, money_position_score,
    // money_liquidity_weight, money_flow_weight.

    let liquidityScore = num(field(row, [
      "money_liquidity_score",
      "liquidity_score",
      "money_volume_score",
      "volume_score"
    ], null), null);

    if (liquidityScore === null) {
      const adv = num(field(row, ["avg_dollar_volume"], field(rt, ["avg_dollar_volume"], null)), null);
      if (adv !== null && adv > 0) {
        // Conservative liquidity proxy. Large-cap names should approach 10.
        liquidityScore = clamp(Math.log10(Math.max(1, adv)) - 1.0, 0, 10);
        audit.push("money.liquidity: derived from avg_dollar_volume proxy");
      } else {
        liquidityScore = base.money;
        audit.push("money.liquidity: missing liquidity factor; fallback to current money_score");
      }
    } else audit.push("money.liquidity: direct money_liquidity_score used");

    let flowScore = num(field(row, [
      "money_flow_score",
      "flow_score",
      "money_volume_ratio_score",
      "volume_ratio_score",
      "flow_volume_score"
    ], null), null);

    if (flowScore === null) {
      const vr = field(row, ["volume_ratio"], field(rt, ["volume_ratio"], null));
      if (num(vr, null) === null) {
        flowScore = base.money;
        audit.push("money.flow: missing flow/volume_ratio factor; fallback to current money_score");
      } else {
        flowScore = clamp(5 + Math.log(Math.max(0.1, num(vr, 1))) * 2.2, 0, 10);
        audit.push("money.flow: derived from log(volume_ratio)");
      }
    } else audit.push("money.flow: direct money_flow_score / volume_ratio_score used");

    const positionScore = num(field(row, ["money_position_score", "position_score"], null), null);
    if (positionScore !== null) {
      audit.push("money.position: direct money_position_score detected; currently audit-only, not included in M7 money formula");
    }

    // Prefer row-level weights from Python output when user has not changed sliders.
    const rowLiquidityWeight = num(field(row, ["money_liquidity_weight"], null), null);
    const rowFlowWeight = num(field(row, ["money_flow_weight"], null), null);

    const p = { ...params };
    const userStillDefault =
      Math.abs(num(params.money_liquidity_weight, 0) - DEFAULT_PARAMS.money_liquidity_weight) < 0.000001 &&
      Math.abs(num(params.money_flow_weight, 0) - DEFAULT_PARAMS.money_flow_weight) < 0.000001;

    if (userStillDefault && rowLiquidityWeight !== null && rowFlowWeight !== null) {
      p.money_liquidity_weight = rowLiquidityWeight;
      p.money_flow_weight = rowFlowWeight;
      audit.push("money.weights: row-level Python weights used because sliders remain at default");
    } else {
      audit.push("money.weights: UI slider weights used");
    }

    const w = normalizeWeights(p, ["money_liquidity_weight", "money_flow_weight"]);

    const newScore =
      liquidityScore * w.money_liquidity_weight +
      flowScore * w.money_flow_weight;

    return {
      now: base.money,
      new: newScore,
      parts: { liquidityScore, flowScore, positionScore, weights: w },
      audit
    };
  }

  function computeTop(base, params) {
    const capped = clamp(base.top, -Math.abs(params.top_adjustment_cap), Math.abs(params.top_adjustment_cap));
    const newTop = clamp(capped * params.top_adjustment_weight, -Math.abs(params.top_adjustment_cap), Math.abs(params.top_adjustment_cap));
    return { now: base.top, new: newTop, capped };
  }

  function computeM7(ctx, params = state.params) {
    const base = getBaseScores(ctx);
    const trend = computeTrend(ctx, base, params);
    const money = computeMoney(ctx, base, params);
    const top = computeTop(base, params);

    const rawKeys = [
      "raw_valuation_weight", "raw_trend_weight", "raw_structure_weight", "raw_timing_weight", "raw_money_weight"
    ];

    // Three layers are intentionally kept separate for display/debug:
    // 1) nowWeights: original formula weights from DEFAULT_PARAMS, normalized by system.
    // 2) userRawWeights: user slider inputs, before system normalization.
    // 3) rawWeights: effective new weights after system normalization.
    const nowWeights = normalizeWeights(DEFAULT_PARAMS, rawKeys);
    const userRawWeights = Object.fromEntries(rawKeys.map(k => [k, Math.max(0, num(params[k], 0))]));
    const rawWeights = normalizeWeights(params, rawKeys);

    const rawNow =
      base.valuation * nowWeights.raw_valuation_weight +
      base.trend * nowWeights.raw_trend_weight +
      base.structure * nowWeights.raw_structure_weight +
      base.timing * nowWeights.raw_timing_weight +
      base.money * nowWeights.raw_money_weight;

    const rawNew =
      base.valuation * rawWeights.raw_valuation_weight +
      trend.new * rawWeights.raw_trend_weight +
      base.structure * rawWeights.raw_structure_weight +
      base.timing * rawWeights.raw_timing_weight +
      money.new * rawWeights.raw_money_weight;

    const reconstructedNow = clamp(rawNow + top.now, 0, 10);
    const m7Now = base.m7Now === null ? reconstructedNow : base.m7Now;
    const newScore = clamp(rawNew + top.new, 0, 10);

    const scores = {
      valuation: { now: base.valuation, new: base.valuation },
      trend: { now: base.trend, new: trend.new },
      structure: { now: base.structure, new: base.structure },
      timing: { now: base.timing, new: base.timing },
      money: { now: base.money, new: money.new },
      top: { now: top.now, new: top.new },
      raw: { now: rawNow, new: rawNew },
      m7: { now: m7Now, new: newScore },
      reconstructedNow: { now: reconstructedNow, new: reconstructedNow }
    };

    const traceLines = [];
    traceLines.push(`SYMBOL = ${ctx.sym}`);
    traceLines.push(`M7 now source = ${base.m7Now === null ? "reconstructed raw+top" : "data field m7_v2_score/m7_final_score"}`);
    traceLines.push("");
    traceLines.push("RAW WEIGHTS:");
    traceLines.push("  now/default normalized:");
    Object.entries(nowWeights).forEach(([k,v]) => traceLines.push(`    ${k} = ${v.toFixed(4)}`));
    traceLines.push("  user slider raw input:");
    Object.entries(userRawWeights).forEach(([k,v]) => traceLines.push(`    ${k} = ${v.toFixed(4)}`));
    traceLines.push("  effective new normalized:");
    Object.entries(rawWeights).forEach(([k,v]) => traceLines.push(`    ${k} = ${v.toFixed(4)}`));
    traceLines.push("");
    traceLines.push("VALUATION L2/L3:");
    const valuationSnapshot = ctx.row && ctx.row.feature_snapshot && ctx.row.feature_snapshot.valuation ? ctx.row.feature_snapshot.valuation : null;
    if (valuationSnapshot) {
      ["forward_pe", "anchor_pe", "base_anchor", "category_sub", "market_regime", "market_multiplier", "industry_regime", "industry_multiplier", "valuation_archetype", "archetype_multiplier", "peg", "eps_growth", "quality_factor"].forEach(k => {
        if (valuationSnapshot[k] !== undefined && valuationSnapshot[k] !== null) {
          traceLines.push(`  ${k} = ${valuationSnapshot[k]}`);
        }
      });
    } else {
      traceLines.push("  feature_snapshot.valuation not found; valuation score uses current valuation_score as base");
    }

    traceLines.push("");
    traceLines.push("TREND:");
    traceLines.push(`  linear=${fmt(trend.parts.linear)} * w=${trend.parts.weights.trend_linear_weight.toFixed(4)}`);
    traceLines.push(`  ma_score=${fmt(trend.parts.ma)} * w=${trend.parts.weights.trend_ma_weight.toFixed(4)}`);
    traceLines.push(`  acceleration=${fmt(trend.parts.accel)} * w=${trend.parts.weights.trend_acceleration_weight.toFixed(4)}`);
    traceLines.push(`  trend now=${fmt(base.trend)} / trend new=${fmt(trend.new)} / delta=${fmt(trend.new - base.trend)}`);
    traceLines.push("");
    traceLines.push("MONEY:");
    traceLines.push(`  liquidityScore=${fmt(money.parts.liquidityScore)} * w=${money.parts.weights.money_liquidity_weight.toFixed(4)}`);
    traceLines.push(`  flowScore=${fmt(money.parts.flowScore)} * w=${money.parts.weights.money_flow_weight.toFixed(4)}`);
    if (money.parts.positionScore !== null) traceLines.push(`  positionScore=${fmt(money.parts.positionScore)} audit-only`);
    traceLines.push(`  money now=${fmt(base.money)} / money new=${fmt(money.new)} / delta=${fmt(money.new - base.money)}`);
    traceLines.push("");
    traceLines.push("FINAL:");
    traceLines.push(`  rawNow = valuation*wv + trend*wt + structure*ws + timing*wi + money*wm = ${fmt(rawNow)}`);
    traceLines.push(`  rawNew = valuation*wv + trendNew*wt + structure*ws + timing*wi + moneyNew*wm = ${fmt(rawNew)}`);
    traceLines.push(`  top now=${fmt(top.now)} / capped=${fmt(top.capped)} / top new=${fmt(top.new)}`);
    traceLines.push(`  M7 new = clamp(rawNew + topNew, 0, 10) = ${fmt(newScore)}`);

    const audit = [...trend.audit, ...money.audit];
    audit.push(`top: clamp top adjustment to ±${fmt(params.top_adjustment_cap)} then multiply by top_adjustment_weight`);
    audit.push("global: no cross-stock re-normalization in what-if mode");

    return { ctx, base, scores, trend, money, top, nowWeights, userRawWeights, rawWeights, trace: traceLines.join("\n"), audit };
  }

  function renderParamControls() {
    const box = $("paramControls");
    box.innerHTML = PARAM_DEFS.map(([key, label, min, max, step]) => `
      <div class="param">
        <div class="param-top"><span class="param-name">${label}</span><span class="param-val" id="pv_${key}">${fmt(state.params[key], 2)}</span></div>
        <input id="p_${key}" type="range" min="${min}" max="${max}" step="${step}" value="${state.params[key]}">
      </div>
    `).join("");
    PARAM_DEFS.forEach(([key]) => {
      $("p_" + key).addEventListener("input", (e) => {
        state.params[key] = num(e.target.value, DEFAULT_PARAMS[key]);
        $("pv_" + key).textContent = fmt(state.params[key], 2);
        render();
      });
    });
  }

  function metricRow(name, now, newer) {
    const d = num(newer, 0) - num(now, 0);
    return `<div class="metric"><div>${name}</div><div class="num">${fmt(now)}</div><div class="num">${fmt(newer)}</div><div class="num ${deltaClass(d)}">${fmt(d)}</div></div>`;
  }

  function paramMetricRow(name, now, newer) {
    const d = num(newer, 0) - num(now, 0);
    const dp = pctChange(now, newer);
    return `<div class="paramMetric"><div>${name}</div><div class="num">${fmt(now)}</div><div class="num">${fmt(newer)}</div><div class="num ${deltaClass(d)}">${fmt(d)}</div><div class="num ${deltaClass(d)}">${fmtPct(dp)}</div></div>`;
  }

  function renderParamsTable() {
    $("paramTable").innerHTML = PARAM_DEFS.map(([key, label]) => paramMetricRow(label, DEFAULT_PARAMS[key], state.params[key])).join("");
  }

  function rawLayerRows(result) {
    const impactMap = new Map(factorImpactRows(result).map(r => [r.label, r]));
    return [
      { label: "valuation", now: result.scores.valuation.now, new: result.scores.valuation.new, impact: impactMap.get("valuation") },
      { label: "trend", now: result.scores.trend.now, new: result.scores.trend.new, impact: impactMap.get("trend") },
      { label: "structure", now: result.scores.structure.now, new: result.scores.structure.new, impact: impactMap.get("structure") },
      { label: "timing", now: result.scores.timing.now, new: result.scores.timing.new, impact: impactMap.get("timing") },
      { label: "money", now: result.scores.money.now, new: result.scores.money.new, impact: impactMap.get("money") }
    ];
  }

  function m7ImpactPct(rawDelta, finalDelta) {
    if (Math.abs(num(finalDelta, 0)) < 0.000001) return null;
    return (rawDelta / finalDelta) * 100;
  }

  function renderScoreTable(result) {
    const el = $("scoreTable");
    if (!el) return;
    const finalDelta = result.scores.m7.new - result.scores.m7.now;
    const rawDelta = result.scores.raw.new - result.scores.raw.now;
    const rows = rawLayerRows(result);

    el.innerHTML = `
      <thead>
        <tr>
          <th>Score Layer</th>
          <th>Now</th>
          <th>New</th>
          <th>Delta</th>
          <th>Delta %</th>
          <th>Impact to M7 Δ</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => {
          const d = num(r.new, 0) - num(r.now, 0);
          const dp = pctChange(r.now, r.new);
          const impact = r.impact ? m7ImpactPct(r.impact.rawDelta, finalDelta) : null;
          const impactText = impact === null ? "--" : fmtPct(impact);
          const impactCls = r.impact ? deltaClass(r.impact.rawDelta) : "zero";
          return `
            <tr>
              <td>${r.label}</td>
              <td>${fmt(r.now)}</td>
              <td>${fmt(r.new)}</td>
              <td class="${deltaClass(d)}">${fmt(d)}</td>
              <td class="${deltaClass(dp)}">${fmtPct(dp)}</td>
              <td class="${impactCls}">${impactText}</td>
            </tr>
          `;
        }).join("")}
        <tr>
          <th>Raw Score</th>
          <th>${fmt(result.scores.raw.now)}</th>
          <th>${fmt(result.scores.raw.new)}</th>
          <th class="${deltaClass(rawDelta)}">${fmt(rawDelta)}</th>
          <th class="${deltaClass(pctChange(result.scores.raw.now, result.scores.raw.new))}">${fmtPct(pctChange(result.scores.raw.now, result.scores.raw.new))}</th>
          <th class="${deltaClass(rawDelta)}">raw layer</th>
        </tr>
        <tr>
          <th>M7 Final</th>
          <th>${fmt(result.scores.m7.now)}</th>
          <th>${fmt(result.scores.m7.new)}</th>
          <th class="${deltaClass(finalDelta)}">${fmt(finalDelta)}</th>
          <th class="${deltaClass(pctChange(result.scores.m7.now, result.scores.m7.new))}">${fmtPct(pctChange(result.scores.m7.now, result.scores.m7.new))}</th>
          <th class="${deltaClass(finalDelta)}">final layer</th>
        </tr>
      </tbody>
    `;
  }

  function factorImpactRows(result) {
    const finalDelta = result.scores.m7.new - result.scores.m7.now;
    const rows = [
      { label: "valuation", scoreNow: result.scores.valuation.now, scoreNew: result.scores.valuation.new, key: "raw_valuation_weight" },
      { label: "trend", scoreNow: result.scores.trend.now, scoreNew: result.scores.trend.new, key: "raw_trend_weight" },
      { label: "structure", scoreNow: result.scores.structure.now, scoreNew: result.scores.structure.new, key: "raw_structure_weight" },
      { label: "timing", scoreNow: result.scores.timing.now, scoreNew: result.scores.timing.new, key: "raw_timing_weight" },
      { label: "money", scoreNow: result.scores.money.now, scoreNew: result.scores.money.new, key: "raw_money_weight" }
    ];

    return rows.map(r => {
      const nowWeight = result.nowWeights[r.key];
      const userNewWeight = result.userRawWeights[r.key];
      const effectiveNewWeight = result.rawWeights[r.key];
      const rawNow = r.scoreNow * nowWeight;
      const rawNew = r.scoreNew * effectiveNewWeight;
      const rawDelta = rawNew - rawNow;
      const weightDeltaPct = pctChange(nowWeight, effectiveNewWeight);
      const contributionPct = Math.abs(finalDelta) < 0.000001 ? null : (rawDelta / finalDelta) * 100;
      return { ...r, nowWeight, userNewWeight, effectiveNewWeight, rawNow, rawNew, rawDelta, weightDeltaPct, contributionPct };
    });
  }

  function renderFactorImpactTable(result) {
    const el = $("factorImpactTable");
    if (!el) return;
    const rows = factorImpactRows(result);
    const rawDelta = result.scores.raw.new - result.scores.raw.now;
    const finalDelta = result.scores.m7.new - result.scores.m7.now;

    el.innerHTML = `
      <thead>
        <tr>
          <th>Score Layer</th>
          <th>Raw Score Now</th>
          <th>Raw Score New</th>
          <th>Now Weight</th>
          <th>User New Weight</th>
          <th>Effective New Weight</th>
          <th>Raw Now</th>
          <th>Raw New</th>
          <th>Raw Delta</th>
          <th>Weight Δ%</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => `
          <tr>
            <td>${r.label}</td>
            <td>${fmt(r.scoreNow)}</td>
            <td>${fmt(r.scoreNew)}</td>
            <td>${fmt(r.nowWeight, 4)}</td>
            <td>${fmt(r.userNewWeight, 4)}</td>
            <td>${fmt(r.effectiveNewWeight, 4)}</td>
            <td>${fmt(r.rawNow)}</td>
            <td>${fmt(r.rawNew)}</td>
            <td class="${deltaClass(r.rawDelta)}">${fmt(r.rawDelta)}</td>
            <td class="${deltaClass(r.weightDeltaPct)}">${fmtPct(r.weightDeltaPct)}</td>
          </tr>
        `).join("")}
        <tr>
          <th>Raw Total / Final</th>
          <th></th><th></th><th></th><th></th><th></th>
          <th>${fmt(result.scores.raw.now)}</th>
          <th>${fmt(result.scores.raw.new)}</th>
          <th class="${deltaClass(rawDelta)}">${fmt(rawDelta)}</th>
          <th class="${deltaClass(finalDelta)}">Final Δ ${fmt(finalDelta)}</th>
        </tr>
      </tbody>
    `;
  }

  function renderAudit(result) {
    $("auditBox").innerHTML = `
      <table>
        <thead><tr><th>Rule</th><th>Status</th></tr></thead>
        <tbody>
          ${result.audit.map(x => `<tr><td>${escapeHtml(x)}</td><td>${x.includes("fallback") ? "fallback" : "ok"}</td></tr>`).join("")}
        </tbody>
      </table>
    `;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c]));
  }

  function rankMap(items, key) {
    const sorted = [...items].sort((a, b) => num(b[key], -999) - num(a[key], -999));
    const map = new Map();
    sorted.forEach((x, i) => map.set(x.sym, i + 1));
    return map;
  }

  function getPrice(ctx) {
    return num(field(ctx.row, ["price_now", "current_price", "last_price", "price"], field(ctx.rt, ["price_now", "current_price", "last_price", "price"], null)), null);
  }

  function getM1Score(ctx) {
    return num(field(ctx.row, ["m1_score", "m1", "m1_final_score"], field(ctx.cmp, ["m1_score", "m1_final_score"], null)), null);
  }

  function impactFactors(result) {
    const rows = factorImpactRows(result)
      .map(r => ({ label: r.label, delta: r.rawDelta }))
      .filter(r => Math.abs(num(r.delta, 0)) > 0.0005)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 3);

    if (!rows.length) return `<span class="tag zero">No major factor</span>`;

    return rows.map(r => {
      const arrow = r.delta > 0 ? "↑" : "↓";
      const cls = r.delta > 0 ? "pos" : "neg";
      return `<span class="tag ${cls}">${escapeHtml(r.label)} ${arrow} ${fmt(r.delta)}</span>`;
    }).join(" ");
  }

  function renderDeltaPreview() {
    const computed = getRows().map(ctx => {
      const result = computeM7(ctx, state.params);
      const name = field(ctx.row, ["name", "company_name"], "");
      const m1 = getM1Score(ctx);
      const m7Now = result.scores.m7.now;
      const m7New = result.scores.m7.new;
      const delta = m7New - m7Now;
      const deltaPct = Math.abs(num(m7Now, 0)) < 0.000001 ? null : (delta / m7Now) * 100;
      return {
        ctx, result, sym: ctx.sym, name, price: getPrice(ctx),
        m1Now: m1, m1New: m1, m7Now, m7New, delta, deltaPct
      };
    });

    const nowRanks = rankMap(computed, "m7Now");
    const newRanks = rankMap(computed, "m7New");

    const rows = computed
      .map(x => ({ ...x, rankNow: nowRanks.get(x.sym), rankNew: newRanks.get(x.sym) }))
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 30);

    $("deltaPreview").innerHTML = `
      <thead>
        <tr>
          <th>Rank Now</th>
          <th>Rank New</th>
          <th>Symbol</th>
          <th>Name</th>
          <th>Price</th>
          <th>Delta %</th>
          <th>M1 Now</th>
          <th>M1 New</th>
          <th>M7 Now</th>
          <th>M7 New</th>
          <th>Impact Factors</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => `
          <tr>
            <td>${r.rankNow ?? "--"}</td>
            <td class="${deltaClass((r.rankNow || 0) - (r.rankNew || 0))}">${r.rankNew ?? "--"}</td>
            <td><strong>${escapeHtml(r.sym)}</strong></td>
            <td>${escapeHtml(r.name || "")}</td>
            <td>${fmt(r.price)}</td>
            <td class="${deltaClass(r.deltaPct)}">${fmtPct(r.deltaPct)}</td>
            <td>${fmt(r.m1Now)}</td>
            <td>${fmt(r.m1New)}</td>
            <td>${fmt(r.m7Now)}</td>
            <td class="${deltaClass(r.delta)}">${fmt(r.m7New)}</td>
            <td style="text-align:left">${impactFactors(r.result)}</td>
          </tr>
        `).join("")}
      </tbody>
    `;
  }

  function renderSymbolOptions() {
    const q = String($("searchBox").value || "").trim().toUpperCase();
    const rows = getRows().filter(x => {
      if (!q) return true;
      const name = String(field(x.row, ["name", "company_name"], "")).toUpperCase();
      return x.sym.includes(q) || name.includes(q);
    });
    const sel = $("symbolSelect");
    const current = state.selectedSymbol;
    sel.innerHTML = rows.map(x => {
      const name = field(x.row, ["name", "company_name"], "");
      return `<option value="${x.sym}">${x.sym}${name ? " - " + escapeHtml(name) : ""}</option>`;
    }).join("");
    if (current && rows.some(x => x.sym === current)) sel.value = current;
    else if (rows[0]) state.selectedSymbol = rows[0].sym;
  }

  function render() {
    renderParamsTable();
    const ctx = getRows().find(x => x.sym === state.selectedSymbol) || getRows()[0];
    if (!ctx) return;
    state.selectedSymbol = ctx.sym;
    const result = computeM7(ctx, state.params);
    const d = result.scores.m7.new - result.scores.m7.now;

    $("kpiNow").textContent = fmt(result.scores.m7.now);
    $("kpiNew").textContent = fmt(result.scores.m7.new);
    $("kpiDelta").textContent = fmt(d);
    $("kpiDelta").className = deltaClass(d);

    const name = field(ctx.row, ["name", "company_name"], "");
    $("selectedMeta").textContent = `${ctx.sym}${name ? " / " + name : ""}`;
    $("ruleBox").innerHTML = `Debug rule：前端會重新計算公式，但必須對齊 Python M7 v2 欄位。trend 分數允許超過 10；money 使用 liquidity/flow 子因子。缺少子因子時才 fallback，並在 audit 明確顯示。`;
    renderScoreTable(result);
    renderFactorImpactTable(result);
    $("traceBox").textContent = result.trace;
    renderAudit(result);
    renderDeltaPreview();
  }

  function resetParams() {
    state.params = { ...DEFAULT_PARAMS };
    PARAM_DEFS.forEach(([key]) => {
      const el = $("p_" + key);
      const pv = $("pv_" + key);
      if (el) el.value = state.params[key];
      if (pv) pv.textContent = fmt(state.params[key], 2);
    });
    render();
  }

  function exportTrace() {
    const ctx = getRows().find(x => x.sym === state.selectedSymbol) || getRows()[0];
    if (!ctx) return;
    const result = computeM7(ctx, state.params);
    const payload = {
      generated_at: new Date().toISOString(),
      symbol: ctx.sym,
      params: state.params,
      scores: result.scores,
      raw_weight_layers: {
        now_weights: result.nowWeights,
        user_new_weights: result.userRawWeights,
        effective_new_weights: result.rawWeights
      },
      factor_impact: factorImpactRows(result),
      audit: result.audit,
      trace: result.trace
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `m7_formula_trace_${ctx.sym}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function init() {
    try {
      $("loadStatus").textContent = "Loading data...";
      const [scores, compare, manifest, runtime, fundamentals] = await Promise.all([
        loadJson(DATA_PATHS.scores),
        loadJson(DATA_PATHS.compare, true),
        loadJson(DATA_PATHS.manifest, true),
        loadJson(DATA_PATHS.runtime, true),
        loadJson(DATA_PATHS.fundamentals, true)
      ]);
      state.scores = asArray(scores);
      state.compare = asArray(compare);
      state.manifest = manifest;
      state.runtime = asArray(runtime);
      state.fundamentals = asArray(fundamentals);

      if (!state.scores.length) throw new Error("m7_v2_scores has no rows");
      state.selectedSymbol = symbolOf(state.scores[0]);
      $("loadStatus").textContent = `Loaded ${state.scores.length} M7 rows`;

      renderSymbolOptions();
      renderParamControls();
      render();

      $("symbolSelect").addEventListener("change", (e) => { state.selectedSymbol = e.target.value; render(); });
      $("searchBox").addEventListener("input", () => { renderSymbolOptions(); render(); });
      $("decimalInput").addEventListener("change", (e) => { state.decimals = clamp(num(e.target.value, 2), 1, 4); render(); });
      $("btnReset").addEventListener("click", resetParams);
      $("btnExport").addEventListener("click", exportTrace);
    } catch (err) {
      console.error(err);
      $("loadStatus").textContent = "Load failed";
      $("ruleBox").className = "warn";
      $("ruleBox").textContent = err.message;
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();

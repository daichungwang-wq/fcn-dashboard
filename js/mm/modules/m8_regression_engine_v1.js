// ============================================================================
// M8 Regression Engine v1
// Path: js/mm/modules/m8_regression_engine_v1.js
// Purpose:
// 1. Build market-implied template / risk / tenor / structure curves
// 2. Produce New Fair Rate per FCN
// 3. Compare Market Coupon vs Old Fair vs New Fair
// ============================================================================

(function (global) {
  "use strict";

  const VERSION = "m8_regression_engine_v1_20260508";

  function toNum(v, d = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  }

  function round2(v) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
  }

  function arr(v) {
    return Array.isArray(v) ? v : [];
  }

  function avg(values) {
    const xs = arr(values).map(Number).filter(Number.isFinite);
    if (!xs.length) return null;
    return xs.reduce((a, b) => a + b, 0) / xs.length;
  }

  function median(values) {
    const xs = arr(values).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
    if (!xs.length) return null;
    const mid = Math.floor(xs.length / 2);
    return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
  }

  function pickNum(...values) {
    for (const v of values) {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
    return null;
  }

  function safeKey(v, fallback = "UNKNOWN") {
    const s = String(v || "").trim();
    return s || fallback;
  }

  function getMarketCoupon(row) {
    return pickNum(row.market_coupon, row.market_rate, row.coupon_pct);
  }

  function getOldFairRate(row) {
    return pickNum(
      row.fair_rate,
      row.fair_yield,
      row.my_preference_rate,
      row.m8_features && row.m8_features.fair_yield
    );
  }

  function getPreRate(row) {
    return pickNum(row.pre_rate, row.my_pre_rate, row.m8_features && row.m8_features.pre_rate);
  }

  function getMarketImpliedBrake(row) {
    const direct = pickNum(row.market_implied_brake, row.implied_market_brake);
    if (direct !== null) return direct;

    const pre = getPreRate(row);
    const coupon = getMarketCoupon(row);
    if (pre !== null && coupon !== null) return pre - coupon;

    return null;
  }

  function groupBy(rows, keyFn) {
    const map = new Map();
    arr(rows).forEach(row => {
      const k = safeKey(keyFn(row));
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(row);
    });
    return map;
  }

  function summarizeGroup(key, rows, keyName) {
    const coupons = rows.map(getMarketCoupon).filter(Number.isFinite);
    const oldFairs = rows.map(getOldFairRate).filter(Number.isFinite);
    const preRates = rows.map(getPreRate).filter(Number.isFinite);
    const brakes = rows.map(getMarketImpliedBrake).filter(Number.isFinite);

    return {
      [keyName]: key,
      count: rows.length,
      avg_coupon: round2(avg(coupons)),
      median_coupon: round2(median(coupons)),
      avg_old_fair_rate: round2(avg(oldFairs)),
      avg_pre_rate: round2(avg(preRates)),
      avg_market_implied_brake: round2(avg(brakes)),
      median_market_implied_brake: round2(median(brakes))
    };
  }

  function buildTemplateSummary(rows) {
    const groups = groupBy(rows, r => r.basket_template || r.basket_template_label);
    return Array.from(groups.entries())
      .map(([k, rs]) => {
        const base = summarizeGroup(k, rs, "template");
        const labels = rs.map(r => r.basket_template_label).filter(Boolean);
        const names = rs.map(r => r.basket_template_name).filter(Boolean);
        return {
          ...base,
          template_label: labels[0] || k,
          template_name: names[0] || ""
        };
      })
      .sort((a, b) => b.count - a.count);
  }

  function buildRiskSurface(rows) {
    const groups = groupBy(rows, r => r.risk_template);
    return Array.from(groups.entries())
      .map(([k, rs]) => summarizeGroup(k, rs, "risk_template"))
      .sort((a, b) => (b.avg_coupon || 0) - (a.avg_coupon || 0));
  }

  function buildTenorCurve(rows) {
    const groups = groupBy(rows, r => r.tenor_template || r.tenor_bucket);
    return Array.from(groups.entries())
      .map(([k, rs]) => summarizeGroup(k, rs, "tenor_template"))
      .sort((a, b) => (b.avg_coupon || 0) - (a.avg_coupon || 0));
  }

  function buildStructureCurve(rows) {
    const groups = groupBy(rows, r => r.structure_template || r.type);
    return Array.from(groups.entries())
      .map(([k, rs]) => summarizeGroup(k, rs, "structure_template"))
      .sort((a, b) => (b.avg_coupon || 0) - (a.avg_coupon || 0));
  }

  function buildDNAStats(rows) {
    const groups = groupBy(rows, r => r.core_dna_2 || r.core_dna_3 || r.basket_symbols_key);
    return Array.from(groups.entries())
      .map(([k, rs]) => summarizeGroup(k, rs, "dna"))
      .sort((a, b) => b.count - a.count);
  }

  function buildM7Overlay(rows) {
    const buckets = {
      high_8_plus: [],
      strong_7_to_8: [],
      medium_6_to_7: [],
      weak_under_6: [],
      no_m7_score: []
    };

    arr(rows).forEach(r => {
      const raw = pickNum(r.avg_m7_score, r.m7_score, r.score_avg);
      if (raw === null) {
        buckets.no_m7_score.push(r);
      } else if (raw >= 8) {
        buckets.high_8_plus.push(r);
      } else if (raw >= 7) {
        buckets.strong_7_to_8.push(r);
      } else if (raw >= 6) {
        buckets.medium_6_to_7.push(r);
      } else {
        buckets.weak_under_6.push(r);
      }
    });

    return Object.entries(buckets).map(([bucket, rs]) => summarizeGroup(bucket, rs, "m7_bucket"));
  }

  function globalMeanCoupon(rows) {
    return avg(arr(rows).map(getMarketCoupon).filter(Number.isFinite)) || 18;
  }

  function findCurveValue(curve, keyName, key, valueField, fallback) {
    const hit = arr(curve).find(x => x[keyName] === key);
    const v = hit ? pickNum(hit[valueField]) : null;
    return v === null ? fallback : v;
  }

  function calcTemplateBaseRate(row, templateSummary, fallbackRate) {
    const key = safeKey(row.basket_template || row.basket_template_label);
    return findCurveValue(templateSummary, "template", key, "avg_coupon", fallbackRate);
  }

  function calcRiskAdjustment(row, riskSurface, globalCoupon) {
    const key = safeKey(row.risk_template);
    const v = findCurveValue(riskSurface, "risk_template", key, "avg_coupon", globalCoupon);
    return (v - globalCoupon) * 0.35;
  }

  function calcTenorAdjustment(row, tenorCurve, globalBrake) {
    const key = safeKey(row.tenor_template || row.tenor_bucket);
    const v = findCurveValue(tenorCurve, "tenor_template", key, "avg_market_implied_brake", globalBrake);
    return (v - globalBrake) * 0.45;
  }

  function calcStructureAdjustment(row, structureCurve, globalCoupon) {
    const key = safeKey(row.structure_template || row.type);
    const v = findCurveValue(structureCurve, "structure_template", key, "avg_coupon", globalCoupon);
    return (v - globalCoupon) * 0.12;
  }

  function calcM7OverlayAdjustment(row) {
    const m7 = pickNum(row.avg_m7_score, row.m7_score, row.score_avg);
    if (m7 === null) return 0;

    if (m7 >= 8.5) return -1.4;
    if (m7 >= 8.0) return -1.0;
    if (m7 >= 7.5) return -0.6;
    if (m7 >= 7.0) return -0.2;
    if (m7 >= 6.5) return 0.5;
    if (m7 >= 6.0) return 1.2;
    return 2.5;
  }

  function calcNewFairRate(row, curves, globals) {
    const coupon = getMarketCoupon(row);
    const oldFair = getOldFairRate(row);

    const templateBase = calcTemplateBaseRate(
      row,
      curves.templateSummary,
      globals.globalCoupon
    );

    const riskAdj = calcRiskAdjustment(
      row,
      curves.riskSurface,
      globals.globalCoupon
    );

    const tenorAdj = calcTenorAdjustment(
      row,
      curves.tenorCurve,
      globals.globalBrake
    );

    const structureAdj = calcStructureAdjustment(
      row,
      curves.structureCurve,
      globals.globalCoupon
    );

    const m7Adj = calcM7OverlayAdjustment(row);

    const newFairRate =
      templateBase +
      riskAdj +
      tenorAdj +
      structureAdj +
      m7Adj;

    return {
      template_base_rate: round2(templateBase),
      risk_adjustment: round2(riskAdj),
      tenor_adjustment: round2(tenorAdj),
      structure_adjustment: round2(structureAdj),
      m7_overlay_adjustment: round2(m7Adj),
      new_fair_rate: round2(newFairRate),
      pricing_gap_vs_old: coupon !== null && oldFair !== null ? round2(coupon - oldFair) : null,
      pricing_gap_vs_new: coupon !== null ? round2(coupon - newFairRate) : null,
      fair_rate_delta_old_to_new: oldFair !== null ? round2(newFairRate - oldFair) : null
    };
  }

  function runM8Regression(rows) {
    const validRows = arr(rows).filter(r => getMarketCoupon(r) !== null);

    const templateSummary = buildTemplateSummary(validRows);
    const riskSurface = buildRiskSurface(validRows);
    const tenorCurve = buildTenorCurve(validRows);
    const structureCurve = buildStructureCurve(validRows);
    const m7Overlay = buildM7Overlay(validRows);
    const dnaStats = buildDNAStats(validRows);

    const globalCoupon = globalMeanCoupon(validRows);
    const globalBrake = avg(validRows.map(getMarketImpliedBrake).filter(Number.isFinite)) || 0;

    const curves = {
      templateSummary,
      riskSurface,
      tenorCurve,
      structureCurve
    };

    const globals = {
      globalCoupon,
      globalBrake
    };

    const calibratedRows = validRows.map(r => {
      const regression = calcNewFairRate(r, curves, globals);
      return {
        ...r,
        ...regression
      };
    });

    const relationshipSummary = {
      avg_market_coupon: round2(avg(calibratedRows.map(getMarketCoupon))),
      avg_old_fair_rate: round2(avg(calibratedRows.map(getOldFairRate))),
      avg_new_fair_rate: round2(avg(calibratedRows.map(r => r.new_fair_rate))),
      avg_gap_vs_old: round2(avg(calibratedRows.map(r => r.pricing_gap_vs_old))),
      avg_gap_vs_new: round2(avg(calibratedRows.map(r => r.pricing_gap_vs_new))),
      avg_old_to_new_delta: round2(avg(calibratedRows.map(r => r.fair_rate_delta_old_to_new)))
    };

    return {
      version: VERSION,
      generated_at: new Date().toISOString(),
      rows_used: calibratedRows.length,
      globals,
      relationship_summary: relationshipSummary,
      template_summary: templateSummary,
      risk_surface: riskSurface,
      tenor_curve: tenorCurve,
      structure_curve: structureCurve,
      m7_overlay: m7Overlay,
      dna_stats: dnaStats,
      calibrated_rows: calibratedRows
    };
  }

  global.M8RegressionEngineV1 = {
    VERSION,
    runM8Regression,
    buildTemplateSummary,
    buildRiskSurface,
    buildTenorCurve,
    buildStructureCurve,
    buildM7Overlay,
    buildDNAStats,
    calcNewFairRate
  };

})(window);


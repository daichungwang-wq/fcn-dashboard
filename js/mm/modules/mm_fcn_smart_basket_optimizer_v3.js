// ============================================================================
// MM FCN Smart Basket Optimizer v3
// Path:
// js/mm/modules/mm_fcn_smart_basket_optimizer_v3.js
//
// Purpose:
//   Target-driven FCN basket optimizer.
//   It does NOT replace:
//     - mm_filter.js
//     - mm_fcn_simulating_allocating_engine_v2.js
//     - mm_fcn_risk_taxonomy_engine_vfinal.js
//
// Design:
//   1) mm_filter.js creates Highlight / Watch / Simulation / Reject pools.
//   2) This optimizer searches candidate baskets by target pool.
//   3) M8 fair yield is injected from caller.
//   4) Risk taxonomy is injected through window.MMFcnRiskTaxonomyEngine if loaded.
//   5) Allocation amount does NOT affect pool admission.
// ============================================================================

window.MMFCNSmartBasketOptimizerV3 = (() => {
  // --------------------------------------------------------------------------
  // CONFIG
  // --------------------------------------------------------------------------

  const VERSION = "mm_fcn_smart_basket_optimizer_v3_20260507";

  const TARGET_POOLS = {
    conservative: {
      label: "保守池",
      target_min: 10,
      target_max: 15,
      target_mid: 13,
      allowed_basket_pool: "保守池",
      max_tenor: 12,
      preferred_size: [3, 4],
      candidate_limit: 30,
      description: "同池內最低風險達標解；若中期中風險已達標，不追求更高 coupon。"
    },
    rational: {
      label: "合理池",
      target_min: 15,
      target_max: 18.99,
      target_mid: 16.5,
      allowed_basket_pool: "合理池",
      max_tenor: 10,
      preferred_size: [3, 4],
      candidate_limit: 30,
      description: "尋找收益與 worst-of 風險平衡，避免為小幅增收拉長天期。"
    },
    aggressive: {
      label: "積極池",
      target_min: 19,
      target_max: 25,
      target_mid: 20,
      allowed_basket_pool: "積極池",
      max_tenor: 9,
      preferred_size: [3, 4],
      candidate_limit: 25,
      description: "積極單以短天期為主；中風險積極單 9M 以內可接受。"
    },
    speculative: {
      label: "投機池",
      target_min: 12,
      target_max: 25,
      target_mid: 15,
      allowed_basket_pool: "投機池",
      max_tenor: 3,
      preferred_size: [2, 3],
      candidate_limit: 15,
      description: "投機池只能搭配 Low / Medium-Low structure，且 3M 以內。"
    }
  };

  const STRUCTURE_PROFILES = {
    conservative: [
      { id: "cons_60_50_12m_eki", KI: 50, Strike: 60, T: 12, type: "EKI" },
      { id: "cons_65_55_9m_eki", KI: 55, Strike: 65, T: 9, type: "EKI" },
      { id: "cons_68_55_6m_eki", KI: 55, Strike: 68, T: 6, type: "EKI" },
      { id: "cons_70_55_9m_eki", KI: 55, Strike: 70, T: 9, type: "EKI" },
      { id: "cons_70_60_6m_aki", KI: 60, Strike: 70, T: 6, type: "AKI" }
    ],
    rational: [
      { id: "rat_65_55_7m_eki", KI: 55, Strike: 65, T: 7, type: "EKI" },
      { id: "rat_68_55_6m_eki", KI: 55, Strike: 68, T: 6, type: "EKI" },
      { id: "rat_68_58_6m_eki", KI: 58, Strike: 68, T: 6, type: "EKI" },
      { id: "rat_70_55_6m_eki", KI: 55, Strike: 70, T: 6, type: "EKI" },
      { id: "rat_70_60_4m_aki", KI: 60, Strike: 70, T: 4, type: "AKI" }
    ],
    aggressive: [
      { id: "agg_65_55_6m_eki", KI: 55, Strike: 65, T: 6, type: "EKI" },
      { id: "agg_68_55_4m_eki", KI: 55, Strike: 68, T: 4, type: "EKI" },
      { id: "agg_70_55_3m_eki", KI: 55, Strike: 70, T: 3, type: "EKI" },
      { id: "agg_70_60_3m_aki", KI: 60, Strike: 70, T: 3, type: "AKI" }
    ],
    speculative: [
      { id: "spec_55_45_3m_eki", KI: 45, Strike: 55, T: 3, type: "EKI" },
      { id: "spec_60_50_2m_eki", KI: 50, Strike: 60, T: 2, type: "EKI" },
      { id: "spec_60_50_1m_aki", KI: 50, Strike: 60, T: 1, type: "AKI" }
    ]
  };

  const STRUCTURE_RISK_RANK = {
    "Low": 1,
    "Medium-Low": 2,
    "Medium": 3,
    "Medium-High": 4,
    "High": 5,
    "Very High": 6,
    "Extremely High": 7
  };

  const POOL_RANK = {
    highlight: 1,
    watch: 2,
    simulation: 3,
    reject: 4,
    unknown: 5
  };

  // --------------------------------------------------------------------------
  // BASIC UTILS
  // --------------------------------------------------------------------------

  function n(v, d = 0) {
    const x = Number(v);
    return Number.isFinite(x) ? x : d;
  }

  function round2(v) {
    const x = Number(v);
    return Number.isFinite(x) ? Math.round(x * 100) / 100 : null;
  }

  function upper(v) {
    return String(v || "").trim().toUpperCase();
  }

  function arr(v) {
    return Array.isArray(v) ? v : [];
  }

  function uniqueBySymbol(list = []) {
    const seen = new Set();
    const out = [];
    list.forEach(x => {
      const s = upper(x.symbol || x.ticker || x.code);
      if (!s || seen.has(s)) return;
      seen.add(s);
      out.push({ ...x, symbol: s });
    });
    return out;
  }

  function mean(xs = []) {
    const clean = xs.map(Number).filter(Number.isFinite);
    if (!clean.length) return null;
    return clean.reduce((a, b) => a + b, 0) / clean.length;
  }

  function combinations(items, k, limit = 100) {
    const out = [];
    const cur = [];

    function walk(start) {
      if (out.length >= limit) return;
      if (cur.length === k) {
        out.push([...cur]);
        return;
      }
      for (let i = start; i < items.length; i += 1) {
        cur.push(items[i]);
        walk(i + 1);
        cur.pop();
      }
    }

    walk(0);
    return out;
  }

  function scoreStockForSearch(stock = {}) {
    return (
      n(stock.m7_score) * 10 +
      n(stock.m6_market_attractive_score) * 1.5 -
      n(stock.m2_util) * 5 -
      (String(stock.vol_band || "") === "extreme" ? 8 : 0)
    );
  }

  function normalizePools(filterResult = {}) {
    const pools = filterResult.pools || {};
    const pack = {};
    ["highlight", "watch", "simulation", "reject"].forEach(pool => {
      pack[pool] = uniqueBySymbol(pools[pool] || [])
        .map(x => ({ ...x, pool_type: pool }))
        .sort((a, b) => scoreStockForSearch(b) - scoreStockForSearch(a));
    });
    return pack;
  }

  // --------------------------------------------------------------------------
  // BASKET POOL / WORST-OF CLASSIFICATION
  // --------------------------------------------------------------------------

  function countBasketPools(basket = []) {
    const c = { highlight: 0, watch: 0, simulation: 0, reject: 0, unknown: 0 };
    basket.forEach(s => {
      const p = String(s.pool_type || s.pool || "unknown").toLowerCase();
      if (c[p] === undefined) c.unknown += 1;
      else c[p] += 1;
    });
    return c;
  }

  function classifyBasketPool(basket = []) {
    const c = countBasketPools(basket);

    if (c.reject > 0) {
      return "投機池";
    }

    if (c.highlight >= 2 && c.watch <= 1 && c.simulation === 0) {
      return "保守池";
    }

    if (c.watch <= 2 && c.simulation <= 1) {
      return "合理池";
    }

    if (c.simulation >= 1 && c.reject === 0) {
      return "積極池";
    }

    return "Reject";
  }

  function worstOfPool(basket = []) {
    const c = countBasketPools(basket);
    if (c.reject > 0) return "reject";
    if (c.simulation > 0) return "simulation";
    if (c.watch > 0) return "watch";
    if (c.highlight > 0) return "highlight";
    return "unknown";
  }

  // --------------------------------------------------------------------------
  // RISK TAXONOMY BRIDGE
  // --------------------------------------------------------------------------

  function classifyRisk({ basket, structure }) {
    const poolCounts = countBasketPools(basket);

    if (window.MMFcnRiskTaxonomyEngine?.process) {
      return window.MMFcnRiskTaxonomyEngine.process({
        strike: structure.Strike,
        ki: structure.KI,
        tenor: structure.T,
        highlight: poolCounts.highlight,
        watch: poolCounts.watch,
        simulation: poolCounts.simulation,
        reject: poolCounts.reject
      });
    }

    // Fallback when taxonomy engine is not loaded.
    return {
      structure_risk: fallbackStructureRisk(structure),
      basket_pool: classifyBasketPool(basket),
      time_label: fallbackTimeLabel(structure.T),
      validity: "UNKNOWN",
      final_label: `${fallbackStructureRisk(structure)}｜${classifyBasketPool(basket)}`
    };
  }

  function fallbackStructureRisk(structure = {}) {
    const strike = n(structure.Strike);
    const ki = n(structure.KI);
    if (strike >= 75 || ki >= 65) return "Very High";
    if (strike >= 70 || ki >= 60) return "High";
    if (strike >= 66 || ki >= 56) return "Medium-High";
    if (strike >= 65 || ki >= 55) return "Medium";
    if (strike >= 60 || ki >= 50) return "Medium-Low";
    return "Low";
  }

  function fallbackTimeLabel(t) {
    const x = n(t);
    if (x <= 2) return "極短期";
    if (x <= 4) return "短期";
    if (x <= 7) return "中期";
    if (x <= 10) return "長期";
    return "超長期";
  }

  function isAllowedTargetRisk(targetKey, risk = {}) {
    const pool = risk.basket_pool;
    const sr = risk.structure_risk;
    const valid = risk.validity;

    if (valid === "INVALID") return false;

    if (targetKey === "conservative") return pool === "保守池";
    if (targetKey === "rational") return pool === "合理池";
    if (targetKey === "aggressive") return pool === "積極池";
    if (targetKey === "speculative") return pool === "投機池" && ["Low", "Medium-Low"].includes(sr);

    return false;
  }

  // --------------------------------------------------------------------------
  // CANDIDATE BASKET GENERATION
  // --------------------------------------------------------------------------

  function buildCandidatesForTarget(targetKey, filterResult = {}, options = {}) {
    const target = TARGET_POOLS[targetKey];
    const pools = normalizePools(filterResult);
    const maxCandidate = n(options.max_candidate_baskets, target.candidate_limit);
    const basketLimit = n(options.max_combinations_per_size, 80);

    const h = pools.highlight.slice(0, n(options.highlight_top_n, 8));
    const w = pools.watch.slice(0, n(options.watch_top_n, 8));
    const s = pools.simulation.slice(0, n(options.simulation_top_n, 8));
    const r = pools.reject.slice(0, n(options.reject_top_n, 6));

    let source = [];

    if (targetKey === "conservative") {
      source = [...h, ...w.slice(0, 3)];
    } else if (targetKey === "rational") {
      source = [...h.slice(0, 6), ...w, ...s.slice(0, 4)];
    } else if (targetKey === "aggressive") {
      source = [...h.slice(0, 4), ...w, ...s];
    } else if (targetKey === "speculative") {
      source = [...r, ...s.slice(0, 4)];
    }

    source = uniqueBySymbol(source);

    const candidates = [];
    target.preferred_size.forEach(size => {
      combinations(source, size, basketLimit).forEach(basket => {
        const basketPool = classifyBasketPool(basket);
        const counts = countBasketPools(basket);

        // Pool policy pre-filter before M8 to reduce workload.
        if (targetKey === "conservative" && basketPool !== "保守池") return;
        if (targetKey === "rational" && basketPool !== "合理池") return;
        if (targetKey === "aggressive" && basketPool !== "積極池") return;
        if (targetKey === "speculative" && basketPool !== "投機池") return;

        candidates.push({
          target_key: targetKey,
          target_label: target.label,
          basket,
          symbols: basket.map(x => x.symbol),
          basket_pool: basketPool,
          worst_of_pool: worstOfPool(basket),
          pool_counts: counts,
          base_score: mean(basket.map(scoreStockForSearch))
        });
      });
    });

    return candidates
      .sort((a, b) => n(b.base_score) - n(a.base_score))
      .slice(0, maxCandidate);
  }

  // --------------------------------------------------------------------------
  // MARKET BENCHMARK
  // --------------------------------------------------------------------------

  function benchmarkMarketCoupon(symbols = [], marketHistory = {}, fallback = null) {
    const rows = arr(marketHistory.records);
    const upperSymbols = symbols.map(upper);

    const scored = rows
      .map(r => {
        const rs = arr(r.symbols).map(upper);
        const overlap = upperSymbols.filter(s => rs.includes(s)).length;
        return { record: r, overlap, ratio: upperSymbols.length ? overlap / upperSymbols.length : 0 };
      })
      .filter(x => x.overlap > 0)
      .sort((a, b) => b.ratio - a.ratio || b.overlap - a.overlap)
      .slice(0, 5);

    const avgCoupon = scored.length
      ? mean(scored.map(x => n(x.record.coupon_pct, null)))
      : fallback;

    return {
      market_coupon: avgCoupon,
      comparable_records: scored.map(x => ({
        id: x.record.record_id || x.record.id,
        symbols: x.record.symbols,
        coupon_pct: x.record.coupon_pct,
        overlap: x.overlap,
        ratio: x.ratio
      }))
    };
  }

  function calcDeltaPct(market, fair) {
    const m = Number(market);
    const f = Number(fair);
    if (!Number.isFinite(m) || !Number.isFinite(f) || f === 0) return null;
    return ((m / f) - 1) * 100;
  }

  // --------------------------------------------------------------------------
  // EVALUATION / RANKING
  // --------------------------------------------------------------------------

  function evaluateRun(run = {}, targetKey) {
    const target = TARGET_POOLS[targetKey];
    const fair = n(run.fair_yield, null);
    const market = n(run.market_coupon, null);
    const delta = calcDeltaPct(market, fair);

    const withinTarget = fair !== null && fair >= target.target_min && fair <= target.target_max;
    const aboveTarget = fair !== null && fair > target.target_max;
    const belowTarget = fair !== null && fair < target.target_min;

    const riskRank = STRUCTURE_RISK_RANK[run.risk?.structure_risk] || 99;
    const tenor = n(run.structure?.T);
    const overlapPenalty = n(run.portfolio_overlap_count) * 8;
    const timePenalty = Math.max(0, tenor - target.max_tenor) * 10;
    const deltaPenalty = delta === null ? 6 : Math.abs(delta) * 0.25;

    let score = 0;

    // Primary objective: target achieved.
    if (withinTarget) score += 120;
    if (aboveTarget) score += 70;
    if (belowTarget) score -= 40;

    // Prefer lowest risk after target achieved.
    score -= riskRank * 12;

    // Prefer shorter tenor when yield already reaches target.
    score -= tenor * 1.5;

    // Penalize portfolio concentration.
    score -= overlapPenalty;

    // Penalize validity and tenor boundary.
    score -= timePenalty;
    if (run.risk?.validity === "INVALID") score -= 100;

    // Prefer market close to fair, but not wildly tight.
    score -= deltaPenalty;
    if (delta !== null && delta < -15) score -= 25;
    if (delta !== null && delta > 15) score -= 12;

    // Good basket quality helps but should not dominate risk.
    score += n(run.candidate?.base_score) * 0.15;

    let decision = "REVIEW";
    if (withinTarget && run.risk?.validity !== "INVALID") decision = "BEST_QUALIFIED";
    if (aboveTarget && run.risk?.validity !== "INVALID") decision = "HIGH_YIELD_CANDIDATE";
    if (belowTarget) decision = "BELOW_TARGET";
    if (run.risk?.validity === "INVALID") decision = "INVALID";

    return {
      score: round2(score),
      within_target: withinTarget,
      above_target: aboveTarget,
      below_target: belowTarget,
      delta_pct: round2(delta),
      decision,
      note: buildDecisionNote({ target, run, decision, delta })
    };
  }

  function buildDecisionNote({ target, run, decision, delta }) {
    const risk = run.risk || {};
    if (decision === "BEST_QUALIFIED") {
      return `${target.label}已達標，優先比較同池內是否有更低 Structure Risk / 更短天期解。`;
    }
    if (decision === "HIGH_YIELD_CANDIDATE") {
      return `收益高於目標區間，可列高收益候選，但需確認是否值得承擔 ${risk.structure_risk} / ${risk.time_label} 風險。`;
    }
    if (decision === "BELOW_TARGET") {
      return `Fair Yield 低於 ${target.target_min}% 目標，除非市場外單更便宜，否則不優先。`;
    }
    if (decision === "INVALID") {
      return `超出 ${target.label} 的 pool policy 或 tenor boundary，不建議承做。`;
    }
    if (delta !== null && delta < -10) {
      return `市場價格偏 tight，需要求更高 coupon 或調整 Strike/KI。`;
    }
    return "需人工檢查 basket overlap / M2 持倉 / 外單條件。";
  }

  function portfolioOverlap(symbols = [], currentPool = []) {
    const current = new Set(arr(currentPool).map(upper));
    const overlap = symbols.map(upper).filter(s => current.has(s));
    return { overlap, count: overlap.length };
  }

  // --------------------------------------------------------------------------
  // MAIN OPTIMIZER
  // --------------------------------------------------------------------------

  async function optimize(input = {}) {
    const {
      filterResult = {},
      marketHistory = {},
      currentPool = [],
      targets = ["conservative", "rational", "aggressive", "speculative"],
      m8Runner,
      options = {}
    } = input;

    if (typeof m8Runner !== "function") {
      throw new Error("MMFCNSmartBasketOptimizerV3.optimize requires m8Runner({caseName,symbols,KI,Strike,T,type,marketYield}).");
    }

    const allRuns = [];

    for (const targetKey of targets) {
      const target = TARGET_POOLS[targetKey];
      if (!target) continue;

      const candidates = buildCandidatesForTarget(targetKey, filterResult, options);
      const profiles = STRUCTURE_PROFILES[targetKey] || [];

      for (const candidate of candidates) {
        for (const structure of profiles) {
          const risk = classifyRisk({ basket: candidate.basket, structure });

          if (!isAllowedTargetRisk(targetKey, risk)) {
            continue;
          }

          const caseName = `V3_${targetKey}_${candidate.symbols.join("_")}_${structure.id}`;
          const m8 = await m8Runner({
            caseName,
            symbols: candidate.symbols,
            KI: structure.KI,
            Strike: structure.Strike,
            T: structure.T,
            type: structure.type,
            marketYield: 0
          });

          const fairYield = n(m8?.fair_yield, null);
          const marketBenchmark = benchmarkMarketCoupon(
            candidate.symbols,
            marketHistory,
            null
          );

          const overlap = portfolioOverlap(candidate.symbols, currentPool);

          const run = {
            run_id: caseName,
            version: VERSION,
            target_key: targetKey,
            target_label: target.label,
            target_min: target.target_min,
            target_max: target.target_max,
            candidate,
            basket: candidate.basket,
            symbols: candidate.symbols,
            structure,
            risk,
            m8,
            fair_yield: fairYield,
            market_coupon: marketBenchmark.market_coupon,
            market_benchmark: marketBenchmark,
            portfolio_overlap: overlap.overlap,
            portfolio_overlap_count: overlap.count
          };

          run.evaluation = evaluateRun(run, targetKey);
          allRuns.push(run);
        }
      }
    }

    const ranked = allRuns
      .sort((a, b) => n(b.evaluation?.score) - n(a.evaluation?.score));

    const byTarget = {};
    Object.keys(TARGET_POOLS).forEach(key => {
      const rows = ranked.filter(r => r.target_key === key);
      byTarget[key] = {
        target: TARGET_POOLS[key],
        best_qualified: rows.find(r => r.evaluation.decision === "BEST_QUALIFIED") || null,
        high_yield_candidate: rows.find(r => r.evaluation.decision === "HIGH_YIELD_CANDIDATE") || null,
        top_runs: rows.slice(0, 5)
      };
    });

    return {
      version: VERSION,
      generated_at: new Date().toISOString(),
      runs: ranked,
      by_target: byTarget,
      best_overall: ranked[0] || null,
      summary: buildSummary(ranked, byTarget)
    };
  }

  function buildSummary(runs = [], byTarget = {}) {
    const best = runs[0] || null;
    return {
      total_runs: runs.length,
      best_overall: best ? {
        target_label: best.target_label,
        symbols: best.symbols,
        fair_yield: round2(best.fair_yield),
        market_coupon: round2(best.market_coupon),
        structure: best.structure,
        risk: best.risk,
        score: best.evaluation?.score,
        decision: best.evaluation?.decision,
        note: best.evaluation?.note
      } : null,
      target_status: Object.fromEntries(Object.entries(byTarget).map(([key, v]) => [
        key,
        {
          label: v.target.label,
          best_qualified: v.best_qualified ? {
            symbols: v.best_qualified.symbols,
            fair_yield: round2(v.best_qualified.fair_yield),
            structure_risk: v.best_qualified.risk?.structure_risk,
            time_label: v.best_qualified.risk?.time_label,
            structure: v.best_qualified.structure
          } : null,
          high_yield_candidate: v.high_yield_candidate ? {
            symbols: v.high_yield_candidate.symbols,
            fair_yield: round2(v.high_yield_candidate.fair_yield),
            structure_risk: v.high_yield_candidate.risk?.structure_risk,
            time_label: v.high_yield_candidate.risk?.time_label,
            structure: v.high_yield_candidate.structure
          } : null
        }
      ]))
    };
  }

  // --------------------------------------------------------------------------
  // PUBLIC
  // --------------------------------------------------------------------------

  return {
    VERSION,
    TARGET_POOLS,
    STRUCTURE_PROFILES,
    optimize,
    buildCandidatesForTarget,
    classifyBasketPool,
    countBasketPools,
    worstOfPool,
    classifyRisk
  };
})();

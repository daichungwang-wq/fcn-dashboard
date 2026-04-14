// ==========================================
// m3_engine.js
// 振宇 FCN 系統｜M3 主觀偏好模擬引擎
// 完整版：Scenario-driven Qualification + Analytics + M5 Payload
// ==========================================

import { runM8Case } from "../core/m8_batch_engine.js";
import { mergeStockData, evaluateStock } from "../core/stock_engine.js";
import { evaluateFCN } from "../core/fcn_engine.js";

// ------------------------------------------
// 工具
// ------------------------------------------
function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round(value, digits = 2) {
  const f = 10 ** digits;
  return Math.round(toNumber(value, 0) * f) / f;
}

function safeText(v, fallback = "-") {
  if (v === null || v === undefined || v === "") return fallback;
  return String(v);
}

function normalizePctMaybe(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  if (Math.abs(n) <= 1.5) return n * 100;
  return n;
}

async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path} 載入失敗：${res.status}`);
  return await res.json();
}

function calcStats(values) {
  const arr = (values || []).map(Number).filter(Number.isFinite);

  if (!arr.length) {
    return {
      count: 0,
      mean: null,
      std: null,
      min: null,
      max: null
    };
  }

  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance =
    arr.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / arr.length;
  const std = Math.sqrt(variance);

  return {
    count: arr.length,
    mean: round(mean, 2),
    std: round(std, 2),
    min: round(Math.min(...arr), 2),
    max: round(Math.max(...arr), 2)
  };
}

function uniqueArray(arr) {
  return [...new Set((arr || []).filter(Boolean))];
}

function mean(values) {
  const arr = (values || []).map(Number).filter(Number.isFinite);
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function std(values) {
  const arr = (values || []).map(Number).filter(Number.isFinite);
  if (arr.length <= 1) return 0;
  const m = mean(arr);
  const v = mean(arr.map(x => Math.pow(x - m, 2)));
  return Math.sqrt(v);
}

// ------------------------------------------
// M3 基本邏輯
// ------------------------------------------
function buildWhyWhyNot(stock) {
  const pure = toNumber(stock.pure_stock_score, 0);
  const snapshot = toNumber(stock.snapshot_score, 0);
  const eventStock = toNumber(stock.event_stock_score, 0);
  const delta = toNumber(stock.delta_stock_score, 0);

  const why = [];
  const whyNot = [];

  if (pure >= 7) why.push("Pure 分數高，屬高品質可接股");
  else if (pure >= 5) why.push("Pure 分數合格，可納入 FCN 考慮");
  else if (pure >= 4) why.push("Pure 分數勉強合格，僅可列觀察");
  else whyNot.push("Pure 分數太低，不願意接這種股票");

  if (eventStock >= 10) why.push("Event Stock 分數高，現在時點偏甜");
  else if (eventStock >= 6) why.push("Event Stock 分數合理，現在價格可接受");
  else if (eventStock >= 4) whyNot.push("Event Stock 分數普通，現在不夠便宜");
  else whyNot.push("Event Stock 分數過低，時點不適合");

  if (snapshot > 0) why.push("Snapshot 為正，短期位置有甜度");
  else if (snapshot < 0) whyNot.push("Snapshot 為負，位置偏高或偏熱");
  else whyNot.push("Snapshot 中性，沒有明顯甜度");

  if (delta > 0) why.push("Delta 為正，現在比平常更甜");
  else if (delta === 0) whyNot.push("Delta = 0，目前沒有額外甜度");
  else whyNot.push("Delta 為負，現在比平常更貴");

  if (stock.suggestion === "避免納入 FCN") whyNot.push("Stock Engine 已建議避免納入 FCN");
  if (stock.trend === "downtrend") whyNot.push("趨勢屬弱勢下跌");
  if (stock.trend === "dead_cat_bounce") whyNot.push("屬弱勢反彈，不宜誤判為甜點");

  return { why, whyNot };
}

function reviewStockForM3(stock) {
  const pure = toNumber(stock.pure_stock_score, 0);
  const eventStock = toNumber(stock.event_stock_score, 0);
  const delta = round(eventStock - pure, 2);

  let bucket = "clean";
  if (pure < 4 || stock.suggestion === "避免納入 FCN") {
    bucket = "reject";
  } else if (pure < 5 || eventStock < 6 || delta <= 0) {
    bucket = "watch";
  } else {
    bucket = "clean";
  }

  const { why, whyNot } = buildWhyWhyNot({
    ...stock,
    delta_stock_score: delta
  });

  return {
    ...stock,
    m1_event_score: toNumber(stock.event_score, 0),
    delta_stock_score: delta,
    bucket,
    why,
    whyNot
  };
}

function splitByBucket(stocks) {
  return {
    reviewed: stocks,
    clean_pool: stocks.filter(x => x.bucket === "clean"),
    watch_list: stocks.filter(x => x.bucket === "watch"),
    reject_list: stocks.filter(x => x.bucket === "reject")
  };
}

// ------------------------------------------
// 模擬組合
// ------------------------------------------
function generateCombinations(arr, size) {
  const result = [];

  function helper(start, combo) {
    if (combo.length === size) {
      result.push([...combo]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      helper(i + 1, combo);
      combo.pop();
    }
  }

  if (size > 0 && arr.length >= size) helper(0, []);
  return result;
}

function getScenarioArrays(scenario) {
  const normalizeToArray = (v, fallback = []) =>
    Array.isArray(v) ? v : (v === undefined ? fallback : [v]);

  return {
    basket_sizes: normalizeToArray(scenario.basket_size),
    kis: normalizeToArray(scenario.ki),
    strikes: normalizeToArray(scenario.strike),
    tenors: normalizeToArray(scenario.tenor),
    rates: normalizeToArray(scenario.rate),
    ekis: normalizeToArray(scenario.eki)
  };
}

function getFairFlag(gap) {
  const g = Number(gap);
  if (!Number.isFinite(g)) return "待接 M8";
  if (g >= 1.5) return "🔥 市場高估（甜）";
  if (g >= 0.5) return "👍 略甜";
  if (g >= -0.5) return "👌 合理";
  return "❌ 市場不買單";
}

// ------------------------------------------
// 健康度 / 市場評價
// ------------------------------------------
function calcHealthPct(fcn) {
  const worst = toNumber(fcn?.r1?.event_stock_score, 0);
  const avg = toNumber(fcn?.avgEventStock, 0);

  const score = 0.6 * worst + 0.4 * avg;
  return Math.max(0, Math.min(100, round((score / 12) * 100, 1)));
}

function getPreferenceLevel(eventFcn) {
  const x = toNumber(eventFcn, 0);
  if (x >= 10) return "高偏好";
  if (x >= 9) return "中高偏好";
  if (x >= 7.5) return "中偏好";
  return "低偏好";
}

function getMarketScore(gap, fairRate) {
  const g = Number(gap);
  const f = Number(fairRate);

  if (!Number.isFinite(g) || !Number.isFinite(f) || f === 0) return null;
  return round((g / f) * 100, 1);
}

function getMarketLevel(gap) {
  const g = Number(gap);
  if (!Number.isFinite(g)) return "待接 M8";
  if (g >= 1.5) return "非常划算";
  if (g >= 0.5) return "偏划算";
  if (g >= 0.0) return "合理可做";
  if (g >= -0.5) return "略嫌不足";
  if (g >= -1.5) return "不划算";
  return "明顯不划算";
}

// ------------------------------------------
// Scenario Qualification
// 相容新格式 qualification 與舊格式 目標
// ------------------------------------------
function getScenarioQualification(scenario = {}) {
  const q = scenario.qualification || {};
  const target = scenario["目標"] || scenario.target || {};

  const profitMinGap =
    q?.profit?.min_gap ??
    target.min_gap ??
    -1;

  const satisfyMinM3 =
    q?.satisfy?.min_m3_score ??
    target.min_event_fcn ??
    8;

  const safetyMinHealth =
    q?.safety?.min_health_score ??
    target.min_health ??
    30;

  return {
    profit: {
      min_gap: toNumber(profitMinGap, -1)
    },
    satisfy: {
      min_m3_score: toNumber(satisfyMinM3, 8)
    },
    safety: {
      min_health_score: toNumber(safetyMinHealth, 30)
    },
    source: scenario.qualification
      ? "scenario.qualification"
      : (scenario["目標"] || scenario.target ? "scenario.目標 / scenario.target" : "engine default")
  };
}

export function isQualified(row, scenario = null) {
  const scenarioQ =
    scenario?.qualification_resolved ||
    row?.qualification ||
    {
      profit: { min_gap: -1 },
      satisfy: { min_m3_score: 8 },
      safety: { min_health_score: 30 }
    };

  const profitPass =
    toNumber(row?.profit?.fair_gap, -999) >= toNumber(scenarioQ?.profit?.min_gap, -1);

  const satisfyPass =
    toNumber(row?.satisfy?.m3_score, 0) >= toNumber(scenarioQ?.satisfy?.min_m3_score, 8);

  const safetyPass =
    toNumber(row?.safety?.health_score, 0) >= toNumber(scenarioQ?.safety?.min_health_score, 30);

  return profitPass && satisfyPass && safetyPass;
}

// ------------------------------------------
// M3 Simulation
// ------------------------------------------
async function runSimulation(cleanPool, config) {
  const results = [];
  const scenarioGroup = config["M3_FCN情境組合參數"] || {};
  const scenarios = scenarioGroup.scenarios || [];
  const rankingCfg = config["M3_排名評分參數"] || {};
  const simCfg = config["M3_模擬控制參數"] || {};
  const maxCombinations = toNumber(simCfg.max_combinations, 50);

  for (const rawScenario of scenarios) {
    const scenario = {
      ...rawScenario,
      qualification_resolved: getScenarioQualification(rawScenario)
    };

    const arrays = getScenarioArrays(scenario);

    for (const basketSize of arrays.basket_sizes) {
      const combos = generateCombinations(cleanPool, toNumber(basketSize, 0)).slice(0, maxCombinations);

      for (let idx = 0; idx < combos.length; idx++) {
        const combo = combos[idx];

        for (const ki of arrays.kis) {
          for (const strike of arrays.strikes) {
            for (const tenor of arrays.tenors) {
              for (const rate of arrays.rates) {
                for (const eki of arrays.ekis) {
                  const type = eki ? "AKI" : "EKI";

                  const fcn = evaluateFCN({
                    id: `${safeText(scenario["名稱"], "SC")}_${idx + 1}`,
                    basket: combo.map(s => s.symbol),
                    ki: toNumber(ki, 0),
                    strike: toNumber(strike, 0),
                    yield: toNumber(rate, 0),
                    period: toNumber(tenor, 0),
                    eki: !!eki
                  }, combo);

                  if (!fcn) continue;

                  let fairRate = null;
                  let fairGap = null;
                  let fairFlag = "待接 M8";
                  let fairReason = "";

                  try {
                    const m8 = await runM8Case({
                      caseName: `${safeText(scenario["名稱"], "SC")}_${idx + 1}`,
                      symbols: combo.map(s => s.symbol),
                      KI: toNumber(ki, 0),
                      Strike: toNumber(strike, 0),
                      T: toNumber(tenor, 0),
                      type,
                      marketYield: toNumber(rate, 0)
                    });

                    fairRate = toNumber(m8?.fair_yield, null);
                    fairGap = Number.isFinite(fairRate)
                      ? round(fairRate - toNumber(rate, 0), 2)
                      : null;
                    fairFlag = safeText(m8?.pricing_view, getFairFlag(fairGap));
                    fairReason = safeText(m8?.note, "");
                  } catch (err) {
                    console.warn("M8 pricing failed:", err);
                  }

                  const eventFcn = toNumber(fcn.event_fcn, 0);
                  const healthPct = calcHealthPct(fcn);

                  const profit = {
                    simulation_rate: toNumber(rate, 0),
                    fair_rate: fairRate,
                    fair_gap: fairGap,
                    fair_flag: fairFlag,
                    fair_reason: fairReason,
                    market_score: getMarketScore(fairGap, fairRate),
                    market_level: getMarketLevel(fairGap)
                  };

                  const satisfy = {
                    m3_score: eventFcn,
                    preference_level: getPreferenceLevel(eventFcn)
                  };

                  const safety = {
                    health_score: healthPct
                  };

                  // 彙總上游 stock 因子（供 analytics / M5 用）
                  const componentPure = (combo || []).map(s => toNumber(s.pure_stock_score, null)).filter(Number.isFinite);
                  const componentSnapshot = (combo || []).map(s => toNumber(s.snapshot_score, null)).filter(Number.isFinite);
                  const componentEvent = (combo || []).map(s => toNumber(s.event_score, null)).filter(Number.isFinite);
                  const componentEventStock = (combo || []).map(s => toNumber(s.event_stock_score, null)).filter(Number.isFinite);
                  const componentSwing = (combo || []).map(s => toNumber(s.short_swing, null)).filter(Number.isFinite);
                  const componentTrendRate = (combo || []).map(s => toNumber(s.trend_rate, null)).filter(Number.isFinite);
                  const componentMidVol = (combo || []).map(s => toNumber(s.mid_term_volatility, null)).filter(Number.isFinite);

                  const row = {
                    ...fcn,

                    scenario_name: safeText(scenario["名稱"], "未命名情境"),
                    scenario_comment: safeText(scenario["說明"], ""),
                    scenario_type: safeText(scenario["類型"], ""),
                    scenario_goal: scenario["目標"] || scenario.target || null,

                    scenario_raw: scenario,
                    qualification: scenario.qualification_resolved,

                    basket_size: toNumber(basketSize, 0),
                    simulation_rate: toNumber(rate, 0),
                    tenor: toNumber(tenor, 0),

                    // 舊欄位相容
                    m3_score: eventFcn,
                    fair_rate: fairRate,
                    fair_gap: fairGap,
                    fair_flag: fairFlag,
                    fair_reason: fairReason,
                    health_pct: healthPct,
                    preference_level: getPreferenceLevel(eventFcn),
                    market_level: getMarketLevel(fairGap),
                    market_score: getMarketScore(fairGap, fairRate),

                    // 新欄位
                    profit,
                    satisfy,
                    safety,

                    // analytics / M5 用的上游因子
                    pure_stock_score: round(mean(componentPure), 4),
                    snapshot_score: round(mean(componentSnapshot), 4),
                    event_score: round(mean(componentEvent), 4),
                    event_stock_score: round(mean(componentEventStock), 4),
                    short_swing: round(mean(componentSwing), 4),
                    trend_rate: round(mean(componentTrendRate), 4),
                    mid_term_volatility: round(mean(componentMidVol), 4)
                  };

                  row.qualified = isQualified(row, scenario);

                  row.suggestion_rank =
                    eventFcn >= toNumber(rankingCfg.strong_buy_min_event_fcn, 12) ? "strong" :
                    eventFcn >= toNumber(rankingCfg.buy_min_event_fcn, 9) ? "buy" :
                    eventFcn >= toNumber(rankingCfg.watch_min_event_fcn, 6) ? "watch" :
                    "avoid";

                  results.push(row);
                }
              }
            }
          }
        }
      }
    }
  }

  results.sort((a, b) => toNumber(b.satisfy?.m3_score, -999) - toNumber(a.satisfy?.m3_score, -999));
  return results;
}

// ------------------------------------------
// Summary / Scenario / Rate
// ------------------------------------------
function buildSummary(selection, sims) {
  const reviewed = selection.reviewed || [];
  const clean = selection.clean_pool || [];
  const watch = selection.watch_list || [];
  const reject = selection.reject_list || [];
  const top = sims[0];
  const qualified = sims.filter(x => isQualified(x, x.scenario_raw));

  return {
    reviewed_count: reviewed.length,
    clean_count: clean.length,
    watch_count: watch.length,
    reject_count: reject.length,
    simulation_count: sims.length,
    qualified_count: qualified.length,
    qualified_rate: sims.length ? round((qualified.length / sims.length) * 100, 1) : 0,
    best_event_fcn: top ? toNumber(top.satisfy?.m3_score, 0) : null,
    best_basket: top ? top.basket : ""
  };
}

function buildScenarioSummary(sims) {
  const map = {};

  sims.forEach(x => {
    const name = x.scenario_name || "未知情境";

    if (!map[name]) {
      map[name] = {
        scenario_name: name,
        scenario_comment: x.scenario_comment || "",
        scenario_type: x.scenario_type || "",
        total: 0,
        qualified: 0,
        best_event_fcn: -999,
        best_basket: "",
        avg_event_fcn: 0,
        avg_gap: 0,
        avg_health: 0,
        rows: []
      };
    }

    map[name].total += 1;
    map[name].rows.push(x);

    if (isQualified(x, x.scenario_raw)) map[name].qualified += 1;

    if (toNumber(x.satisfy?.m3_score, -999) > map[name].best_event_fcn) {
      map[name].best_event_fcn = toNumber(x.satisfy?.m3_score, -999);
      map[name].best_basket = x.basket;
    }
  });

  return Object.values(map)
    .map(item => {
      const avgM3 = item.rows.reduce((sum, r) => sum + toNumber(r.satisfy?.m3_score, 0), 0) / Math.max(item.rows.length, 1);
      const avgGap = item.rows.reduce((sum, r) => sum + toNumber(r.profit?.fair_gap, 0), 0) / Math.max(item.rows.length, 1);
      const avgHealth = item.rows.reduce((sum, r) => sum + toNumber(r.safety?.health_score, 0), 0) / Math.max(item.rows.length, 1);

      return {
        ...item,
        avg_event_fcn: round(avgM3, 2),
        avg_gap: round(avgGap, 2),
        avg_health: round(avgHealth, 2),
        success_rate: round((item.qualified / Math.max(item.total, 1)) * 100, 1)
      };
    })
    .sort((a, b) => b.success_rate - a.success_rate || b.best_event_fcn - a.best_event_fcn);
}

function buildRateDistribution(sims) {
  const buckets = [
    { key: "<15", min: -Infinity, max: 15 },
    { key: "15-18", min: 15, max: 18 },
    { key: "18-20", min: 18, max: 20 },
    { key: "20以上", min: 20, max: Infinity }
  ];

  return buckets.map(b => {
    const rows = sims.filter(x => {
      const r = toNumber(x.profit?.simulation_rate, 0);
      return r >= b.min && r < b.max;
    });

    const ok = rows.filter(x => isQualified(x, x.scenario_raw)).length;

    return {
      bucket: b.key,
      total: rows.length,
      qualified: ok,
      success_rate: rows.length ? round((ok / rows.length) * 100, 1) : 0
    };
  });
}

// ------------------------------------------
// Simulation Meta / Qualified Meta / Compare
// ------------------------------------------
function buildSymbolStatsFromRows(rows) {
  const map = {};

  rows.forEach(row => {
    const components = Array.isArray(row.components) ? row.components : [];

    components.forEach(c => {
      const symbol = safeText(c.symbol, "");
      if (!symbol) return;

      if (!map[symbol]) {
        map[symbol] = {
          symbol,
          count: 0,
          event_scores: [],
          pure_scores: [],
          snapshot_scores: []
        };
      }

      map[symbol].count += 1;
      map[symbol].event_scores.push(toNumber(c.event_stock_score, null));
      map[symbol].pure_scores.push(toNumber(c.pure_stock_score, null));
      map[symbol].snapshot_scores.push(toNumber(c.snapshot_score, null));
    });
  });

  return Object.values(map)
    .map(x => ({
      symbol: x.symbol,
      count: x.count,
      avg_event_score: calcStats(x.event_scores).mean,
      avg_pure_score: calcStats(x.pure_scores).mean,
      avg_snapshot_score: calcStats(x.snapshot_scores).mean
    }))
    .sort((a, b) => b.count - a.count || toNumber(b.avg_event_score, 0) - toNumber(a.avg_event_score, 0));
}

function buildScenarioStatsFromRows(rows) {
  const map = {};

  rows.forEach(row => {
    const name = row.scenario_name || "未知情境";

    if (!map[name]) {
      map[name] = {
        scenario_name: name,
        scenario_type: safeText(row.scenario_type, "-"),
        scenario_goal: safeText(row.scenario_goal, "-"),
        count: 0,
        m3_scores: [],
        gaps: [],
        healths: [],
        rates: []
      };
    }

    map[name].count += 1;
    map[name].m3_scores.push(toNumber(row.satisfy?.m3_score, null));
    map[name].gaps.push(toNumber(row.profit?.fair_gap, null));
    map[name].healths.push(toNumber(row.safety?.health_score, null));
    map[name].rates.push(toNumber(row.profit?.simulation_rate, null));
  });

  return Object.values(map)
    .map(x => ({
      scenario_name: x.scenario_name,
      scenario_type: x.scenario_type,
      scenario_goal: x.scenario_goal,
      count: x.count,
      avg_m3_score: calcStats(x.m3_scores).mean,
      avg_gap: calcStats(x.gaps).mean,
      avg_health: calcStats(x.healths).mean,
      avg_rate: calcStats(x.rates).mean
    }))
    .sort((a, b) => b.count - a.count || toNumber(b.avg_m3_score, 0) - toNumber(a.avg_m3_score, 0));
}

function buildSimulationMeta(selection, sims) {
  const cleanPool = selection?.clean_pool || [];
  const scenarioMap = new Map();

  sims.forEach(row => {
    const key = row.scenario_name || "未知情境";
    if (!scenarioMap.has(key)) {
      scenarioMap.set(key, {
        scenario_name: key,
        scenario_type: safeText(row.scenario_type, "-"),
        scenario_goal: safeText(row.scenario_goal, "-"),
        qualification: row.qualification || null,
        source: "parameter_matrix.json / M3_FCN情境組合參數"
      });
    }
  });

  return {
    simulated_stock_count: cleanPool.length,
    simulated_stocks: cleanPool.map(s => ({
      symbol: s.symbol,
      score: round(toNumber(s.event_stock_score, 0), 2)
    })),
    scenario_count: scenarioMap.size,
    scenarios: [...scenarioMap.values()],
    stock_stats: calcStats(cleanPool.map(s => toNumber(s.event_stock_score, null))),
    gap_stats: calcStats(sims.map(s => toNumber(s.profit?.fair_gap, null))),
    m3_stats: calcStats(sims.map(s => toNumber(s.satisfy?.m3_score, null))),
    health_stats: calcStats(sims.map(s => toNumber(s.safety?.health_score, null))),
    symbol_stats: buildSymbolStatsFromRows(sims),
    scenario_stats: buildScenarioStatsFromRows(sims)
  };
}

function buildQualifiedMeta(sims) {
  const qualified = sims.filter(x => isQualified(x, x.scenario_raw));
  const qualifiedScenarioNames = uniqueArray(qualified.map(x => x.scenario_name));

  return {
    qualified_count: qualified.length,
    qualified_stock_count: uniqueArray(
      qualified.flatMap(x => Array.isArray(x.basket) ? x.basket : String(x.basket || "").split(",").map(s => s.trim()))
    ).filter(Boolean).length,
    qualified_scenario_count: qualifiedScenarioNames.length,
    gap_stats: calcStats(qualified.map(s => toNumber(s.profit?.fair_gap, null))),
    m3_stats: calcStats(qualified.map(s => toNumber(s.satisfy?.m3_score, null))),
    health_stats: calcStats(qualified.map(s => toNumber(s.safety?.health_score, null))),
    rate_stats: calcStats(qualified.map(s => toNumber(s.profit?.simulation_rate, null))),
    symbol_stats: buildSymbolStatsFromRows(qualified),
    scenario_stats: buildScenarioStatsFromRows(qualified)
  };
}

function buildCompareStats(simMeta, qualifiedMeta) {
  const simCount = toNumber(simMeta?.symbol_stats?.length, 0);
  const qualCount = toNumber(qualifiedMeta?.symbol_stats?.length, 0);
  const simScenarioCount = toNumber(simMeta?.scenario_stats?.length, 0);
  const qualScenarioCount = toNumber(qualifiedMeta?.scenario_stats?.length, 0);

  return {
    stock_capture_rate: simCount ? round((qualCount / simCount) * 100, 1) : 0,
    scenario_capture_rate: simScenarioCount ? round((qualScenarioCount / simScenarioCount) * 100, 1) : 0,
    gap_mean_delta:
      Number.isFinite(simMeta?.gap_stats?.mean) && Number.isFinite(qualifiedMeta?.gap_stats?.mean)
        ? round(qualifiedMeta.gap_stats.mean - simMeta.gap_stats.mean, 2)
        : null,
    m3_mean_delta:
      Number.isFinite(simMeta?.m3_stats?.mean) && Number.isFinite(qualifiedMeta?.m3_stats?.mean)
        ? round(qualifiedMeta.m3_stats.mean - simMeta.m3_stats.mean, 2)
        : null,
    health_mean_delta:
      Number.isFinite(simMeta?.health_stats?.mean) && Number.isFinite(qualifiedMeta?.health_stats?.mean)
        ? round(qualifiedMeta.health_stats.mean - simMeta.health_stats.mean, 2)
        : null
  };
}

// ------------------------------------------
// Scenario Analytics（M5-ready）
// Qualified vs Not Qualified 比較
// ------------------------------------------
function buildScenarioAnalytics(simulationResults = []) {
  const scenarioMap = {};

  for (const row of simulationResults) {
    const key = row.scenario_name || "未知情境";
    if (!scenarioMap[key]) scenarioMap[key] = [];
    scenarioMap[key].push(row);
  }

  const factors = [
    "mid_term_volatility",
    "snapshot_score",
    "short_swing",
    "event_score",
    "pure_stock_score",
    "event_stock_score",
    "trend_rate",
    "health_pct",
    "fair_gap",
    "simulation_rate",
    "fair_rate"
  ];

  const result = [];

  for (const scenarioName of Object.keys(scenarioMap)) {
    const rows = scenarioMap[scenarioName];
    const qualified = rows.filter(r => r.qualified);
    const notQualified = rows.filter(r => !r.qualified);

    const factorStats = {
      qualified: {},
      not_qualified: {},
      delta: {}
    };

    for (const factor of factors) {
      const qArr = qualified.map(r => toNumber(r[factor], null)).filter(Number.isFinite);
      const nArr = notQualified.map(r => toNumber(r[factor], null)).filter(Number.isFinite);

      const qMean = mean(qArr);
      const nMean = mean(nArr);

      factorStats.qualified[factor] = {
        mean: round(qMean, 4),
        std: round(std(qArr), 4),
        count: qArr.length,
        min: qArr.length ? round(Math.min(...qArr), 4) : null,
        max: qArr.length ? round(Math.max(...qArr), 4) : null
      };

      factorStats.not_qualified[factor] = {
        mean: round(nMean, 4),
        std: round(std(nArr), 4),
        count: nArr.length,
        min: nArr.length ? round(Math.min(...nArr), 4) : null,
        max: nArr.length ? round(Math.max(...nArr), 4) : null
      };

      factorStats.delta[factor] = round(qMean - nMean, 4);
    }

    // 使用股票 / worst-of / qualified stocks
    const usedStocks = {};
    const qualifiedStocks = {};
    const worstOfStocks = {};

    rows.forEach(row => {
      const basket = Array.isArray(row.basket)
        ? row.basket
        : String(row.basket || "").split(",").map(s => s.trim()).filter(Boolean);

      basket.forEach(sym => {
        if (!usedStocks[sym]) usedStocks[sym] = { symbol: sym, count: 0 };
        usedStocks[sym].count += 1;

        if (row.qualified) {
          if (!qualifiedStocks[sym]) qualifiedStocks[sym] = { symbol: sym, count: 0 };
          qualifiedStocks[sym].count += 1;
        }
      });

      const worstList = [row.r1?.symbol, row.r2?.symbol, row.r3?.symbol].filter(Boolean);
      worstList.forEach(sym => {
        if (!worstOfStocks[sym]) worstOfStocks[sym] = { symbol: sym, count: 0 };
        worstOfStocks[sym].count += 1;
      });
    });

    const topUsedStocks = Object.values(usedStocks).sort((a, b) => b.count - a.count).slice(0, 10);
    const topQualifiedStocks = Object.values(qualifiedStocks).sort((a, b) => b.count - a.count).slice(0, 10);
    const topWorstOfStocks = Object.values(worstOfStocks).sort((a, b) => b.count - a.count).slice(0, 10);

    // M3語言簡版
    const d = factorStats.delta;
    let pattern = "成功模式尚未明確";
    if (d.event_score > 1.5 && d.pure_stock_score > 1.0 && d.snapshot_score > 0.5) {
      pattern = "高 Event + 高 Pure + 偏甜";
    } else if (d.fair_gap > 0.5 && d.health_pct > 3) {
      pattern = "市場溢價 + 健康度優勢";
    } else if (d.pure_stock_score > 1.0 && d.trend_rate > 0.02) {
      pattern = "高品質 + 趨勢穩定";
    }

    const conclusion =
      d.fair_gap > 0
        ? "市場略有溢價，結構可承作"
        : d.fair_gap < 0
          ? "市場未明顯支持，需保守看待"
          : "市場定價大致合理";

    result.push({
      scenario: scenarioName,
      counts: {
        total: rows.length,
        qualified: qualified.length,
        not_qualified: notQualified.length,
        success_rate: rows.length ? round((qualified.length / rows.length) * 100, 2) : 0
      },
      qualification: rows[0]?.qualification || null,
      factor_stats: factorStats,
      stock_stats: {
        used: topUsedStocks,
        qualified: topQualifiedStocks,
        worst_of: topWorstOfStocks
      },
      m3_summary: {
        pattern,
        conclusion
      }
    });
  }

  return result.sort((a, b) => b.counts.success_rate - a.counts.success_rate);
}

// ------------------------------------------
// Best example / Dashboard / Decision
// ------------------------------------------
function pickBestQualifiedExample(sims) {
  const qualified = sims.filter(x => isQualified(x, x.scenario_raw));
  if (!qualified.length) return null;

  return [...qualified].sort((a, b) => {
    const scoreA =
      toNumber(a.satisfy?.m3_score, 0) * 1.0 +
      toNumber(a.profit?.fair_gap, 0) * 0.6 +
      toNumber(a.safety?.health_score, 0) * 0.03;

    const scoreB =
      toNumber(b.satisfy?.m3_score, 0) * 1.0 +
      toNumber(b.profit?.fair_gap, 0) * 0.6 +
      toNumber(b.safety?.health_score, 0) * 0.03;

    return scoreB - scoreA;
  })[0];
}

function buildDashboard(summary, scenarioSummary, rateDistribution, sims, selection) {
  const qualified = sims.filter(x => isQualified(x, x.scenario_raw));
  const overallSuccessRate = sims.length
    ? round((qualified.length / sims.length) * 100, 1)
    : 0;

  const bestScenario = scenarioSummary.length ? scenarioSummary[0] : null;
  const simulationMeta = buildSimulationMeta(selection, sims);
  const qualifiedMeta = buildQualifiedMeta(sims);
  const compareStats = buildCompareStats(simulationMeta, qualifiedMeta);
  const bestQualifiedExample = pickBestQualifiedExample(sims);

  return {
    total_simulations: sims.length,
    total_qualified: qualified.length,
    overall_success_rate: overallSuccessRate,

    best_scenario: bestScenario,
    simulation_meta: simulationMeta,
    qualified_meta: qualifiedMeta,
    compare_stats: compareStats,
    best_qualified_example: bestQualifiedExample,

    summary,
    scenario_summary: scenarioSummary,
    rate_distribution: rateDistribution
  };
}

function buildFinalDecision(sims, topN = 5) {
  return sims
    .filter(x => isQualified(x, x.scenario_raw))
    .sort((a, b) => {
      const scoreA =
        toNumber(a.satisfy?.m3_score, 0) * 1.0 +
        toNumber(a.profit?.fair_gap, 0) * 0.6 +
        toNumber(a.safety?.health_score, 0) * 0.03;

      const scoreB =
        toNumber(b.satisfy?.m3_score, 0) * 1.0 +
        toNumber(b.profit?.fair_gap, 0) * 0.6 +
        toNumber(b.safety?.health_score, 0) * 0.03;

      return scoreB - scoreA;
    })
    .slice(0, topN);
}

function buildM5Payload(selection, sims, dashboard, finalDecision, scenarioAnalytics) {
  return {
    generated_at: new Date().toISOString(),
    source: "M3 Engine",

    raw: {
      total: sims.length,
      rows: sims
    },

    simulated_universe: {
      clean_pool_symbols: (selection?.clean_pool || []).map(x => x.symbol),
      simulated_stock_count: dashboard?.simulation_meta?.simulated_stock_count || 0,
      simulated_scenario_count: dashboard?.simulation_meta?.scenario_count || 0,
      stock_stats: dashboard?.simulation_meta?.stock_stats || {},
      gap_stats: dashboard?.simulation_meta?.gap_stats || {},
      m3_stats: dashboard?.simulation_meta?.m3_stats || {},
      health_stats: dashboard?.simulation_meta?.health_stats || {}
    },

    qualified_universe: {
      qualified_count: dashboard?.qualified_meta?.qualified_count || 0,
      qualified_stock_count: dashboard?.qualified_meta?.qualified_stock_count || 0,
      qualified_scenario_count: dashboard?.qualified_meta?.qualified_scenario_count || 0,
      gap_stats: dashboard?.qualified_meta?.gap_stats || {},
      m3_stats: dashboard?.qualified_meta?.m3_stats || {},
      health_stats: dashboard?.qualified_meta?.health_stats || {},
      rate_stats: dashboard?.qualified_meta?.rate_stats || {}
    },

    compare_stats: dashboard?.compare_stats || {},
    qualified_symbol_stats: dashboard?.qualified_meta?.symbol_stats || [],
    qualified_scenario_stats: dashboard?.qualified_meta?.scenario_stats || [],
    top_qualified_examples: finalDecision || [],
    scenario_analytics: scenarioAnalytics || []
  };
}

// ------------------------------------------
// 主流程
// ------------------------------------------
export async function runM3Engine() {
  const [pool30, marketRuntime, config] = await Promise.all([
    loadJSON("./data/pool30.json"),
    loadJSON("./data/market_runtime.json"),
    loadJSON("./data/parameter_matrix.json")
  ]);

  const stockSelectionCfg = config["M3_股票篩選情境參數"] || {};

  const cleanMinPure = toNumber(stockSelectionCfg.clean_min_pure, 6);
  const cleanMinEvent = toNumber(stockSelectionCfg.clean_min_event, 6);
  const cleanMinDelta = toNumber(stockSelectionCfg.clean_min_delta, 0);
  const cleanUseDeltaGate = !!stockSelectionCfg.clean_use_delta_gate;

  const watchMinPure = toNumber(stockSelectionCfg.watch_min_pure, 5);
  const watchMinEvent = toNumber(stockSelectionCfg.watch_min_event, 5);
  const watchUseOrLogic = stockSelectionCfg.watch_use_or_logic !== false;

  const rejectIfAvoid = !!stockSelectionCfg.reject_if_suggestion_avoid;

  const stockResults = (pool30 || [])
    .map(stock => mergeStockData(stock, marketRuntime || {}))
    .map(stock => evaluateStock(stock, config))
    .map(stock => {
      const reviewed = reviewStockForM3(stock);

      const pure = toNumber(reviewed.pure_stock_score, 0);
      const eventStock = toNumber(reviewed.event_stock_score, 0);

      const passCleanBase =
        pure >= cleanMinPure &&
        eventStock >= cleanMinEvent;

      const passCleanDelta =
        !cleanUseDeltaGate || reviewed.delta_stock_score >= cleanMinDelta;

      const passWatch =
        watchUseOrLogic
          ? (pure >= watchMinPure || eventStock >= watchMinEvent)
          : (pure >= watchMinPure && eventStock >= watchMinEvent);

      if (rejectIfAvoid && reviewed.suggestion === "避免納入 FCN") {
        reviewed.bucket = "reject";
      } else if (passCleanBase && passCleanDelta) {
        reviewed.bucket = "clean";
      } else if (passWatch) {
        reviewed.bucket = "watch";
      } else {
        reviewed.bucket = "reject";
      }

      return reviewed;
    })
    .sort((a, b) => toNumber(b.event_stock_score, 0) - toNumber(a.event_stock_score, 0));

  const selection = splitByBucket(stockResults);
  const simulationResults = await runSimulation(selection.clean_pool, config);

  const summary = buildSummary(selection, simulationResults);
  const scenarioSummary = buildScenarioSummary(simulationResults);
  const rateDistribution = buildRateDistribution(simulationResults);
  const dashboard = buildDashboard(
    summary,
    scenarioSummary,
    rateDistribution,
    simulationResults,
    selection
  );

  const scenarioAnalytics = buildScenarioAnalytics(simulationResults);

  const simCfg = config["M3_模擬控制參數"] || {};
  const topNOutput = toNumber(simCfg.top_n_output, 5);
  const finalDecision = buildFinalDecision(simulationResults, Math.min(topNOutput, 5));
  const m5_payload = buildM5Payload(
    selection,
    simulationResults,
    dashboard,
    finalDecision,
    scenarioAnalytics
  );

  return {
    generated_at: new Date().toISOString(),
    config,
    stockResults,
    selection,
    simulationResults,
    summary,
    scenarioSummary,
    rateDistribution,
    dashboard,
    finalDecision,
    scenarioAnalytics,
    m5_payload
  };
}

// ------------------------------------------
// 給外部 UI 用的輕量文字摘要
// ------------------------------------------
export function buildDashboardConclusion(cache) {
  const dashboard = cache.dashboard || {};
  const qualified = toNumber(dashboard.total_qualified, 0);
  const total = toNumber(dashboard.total_simulations, 0);

  if (!total) {
    return "尚未產生模擬結果。";
  }

  if (!qualified) {
    return "本次無達標組。可能原因：Profit 未達標、Satisfy 不足，或 Safety 不足。";
  }

  const bestScenario = dashboard.best_scenario?.scenario_name || "未知";
  const stockCaptureRate = toNumber(dashboard.compare_stats?.stock_capture_rate, 0);
  const scenarioCaptureRate = toNumber(dashboard.compare_stats?.scenario_capture_rate, 0);

  return `本次模擬共 ${total} 組，達標 ${qualified} 組，最有效策略為「${bestScenario}」。達標標的涵蓋率 ${stockCaptureRate}%；達標情境涵蓋率 ${scenarioCaptureRate}%。`;
}

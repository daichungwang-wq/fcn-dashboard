// ============================================================================
// M8 Calibration Engine v1
// Path: js/mm/modules/m8_calibration_engine_v1.js
// Purpose: FCN Pool + Old Pool -> M8 decomposition -> calibration dataset
// Sandbox only. Does NOT modify M8 formula or production data.
// ============================================================================

import { runM8Case } from "../../core/m8_batch_engine.js";

export const M8_CALIBRATION_VERSION = "m8_calibration_engine_v1_20260508";

function toNum(v, d = 0) { const n = Number(v); return Number.isFinite(n) ? n : d; }
function round2(v) { const n = Number(v); return Number.isFinite(n) ? Math.round(n * 100) / 100 : null; }
function safeUpper(v) { return String(v || "").trim().toUpperCase(); }
function arr(v) { return Array.isArray(v) ? v : []; }
function avg(xs = []) { const c = xs.map(Number).filter(Number.isFinite); return c.length ? c.reduce((a,b)=>a+b,0)/c.length : null; }
function std(xs = []) { const c = xs.map(Number).filter(Number.isFinite); if(c.length<=1) return 0; const m=avg(c); return Math.sqrt(c.reduce((s,x)=>s+Math.pow(x-m,2),0)/c.length); }
function uniqSymbols(symbols = []) { return [...new Set(arr(symbols).map(safeUpper).filter(Boolean))]; }

async function tryLoadJson(path) {
  try { const res = await fetch(path + "?v=" + Date.now()); if (!res.ok) return null; return await res.json(); }
  catch (err) { return null; }
}

function normalizePoolRows(json, sourceName) {
  const rows = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : Array.isArray(json?.records) ? json.records : [];
  return rows.map((row, idx) => normalizeFcnRecord(row, sourceName, idx)).filter(Boolean);
}

function normalizeFcnRecord(row, sourceName, idx) {
  const symbols = uniqSymbols(row?.basket || row?.symbols || row?.underlyings);
  const id = row?.fcn_id || row?.id || `${sourceName}_${idx + 1}`;
  if (symbols.length < 2 || symbols.length > 5) return {_invalid:true, source_name:sourceName, source_index:idx, fcn_id:id, reason:"basket must contain 2~5 symbols", raw:row};
  const strike = toNum(row?.strike ?? row?.Strike ?? row?.strike_pct, null);
  const ki = toNum(row?.ki ?? row?.KI ?? row?.ki_pct, null);
  const tenor = toNum(row?.tenor ?? row?.T ?? row?.tenor_month, null);
  const marketRate = toNum(row?.rate ?? row?.coupon_pct ?? row?.market_rate, null);
  if (![strike, ki, tenor, marketRate].every(Number.isFinite)) return {_invalid:true, source_name:sourceName, source_index:idx, fcn_id:id, reason:"missing strike / ki / tenor / rate", raw:row};
  return {
    source_name:sourceName, source_index:idx, fcn_id:id,
    date:row?.date || row?.created_time || "", created_time:row?.created_time || "", entry_time:row?.entry_time || "", exit_time:row?.exit_time || "", maturity_time:row?.maturity_time || "",
    status:row?.status || "", bank:row?.bank || "", tw_bank:row?.tw_bank || "",
    symbols, tenor, market_rate:marketRate, autocall:toNum(row?.autocall, null), strike, ki,
    eki:!!row?.eki, type:row?.type || (row?.eki ? "EKI" : "AKI"), amount:toNum(row?.amt, null), currency:row?.currency || "USD",
    has_ki_breach:!!row?.has_ki_breach, early_exit_count:countEarlyExitHits(row?.early_exit_record), early_exit_total:Object.keys(row?.early_exit_record || {}).length,
    decision_flag:row?.decision_flag || "", note:row?.note || "", entry_prices:row?.entry_prices || {}
  };
}

function countEarlyExitHits(record = {}) { return Object.values(record || {}).filter(x => !!x?.hit).length; }
function classifyRateBand(rate) { const r=toNum(rate); if(r<10) return "below_conservative"; if(r<15) return "conservative"; if(r<19) return "rational"; return "aggressive"; }
function classifyBrakeLevel(brake) { const b=toNum(brake); if(b<=0.5) return "none"; if(b<=3) return "light"; if(b<=7) return "medium"; if(b<=11) return "heavy"; return "extreme"; }
function classifyPricingGap(gap) { const g=toNum(gap); if(g>=4) return "market_much_higher"; if(g>=1.5) return "market_higher"; if(g>-1.5) return "near_fair"; if(g>-4) return "market_lower"; return "market_much_lower"; }

function extractM8Features(m8 = {}) {
  const weaknesses = arr(m8.weaknesses).map(Number).filter(Number.isFinite);
  const scores = arr(m8.scores).map(Number).filter(Number.isFinite);
  return {
    base:round2(m8.base), basket_premium:round2(m8.basket_premium), tail_adj:round2(m8.tail_adj),
    ki_adj:round2(m8.ki_adj), tenor_adj:round2(m8.tenor_adj), strike_adj:round2(m8.strike_adj), type_adj:round2(m8.type_adj), structure_total:round2(m8.structure_total),
    basket_vol:round2(m8.basket_vol), vol_adj:round2(m8.vol_adj), rate_pressure_adj:round2(m8.rate_pressure_adj), rate_pressure_score_basket:round2(m8.rate_pressure_score_basket),
    rate_pressure_worst:round2(m8.rate_pressure_worst), rate_pressure_second:round2(m8.rate_pressure_second), rate_pressure_avg:round2(m8.rate_pressure_avg),
    BW:round2(m8.BW), weakness_worst:round2(Math.max(...weaknesses, 0)), weakness_avg:round2(avg(weaknesses)), score_avg:round2(avg(scores)),
    pre_rate:round2(m8.pre_rate), high_rate_brake:round2(m8.high_rate_brake), fair_yield:round2(m8.fair_yield)
  };
}

function countBy(rows, fn) { const out={}; rows.forEach(r=>{ const k=fn(r)||"unknown"; out[k]=(out[k]||0)+1; }); return out; }
function calcSummary(rows = [], invalidRows = []) {
  const valid = rows.filter(r => r.status === "ok");
  const gaps = valid.map(r => r.pricing_gap).filter(Number.isFinite);
  const brakes = valid.map(r => r.m8_features.high_rate_brake).filter(Number.isFinite);
  const preRates = valid.map(r => r.m8_features.pre_rate).filter(Number.isFinite);
  const fairRates = valid.map(r => r.m8_features.fair_yield).filter(Number.isFinite);
  const marketRates = valid.map(r => r.market_rate).filter(Number.isFinite);
  return {
    version:M8_CALIBRATION_VERSION, generated_at:new Date().toISOString(), total_rows:rows.length+invalidRows.length, valid_rows:valid.length,
    error_rows:rows.filter(r=>r.status==="error").length, invalid_rows:invalidRows.length,
    market_rate_mean:round2(avg(marketRates)), fair_yield_mean:round2(avg(fairRates)), pre_rate_mean:round2(avg(preRates)), brake_mean:round2(avg(brakes)), pricing_gap_mean:round2(avg(gaps)), pricing_gap_std:round2(std(gaps)),
    brake_distribution:countBy(valid, r=>r.brake_level), gap_distribution:countBy(valid, r=>r.pricing_gap_label), rate_band_distribution:countBy(valid, r=>r.market_rate_band), source_distribution:countBy(valid, r=>r.source_name)
  };
}

export async function loadFcnCalibrationSources(options = {}) {
  const currentPath = options.current_path || "./data/fcn_pool.json";
  const oldPath = options.old_path || "./data/fcn_pool_old.json";
  const [currentJson, oldJson] = await Promise.all([tryLoadJson(currentPath), tryLoadJson(oldPath)]);
  const all = [...normalizePoolRows(currentJson || [], "fcn_pool"), ...normalizePoolRows(oldJson || [], "fcn_pool_old")];
  return { current_path:currentPath, old_path:oldPath, rows:all.filter(r=>!r._invalid), invalid_rows:all.filter(r=>r._invalid) };
}

export async function buildM8CalibrationDataset(options = {}) {
  const source = await loadFcnCalibrationSources(options);
  const maxRows = Number.isFinite(Number(options.max_rows)) ? Number(options.max_rows) : Infinity;
  const results = [];
  for (const record of source.rows.slice(0, maxRows)) {
    const caseName = `CAL_${record.source_name}_${record.fcn_id}`.replace(/\s+/g, "_");
    try {
      const m8 = await runM8Case({ caseName, symbols:record.symbols, KI:record.ki, Strike:record.strike, T:record.tenor, type:record.type, marketYield:record.market_rate });
      const features = extractM8Features(m8);
      const pricingGap = round2(record.market_rate - features.fair_yield);
      const preGap = round2(record.market_rate - features.pre_rate);
      const impliedMarketBrake = round2(features.pre_rate - record.market_rate);
      const brakeGap = round2(features.high_rate_brake - impliedMarketBrake);
      results.push({
        status:"ok", calibration_version:M8_CALIBRATION_VERSION,
        source_name:record.source_name, source_index:record.source_index, fcn_id:record.fcn_id, date:record.date, created_time:record.created_time, entry_time:record.entry_time, exit_time:record.exit_time, maturity_time:record.maturity_time,
        fcn_status:record.status, bank:record.bank, tw_bank:record.tw_bank, symbols:record.symbols, tenor:record.tenor, market_rate:round2(record.market_rate), market_rate_band:classifyRateBand(record.market_rate), autocall:record.autocall,
        strike:round2(record.strike), ki:round2(record.ki), type:record.type, eki:record.eki, amount:record.amount, currency:record.currency, has_ki_breach:record.has_ki_breach, early_exit_count:record.early_exit_count, early_exit_total:record.early_exit_total,
        m8_features:features, pricing_gap:pricingGap, pricing_gap_label:classifyPricingGap(pricingGap), pre_rate_gap:preGap, implied_market_brake:impliedMarketBrake, brake_gap:brakeGap, brake_level:classifyBrakeLevel(features.high_rate_brake),
        stock_sources:m8.stock_sources || [], note:record.note
      });
    } catch (err) {
      results.push({ status:"error", calibration_version:M8_CALIBRATION_VERSION, source_name:record.source_name, source_index:record.source_index, fcn_id:record.fcn_id, date:record.date, symbols:record.symbols, tenor:record.tenor, market_rate:round2(record.market_rate), strike:round2(record.strike), ki:round2(record.ki), type:record.type, error_message:err?.message || String(err) });
    }
  }
  return { meta:calcSummary(results, source.invalid_rows), rows:results, invalid_rows:source.invalid_rows };
}

export function buildCalibrationRegressionRows(dataset = {}) {
  return arr(dataset.rows).filter(r=>r.status==="ok").map(r=>{
    const f = r.m8_features || {};
    return {
      fcn_id:r.fcn_id, source_name:r.source_name, date:r.date,
      market_rate:r.market_rate, fair_yield:f.fair_yield, pre_rate:f.pre_rate,
      pricing_gap:r.pricing_gap, implied_market_brake:r.implied_market_brake, brake_gap:r.brake_gap,
      base:f.base, basket_premium:f.basket_premium, tail_adj:f.tail_adj, ki_adj:f.ki_adj, tenor_adj:f.tenor_adj, strike_adj:f.strike_adj, type_adj:f.type_adj, structure_total:f.structure_total,
      basket_vol:f.basket_vol, vol_adj:f.vol_adj, rate_pressure_adj:f.rate_pressure_adj, rate_pressure_score_basket:f.rate_pressure_score_basket, BW:f.BW, weakness_worst:f.weakness_worst, weakness_avg:f.weakness_avg, score_avg:f.score_avg, high_rate_brake:f.high_rate_brake,
      tenor:r.tenor, strike:r.strike, ki:r.ki, type:r.type, symbol_count:arr(r.symbols).length, has_ki_breach:r.has_ki_breach ? 1 : 0, early_exit_count:r.early_exit_count
    };
  });
}

export function downloadCalibrationJson(dataset, filename = "m8_calibration_dataset.json") {
  const blob = new Blob([JSON.stringify(dataset, null, 2)], { type:"application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}

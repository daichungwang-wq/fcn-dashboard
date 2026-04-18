// ==========================================
// build_m1_pool_output.js
// 讀取 M1 candidate / runtime / fundamental
// 跑 m1_stock_engine.js
// 輸出 data/m1/pool_stock_evaluated_v1.json
// ==========================================

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { evaluateStock } from "../js/modules/m1_stock_engine.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

// ---------- 檔案位置 ----------
const CANDIDATE_FILE = path.resolve(ROOT, "data/m1/pool_stock_candidate_v1.json");
const RUNTIME_FILE = path.resolve(ROOT, "data/market_runtime.json");
const FUNDAMENTAL_FILE = path.resolve(ROOT, "data/m1/m1_fundamental_map.json");
const OUTPUT_FILE = path.resolve(ROOT, "data/m1/pool_stock_evaluated_v1.json");

// ---------- 工具 ----------
function readJsonSafe(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠ 找不到檔案：${filePath}，改用 fallback`);
      return fallback;
    }

    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`⚠ 讀取失敗：${filePath}`, err.message);
    return fallback;
  }
}

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function arr(v) {
  return Array.isArray(v) ? v : [];
}

function obj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function num(v, d = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}

function round(v, digits = 2) {
  const x = Number(v);
  return Number.isFinite(x) ? Number(x.toFixed(digits)) : null;
}

function upper(s) {
  return String(s || "").trim().toUpperCase();
}

function buildIndexMapBySymbol(raw) {
  const out = {};
  const source = Array.isArray(raw) ? raw : Object.values(obj(raw));

  source.forEach((item) => {
    const symbol = upper(item?.symbol || item?.ticker);
    if (!symbol) return;
    out[symbol] = item;
  });

  return out;
}

function buildRuntimeMap(raw) {
  // 支援：
  // 1. { "NVDA": {...}, "TSM": {...} }
  // 2. [ {symbol:"NVDA", ...}, ... ]
  if (Array.isArray(raw)) return buildIndexMapBySymbol(raw);

  const o = obj(raw);
  const keys = Object.keys(o);

  // 若已經是 symbol -> payload
  const looksLikeRuntimeMap = keys.every((k) => typeof o[k] === "object");
  if (looksLikeRuntimeMap) {
    const out = {};
    for (const [k, v] of Object.entries(o)) {
      out[upper(k)] = v;
    }
    return out;
  }

  return {};
}

function buildFundamentalMap(raw) {
  // 支援：
  // 1. { "NVDA": {...}, "TSM": {...} }
  // 2. [ {symbol:"NVDA", ...}, ... ]
  if (Array.isArray(raw)) return buildIndexMapBySymbol(raw);

  const o = obj(raw);
  const out = {};
  for (const [k, v] of Object.entries(o)) {
    out[upper(k)] = v;
  }
  return out;
}

function mergeEvaluatedRow(candidate, evaluated) {
  const system = obj(candidate.system_recommendation);
  const human = obj(candidate.human_override);
  const reason = obj(candidate.system_reason);
  const aiShort = arr(candidate.ai_reason_short);
  const aiDetail = obj(candidate.ai_reason_detail);
  const research = obj(candidate.research);
  const identity = obj(candidate.identity);

  return {
    symbol: candidate.symbol || "",
    name: candidate.name || "",
    sector: candidate.sector || "",
    subsector: candidate.subsector || "",

    identity: {
      is_new_stock: Boolean(identity.is_new_stock),
      already_in_pool30: Boolean(identity.already_in_pool30),
      source: identity.source || "unknown",
      priority: identity.priority || "normal"
    },

    // 保留原始 AI/人工資料
    human_override: {
      into_stock_pool:
        typeof human.into_stock_pool === "boolean"
          ? human.into_stock_pool
          : evaluated.system_recommendation.into_stock_pool,

      into_pool30:
        typeof human.into_pool30 === "boolean"
          ? human.into_pool30
          : evaluated.system_recommendation.into_pool30,

      final_category:
        human.final_category || evaluated.system_recommendation.suggested_category,

      note: human.note || ""
    },

    // engine 覆蓋系統建議
    system_recommendation: {
      bucket: evaluated.system_recommendation.bucket,
      into_stock_pool: evaluated.system_recommendation.into_stock_pool,
      into_pool30: evaluated.system_recommendation.into_pool30,
      suggested_category: evaluated.system_recommendation.suggested_category,

      // 補原來 candidate 的 system 建議作為參考
      seed_bucket: system.bucket || null,
      seed_into_stock_pool:
        typeof system.into_stock_pool === "boolean" ? system.into_stock_pool : null,
      seed_into_pool30:
        typeof system.into_pool30 === "boolean" ? system.into_pool30 : null,
      seed_category: system.suggested_category || null
    },

    engine_score: {
      baseline: round(evaluated.engine_score.baseline),
      vol_score: round(evaluated.engine_score.vol_score),
      pure: round(evaluated.engine_score.pure),
      valuation: round(evaluated.engine_score.valuation),
      trend: round(evaluated.engine_score.trend),
      raw: round(evaluated.engine_score.raw),
      std: round(evaluated.engine_score.std)
    },

    system_reason: {
      why_yes: arr(evaluated.system_reason.why_yes),
      why_no: arr(evaluated.system_reason.why_no),
      seed_why_yes: arr(reason.why_yes),
      seed_why_no: arr(reason.why_no)
    },

    ai_reason_short: aiShort,
    ai_reason_detail: {
      growth: aiDetail.growth || "",
      industry: aiDetail.industry || "",
      competition: aiDetail.competition || "",
      valuation: aiDetail.valuation || "",
      risk: aiDetail.risk || ""
    },

    research: {
      status: research.status || "not_started",
      fundamental: research.fundamental || "",
      industry: research.industry || "",
      valuation_analysis: research.valuation_analysis || "",
      trading_plan: research.trading_plan || "",
      technical_analysis: research.technical_analysis || "",
      pool30_fit: research.pool30_fit || "",
      risk: research.risk || "",
      final_conclusion: research.final_conclusion || "",
      attachments: arr(research.attachments)
    }
  };
}

function calcSummary(allRows) {
  const summary = {
    total_count: allRows.length,
    pool30_candidate_count: 0,
    stock_pool_candidate_count: 0,
    watch_candidate_count: 0,
    reject_candidate_count: 0,
    new_stock_count: 0,
    existing_stock_count: 0,
    engine_into_stock_pool_count: 0,
    engine_into_pool30_count: 0
  };

  allRows.forEach((row) => {
    const bucket = row?.system_recommendation?.bucket || "";
    if (bucket === "pool30_candidate") summary.pool30_candidate_count += 1;
    else if (bucket === "stock_pool_candidate") summary.stock_pool_candidate_count += 1;
    else if (bucket === "watch_candidate") summary.watch_candidate_count += 1;
    else if (bucket === "reject_candidate") summary.reject_candidate_count += 1;

    if (row?.identity?.is_new_stock) summary.new_stock_count += 1;
    else summary.existing_stock_count += 1;

    if (row?.system_recommendation?.into_stock_pool) summary.engine_into_stock_pool_count += 1;
    if (row?.system_recommendation?.into_pool30) summary.engine_into_pool30_count += 1;
  });

  return summary;
}

function groupBuckets(allRows) {
  return {
    pool30_candidate: allRows.filter((x) => x.system_recommendation.bucket === "pool30_candidate"),
    stock_pool_candidate: allRows.filter((x) => x.system_recommendation.bucket === "stock_pool_candidate"),
    watch_candidate: allRows.filter((x) => x.system_recommendation.bucket === "watch_candidate"),
    reject_candidate: allRows.filter((x) => x.system_recommendation.bucket === "reject_candidate")
  };
}

function sortRows(rows) {
  return [...rows].sort((a, b) => {
    const b1 = num(b?.engine_score?.std, -999);
    const a1 = num(a?.engine_score?.std, -999);
    if (b1 !== a1) return b1 - a1;

    const b2 = num(b?.engine_score?.pure, -999);
    const a2 = num(a?.engine_score?.pure, -999);
    if (b2 !== a2) return b2 - a2;

    return upper(a.symbol).localeCompare(upper(b.symbol));
  });
}

// ---------- 主流程 ----------
function run() {
  const candidates = arr(readJsonSafe(CANDIDATE_FILE, []));
  const runtimeRaw = readJsonSafe(RUNTIME_FILE, {});
  const fundamentalRaw = readJsonSafe(FUNDAMENTAL_FILE, {});

  const runtimeMap = buildRuntimeMap(runtimeRaw);
  const fundamentalMap = buildFundamentalMap(fundamentalRaw);

  console.log(`📥 candidates: ${candidates.length}`);
  console.log(`📥 runtime symbols: ${Object.keys(runtimeMap).length}`);
  console.log(`📥 fundamental symbols: ${Object.keys(fundamentalMap).length}`);

  const evaluatedRows = candidates.map((candidate) => {
    const symbol = upper(candidate.symbol);
    const runtime = obj(runtimeMap[symbol]);
    const fundamental = obj(fundamentalMap[symbol]);

    const evaluated = evaluateStock(candidate, runtime, fundamental);
    return mergeEvaluatedRow(candidate, evaluated);
  });

  const sortedAll = sortRows(evaluatedRows);
  const grouped = groupBuckets(sortedAll);

  const output = {
    generated_at: new Date().toISOString(),
    source_files: {
      candidate: path.relative(ROOT, CANDIDATE_FILE),
      runtime: path.relative(ROOT, RUNTIME_FILE),
      fundamental: path.relative(ROOT, FUNDAMENTAL_FILE)
    },
    summary: calcSummary(sortedAll),

    pool30_candidate: sortRows(grouped.pool30_candidate),
    stock_pool_candidate: sortRows(grouped.stock_pool_candidate),
    watch_candidate: sortRows(grouped.watch_candidate),
    reject_candidate: sortRows(grouped.reject_candidate),

    all: sortedAll
  };

  ensureDir(OUTPUT_FILE);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), "utf-8");

  console.log(`✅ 已產出：${path.relative(ROOT, OUTPUT_FILE)}`);
  console.log(`📊 summary =`, output.summary);
}

run();

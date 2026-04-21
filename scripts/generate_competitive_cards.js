// ==========================================
// generate_competitive_cards.js
// 將 universe_150.json 批次轉成 competitive_cards.json
// ==========================================

const fs = require("fs");
const path = require("path");
const vm = require("vm");

// ---------- 路徑 ----------
const ROOT = path.resolve(__dirname, "..");
const INPUT_PATH = path.join(ROOT, "data", "m1", "universe_150.json");
const ENGINE_PATH = path.join(ROOT, "js", "m1", "m1_competition_engine.js");
const OUTPUT_PATH = path.join(ROOT, "data", "m1", "competitive_cards.json");

// ---------- 工具 ----------
function readJson(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`讀取 JSON 失敗: ${filePath}\n${err.message}`);
  }
}

function writeJson(filePath, data) {
  try {
    const json = JSON.stringify(data, null, 2);
    fs.writeFileSync(filePath, json, "utf8");
  } catch (err) {
    throw new Error(`寫入 JSON 失敗: ${filePath}\n${err.message}`);
  }
}

function asArray(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.stocks)) return data.stocks;
  if (Array.isArray(data?.items)) return data.items;
  if (data && typeof data === "object") return Object.values(data);
  return [];
}

function loadEngine(enginePath) {
  const code = fs.readFileSync(enginePath, "utf8");

  const sandbox = {
    window: {},
    console,
    Date
  };

  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: enginePath });

  const engine = sandbox.window?.M1CompetitionEngine;
  if (!engine || typeof engine.enrichPoolWithCompetition !== "function") {
    throw new Error("找不到 window.M1CompetitionEngine.enrichPoolWithCompetition");
  }

  return engine;
}

// ---------- 主流程 ----------
function main() {
  console.log("==========================================");
  console.log("Generate competitive_cards.json");
  console.log("==========================================");

  console.log(`讀取股票池: ${INPUT_PATH}`);
  const universeRaw = readJson(INPUT_PATH);
  const universe = asArray(universeRaw);

  if (!universe.length) {
    throw new Error("universe_150.json 沒有可用資料");
  }

  console.log(`載入 engine: ${ENGINE_PATH}`);
  const engine = loadEngine(ENGINE_PATH);

  console.log(`開始產生研究卡，共 ${universe.length} 檔...`);
  const rawCards = engine.enrichPoolWithCompetition(universe);

// 🔥 清洗 + 保證結構一致
const cards = rawCards.map(card => ({
  symbol: card.symbol,

  company_name: card.company_name || "",

  basic_info: {
    business_summary: card.basic_info?.business_summary || "",
    company_positioning: card.basic_info?.company_positioning || "",
    why_in_m1: card.basic_info?.why_in_m1 || "",
    initial_pool30_view: card.basic_info?.initial_pool30_view || ""
  },

  competition: {
    competitive_position: card.competition?.competitive_position || "",
    direct_competitors: card.competition?.direct_competitors || [],
    indirect_competitors: card.competition?.indirect_competitors || [],
    moat_summary: card.competition?.moat_summary || "",
    why_it_wins: card.competition?.why_it_wins || [],
    why_it_can_lose: card.competition?.why_it_can_lose || [],
    industry_structure: card.competition?.industry_structure || "",
    competition_trend_1y_3y: card.competition?.competition_trend_1y_3y || ""
  },

  m1_positioning: card.m1_positioning || {},

  m1_scores: {
    capex: card.m1_scores?.capex ?? null,
    trend: card.m1_scores?.trend ?? null,
    competition: card.m1_scores?.competition ?? null,
    valuation_detail: card.m1_scores?.valuation_detail || "",
    capex_comment: card.m1_scores?.capex_comment || "",
    trend_comment: card.m1_scores?.trend_comment || "",
    competition_comment: card.m1_scores?.competition_comment || "",
    valuation_comment: card.m1_scores?.valuation_comment || ""
  },

  investment_view: {
    human_summary: card.investment_view?.human_summary || "",
    action_hint: card.investment_view?.action_hint || "",
    fcn_view: card.investment_view?.fcn_view || "",
    final_verdict: card.investment_view?.final_verdict || ""
  },

  research_status: {
    basic_info_done: true,
    competition_done: true,
    technical_done: false,
    fcn_view_done: false,
    final_verdict_done: true
  },

  coverage_score: 60,

  updated_at: new Date().toISOString().slice(0, 10)
}));

  if (!Array.isArray(cards)) {
    throw new Error("engine 輸出不是陣列");
  }

  console.log(`寫入檔案: ${OUTPUT_PATH}`);
  writeJson(OUTPUT_PATH, cards);

  console.log("完成！");
  console.log(`共輸出 ${cards.length} 筆 research cards`);
}

// ---------- 執行 ----------
try {
  main();
} catch (err) {
  console.error("發生錯誤：");
  console.error(err.message);
  process.exit(1);
}

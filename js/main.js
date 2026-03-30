// ==========================================
// FCN SYSTEM V5 MAIN
// 振宇 FCN 系統｜Stock / FCN 分層版
// ==========================================

// M1
import { buildNewsInput } from "./news/build_news_input.js";
import { buildNewsRuntime } from "./modules/m1_event_engine.js";

// M3.1 Stock Engine
import { mergeStockData, evaluateStock } from "./core/stock_engine.js";

// M3.2 FCN Engine（先沿用現有 calcFCNPure）
import { calcFCNPure } from "./core/fcn_engine.js";

// ==========================================
// 工具
// ==========================================
function toNumber(val, fallback = 0) {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

async function loadJSON(path) {
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`${path} load fail: ${res.status}`);
    return await res.json();
  } catch (e) {
    console.error("❌ loadJSON:", path, e);
    return null;
  }
}

// ==========================================
// M1：News Pipeline
// ==========================================
async function runNewsPipeline(pool) {
  let rawNews = await loadJSON("./data/news.json");

  if (!Array.isArray(rawNews) || rawNews.length === 0) {
    console.warn("⚠️ 使用 fallback news");
    rawNews = [
      {
        id: "TEST_1",
        title: "Fed signals first rate cut could come sooner than expected",
        summary: "市場預期降息節奏可能提前。",
        source: "Fallback",
        url: "",
        published_at: new Date().toISOString()
      },
      {
        id: "TEST_2",
        title: "US CPI comes in below expectations, easing inflation concerns",
        summary: "CPI 低於預期，市場風險偏好改善。",
        source: "Fallback",
        url: "",
        published_at: new Date().toISOString()
      }
    ];
  }

  console.log("📰 rawNews:", rawNews);

  const newsInput = await buildNewsInput(rawNews);
  console.log("📊 news_input:", newsInput);

  const safeNewsInput = Array.isArray(newsInput) ? newsInput : [];

  const newsRuntime = buildNewsRuntime(
    new Date().toISOString().slice(0, 10),
    safeNewsInput,
    {},
    {},
    {},
    pool,
    {}
  );

  console.log("🔥 news_runtime:", newsRuntime);

  return newsRuntime;
}

// ==========================================
// M3.1：Stock Evaluation（只做個股）
// ==========================================
function runStockEvaluation(pool, newsRuntime, marketRuntime = {}) {
  const results = (pool || []).map(stock => {
    const merged = mergeStockData(stock, marketRuntime);
    console.log("🔗 merged:", merged.symbol, merged);

    const result = evaluateStock(merged, {
      eventImpactMap: newsRuntime?.stock_event_map || {}
    });

    console.log("🧪 evaluateStock:", merged.symbol, result);
    return result;
  });

  results.sort((a, b) => {
    const aTotal =
      toNumber(a?.pure_stock_score, 0) + toNumber(a?.event_stock_score, 0);
    const bTotal =
      toNumber(b?.pure_stock_score, 0) + toNumber(b?.event_stock_score, 0);

    return bTotal - aTotal;
  });

  return results;
}

// ==========================================
// M3.2：FCN Evaluation（暫用簡化版）
// 之後可換成你定義的 V6.5
// ==========================================
function runFCNEvaluation(stockResults = []) {
  const fcnTemplates = [
    {
      id: "FCN_001",
      basket: ["NVDA", "TSM", "AVGO"],
      ki: 60,
      strike: 65,
      yield_pa: 16,
      tenor_months: 6
    },
    {
      id: "FCN_002",
      basket: ["MSFT", "GOOGL", "AMZN"],
      ki: 65,
      strike: 70,
      yield_pa: 14,
      tenor_months: 6
    },
    {
      id: "FCN_003",
      basket: ["UNH", "COST", "PG"],
      ki: 60,
      strike: 65,
      yield_pa: 12,
      tenor_months: 6
    },
    {
      id: "FCN_004",
      basket: ["AAL", "CCL", "LVS"],
      ki: 55,
      strike: 65,
      yield_pa: 20,
      tenor_months: 9
    },
    {
      id: "FCN_005",
      basket: ["SMH", "QQQ", "LQD"],
      ki: 60,
      strike: 65,
      yield_pa: 11,
      tenor_months: 6
    }
  ];

  const fcnResults = fcnTemplates.map(fcn => {
    const stocks = fcn.basket
      .map(sym => stockResults.find(s => s.symbol === sym))
      .filter(Boolean);

    const avgPure =
      stocks.reduce((sum, s) => sum + toNumber(s.pure_stock_score, 0), 0) /
      (stocks.length || 1);

    const avgEvent =
      stocks.reduce((sum, s) => sum + toNumber(s.event_stock_score, 0), 0) /
      (stocks.length || 1);

    let pureFCN = 0;
    try {
      const pure = calcFCNPure(fcn);
      pureFCN = typeof pure === "number" ? pure : toNumber(pure?.score, 0);
    } catch (e) {
      console.warn(`⚠️ calcFCNPure fail: ${fcn.id}`, e);
    }

    const total = pureFCN + avgEvent;

    let suggestion = "觀察";
    if (total >= 20) suggestion = "可做";
    else if (total < 12) suggestion = "避免";

    return {
      basket_id: fcn.id,
      basket: fcn.basket,
      basket_count: fcn.basket.length,
      ki: fcn.ki,
      strike: fcn.strike,
      yield_pa: fcn.yield_pa,
      tenor_months: fcn.tenor_months,

      avg_pure_stock: avgPure,
      avg_event_stock: avgEvent,

      pure_fcn_score: pureFCN,
      total_fcn_score: total,
      suggestion
    };
  });

  fcnResults.sort(
    (a, b) => toNumber(b.total_fcn_score, 0) - toNumber(a.total_fcn_score, 0)
  );

  return fcnResults;
}

// ==========================================
// UI：Stock Ranking
// ==========================================
function renderStockRanking(stockResults = []) {
  const container = document.getElementById("stock-ranking");
  if (!container) return;

  const top10 = stockResults.slice(0, 10);

  container.innerHTML = `
    <div style="background:#fff;border:1px solid #ddd;border-radius:16px;padding:16px;margin-bottom:16px;">
      <h2 style="margin:0 0 12px 0;">🧠 Stock Ranking</h2>
      <div>總股票數：${stockResults.length}</div>
    </div>

    <div style="background:#fff;border:1px solid #ddd;border-radius:16px;padding:16px;margin-bottom:16px;">
      <h2 style="margin:0 0 12px 0;">🔥 Top 10 Stocks</h2>
      ${top10.map((item, idx) => {
        const pure = toNumber(item?.pure_stock_score, 0);
        const event = toNumber(item?.event_stock_score, 0);
        const total = pure + event;

        return `
          <div style="padding:10px 0;border-bottom:${idx === top10.length - 1 ? "none" : "1px solid #eee"};">
            <div style="font-weight:700;">#${idx + 1} ${item?.symbol || "-"}</div>
            <div>Trend: ${item?.trend_label || "-"}</div>
            <div>Pure Stock: ${pure.toFixed(2)}</div>
            <div>Event Stock: ${event.toFixed(2)}</div>
            <div>Total: ${total.toFixed(2)}</div>
            <div>Suggestion: ${item?.suggestion || "-"}</div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

// ==========================================
// UI：FCN Ranking
// ==========================================
function renderFCNRanking(fcnResults = []) {
  const container = document.getElementById("fcn-ranking");
  if (!container) return;

  container.innerHTML = `
    <div style="background:#fff;border:1px solid #ddd;border-radius:16px;padding:16px;margin-bottom:16px;">
      <h2 style="margin:0 0 12px 0;">💰 FCN Ranking</h2>
      ${fcnResults.map((item, idx) => {
        const pureFCN = toNumber(item?.pure_fcn_score, 0);
        const total = toNumber(item?.total_fcn_score, 0);
        const avgPure = toNumber(item?.avg_pure_stock, 0);
        const avgEvent = toNumber(item?.avg_event_stock, 0);

        return `
          <div style="padding:10px 0;border-bottom:${idx === fcnResults.length - 1 ? "none" : "1px solid #eee"};">
            <div style="font-weight:700;">#${idx + 1} ${item?.basket_id || "-"}</div>
            <div>Basket: ${(item?.basket || []).join(" / ")}</div>
            <div>條件：KI ${item?.ki ?? "-"} / Strike ${item?.strike ?? "-"} / Yield ${item?.yield_pa ?? "-"}% / ${item?.tenor_months ?? "-"}M</div>
            <div>Avg Pure Stock: ${avgPure.toFixed(2)}</div>
            <div>Avg Event Stock: ${avgEvent.toFixed(2)}</div>
            <div>Pure FCN: ${pureFCN.toFixed(2)}</div>
            <div>Total FCN: ${total.toFixed(2)}</div>
            <div>Suggestion: ${item?.suggestion || "-"}</div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

// ==========================================
// MAIN
// ==========================================
async function main() {
  console.log("🚀 FCN SYSTEM START");

  let pool = await loadJSON("./data/pool30.json");
  const marketRuntime = await loadJSON("./data/market_runtime.json");

  if (!Array.isArray(pool) || pool.length === 0) {
    console.warn("⚠️ 使用 fallback pool");
    pool = [
      { symbol: "NVDA", name: "NVIDIA", sector: "AI_SEMI", category: "growth" },
      { symbol: "TSM", name: "TSMC", sector: "AI_SEMI", category: "core" },
      { symbol: "AVGO", name: "Broadcom", sector: "AI_SEMI", category: "core" },
      { symbol: "MSFT", name: "Microsoft", sector: "PLATFORM", category: "core" },
      { symbol: "GOOGL", name: "Alphabet", sector: "PLATFORM", category: "core" },
      { symbol: "AMZN", name: "Amazon", sector: "PLATFORM", category: "core" },
      { symbol: "UNH", name: "UnitedHealth", sector: "HEALTHCARE", category: "defensive" },
      { symbol: "COST", name: "Costco", sector: "CONSUMER", category: "defensive" },
      { symbol: "PG", name: "P&G", sector: "CONSUMER", category: "defensive" },
      { symbol: "AAL", name: "American Airlines", sector: "TRAVEL", category: "speculative" },
      { symbol: "CCL", name: "Carnival", sector: "TRAVEL", category: "speculative" },
      { symbol: "LVS", name: "Las Vegas Sands", sector: "TRAVEL", category: "income" },
      { symbol: "SMH", name: "VanEck Semiconductor ETF", sector: "ETF", category: "core" },
      { symbol: "QQQ", name: "Invesco QQQ", sector: "ETF", category: "core" },
      { symbol: "LQD", name: "iShares iBoxx IG Corporate Bond ETF", sector: "ETF", category: "defensive" }
    ];
  }

  const newsRuntime = await runNewsPipeline(pool);

  const stockResults = runStockEvaluation(pool, newsRuntime, marketRuntime || {});
  console.log("🏆 stockResults:", stockResults);

  const fcnResults = runFCNEvaluation(stockResults);
  console.log("💰 fcnResults:", fcnResults);

  renderStockRanking(stockResults);
  renderFCNRanking(fcnResults);
}

// ==========================================
// 啟動
// ==========================================
main().catch(err => {
  console.error("❌ main fatal:", err);

  const stockContainer = document.getElementById("stock-ranking");
  const fcnContainer = document.getElementById("fcn-ranking");

  if (stockContainer) {
    stockContainer.innerHTML = `
      <div style="margin-top:20px;background:#fff;border:1px solid #f1b5b5;border-radius:16px;padding:16px;color:#b00020;">
        <h2 style="margin:0 0 8px 0;">系統發生錯誤</h2>
        <div>${err.message}</div>
      </div>
    `;
  }

  if (fcnContainer) {
    fcnContainer.innerHTML = `
      <div style="margin-top:20px;background:#fff;border:1px solid #f1b5b5;border-radius:16px;padding:16px;color:#b00020;">
        <div>Debug Error: ${err.message}</div>
      </div>
    `;
  }
});

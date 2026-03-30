// ==========================================
// 🚀 FCN SYSTEM V5 MAIN (STRUCTURE FIXED)
// 振宇專用：Stock / FCN 完全分離版
// ==========================================

// M1
import { buildNewsInput } from "./news/build_news_input.js";
import { buildNewsRuntime } from "./modules/m1_event_engine.js";

// M3.1（Stock Engine）
import { evaluateStock } from "./core/stock_engine.js";

// M3.2（FCN Engine）
import { calcFCNPure } from "./core/fcn_engine.js";

// ==========================================
// 🧩 工具：安全數字
// ==========================================
function toNumber(val, fallback = 0) {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

// ==========================================
// 🧩 合併 market runtime
// ==========================================
function mergeStockData(stock, marketRuntime = {}) {
  const runtime = marketRuntime[stock.symbol] || {};

  return {
    ...stock,
    ...runtime
  };
}

// ==========================================
// 🧠 M3.1：Stock Evaluation（只做個股）
// ==========================================
function runStockEvaluation(pool, newsRuntime, marketRuntime) {
  return pool.map(stock => {
    const merged = mergeStockData(stock, marketRuntime);

    const result = evaluateStock(merged, {
      eventImpactMap: newsRuntime?.stock_event_map || {}
    });

    return result;
  }).sort((a, b) =>
    toNumber(b.pure_stock_score + b.event_stock_score) -
    toNumber(a.pure_stock_score + a.event_stock_score)
  );
}

// ==========================================
// 🧠 M3.2：FCN Evaluation（組合）
// ==========================================
function runFCNEvaluation(stockResults) {

  const fcnTemplates = [
    {
      id: "FCN_001",
      basket: ["NVDA", "TSM", "AVGO"],
      ki: 60,
      strike: 65,
      yield_pa: 16,
      tenor: 6
    },
    {
      id: "FCN_002",
      basket: ["MSFT", "GOOGL", "AMZN"],
      ki: 65,
      strike: 70,
      yield_pa: 14,
      tenor: 6
    }
  ];

  return fcnTemplates.map(fcn => {

    const stocks = fcn.basket.map(sym =>
      stockResults.find(s => s.symbol === sym)
    ).filter(Boolean);

    const worst = stocks.reduce((a, b) =>
      (a.pure_stock_score + a.event_stock_score) <
      (b.pure_stock_score + b.event_stock_score) ? a : b
    );

    const pure = calcFCNPure(fcn);
    const event = stocks.reduce((sum, s) =>
      sum + toNumber(s.event_stock_score), 0
    ) / (stocks.length || 1);

    const total = pure + event;

    return {
      basket_id: fcn.id,

      basket: fcn.basket,
      basket_count: fcn.basket.length,
      worst_of: worst?.symbol,

      ki: fcn.ki,
      strike: fcn.strike,
      yield_pa: fcn.yield_pa,
      tenor: fcn.tenor,

      pure_fcn_score: pure,
      event_fcn_score: event,
      total_fcn_score: total,

      suggestion:
        total > 20 ? "可做" :
        total > 15 ? "觀察" :
        "避免"
    };

  }).sort((a, b) =>
    b.total_fcn_score - a.total_fcn_score
  );
}

// ==========================================
// 🎨 UI：Stock Ranking
// ==========================================
function renderStockRanking(stockResults) {

  const container = document.getElementById("stock-ranking");

  container.innerHTML = `
    <h2>🧠 Stock Ranking</h2>
    ${stockResults.slice(0, 10).map((s, i) => `
      <div class="card">
        <b>#${i + 1} ${s.symbol}</b><br>
        趨勢：${s.trend_label}<br>
        Pure Stock: ${s.pure_stock_score?.toFixed(2)}<br>
        Event Stock: ${s.event_stock_score?.toFixed(2)}<br>
        建議：${s.suggestion}
      </div>
    `).join("")}
  `;
}

// ==========================================
// 🎨 UI：FCN Ranking
// ==========================================
function renderFCNRanking(fcnResults) {

  const container = document.getElementById("fcn-ranking");

  container.innerHTML = `
    <h2>💰 FCN Ranking</h2>
    ${fcnResults.map((f, i) => `
      <div class="card">
        <b>#${i + 1} ${f.basket_id}</b><br>
        總分：${f.total_fcn_score.toFixed(2)}<br>
        股票：${f.basket.join(" / ")}<br>
        條件：KI ${f.ki} / Strike ${f.strike} / Yield ${f.yield_pa}% / ${f.tenor}M<br>
        Worst-of：${f.worst_of}<br>
        建議：${f.suggestion}
      </div>
    `).join("")}
  `;
}

// ==========================================
// 🚀 MAIN
// ==========================================
async function main() {

  console.log("🚀 FCN SYSTEM START V5");

  // Pool（你可以換 pool30.json）
  const pool = await fetch("./data/pool.json").then(r => r.json());

  // Market Runtime（Python產出）
  const marketRuntime = await fetch("./data/market_runtime.json")
    .then(r => r.json());

  // News Pipeline
  const newsInput = await buildNewsInput();
  const newsRuntime = await buildNewsRuntime(newsInput);

  // 🧠 Stock Layer
  const stockResults = runStockEvaluation(pool, newsRuntime, marketRuntime);
  console.log("🧠 stockResults:", stockResults);

  // 💰 FCN Layer
  const fcnResults = runFCNEvaluation(stockResults);
  console.log("💰 fcnResults:", fcnResults);

  // 🎨 Render
  renderStockRanking(stockResults);
  renderFCNRanking(fcnResults);
}

// ==========================================
main().catch(err => {
  console.error("❌ 系統錯誤:", err);
  document.body.innerHTML = `
    <h2 style="color:red;">系統錯誤</h2>
    <pre>${err}</pre>
  `;
});

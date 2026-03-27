import { buildNewsRuntime } from "./modules/m1_event_engine.js";

/* ==========================================
   振宇 FCN 系統｜主程式 main.js
   功能：
   1. 載入資料
   2. 執行 M1 Event Engine V4
   3. 顯示全部股票（Debug模式）
========================================== */

function round(value, digits = 4) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Number(n.toFixed(digits));
}

async function loadJson(path) {
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error(`載入失敗: ${path}`);
  }
  return await res.json();
}

function renderAllStocks(stockEventMap) {
  const root = document.getElementById("module3") || document.body;

  const rows = Object.entries(stockEventMap)
    .map(([symbol, data]) => ({
      symbol,
      ...data
    }))
    .sort((a, b) => b.event_score - a.event_score);

  const container = document.createElement("div");
  container.style.marginTop = "20px";
  container.style.padding = "16px";

  const title = document.createElement("h2");
  title.innerText = "📊 全部股票 Event Score（Debug 模式）";
  container.appendChild(title);

  rows.forEach((item, index) => {
    const div = document.createElement("div");

    div.style.marginBottom = "12px";
    div.style.padding = "12px";
    div.style.border = "1px solid #ddd";
    div.style.borderRadius = "10px";
    div.style.background = "#fff";

    div.innerHTML = `
      <div style="font-size:22px;font-weight:700;">#${index + 1} ${item.symbol}</div>
      <div>event_score: ${round(item.event_score)}</div>
      <div>macro_avg: ${round(item.macro_avg)}</div>
      <div>industry_avg: ${round(item.industry_avg)}</div>
      <div>market_avg: ${round(item.market_avg)}</div>
      <div>news_count: ${item.news_count}</div>

      <hr style="margin:10px 0;" />

      <div>macro_scores: ${JSON.stringify(item.macro_scores || [])}</div>
      <div>industry_scores: ${JSON.stringify(item.industry_scores || [])}</div>
      <div>market_scores: ${JSON.stringify(item.market_scores || [])}</div>
    `;

    container.appendChild(div);
  });

  root.appendChild(container);
}

async function main() {
  try {
    const [
      newsInput,
      stockPool,
      impactTable,
      sectorMap,
      marketRuleTable,
      stockSensitivityMap
    ] = await Promise.all([
      loadJson("./data/news_input.json"),
      loadJson("./data/pool30.json"),
      loadJson("./data/impact_table_v2.json"),
      loadJson("./data/sector_map_v1.json"),
      loadJson("./data/market_rule_table_v1.json"),
      loadJson("./data/stock_sensitivity_map_v1.json")
    ]);

    const newsRuntime = buildNewsRuntime(
      "2026-03-26",
      newsInput,
      impactTable,
      sectorMap,
      marketRuleTable,
      stockPool,
      stockSensitivityMap
    );

    console.log("🔥 newsRuntime =", newsRuntime);
    console.log("🔥 stock_event_map =", newsRuntime.stock_event_map);

    window.newsRuntime = newsRuntime;
    window.stockEventMap = newsRuntime.stock_event_map;

    renderAllStocks(newsRuntime.stock_event_map);
  } catch (error) {
    console.error("❌ 系統錯誤:", error);

    const errorBox = document.createElement("div");
    errorBox.style.margin = "20px";
    errorBox.style.padding = "16px";
    errorBox.style.border = "1px solid red";
    errorBox.style.borderRadius = "10px";
    errorBox.style.background = "#fff5f5";
    errorBox.style.color = "#b00020";
    errorBox.innerText = `系統錯誤：${error.message}`;

    document.body.appendChild(errorBox);
  }
}

main();

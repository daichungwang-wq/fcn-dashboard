/* ==========================================
   振宇 FCN 系統｜主程式 main.js
   功能：
   1. 載入資料
   2. 執行 M1 Event Engine
   3. 輸出 stock_event_map
========================================== */

import { buildNewsRuntime } from "./modules/m1_event_engine.js";

async function loadJson(path) {
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error(`載入失敗: ${path}`);
  }
  return await res.json();
}

async function main() {
  try {
    const [
      newsInput,
      stockPool,
      impactTable,
      sectorMap,
      marketRuleTable
    ] = await Promise.all([
      loadJson("./data/news_input.json"),
      loadJson("./data/pool30.json"),
      loadJson("./data/impact_table_v1.json"),
      loadJson("./data/sector_map_v1.json"),
      loadJson("./data/market_rule_table_v1.json")
    ]);

    const newsRuntime = buildNewsRuntime(
      "2026-03-26",
      newsInput,
      impactTable,
      sectorMap,
      marketRuleTable,
      stockPool
    );

    console.log("🔥 newsRuntime =", newsRuntime);
    console.log("🔥 stock_event_map =", newsRuntime.stock_event_map);

    window.newsRuntime = newsRuntime;
    window.stockEventMap = newsRuntime.stock_event_map;

    // ====== 測試顯示（先簡單印在畫面上） ======
    const container = document.createElement("div");
    container.style.marginTop = "20px";
    container.style.padding = "16px";

    const title = document.createElement("h3");
    title.innerText = "M1 Event Engine 結果（測試）";
    container.appendChild(title);

    const entries = Object.entries(newsRuntime.stock_event_map).slice(0, 5);

    entries.forEach(([symbol, data]) => {
      const div = document.createElement("div");
      div.style.marginBottom = "12px";
      div.style.padding = "10px";
      div.style.border = "1px solid #ddd";
      div.style.borderRadius = "8px";

      div.innerHTML = `
        <b>${symbol}</b><br/>
        event_score: ${data.event_score}<br/>
        macro_avg: ${data.macro_avg}<br/>
        industry_avg: ${data.industry_avg}<br/>
        market_avg: ${data.market_avg}<br/>
        news_count: ${data.news_count}
      `;

      container.appendChild(div);
    });

    document.body.appendChild(container);
  } catch (err) {
    console.error("❌ main.js 執行失敗:", err);
  }
}

main();

/* ==========================================
   振宇 FCN 系統｜主程式 main.js
   功能：
   1. 載入資料
   2. 執行 M1 Event Engine
   3. 輸出 stock_event_map
========================================== */

// ====== 載入資料 ======
import newsInput from "../data/news_input.json" assert { type: "json" };
import stockPool from "../data/pool30.json" assert { type: "json" };
import impactTable from "../data/impact_table_v1.json" assert { type: "json" };
import sectorMap from "../data/sector_map_v1.json" assert { type: "json" };
import marketRuleTable from "../data/market_rule_table_v1.json" assert { type: "json" };

// ====== 載入 M1 Engine ======
import { buildNewsRuntime } from "./modules/m1_event_engine.js";

// ====== 執行 M1 ======
const newsRuntime = buildNewsRuntime(
  "2026-03-26",
  newsInput,
  impactTable,
  sectorMap,
  marketRuleTable,
  stockPool
);

// ====== Debug輸出 ======
console.log("🔥 newsRuntime =", newsRuntime);
console.log("🔥 stock_event_map =", newsRuntime.stock_event_map);

// ====== 全域變數（之後 UI 會用） ======
window.newsRuntime = newsRuntime;
window.stockEventMap = newsRuntime.stock_event_map;

// ====== 測試顯示（先簡單印在畫面上） ======
const container = document.createElement("div");
container.style.marginTop = "20px";

const title = document.createElement("h3");
title.innerText = "M1 Event Engine 結果（測試）";
container.appendChild(title);

// 顯示前5檔
const entries = Object.entries(newsRuntime.stock_event_map).slice(0, 5);

entries.forEach(([symbol, data]) => {
  const div = document.createElement("div");
  div.style.marginBottom = "10px";

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

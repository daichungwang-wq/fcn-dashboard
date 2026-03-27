import { buildNewsRuntime } from "./js/core/scoring.js";
import { render } from "./js/main.js";
import { renderDebugDashboard } from "./js/modules/module_debug.js";

// ⭐ 共用讀檔
async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`載入失敗: ${path}`);
  return await res.json();
}

// ⭐ 主程式
async function main() {
  try {
    console.log("🚀 系統啟動");

    // ===== 1️⃣ 載入資料 =====
    const news = await loadJSON("./data/news_input.json");
    const pool = await loadJSON("./data/pool30.json");
    const sectorMap = await loadJSON("./data/sector_map_v1.json");
    const impactTable = await loadJSON("./data/impact_table_v2.json");
    const marketRule = await loadJSON("./data/market_rule_table_v1.json");

    console.log("📦 資料載入完成");

    // ===== 2️⃣ 計算引擎 =====
    const runtime = buildNewsRuntime(
      new Date().toISOString().slice(0, 10),
      news,
      impactTable,
      sectorMap,
      marketRule,
      pool,
      {} // sensitivityMap（先空）
    );

    console.log("🔥 newsRuntime =", runtime);
    console.log("🔥 stock_event_map =", runtime.stock_event_map);

    // ===== 3️⃣ 存全域（方便debug）=====
    window.newsRuntime = runtime;
    window.stockEventMap = runtime.stock_event_map;

    // ===== 4️⃣ 畫畫面 =====
    render(runtime.stock_event_map, pool);

    // ===== 5️⃣ Debug Dashboard =====
    renderDebugDashboard(runtime.stock_event_map, pool);

  } catch (err) {
    console.error("❌ 系統錯誤:", err);

    document.body.innerHTML = `
      <div style="margin:20px;padding:16px;border:2px solid red;border-radius:10px;">
        ❌ 系統錯誤：${err.message}
      </div>
    `;
  }
}

main();

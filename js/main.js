import { buildNewsRuntime } from "./modules/m1_event_engine.js";

/* ===== 工具 ===== */
function fmt(n, d = 4) {
  const v = Number(n);
  return Number.isFinite(v) ? v.toFixed(d) : "0.0000";
}

function avg(arr = []) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + Number(b || 0), 0) / arr.length;
}

async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`載入失敗: ${path}`);
  return await res.json();
}

/* ===== 主畫面 ===== */
function render(stockMap, stockPool) {
  const root = document.getElementById("module3");
  root.innerHTML = "";

  const list = stockPool
    .map(s => ({
      symbol: s.symbol,
      ...(stockMap[s.symbol] || {})
    }))
    .sort((a, b) => b.event_score - a.event_score);

  const summary = document.createElement("div");
  summary.className = "card";
  summary.innerHTML = `
    <div class="section-title">📌 測試摘要</div>
    <div>總股票數：${list.length}</div>
    <div>有被新聞打到：${list.filter(s=>s.news_count>0).length}</div>
    <div>完全沒被打到：${list.filter(s=>s.news_count===0).length}</div>
  `;
  root.appendChild(summary);

  const title = document.createElement("div");
  title.className = "section-title";
  title.innerText = "📊 Event Score";
  root.appendChild(title);

  list.forEach((s, i) => {
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      <b>#${i + 1} ${s.symbol}</b><br/>
      event_score: ${fmt(s.event_score)}<br/>
      macro: ${fmt(s.macro_avg)} |
      industry: ${fmt(s.industry_avg)} |
      market: ${fmt(s.market_avg)}<br/>
      news_count: ${s.news_count}
    `;
    root.appendChild(div);
  });
}

/* ===== 🔥 Debug Dashboard V2 ===== */
function renderDebugDashboard(stockMap, stockPool) {
  const root = document.getElementById("debug-dashboard");
  root.innerHTML = "";

  const stocks = stockPool.map(s => ({
    symbol: s.symbol,
    sector: s.sector,
    ...(stockMap[s.symbol] || {})
  }));

  const avgMacro = avg(stocks.map(s => s.macro_avg));
  const avgMarket = avg(stocks.map(s => s.market_avg));
  const avgIndustry = avg(stocks.map(s => s.industry_avg));

  /* ===== 市場判斷 ===== */
  let regime = "🟡 Neutral";
  if (avgMacro > 1 && avgMarket > 0) regime = "🟢 Risk On";
  if (avgMacro < 0 && avgMarket < 0) regime = "🔴 Risk Off";

  /* ===== Top / Bottom ===== */
  const sorted = [...stocks].sort((a,b)=>b.event_score-a.event_score);
  const top5 = sorted.slice(0,5);
  const bottom5 = sorted.slice(-5);

  /* ===== Coverage ===== */
  const macroHit = stocks.filter(s=>s.macro_scores?.length>0).length;
  const industryHit = stocks.filter(s=>s.industry_scores?.length>0).length;
  const marketHit = stocks.filter(s=>s.market_scores?.length>0).length;

  /* ===== Risk Radar ===== */
  const riskStocks = stocks.filter(s=>s.event_score < 0);
  const hotStocks = stocks.filter(s=>s.event_score > 1.5);

  /* ===== Sector Heat ===== */
  const sectorMap = {};
  stocks.forEach(s=>{
    if(!sectorMap[s.sector]) sectorMap[s.sector]=[];
    sectorMap[s.sector].push(s.event_score);
  });

  const sectorHeat = Object.entries(sectorMap)
    .map(([k,v])=>({sector:k,avg:avg(v)}))
    .sort((a,b)=>b.avg-a.avg);

  /* ===== 異常偵測 ===== */
  let warnings = [];

  if (macroHit === stocks.length)
    warnings.push("⚠️ Macro 過強（可能過度擴散）");

  if (industryHit < stocks.length * 0.3)
    warnings.push("⚠️ Industry 太弱（題材不足）");

  if (avgMarket > 1)
    warnings.push("⚠️ Market 過熱");

  const div = document.createElement("div");
  div.className = "card";

  div.innerHTML = `
    <div class="section-title">🧠 Debug Dashboard V2</div>

    <b>🌍 市場狀態：</b> ${regime}<br/>
    Macro: ${fmt(avgMacro)} /
    Industry: ${fmt(avgIndustry)} /
    Market: ${fmt(avgMarket)}<br/><br/>

    <b>🔥 Top 5</b><br/>
    ${top5.map(s=>`${s.symbol} (${fmt(s.event_score)})`).join("<br/>")}<br/><br/>

    <b>❄️ Bottom 5</b><br/>
    ${bottom5.map(s=>`${s.symbol} (${fmt(s.event_score)})`).join("<br/>")}<br/><br/>

    <b>📊 Coverage</b><br/>
    Macro: ${macroHit}/${stocks.length}<br/>
    Industry: ${industryHit}/${stocks.length}<br/>
    Market: ${marketHit}/${stocks.length}<br/><br/>

    <b>⚠️ Risk Radar</b><br/>
    負分股票：${riskStocks.map(s=>s.symbol).join(", ") || "無"}<br/>
    過熱股票：${hotStocks.map(s=>s.symbol).join(", ") || "無"}<br/><br/>

    <b>🏭 Sector Heat</b><br/>
    ${sectorHeat.map(s=>`${s.sector} (${fmt(s.avg)})`).join("<br/>")}<br/><br/>

    <b>🚨 系統警告</b><br/>
    ${warnings.length ? warnings.join("<br/>") : "✅ 正常"}
  `;

  root.appendChild(div);
}

/* ===== 主流程 ===== */
async function main() {
  try {
    const [news, pool, sectorMap, impact, marketRule] = await Promise.all([
      loadJSON("./data/news_input.json"),
      loadJSON("./data/pool30.json"),
      loadJSON("./data/sector_map_v1.json"),
      loadJSON("./data/impact_table_v2.json"),
      loadJSON("./data/market_rule_table_v1.json")
    ]);

    const runtime = buildNewsRuntime(
      new Date().toISOString().slice(0,10),
      news,
      impact,
      sectorMap,
      marketRule,
      pool,
      {}
    );

    console.log("🔥 runtime", runtime);

    render(runtime.stock_event_map, pool);
    renderDebugDashboard(runtime.stock_event_map, pool);

  } catch (err) {
    console.error(err);
    document.body.innerHTML = `<div style="color:red;">❌ ${err.message}</div>`;
  }
}

main();

import { runM1Engine } from "./m1_engine.js";

async function main() {
  try {
    // 讀 pool30（或你現在的 stock universe）
    const stocks = await fetch("data/pool30.json").then(r => r.json());

    const result = runM1Engine(stocks);

    console.log("M1 RESULT:", result);

    // 👉 debug 用：畫面顯示
    renderM1(result);

  } catch (err) {
    console.error("M1 error:", err);
  }
}

function renderM1(data) {
  const el = document.getElementById("m1_output");
  if (!el) return;

  el.innerHTML = `
    <h2>M1 Engine Output</h2>

    <h3>Category Stats</h3>
    <pre>${JSON.stringify(data.stats, null, 2)}</pre>

    <h3>Top Stocks</h3>
    <pre>${JSON.stringify(
      data.scores
        .sort((a,b)=>b.M1_score-a.M1_score)
        .slice(0,10),
      null,2
    )}</pre>
  `;
}

main();

// ==========================================
// M7 UI（今日選股顯示）
// ==========================================

async function loadM7Today() {
  const wrap = document.getElementById("m7-list");

  try {
    const res = await fetch("./data/m7/m7_new_stock_today.json?v=" + Date.now());
    const data = await res.json();

    document.getElementById("m7-time").innerText =
      "更新時間：" + (data.generated_at || "--");

    document.getElementById("m7-summary").innerText =
      `今日候選 ${data.today_pick_count} / ${data.total_count}`;

    wrap.innerHTML = data.today_picks.map(renderCard).join("");
  } catch (err) {
    wrap.innerHTML = `<div style="color:red">載入失敗</div>`;
  }
}

function renderCard(row) {
  return `
    <div class="card">
      <div class="top">
        <div>
          <div class="title">${row.排名}. ${row.股號} ${row.股名}</div>
          <div class="sub">${row.產業} ｜ 風險：${row.風險等級}</div>
        </div>
        <div class="right">
          <div class="score ${getScoreClass(row.today_score)}">${row.today_score}</div>
          <div class="action ${getActionClass(row.建議動作)}">${row.建議動作}</div>
        </div>
      </div>

      <div class="grid">
        <div>股價：${row.股價}</div>
        <div>PEG：${row.PEG}</div>
        <div>估值：${row.valuation_score}</div>
        <div>技術：${row.technical_score}</div>
        <div>資金：${row.money_score}</div>
        <div>Quality：${row.quality_score}</div>
        <div>1M：${row["1月漲跌幅"]}%</div>
        <div>3M：${row["3月漲跌幅"]}%</div>
      </div>
    </div>
  `;
}

function getScoreClass(score) {
  if (score >= 75) return "good";
  if (score >= 60) return "mid";
  return "bad";
}

function getActionClass(a) {
  if (a === "加入") return "add";
  if (a === "觀察") return "watch";
  return "remove";
}

document.addEventListener("DOMContentLoaded", loadM7Today);

export function renderModule3Decision(positions, pool, config) {
  if (!pool || pool.length === 0) {
    return `<p>目前無股票池資料</p>`;
  }

  // === 分群 ===
  const groups = {
    core: [],
    defensive: [],
    balanced: [],
    yield: [],
    avoid: []
  };

  pool.forEach(stock => {
    const tag = stock.decision_tag || "";

    if (tag.includes("核心")) groups.core.push(stock);
    else if (tag.includes("防守")) groups.defensive.push(stock);
    else if (tag.includes("平衡")) groups.balanced.push(stock);
    else if (tag.includes("收益") || tag.includes("高波動")) groups.yield.push(stock);
    else if (tag.includes("避免")) groups.avoid.push(stock);
    else groups.balanced.push(stock);
  });

  // === 卡片HTML ===
  function stockCard(s) {
    const id = `stock-${s.symbol}`;

    return `
      <div class="stock-card" onclick="toggleDetail('${id}')">
        <div class="stock-title">
          ${s.symbol}｜${s.sector || "-"}｜${s.decision_tag || "-"}
        </div>

        <div id="${id}" class="stock-detail hidden">
          <div class="line2">
            ${s.category || "-"} / ${s.risk_level || "-"} / ${s.fcn_preference || "-"}
            / risk ${s.risk_score ?? "-"} / pref ${s.preference_score ?? "-"}
          </div>

          <div class="line3">
            $${s.price ?? "-"} / ${formatPct(s.price_change_pct)}
            / PE25 ${s.pe_2025 ?? "-"} / PE26 ${s.pe_2026 ?? "-"}
            / EPS26 ${s.eps_2026 ?? "-"}
            / 1M ${formatPct(s.perf_1m_pct)}
            / 6M ${formatPct(s.perf_6m_pct)}
          </div>
        </div>
      </div>
    `;
  }

  // === 區塊 ===
  function section(title, list) {
    return `
      <div class="section">
        <h3>${title}（${list.length}）</h3>
        ${list.map(stockCard).join("")}
      </div>
    `;
  }

  // === 全部展開區 ===
  function allStocksSection() {
    const sorted = [...pool].sort((a, b) => (a.risk_score || 0) - (b.risk_score || 0));

    return `
      <div class="section">
        <h3 onclick="toggleAll()">📊 所有股票（點擊展開/收合）</h3>
        <div id="allStocks" class="hidden">
          ${sorted.map(stockCard).join("")}
        </div>
      </div>
    `;
  }

  // === 主畫面 ===
  return `
    <div class="module3">

      <div class="summary">
        Pool：${pool.length}｜
        核心：${groups.core.length}｜
        防守：${groups.defensive.length}｜
        平衡：${groups.balanced.length}｜
        收益：${groups.yield.length}｜
        避免：${groups.avoid.length}
      </div>

      ${section("今日核心可做", groups.core)}
      ${section("今日防守可做", groups.defensive)}
      ${section("今日平衡可做", groups.balanced)}
      ${section("今日高收益候選", groups.yield)}
      ${section("今日避免股票", groups.avoid)}

      ${allStocksSection()}

    </div>
  `;
}

// === 工具 ===
function formatPct(val) {
  if (val === undefined || val === null) return "-";
  return `${val > 0 ? "+" : ""}${val}%`;
}

// === 展開控制 ===
window.toggleDetail = function(id) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle("hidden");
};

window.toggleAll = function() {
  const el = document.getElementById("allStocks");
  if (el) el.classList.toggle("hidden");
};

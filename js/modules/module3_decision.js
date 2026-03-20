export function renderModule3(data) {
  const container = document.getElementById("module3-decision");
  if (!container) return;

  const pool = data.pool || [];

  // === 分類 ===
  const groups = {
    core: [],
    defensive: [],
    balanced: [],
    income: [],
    avoid: []
  };

  pool.forEach(s => {
    const cat = s.category || "balanced";
    if (groups[cat]) groups[cat].push(s);
  });

  // === 建議邏輯（先用 pref 當標準）===
  function getRecommend(list) {
    return list.filter(s => (s.pref || 0) >= 80);
  }

  // === 卡片 render ===
  function renderCard(title, key, list) {
    const recommend = getRecommend(list);
    const percent = list.length
      ? Math.round((recommend.length / list.length) * 100)
      : 0;

    return `
      <div class="m3-card">
        <div class="m3-header" onclick="toggleM3('${key}')">
          <div class="m3-title">${title}</div>
          <div class="m3-meta">
            <span>總數 ${list.length}</span>
            <span>建議 ${recommend.length}</span>
            <span>${percent}%</span>
          </div>
        </div>

        <div id="m3-${key}" class="m3-content">
          ${recommend.length === 0 ? "<p>無建議標的</p>" : recommend.map(renderStock).join("")}
        </div>
      </div>
    `;
  }

  // === 股票展開 ===
  function renderStock(s) {
    return `
      <div class="m3-stock">
        <div class="m3-stock-head" onclick="toggleStock('${s.symbol}')">
          ${s.symbol} ｜ pref ${s.pref} ｜ risk ${s.risk}
        </div>

        <div id="stock-${s.symbol}" class="m3-stock-body">
          <div>分類：${s.category}</div>
          <div>波動：${s.volatility}</div>
          <div>PE25：${s.pe25 || "-"}</div>
          <div>PE26：${s.pe26 || "-"}</div>
          <div>EPS26：${s.eps26 || "-"}</div>

          <div class="m3-news">
            ${renderNews(s.symbol)}
          </div>
        </div>
      </div>
    `;
  }

  // === 新聞 ===
  function renderNews(symbol) {
    const news = (data.newsData || []).filter(n =>
      (n.impact || []).includes(symbol)
    );

    if (!news.length) return "<div>無新聞</div>";

    return news.map(n => `
      <div class="m3-news-item">
        <div>${n.title}</div>
        <div>AI判定：${n.sentiment}</div>
      </div>
    `).join("");
  }

  // === HTML ===
  container.innerHTML = `
    <div class="m3-wrapper">

      <h3>Module3-A｜分類決策</h3>

      ${renderCard("核心", "core", groups.core)}
      ${renderCard("防守", "defensive", groups.defensive)}
      ${renderCard("平衡", "balanced", groups.balanced)}
      ${renderCard("收益", "income", groups.income)}
      ${renderCard("避免", "avoid", groups.avoid)}

      <h3 style="margin-top:30px;">Module3-B｜今日FCN推薦</h3>

      <div class="m3-recommend">
        ${Object.keys(groups).map(k => {
          const rec = getRecommend(groups[k]);
          if (!rec.length) return "";
          return `
            <div class="m3-re-block">
              <div class="m3-re-title">${k}</div>
              <div>${rec.slice(0,3).map(s => s.symbol).join(" / ")}</div>
            </div>
          `;
        }).join("")}
      </div>

      <h3 style="margin-top:30px;">Module3-C｜個股查詢</h3>

      <div class="m3-search">
        <input id="m3-input" placeholder="輸入股票，例如 NVDA"/>
        <button onclick="searchStock()">查詢</button>
      </div>

      <div id="m3-result"></div>

    </div>
  `;

  // === 全域 function ===
  window.toggleM3 = function (key) {
    const el = document.getElementById("m3-" + key);
    if (!el) return;
    el.style.display = el.style.display === "block" ? "none" : "block";
  };

  window.toggleStock = function (sym) {
    const el = document.getElementById("stock-" + sym);
    if (!el) return;
    el.style.display = el.style.display === "block" ? "none" : "block";
  };

  window.searchStock = function () {
    const val = document.getElementById("m3-input").value.toUpperCase();
    const stock = pool.find(s => s.symbol === val);

    const el = document.getElementById("m3-result");

    if (!stock) {
      el.innerHTML = "<p>找不到</p>";
      return;
    }

    el.innerHTML = `
      <div class="m3-stock">
        <div>${stock.symbol}</div>
        <div>分類：${stock.category}</div>
        <div>pref：${stock.pref}</div>
        <div>risk：${stock.risk}</div>
        <div>${renderNews(stock.symbol)}</div>
      </div>
    `;
  };
}

function calcDeltaPct(current, previous) {
  const c = Number(current);
  const p = Number(previous);
  if (!Number.isFinite(c) || !Number.isFinite(p) || p === 0) return null;
  return ((c - p) / p) * 100;
}

function formatDeltaPct(current, previous) {
  const delta = calcDeltaPct(current, previous);
  if (delta === null) return "-";
  return `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%`;
}

function formatValue(key, current) {
  if (current === null || current === undefined) return "-";

  if (key === "us10y" || key === "us20y") return `${current}%`;
  if (key === "oil" || key === "gold") return `${current}`;
  if (key === "cpi" || key === "ppi") return `${current}`;
  if (key === "nasdaq" || key === "sp500" || key === "dow" || key === "tw_index" || key === "vix") {
    return `${current}`;
  }

  return `${current}`;
}

function marketInterpretation(key, current, previous) {
  const delta = calcDeltaPct(current, previous);

  if (delta === null) return "→ 無法判讀";

  switch (key) {
    case "vix":
      return delta > 0
        ? "→ 恐慌上升（⚠️ 風險↑ / FCN利率↑）"
        : "→ 恐慌下降（市場情緒回穩）";

    case "nasdaq":
      return delta > 0
        ? "→ 科技股轉強"
        : "→ 科技股轉弱";

    case "sp500":
      return delta > 0
        ? "→ 大盤穩定偏多"
        : "→ 大盤壓力上升";

    case "dow":
      return delta > 0
        ? "→ 權值股偏穩"
        : "→ 權值股轉弱";

    case "us10y":
    case "us20y":
      return delta > 0
        ? "→ 利率上升（⚠️ 壓估值）"
        : "→ 利率下降（支撐股市）";

    case "oil":
      return delta > 0
        ? "→ 通膨壓力略升"
        : "→ 通膨壓力舒緩";

    case "gold":
      return delta > 0
        ? "→ 避險需求增加"
        : "→ 避險需求下降";

    case "cpi":
      return delta > 0
        ? "→ 通膨升溫（偏利空）"
        : "→ 通膨下降（偏利多）";

    case "ppi":
      return delta > 0
        ? "→ 生產端通膨升溫"
        : "→ 生產端通膨下降（偏利多）";

    case "tw_index":
      return delta > 0
        ? "→ 台股偏強"
        : "→ 台股偏弱";

    default:
      return "→ 中性";
  }
}

function marketCard(label, key, data) {
  if (!data) return "";

  const current = data.current;
  const previous = data.previous;
  const deltaText = formatDeltaPct(current, previous);

  return `
    <div class="news-card">
      <div class="news-title">${label}：${formatValue(key, current)}（${formatValue(key, previous)}，${deltaText}）</div>
      <div class="news-meta">${marketInterpretation(key, current, previous)}</div>
    </div>
  `;
}

function getEffectiveDirection(item) {
  return item.user_direction || item.ai_direction || "neutral";
}

function directionBadge(direction, strength) {
  const map = {
    positive: "🟢 正向",
    neutral: "⚪ 中性",
    negative: "🔴 負向"
  };
  return `${map[direction] || "⚪ 中性"}（${strength || "low"}）`;
}

function renderDirectionControls(item, idx, prefix) {
  const key = `${prefix}-${idx}`;
  const current = item.user_direction || "ai";

  return `
    <div class="news-controls" data-news-key="${key}">
      <div class="news-meta">AI判定：${directionBadge(item.ai_direction, item.ai_strength)}</div>
      <div class="news-meta">理由：${item.ai_reason || "未提供"}</div>
      <div class="news-meta" style="margin-top:6px;">你的選擇：</div>
      <div style="margin-top:6px;">
        <button class="news-btn ${current === "ai" ? "active" : ""}" onclick="setNewsDirection('${key}','ai')">採用AI</button>
        <button class="news-btn ${current === "positive" ? "active" : ""}" onclick="setNewsDirection('${key}','positive')">正向</button>
        <button class="news-btn ${current === "neutral" ? "active" : ""}" onclick="setNewsDirection('${key}','neutral')">中性</button>
        <button class="news-btn ${current === "negative" ? "active" : ""}" onclick="setNewsDirection('${key}','negative')">負向</button>
      </div>
    </div>
  `;
}

function renderNewsItem(item, idx, prefix) {
  const id = `${prefix}-${idx}`;
  const effectiveDirection = getEffectiveDirection(item);

  return `
    <div class="news-card">
      <div class="news-title">${item.title}</div>

      <div class="news-summary">
        ${item.summary}
      </div>

      <div class="news-meta">
        影響：${item.impact || "-"} ｜ 強度：${item.level || "-"} ｜ 最終方向：${directionBadge(effectiveDirection, item.ai_strength)}
      </div>

      ${renderDirectionControls(item, idx, prefix)}

      <div class="news-expand" onclick="toggleNews('${id}')">
        點擊展開 / 收合
      </div>

      <div id="${id}" class="hidden news-meta" style="margin-top:8px;">
        完整說明：${item.ai_reason || "目前無更多內容"}
      </div>
    </div>
  `;
}

function renderSection(title, list, key) {
  const items = (list || []).slice(0, 10);

  return `
    <div class="section">
      <h3>${title}（${items.length}）</h3>
      ${items.length > 0
        ? items.map((n, i) => renderNewsItem(n, i, key)).join("")
        : `<p>目前無資料</p>`}
    </div>
  `;
}

function getTopNews(data) {
  const all = [
    ...(data.global || []),
    ...(data.finance || []),
    ...(data.ai || []),
    ...(data.fcn || [])
  ];

  return all.filter(n => n.level === "high").slice(0, 3);
}

function marketSummary(market) {
  if (!market) return `<p>目前無市場指標資料</p>`;

  return `
    <div class="section">
      <h3>📊 市場指標</h3>
      ${marketCard("VIX", "vix", market.vix)}
      ${marketCard("Nasdaq", "nasdaq", market.nasdaq)}
      ${marketCard("S&P 500", "sp500", market.sp500)}
      ${marketCard("Dow", "dow", market.dow)}
      ${marketCard("10Y", "us10y", market.us10y)}
      ${marketCard("20Y", "us20y", market.us20y)}
      ${marketCard("Oil", "oil", market.oil)}
      ${marketCard("Gold", "gold", market.gold)}
      ${marketCard("CPI", "cpi", market.cpi)}
      ${marketCard("PPI", "ppi", market.ppi)}
      ${marketCard("台股", "tw_index", market.tw_index)}
    </div>
  `;
}

export function renderModule1News(newsData, marketData) {
  if (!newsData) return `<p>目前無新聞資料</p>`;

  const topNews = getTopNews(newsData);

  return `
    <div class="module1">

      <div class="summary">
        Module1 新聞雷達<br>
        國際：${newsData.global?.length || 0} ｜ 
        財經：${newsData.finance?.length || 0} ｜ 
        AI：${newsData.ai?.length || 0} ｜ 
        FCN：${newsData.fcn?.length || 0}
      </div>

      ${marketSummary(marketData)}

      ${
        topNews.length > 0
          ? `
        <div class="section">
          <h3>🔥 今日重點（${topNews.length}）</h3>
          ${topNews.map((n, i) => renderNewsItem(n, i, "top")).join("")}
        </div>
      `
          : ""
      }

      ${renderSection("🌍 國際新聞", newsData.global, "global")}
      ${renderSection("💰 財經新聞", newsData.finance, "finance")}
      ${renderSection("🤖 AI 趨勢", newsData.ai, "ai")}
      ${renderSection("📦 FCN 影響", newsData.fcn, "fcn")}

      <div class="section">
        <button class="news-btn active" onclick="rerunDecision()">🔄 套用判定並重新計算</button>
      </div>
    </div>
  `;
}

window.toggleNews = function(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle("hidden");
};

window.setNewsDirection = function(key, direction) {
  const controls = document.querySelector(`[data-news-key="${key}"]`);
  if (!controls) return;

  const buttons = controls.querySelectorAll(".news-btn");
  buttons.forEach(btn => btn.classList.remove("active"));

  let targetText = "採用AI";
  if (direction === "positive") targetText = "正向";
  if (direction === "neutral") targetText = "中性";
  if (direction === "negative") targetText = "負向";

  buttons.forEach(btn => {
    if (btn.textContent === targetText) {
      btn.classList.add("active");
    }
  });

  window.__module1Overrides = window.__module1Overrides || {};
  window.__module1Overrides[key] = direction;
};

window.rerunDecision = function() {
  alert("這一版先完成 UI 與覆核流程。下一步會把重新計算正式連到 Module3。");
};

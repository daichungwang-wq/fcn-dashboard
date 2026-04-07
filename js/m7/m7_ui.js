// ==========================================
// M7 UI FINAL（Dashboard + 開發版明細）
// ==========================================

async function loadM7Today() {
  const listWrap = document.getElementById("m7-list");

  try {
    const res = await fetch("./data/m7/m7_new_stock_today.json?v=" + Date.now());
    if (!res.ok) throw new Error("無法讀取 m7_new_stock_today.json");

    const data = await res.json();
    const rows = data.all || [];

    renderTopSummary(data, rows);
    renderDashboard(rows);

    if (!rows.length) {
      listWrap.innerHTML = `<div class="empty-box">目前沒有資料</div>`;
      return;
    }

    listWrap.innerHTML = rows.map(renderCard).join("");
    bindCardToggle();
  } catch (err) {
    listWrap.innerHTML = `<div class="error-box">載入失敗：${err.message}</div>`;
  }
}

// ------------------------------------------
// Top summary
// ------------------------------------------
function renderTopSummary(data, rows) {
  const timeEl = document.getElementById("m7-time");
  const summaryEl = document.getElementById("m7-summary");

  const total = rows.length;
  const addCount = rows.filter(x => x["建議動作"] === "加入").length;
  const watchCount = rows.filter(x => x["建議動作"] === "觀察").length;
  const removeCount = rows.filter(x => x["建議動作"] === "移除").length;

  timeEl.textContent = `更新時間：${data.generated_at || "--"}`;
  summaryEl.textContent = `全部 ${total} 檔 ｜ 加入 ${addCount} ｜ 觀察 ${watchCount} ｜ 移除 ${removeCount}`;
}

// ------------------------------------------
// Dashboard
// ------------------------------------------
function renderDashboard(rows) {
  const wrap = document.getElementById("m7-dashboard");
  if (!wrap) return;

  const total = rows.length || 1;

  const addCount = rows.filter(x => x["建議動作"] === "加入").length;
  const watchCount = rows.filter(x => x["建議動作"] === "觀察").length;
  const removeCount = rows.filter(x => x["建議動作"] === "移除").length;

  const trendUp = rows.filter(x => {
    const s = x["趨勢判讀"]?.["趨勢狀態"];
    return s === "up_strong" || s === "up_mild";
  }).length;

  const topStruct = rows.filter(x => x["趨勢判讀"]?.["結構狀態"] === "top").length;
  const pullbackStruct = rows.filter(x => x["趨勢判讀"]?.["結構狀態"] === "pullback").length;
  const hotStruct = rows.filter(x => x["趨勢判讀"]?.["結構狀態"] === "hot").length;

  const avgScore = avg(rows.map(x => num(x["today_score"])));
  const avgPeg = avg(rows.map(x => num(x["估值資料"]?.["PEG"])));
  const avgVolRatio = avg(rows.map(x => num(x["量比"])));

  const scoreBands = {
    high: rows.filter(x => num(x["today_score"]) >= 75).length,
    mid: rows.filter(x => num(x["today_score"]) >= 55 && num(x["today_score"]) < 75).length,
    low: rows.filter(x => num(x["today_score"]) < 55).length
  };

  wrap.innerHTML = `
    <div class="dashboard-grid">
      ${metricCard("總體平均分", formatNum(avgScore, 1), `高分 ${scoreBands.high} ｜ 中分 ${scoreBands.mid} ｜ 低分 ${scoreBands.low}`)}
      ${metricCard("長期趨勢向上", `${trendUp}/${total}`, `占比 ${pct(trendUp, total)}%`)}
      ${metricCard("回檔結構", `${pullbackStruct}`, "FCN 較理想結構")}
      ${metricCard("做頭結構", `${topStruct}`, "中期轉弱，應按兵不動")}
      ${metricCard("偏熱結構", `${hotStruct}`, "結構健康但不宜追高")}
      ${metricCard("平均量比", formatNum(avgVolRatio, 2), "觀察市場資金參與度")}
    </div>

    <div class="dashboard-notes">
      <div class="note-box">
        <div class="note-title">整體判讀</div>
        <div class="note-body">
          目前樣本中，長期趨勢向上的股票共 <strong>${trendUp}</strong> 檔；
          其中屬於 <strong>中期回檔</strong> 的有 <strong>${pullbackStruct}</strong> 檔，
          屬於 <strong>做頭結構</strong> 的有 <strong>${topStruct}</strong> 檔。
          平均 PEG 為 <strong>${formatNum(avgPeg, 2)}</strong>，
          平均量比為 <strong>${formatNum(avgVolRatio, 2)}</strong>。
        </div>
      </div>

      <div class="note-box">
        <div class="note-title">開發版說明</div>
        <div class="note-body">
          本頁目前保留所有股票，包括低分與移除名單，方便觀察不同結構、估值、資金與品質狀態，不做最終刪除。
        </div>
      </div>
    </div>
  `;
}

function metricCard(title, value, sub) {
  return `
    <div class="metric-card">
      <div class="metric-title">${title}</div>
      <div class="metric-value">${value}</div>
      <div class="metric-sub">${sub}</div>
    </div>
  `;
}

// ------------------------------------------
// Card
// ------------------------------------------
function renderCard(row) {
  const rankBadge = getRankBadge(row["排名"]);
  const scoreClass = getScoreClass(row["today_score"]);
  const actionClass = getActionClass(row["建議動作"]);

  const breakdown = row["分數拆解"] || {};
  const trend = row["趨勢判讀"] || {};
  const valData = row["估值資料"] || {};

  return `
    <div class="stock-card">
      <div class="card-head">
        <div class="card-left">
          <div class="rank-row">
            ${rankBadge ? `<span class="rank-badge">${rankBadge}</span>` : ""}
            <div class="card-title">${safe(row["排名"])}. ${safe(row["股號"])} ${safe(row["股名"])}</div>
          </div>
          <div class="card-sub">
            ${safe(row["產業"])} ｜ ${safe(row["子產業"])} ｜ 分類：${safe(row["分類"])} ｜ 風險：${safe(row["風險等級"])}
          </div>
        </div>

        <div class="card-right">
          <div class="score-number ${scoreClass}">${safe(row["today_score"])}</div>
          <div class="action-pill ${actionClass}">${safe(row["建議動作"])}</div>
        </div>
      </div>

      <div class="scorebar-wrap">
        <div class="scorebar-label">Today Score</div>
        <div class="scorebar">
          <div class="scorebar-fill ${getBarClass(row["today_score"])}" style="width:${clamp(num(row["today_score"]), 0, 100)}%"></div>
        </div>
      </div>

      <div class="quick-summary">
        <strong>總結：</strong>${safe(row["最終說明"] || "--")}
      </div>

      <div class="toggle-row">
        <button class="toggle-btn" data-target="detail-${safe(row["排名"])}">展開分析</button>
      </div>

      <div id="detail-${safe(row["排名"])}" class="detail-wrap hidden">

        ${renderSection(
          "估值面",
          [
            ["PEG", showValue(valData["PEG"])],
            ["Forward PE", showValue(valData["ForwardPE"])],
            ["EPS成長率", showPercentNoGap(valData["EPS成長率"])],
            ["估值分數", showValue(breakdown["估值分"])]
          ],
          safe(row["估值說明"] || "--")
        )}

        ${renderSection(
          "技術面",
          [
            ["年線方向", arrowText(trend["年線"], row["12月漲跌幅"])],
            ["6月線方向", arrowText(trend["6月線"], row["6月漲跌幅"])],
            ["3月線方向", arrowText(trend["3月線"], row["3月漲跌幅"])],
            ["1W短期波動", showPercentNoGap(row["1週漲跌幅"])],
            ["趨勢分", showValue(breakdown["趨勢分"])],
            ["結構分", showValue(breakdown["結構分"])],
            ["時機調整", showValue(breakdown["時機調整"])]
          ],
          buildTechnicalComment(row)
        )}

        ${renderSection(
          "資金面",
          [
            ["量比", showValue(row["量比"])],
            ["資金分數", showValue(breakdown["資金分"])]
          ],
          buildMoneyComment(row)
        )}

        ${renderSection(
          "標的品質",
          [
            ["品質等級", qualityText(row, breakdown)],
            ["品質分數", showValue(breakdown["品質分"])],
            ["類別調整", showValue(breakdown["類別調整"])]
          ],
          buildQualityComment(row)
        )}

        <div class="analysis-section">
          <div class="section-title">Why / Why not</div>
          <div class="why-grid">
            <div class="why-box">
              <div class="why-title">Why</div>
              <div class="why-body">${renderWhyList(row["why_yes"])}</div>
            </div>
            <div class="why-box">
              <div class="why-title">Why not</div>
              <div class="why-body">${renderWhyList(row["why_no"])}</div>
            </div>
          </div>
        </div>

        <div class="analysis-section">
          <div class="section-title">分數拆解</div>
          <div class="formula-line">
            估值 ${showValue(breakdown["估值分"])}
            + 趨勢 ${showValue(breakdown["趨勢分"])}
            + 結構 ${showValue(breakdown["結構分"])}
            + 時機 ${showValue(breakdown["時機調整"])}
            + 資金 ${showValue(breakdown["資金分"])}
            + 品質 ${showValue(breakdown["品質分"])}
            + 類別 ${showValue(breakdown["類別調整"])}
            = <strong>${showValue(breakdown["總分"])}</strong>
          </div>
        </div>

      </div>
    </div>
  `;
}

function renderSection(title, rows, comment) {
  return `
    <div class="analysis-section">
      <div class="section-title">${title}</div>
      <div class="analysis-table">
        ${rows.map(([label, value]) => `
          <div class="analysis-row">
            <div class="analysis-label">${label}</div>
            <div class="analysis-value">${value}</div>
          </div>
        `).join("")}
      </div>
      <div class="analysis-comment">${comment}</div>
    </div>
  `;
}

// ------------------------------------------
// Text builders
// ------------------------------------------
function buildTechnicalComment(row) {
  const trend = row["趨勢判讀"] || {};
  const trendState = trend["趨勢狀態"];
  const structureState = trend["結構狀態"];
  const timingState = trend["溫度狀態"];

  const longText =
    trendState === "up_strong" ? "長期趨勢向上且明確" :
    trendState === "up_mild" ? "長期趨勢仍向上，但斜率較緩" :
    trendState === "down" ? "長期趨勢向下，方向有問題" :
    "長期趨勢資料不足";

  const midText =
    structureState === "pullback" ? "中期屬回檔結構，位置較合理" :
    structureState === "hot" ? "中期結構健康，但位置偏熱" :
    structureState === "top" ? "中期結構轉弱，屬做頭型態" :
    structureState === "rebound" ? "中期偏弱，目前較像反彈" :
    "中期結構中性";

  const shortText =
    timingState === "dip" ? "短期波動屬回檔，有利觀察進場點" :
    timingState === "overheat" ? "短期波動偏熱，不宜追高" :
    "短期波動中性";

  return `長期：${longText}；中期：${midText}；短期：${shortText}。`;
}

function buildMoneyComment(row) {
  const vr = num(row["量比"]);
  const score = num(row["分數拆解"]?.["資金分"]);

  if (vr >= 1.5) {
    return `量比 ${formatNum(vr, 2)}，市場資金明顯放大，資金面偏強。`;
  }
  if (vr >= 1.0) {
    return `量比 ${formatNum(vr, 2)}，市場資金維持正常，資金面中性偏穩。`;
  }
  if (vr >= 0.7) {
    return `量比 ${formatNum(vr, 2)}，短期資金偏保守，尚未見到強力追價。`;
  }
  return `量比 ${formatNum(vr, 2)}，資金參與度偏低，雖可觀察，但短期推升力不足。`;
}

function buildQualityComment(row) {
  const risk = safe(row["風險等級"]);
  const category = safe(row["分類"]);
  const q = num(row["分數拆解"]?.["品質分"]);

  let level = "中";
  if (q >= 5) level = "高";
  else if (q < 0) level = "低";

  return `標的品質屬${level}，分類為 ${category}，風險等級為 ${risk}。${category === "core" ? "屬核心可接標的。" : "需搭配結構與價格判斷。"} `;
}

function qualityText(row, breakdown) {
  const q = num(breakdown["品質分"]);
  let level = "中";
  if (q >= 5) level = "高";
  else if (q < 0) level = "低";
  return `${level}（分類 ${safe(row["分類"])} / 風險 ${safe(row["風險等級"])})`;
}

function renderWhyList(arr) {
  if (!Array.isArray(arr) || !arr.length) return "—";
  return arr.map(x => `<div class="why-item">• ${safe(x)}</div>`).join("");
}

function arrowText(arrow, val) {
  if (!arrow || arrow === "未知") return "未知";
  return `${arrow}（${showPercentNoGap(val)}）`;
}

// ------------------------------------------
// helpers
// ------------------------------------------
function bindCardToggle() {
  document.querySelectorAll(".toggle-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-target");
      const el = document.getElementById(targetId);
      if (!el) return;

      el.classList.toggle("hidden");
      btn.textContent = el.classList.contains("hidden") ? "展開分析" : "收起分析";
    });
  });
}

function getRankBadge(rank) {
  if (rank === 1) return "🔥 今日最強";
  if (rank === 2) return "⭐ 核心觀察";
  if (rank === 3) return "📌 重點追蹤";
  return "";
}

function getScoreClass(score) {
  const s = num(score);
  if (s >= 75) return "score-good";
  if (s >= 55) return "score-mid";
  return "score-bad";
}

function getBarClass(score) {
  const s = num(score);
  if (s >= 75) return "bar-good";
  if (s >= 55) return "bar-mid";
  return "bar-bad";
}

function getActionClass(a) {
  if (a === "加入") return "pill-add";
  if (a === "觀察") return "pill-watch";
  return "pill-remove";
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function avg(arr) {
  const valid = arr.filter(v => Number.isFinite(v));
  if (!valid.length) return 0;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function pct(n, d) {
  if (!d) return 0;
  return Math.round((n / d) * 100);
}

function formatNum(v, digits = 2) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(digits) : "--";
}

function showValue(v) {
  return v === undefined || v === null || v === "" ? "--" : v;
}

function showPercentNoGap(v) {
  return v === undefined || v === null || v === "" ? "--" : `${Number(v).toFixed(2)}%`;
}

function safe(v) {
  return v === undefined || v === null ? "" : String(v);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

document.addEventListener("DOMContentLoaded", loadM7Today);

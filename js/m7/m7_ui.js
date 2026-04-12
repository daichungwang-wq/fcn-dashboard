// ==========================================
// M7 UI PRO FINAL
// 保留：Top / Dashboard / Score Dashboard / Score Ranking
// 調整：Score Ranking 之後改為 4 大池，取代原本三大池
// 讀取：data/m7/m7_new_stock_today.json
// ==========================================

async function loadM7() {
  try {
    const res = await fetch("./data/m7/m7_new_stock_today.json?v=" + Date.now());
    if (!res.ok) throw new Error("無法讀取 m7_new_stock_today.json");
    const data = await res.json();

    renderTop(data);
    renderDashboard(data);
    renderScoreDashboard(data);
    renderScoreRanking(data);
    renderFourPools(data);
  } catch (err) {
    const wrap = document.getElementById("m7-sections");
    if (wrap) {
      wrap.innerHTML = `<div class="error-box">載入失敗：${err.message}</div>`;
    }
  }
}

// ------------------------------------------
// TOP
// ------------------------------------------
function renderTop(data) {
  const timeEl = document.getElementById("m7-time");
  const subEl = document.getElementById("m7-subtitle");

  if (timeEl) {
    timeEl.innerText = `更新時間：${safe(data.generated_at) || "--"}`;
  }

  if (subEl) {
    subEl.innerText =
      `M7 總樣本 ${num(data.total_count)} 檔` +
      (data.m2_generated_at ? ` ｜ M2更新：${data.m2_generated_at}` : "");
  }
}

// ------------------------------------------
// DASHBOARD
// 改成 4 大池總覽
// ------------------------------------------
function renderDashboard(data) {
  const wrap = document.getElementById("m7-dashboard");
  if (!wrap) return;

  const summary = data.pool_summary || {};
  const rules = data.pool_rules || {};

  wrap.innerHTML = `
    <div class="dash-grid">
      ${dashCard(
        "🔥 Today Highlight",
        `檔數：${num(summary.today_highlight_count)}`,
        safe(rules.today_highlight_pool?.purpose) || "今日優先看、優先配 basket"
      )}
      ${dashCard(
        "👀 Watch Pool",
        `檔數：${num(summary.watch_count)}`,
        safe(rules.watch_pool?.purpose) || "可做、可追蹤，但今天不優先"
      )}
      ${dashCard(
        "🧪 Simulation Pool",
        `檔數：${num(summary.simulation_count)}`,
        safe(rules.simulation_pool?.purpose) || "提供 M8 / U8 使用的正式候選池"
      )}
      ${dashCard(
        "❌ Reject Pool",
        `檔數：${num(summary.reject_count)}`,
        safe(rules.reject_pool?.purpose) || "真的不做，不進 FCN simulation"
      )}
    </div>
  `;
}

function dashCard(title, value, desc) {
  return `
    <div class="dash-card">
      <div class="dash-title">${title}</div>
      <div class="dash-value text-block">${value}</div>
      <div class="dash-desc">${desc}</div>
    </div>
  `;
}

// ------------------------------------------
// SCORE DASHBOARD
// 保留原本
// ------------------------------------------
function renderScoreDashboard(data) {
  const wrap = document.getElementById("m7-score-dashboard");
  if (!wrap) return;

  const rows = Array.isArray(data.all) ? data.all : [];
  if (!rows.length) {
    wrap.innerHTML = "";
    return;
  }

  const metricDefs = [
    { key: "估值分", label: "估值" },
    { key: "趨勢分", label: "Trend" },
    { key: "結構分", label: "Structure" },
    { key: "時機分", label: "Timing" },
    { key: "資金分", label: "Money" },
    { key: "品質分", label: "Quality Bonus" }
  ];

  const cards = metricDefs.map(def => {
    const stat = calcMetricStats(rows, def.key);

    return `
      <div class="score-stat-card">
        <div class="score-stat-title">${def.label}</div>
        <div class="score-stat-body">
          <div class="score-stat-line">
            <span class="score-stat-label">stock 數量</span>
            <span class="score-stat-value">${stat.count}</span>
          </div>
          <div class="score-stat-line">
            <span class="score-stat-label">平均值</span>
            <span class="score-stat-value">${fmtNum(stat.mean)}</span>
          </div>
          <div class="score-stat-line">
            <span class="score-stat-label">標準差</span>
            <span class="score-stat-value">${fmtNum(stat.std)}</span>
          </div>
          <div class="score-stat-line">
            <span class="score-stat-label">離散係數</span>
            <span class="score-stat-value">${stat.cv === null ? "--" : fmtNum(stat.cv)}</span>
          </div>
          <div class="score-stat-line">
            <span class="score-stat-label">最高分</span>
            <span class="score-stat-value">${stat.maxSymbol || "--"} (${fmtNum(stat.maxValue)})</span>
          </div>
          <div class="score-stat-line">
            <span class="score-stat-label">最低分</span>
            <span class="score-stat-value">${stat.minSymbol || "--"} (${fmtNum(stat.minValue)})</span>
          </div>
        </div>
      </div>
    `;
  }).join("");

  wrap.innerHTML = `
    <div class="main-card">
      <div class="main-header">
        <div>
          <div class="main-title">Score Dashboard</div>
          <div class="main-desc">各分項的樣本數、平均、標準差、離散係數與極值</div>
        </div>
      </div>
      <div class="main-body">
        <div class="score-stat-grid">
          ${cards}
        </div>
      </div>
    </div>
  `;
}

function calcMetricStats(rows, metricKey) {
  const items = rows
    .map(row => ({
      symbol: row["股號"],
      value: Number(row?.["分數拆解"]?.[metricKey])
    }))
    .filter(x => Number.isFinite(x.value));

  const count = items.length;
  if (!count) {
    return {
      count: 0,
      mean: null,
      std: null,
      cv: null,
      maxSymbol: null,
      maxValue: null,
      minSymbol: null,
      minValue: null
    };
  }

  const values = items.map(x => x.value);
  const mean = values.reduce((sum, v) => sum + v, 0) / count;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / count;
  const std = Math.sqrt(variance);
  const cv = mean === 0 ? null : std / Math.abs(mean);

  const sorted = [...items].sort((a, b) => b.value - a.value);
  const maxItem = sorted[0];
  const minItem = sorted[sorted.length - 1];

  return {
    count,
    mean,
    std,
    cv,
    maxSymbol: maxItem?.symbol || null,
    maxValue: maxItem?.value ?? null,
    minSymbol: minItem?.symbol || null,
    minValue: minItem?.value ?? null
  };
}

// ------------------------------------------
// SCORE RANKING
// 保留原本
// ------------------------------------------
function renderScoreRanking(data) {
  const wrap = document.getElementById("m7-score-ranking");
  if (!wrap) return;

  const rows = Array.isArray(data.all) ? data.all : [];
  if (!rows.length) {
    wrap.innerHTML = "";
    return;
  }

  const metricDefs = [
    {
      key: "估值分",
      label: "估值",
      formula: "Valuation = (0.6 × peScore + 0.4 × growthScore_adj) × qualityFactor"
    },
    {
      key: "趨勢分",
      label: "Trend",
      formula: "TrendRaw = 0.25×1M + 0.25×3M + 0.25×6M + 0.25×12M，再映射成分數"
    },
    {
      key: "結構分",
      label: "Structure",
      formula: "Structure = ShortSwing 對應甜度分數"
    },
    {
      key: "時機分",
      label: "Timing",
      formula: "Snapshot = 0.45×1D + 0.35×1W + 0.2×1M，再映射成分數"
    },
    {
      key: "資金分",
      label: "Money",
      formula: "Money = volume_ratio 對應資金參與度分數"
    },
    {
      key: "品質分",
      label: "Quality Bonus",
      formula: "Quality Bonus = quality_level + risk_level 對應加減分"
    }
  ];

  wrap.innerHTML = `
    <div class="main-card">
      <div class="main-header">
        <div>
          <div class="main-title">Score Ranking</div>
          <div class="main-desc">依各分項由高到低排序</div>
        </div>
        <div>
          <button class="toggle-btn" onclick="toggleMainCard('score_ranking_body', this, '展開全部', '收合全部')">
            展開全部
          </button>
        </div>
      </div>

      <div id="score_ranking_body" class="main-body hidden">
        ${metricDefs.map(def => `
          <div class="analysis-section">
            <div class="analysis-title">${def.label}</div>
            <div class="analysis-table">
              <div class="analysis-row">
                <div class="analysis-label">公式</div>
                <div class="analysis-value">${def.formula}</div>
              </div>
              <div class="analysis-row">
                <div class="analysis-label">排序</div>
                <div class="analysis-value ranking-line">${buildMetricRankingLine(rows, def.key)}</div>
              </div>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function buildMetricRankingLine(rows, metricKey) {
  const items = rows
    .map(row => ({
      symbol: row["股號"],
      value: Number(row?.["分數拆解"]?.[metricKey])
    }))
    .filter(x => Number.isFinite(x.value))
    .sort((a, b) => b.value - a.value);

  if (!items.length) return "--";

  return items.map(x => `${x.symbol}(${fmtNum(x.value)})`).join("，");
}

// ------------------------------------------
// 四大池：取代原本三大池
// ------------------------------------------
function renderFourPools(data) {
  const wrap = document.getElementById("m7-sections");
  if (!wrap) return;

  const highlight = Array.isArray(data.today_highlight_pool) ? data.today_highlight_pool : [];
  const watch = Array.isArray(data.watch_pool) ? data.watch_pool : [];
  const simulation = Array.isArray(data.simulation_pool) ? data.simulation_pool : [];
  const reject = Array.isArray(data.reject_pool) ? data.reject_pool : [];

  wrap.innerHTML = `
    ${poolCard("today_highlight_pool", "🔥 Today Highlight Pool", highlight, "規則：Simulation Pool 前段 + 結構非 flat + timing 非 hot + 曝險非 high")}
    ${poolCard("watch_pool", "👀 Watch Pool", watch, "規則：可做、可追蹤，但今天不優先")}
    ${poolCard("simulation_pool", "🧪 Simulation Pool", simulation, "規則：非 Reject 股票，依 today_score 排名前段")}
    ${poolCard("reject_pool", "❌ Reject Pool", reject, "規則：attribute reject 或 quant reject")}
  `;
}

function poolCard(id, title, list, desc) {
  if (!list || !list.length) {
    return `
      <div class="main-card">
        <div class="main-header" onclick="toggleBodyOnly('${id}')">
          <div>
            <div class="main-title">${title}</div>
            <div class="main-desc">${desc}</div>
          </div>
          <div class="main-count">0 檔</div>
        </div>
        <div id="${id}" class="main-body hidden">
          <div class="name-summary">目前無資料</div>
        </div>
      </div>
    `;
  }

  return `
    <div class="main-card">
      <div class="main-header" onclick="toggleBodyOnly('${id}')">
        <div>
          <div class="main-title">${title}</div>
          <div class="main-desc">${desc}</div>
        </div>
        <div class="main-count">${list.length} 檔</div>
      </div>

      <div id="${id}" class="main-body hidden">
        <div class="name-summary">${buildPoolSummaryLine(list)}</div>
        ${list.map((x, i) => stockCard(x, `${id}_${i}`)).join("")}
      </div>
    </div>
  `;
}

function buildPoolSummaryLine(list) {
  return list.map(x => `${safe(x["股號"])} ${fmtNum(x["today_score"])}`).join(" ｜ ");
}

// ------------------------------------------
// 單檔卡片
// ------------------------------------------
function stockCard(x, detailId) {
  const scoreClass = scoreCls(num(x["today_score"]));
  const poolReason = x["pool_reason"] || {};
  const rejectType = x["reject_type"] || "";
  const rejectReasons = Array.isArray(x["reject_reasons"]) ? x["reject_reasons"] : [];

  return `
    <div class="stock-card">
      <div class="card-head">
        <div class="card-left">
          <div class="title-row">
            <div class="stock-title">${x.is_today_highlight ? "🔥 " : ""}${safe(x["股號"])} ${safe(x["股名"])}</div>
            ${x.is_today_highlight ? `<div class="today-tag">今日推薦</div>` : ""}
          </div>
          <div class="stock-sub">
            ${safe(x["產業"])} ｜ ${safe(x["子產業"])} ｜ 分類：${safe(x["分類"])} ｜ 風險：${safe(x["風險等級"])}
          </div>
        </div>

        <div class="card-right">
          <div class="score ${scoreClass}">${fmtNum(x["today_score"])}</div>
        </div>
      </div>

      <div class="summary-box">
        <strong>第一層：摘要</strong><br>
        Total ${fmtNum(x["today_score"])}<br>
        Valuation ${fmtNum(x["valuation_score"])} ｜ Trend ${fmtNum(x["trend_score"])} ｜ Structure ${fmtNum(x["structure_score"])} ｜ Timing ${fmtNum(x["timing_score"])} ｜ Money ${fmtNum(x["money_score"])}<br>
        短評：${safe(x["最終說明"])}
      </div>

      <div class="highlight-box">
        <strong>第二層：為什麼進這一池</strong><br>
        ${safe(poolReason.pool)} ｜ ${safe(poolReason.reason_summary)}<br>
        ${
          Array.isArray(poolReason.detail) && poolReason.detail.length
            ? poolReason.detail.map(v => `• ${safe(v)}`).join("<br>")
            : "—"
        }
      </div>

      ${
        rejectType
          ? `
        <div class="warn-box high">
          <strong>Reject Type：</strong>${safe(rejectType)}<br>
          <strong>Reject Reasons：</strong><br>
          ${rejectReasons.length ? rejectReasons.map(v => `• ${safe(v)}`).join("<br>") : "—"}
        </div>
      `
          : ""
      }

      <div class="detail-btn-row">
        <button class="detail-btn" onclick="toggleDetail('${detailId}', this)">展開完整分析</button>
      </div>

      <div id="${detailId}" class="detail-wrap hidden">
        ${analysisBlock(x)}
      </div>
    </div>
  `;
}

function analysisBlock(x) {
  return `
    ${analysisSection("第三層：完整公式展開", [
      ["TrendRaw", `0.25×1M + 0.25×3M + 0.25×6M + 0.25×12M = ${fmtNum(x["trendRaw"])}`],
      ["Snapshot", `0.45×1D + 0.35×1W + 0.2×1M = ${fmtNum(x["snapshot"])}`],
      ["Growth", x["growth"] === null || x["growth"] === undefined ? "--" : `${fmtNum(x["growth"])}%`],
      ["GrowthScore", fmtNum(x["growthScore"])],
      ["ShortSwing", fmtNum(x?.["結構資料"]?.["ShortSwing"])]
    ])}

    ${analysisSection("第四層：Score 展開", [
      ["today_score", fmtNum(x["today_score"])],
      ["valuation_score", fmtNum(x["valuation_score"])],
      ["trend_score", fmtNum(x["trend_score"])],
      ["structure_score", fmtNum(x["structure_score"])],
      ["timing_score", fmtNum(x["timing_score"])],
      ["money_score", fmtNum(x["money_score"])],
      ["trendRaw", fmtNum(x["trendRaw"])],
      ["snapshot", fmtNum(x["snapshot"])],
      ["growth", x["growth"] === null || x["growth"] === undefined ? "--" : fmtNum(x["growth"])],
      ["growthScore", fmtNum(x["growthScore"])],
      ["pool", safe(x?.["pool_reason"]?.["pool"])],
      ["pool_reason", safe(x?.["pool_reason"]?.["reason_summary"])]
    ])}

    ${analysisSection("Reject 補充", [
      ["reject_type", safe(x["reject_type"]) || "--"],
      ["reject_reasons", Array.isArray(x["reject_reasons"]) && x["reject_reasons"].length ? x["reject_reasons"].join(" / ") : "--"],
      ["badCount", x["badCount"] === undefined || x["badCount"] === null ? "--" : x["badCount"]],
      ["trendTerrible", x["trendTerrible"] === undefined ? "--" : String(x["trendTerrible"])],
      ["snapshotTerrible", x["snapshotTerrible"] === undefined ? "--" : String(x["snapshotTerrible"])],
      ["growthTerrible", x["growthTerrible"] === undefined ? "--" : String(x["growthTerrible"])]
    ])}
  `;
}

function analysisSection(title, rows) {
  return `
    <div class="analysis-section">
      <div class="analysis-title">${title}</div>
      <div class="analysis-table">
        ${rows.map(([label, value]) => `
          <div class="analysis-row">
            <div class="analysis-label">${label}</div>
            <div class="analysis-value">${value}</div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

// ------------------------------------------
// Toggle
// ------------------------------------------
function toggleBodyOnly(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle("hidden");
}

function toggleMainCard(id, btn, closedText = "展開", openedText = "收合") {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle("hidden");
  if (btn) {
    btn.textContent = el.classList.contains("hidden") ? closedText : openedText;
  }
}

function toggleDetail(id, btn) {
  const detail = document.getElementById(id);
  if (!detail) return;
  detail.classList.toggle("hidden");
  if (btn) {
    btn.textContent = detail.classList.contains("hidden") ? "展開完整分析" : "收起完整分析";
  }
}

// ------------------------------------------
// helpers
// ------------------------------------------
function scoreCls(score) {
  if (score >= 75) return "score-good";
  if (score >= 55) return "score-mid";
  return "score-bad";
}

function fmtNum(v, digits = 2) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(digits) : "--";
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function safe(v) {
  return v === undefined || v === null ? "" : String(v);
}

document.addEventListener("DOMContentLoaded", loadM7);

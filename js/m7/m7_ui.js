// ==========================================
// M7 UI FINAL
// 依振宇最新需求調整：
// 1. Dashboard 只保留「今日總覽 / 投資金額健檢分析」
// 2. 取消 技術面分析
// 3. 取消 今日組合推薦
// 4. Score Dashboard 取消 Category Bonus
// 5. Score Ranking 加入一鍵展開 / 收合
// 6. Score Ranking 每一項後面加上公式說明
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
    renderMainCards(data);
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
// 只保留：
// 1. 今日總覽
// 2. 投資金額健檢分析
// ------------------------------------------
function renderDashboard(data) {
  const wrap = document.getElementById("m7-dashboard");
  if (!wrap) return;

  const aggressive = data.aggressive_recommend || [];
  const watch = [...(data.watch_list || [])];
  const remove = data.remove_list || [];

  const overallSummary = [
    `總數：${num(data.total_count)}`,
    `積極推薦：${aggressive.length}`,
    `觀察名單：${watch.length}`,
    `建議剔除：${remove.length}`
  ].join(" ｜ ");

  const investHealth = [
    `高曝險：${num(data.high_exposure)}`,
    `中曝險：${num(data.mid_exposure)}`
  ].join(" ｜ ");

  const allRows = Array.isArray(data.all) ? data.all : [];
  const highExposureStocks = allRows
    .filter(x => (x["曝險警示"]?.level || "") === "high")
    .map(x => safe(x["股號"]))
    .filter(Boolean);

  const highExposureText = highExposureStocks.length
    ? `高曝險股票：${highExposureStocks.join(" / ")}`
    : "目前無高曝險股票。";

  wrap.innerHTML = `
    <div class="dash-grid" style="grid-template-columns: repeat(2, minmax(0, 1fr));">
      ${dashCard(
        "今日總覽",
        overallSummary,
        "觀察目前篩選結果與三大分類分布。"
      )}

      ${dashCard(
        "投資金額健檢分析",
        investHealth,
        highExposureText
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
// 取消 Category Bonus
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
    // 類別調整 Category Bonus 已取消
  ];

  const cards = metricDefs.map(def => {
    const stat = calcMetricStats(rows, def.key);

    return `
      <div class="score-stat-card">
        <div class="score-stat-title">${def.label}</div>
        <div class="score-stat-body">
          <div>stock 數量：${stat.count}</div>
          <div>平均值：${fmtNum(stat.mean)}</div>
          <div>標準差：${fmtNum(stat.std)}</div>
          <div>離散係數：${stat.cv === null ? "--" : fmtNum(stat.cv)}</div>
          <div>最高分：${stat.maxSymbol || "--"} (${fmtNum(stat.maxValue)})</div>
          <div>最低分：${stat.minSymbol || "--"} (${fmtNum(stat.minValue)})</div>
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

  const variance = values.reduce((sum, v) => {
    return sum + Math.pow(v - mean, 2);
  }, 0) / count;

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
// 1. 加上一鍵展開 / 收合
// 2. 每個項目後面加上公式說明
// 3. 排序內容不動
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
      formula: "公式說明：Valuation = (0.6 × peScore + 0.4 × growthScore_adj) × qualityFactor"
    },
    {
      key: "趨勢分",
      label: "Trend",
      formula: "公式說明：Trend = 1M / 3M / 6M / 12M 綜合方向判讀"
    },
    {
      key: "結構分",
      label: "Structure",
      formula: "公式說明：Structure = ShortSwing 對應甜度分數，並依上限封頂"
    },
    {
      key: "時機分",
      label: "Timing",
      formula: "公式說明：Timing = Snapshot = 0.4×1D + 0.5×1W + 0.1×1M，再映射成分數"
    },
    {
      key: "資金分",
      label: "Money",
      formula: "公式說明：Money = 依量比 / 資金參與度映射分數"
    },
    {
      key: "品質分",
      label: "Quality Bonus",
      formula: "公式說明：Quality Bonus = 依標的品質等級給予加減分"
    },
    {
      key: "類別調整",
      label: "Category Bonus",
      formula: "公式說明：Category Bonus = 依 core / defensive / cyclical / speculative 類別調整"
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
// 三大卡
// ------------------------------------------
function renderMainCards(data) {
  const wrap = document.getElementById("m7-sections");
  if (!wrap) return;

  const aggressive = sortAggressive(data.aggressive_recommend || []);
  const watchBucket = sortWatch(data.watch_list || []);
  const removeBucket = data.remove_list || [];

  wrap.innerHTML = `
    ${mainCard("積極推薦", aggressive, "含今日推薦，今日首選會排最前並標示原因。", true, 3)}
    ${mainCard("觀察名單", watchBucket, "集中追蹤等待更佳位置。", false, 1)}
    ${mainCard("建議剔除", removeBucket, "目前結構或風險不適合做 FCN。", false, 1)}
  `;
}

function sortAggressive(list) {
  return [...list].sort((a, b) => {
    return (b.is_today_highlight === true) - (a.is_today_highlight === true)
      || b.today_score - a.today_score;
  });
}

function sortWatch(list) {
  return [...list].sort((a, b) => b.today_score - a.today_score);
}

function mainCard(title, list, desc, defaultOpen = false, previewCount = 3) {
  if (!list || !list.length) return "";

  const preview = list.slice(0, previewCount);
  const hidden = list.slice(previewCount);
  const safeId = "card_" + title.replace(/\s+/g, "_");

  return `
    <div class="main-card">
      <div class="main-header" onclick="toggleBodyOnly('${safeId}')">
        <div>
          <div class="main-title">${title}</div>
          <div class="main-desc">${desc}</div>
        </div>
        <div class="main-count">${list.length} 檔</div>
      </div>

      <div id="${safeId}" class="main-body ${defaultOpen ? "" : "hidden"}">
        <div class="name-summary">${buildNameSummary(title, list)}</div>

        ${preview.map(cardHTML).join("")}

        ${
          hidden.length > 0
            ? `
          <div class="toggle-row">
            <button class="toggle-btn" onclick="toggleList('${safeId}_list', this, ${list.length})">
              展開全部 (${list.length})
            </button>
          </div>
          <div id="${safeId}_list" class="hidden-list hidden">
            ${hidden.map(cardHTML).join("")}
          </div>
        `
            : ""
        }
      </div>
    </div>
  `;
}

function buildNameSummary(title, list) {
  if (!list || !list.length) return "—";

  if (title === "積極推薦") {
    const highlights = list.filter(x => x.is_today_highlight).map(x => x["股號"]);
    const others = list.filter(x => !x.is_today_highlight).map(x => x["股號"]);

    const parts = [];
    if (highlights.length) parts.push(`今日推薦：${highlights.join(" / ")}`);
    if (others.length) parts.push(`其餘：${others.join(" / ")}`);
    return parts.join(" ｜ ");
  }

  return list.map(x => x["股號"]).join(" / ");
}

// ------------------------------------------
// 股票卡
// ------------------------------------------
function cardHTML(x) {
  const scoreClass = scoreCls(num(x["today_score"]));
  const actionClass = actionCls(x["建議動作"]);
  const warnLevel = x["曝險警示"]?.level || "normal";

  const scoreJson = encodeURIComponent(JSON.stringify(x["分數拆解"] || {}));

  return `
    <div class="stock-card">
      <div class="card-head">
        <div class="card-left">
          <div class="title-row">
            <div class="stock-title">
              ${x.is_today_highlight ? "🔥 " : ""}${safe(x["股號"])} ${safe(x["股名"])}
            </div>
            ${x.is_today_highlight ? `<div class="today-tag">今日推薦</div>` : ""}
          </div>
          <div class="stock-sub">
            ${safe(x["產業"])} ｜ ${safe(x["子產業"])} ｜ 分類：${safe(x["分類"])} ｜ 風險：${safe(x["風險等級"])}
          </div>
        </div>

        <div class="card-right">
          <div class="score ${scoreClass}" onclick="showScoreDetail('${scoreJson}')">${num(x["today_score"])}</div>
          <div class="action-pill ${actionClass}">${safe(x["建議動作"])}</div>
        </div>
      </div>

      ${
        x.is_today_highlight
          ? `
        <div class="highlight-box">
          <strong>今日推薦原因：</strong>${safe(x.today_highlight_reason) || "—"}
        </div>
      `
          : ""
      }

      <div class="summary-box">
        <strong>總結：</strong>${safe(x["最終說明"])}
      </div>

      ${exposureBlock(x, warnLevel)}

      <div class="detail-btn-row">
        <button class="detail-btn" onclick="toggleDetail(this)">展開分析</button>
      </div>

      <div class="detail-wrap hidden">
        ${analysisBlock(x)}
      </div>
    </div>
  `;
}

function exposureBlock(x, warnLevel) {
  const e = x["持倉曝險"] || {};
  const warn = x["曝險警示"] || {};

  return `
    <div class="exposure-box">
      <div class="exposure-head">持倉曝險</div>

      <div class="mini-grid">
        <div class="mini-item">
          <span class="mini-label">FCN數量</span>
          <span class="mini-value">${num(e["FCN數量"])}</span>
        </div>

        <div class="mini-item">
          <span class="mini-label">投入資金比</span>
          <span class="mini-value">${formatNum(num(e["投入資金比"]), 2)}%</span>
        </div>

        <div class="mini-item">
          <span class="mini-label">Danger / Watch / Healthy</span>
          <span class="mini-value">${num(e["Danger"])} / ${num(e["Watch"])} / ${num(e["Healthy"])}</span>
        </div>
      </div>

      <div class="warn-box ${warnLevel}">
        ${safe(warn.text)}
      </div>
    </div>
  `;
}

// ------------------------------------------
// 詳細分析
// ------------------------------------------
function analysisBlock(x) {
  const score = x["分數拆解"] || {};
  const valData = x["估值資料"] || {};
  const trend = x["趨勢判讀"] || {};
  const struct = x["結構資料"] || {};
  const timing = x["時機資料"] || {};
  const exposure = x["持倉曝險"] || {};

  return `
    ${analysisSection(
      "分數拆解",
      [
        ["欄位", "估值 / 趨勢 / 結構 / 時機 / 資金 / 品質 / 類別"],
        ["值", valueLine(
          `估值：${showValue(score["估值分"])}`,
          `趨勢：${showValue(score["趨勢分"])}`,
          `結構：${showValue(score["結構分"])}`,
          `時機：${showValue(score["時機分"])}`,
          `資金：${showValue(score["資金分"])}`,
          `品質：${showValue(score["品質分"])}`,
          `類別：${showValue(score["類別調整"])}`
        )],
        ["分數", `總分：${showValue(score["總分"])}`],
        ["說明", "這是 M7 的總拆解。估值看價格合理性，趨勢看方向，結構看甜度，時機看短線節奏，資金看量比，品質與類別做風險框架修正。"]
      ]
    )}

    ${analysisSection(
      "估值面",
      [
        ["欄位", "Forward PE / Anchor PE / PE Ratio / PEG / EPS成長 / 品質倍率"],
        ["值", valueLine(
          `Forward PE：${showValue(valData["ForwardPE"])}`,
          `Anchor PE：${showValue(valData["AnchorPE"])}`,
          `PE Ratio：${showValue(valData["PERatio"])}`,
          `PEG：${showValue(valData["PEG"])}`,
          `EPS成長率：${showPercentNum(valData["EPS成長率"])}`,
          `QualityFactor：${showValue(valData["QualityFactor"])}`
        )],
        ["分數", valueLine(
          `PEScore：${showValue(valData["PEScore"])}`,
          `GrowthScore：${showValue(valData["GrowthScore"])}`,
          `ValuationRaw：${showValue(valData["ValuationRaw"])}`,
          `估值分：${showValue(score["估值分"])}`
        )],
        ["說明", safe(x["估值說明"])]
      ]
    )}

    ${analysisSection(
      "趨勢面",
      [
        ["欄位", "1M / 3M / 6M / 12M 加權後的中期方向"],
        ["值", valueLine(
          `月線：${showValue(trend["月線"])}（${showPercentNum(x["1月漲跌幅"])})`,
          `3月線：${showValue(trend["3月線"])}（${showPercentNum(x["3月漲跌幅"])})`,
          `6月線：${showValue(trend["6月線"])}（${showPercentNum(x["6月漲跌幅"])})`,
          `年線：${showValue(trend["年線"])}（${showPercentNum(x["12月漲跌幅"])})`
        )],
        ["分數", `趨勢分：${showValue(score["趨勢分"])}`],
        ["說明", `趨勢狀態：${safe(trend["趨勢狀態"])}。趨勢只看方向，不看甜不甜。`]
      ]
    )}

    ${analysisSection(
      "結構面",
      [
        ["欄位", "ShortSwing / 結構狀態"],
        ["值", valueLine(
          `ShortSwing：${showValue(struct["ShortSwing"])}`,
          `結構狀態：${safe(trend["結構狀態"])}`
        )],
        ["分數", `結構分：${showValue(score["結構分"])}`],
        ["說明", "Structure 用 M8 的 ShortSwing 量化價格甜度。0~5% 曲線加速到 8 分，5~10% 緩升到 10 分，10% 以上封頂。"]
      ]
    )}

    ${analysisSection(
      "時機面",
      [
        ["欄位", "1D / 1W / 1M Snapshot"],
        ["值", valueLine(
          `1日：${showPercentNum(x["1日漲跌幅"])}`,
          `1週：${showPercentNum(x["1週漲跌幅"])}`,
          `1月：${showPercentNum(x["1月漲跌幅"])}`,
          `Snapshot：${showValue(timing["Snapshot"])}`
        )],
        ["分數", `時機分：${showValue(score["時機分"])}`],
        ["說明", `時機狀態：${safe(trend["時機狀態"])}。Timing 用 0.4×1D + 0.5×1W + 0.1×1M 做 snapshot，再映射成 0~10 分。`]
      ]
    )}

    ${analysisSection(
      "資金面",
      [
        ["欄位", "量比 / 市場資金參與度"],
        ["值", `量比：${showValue(x["量比"])}`],
        ["分數", showValue(score["資金分"])],
        ["說明", moneyComment(x)]
      ]
    )}

    ${analysisSection(
      "標的品質 / 類別",
      [
        ["欄位", "標的品質 / 類別框架"],
        ["值", valueLine(
          `分類：${safe(x["分類"])}`,
          `風險等級：${safe(x["風險等級"])}`
        )],
        ["分數", valueLine(
          `品質分：${showValue(score["品質分"])}`,
          `類別調整：${showValue(score["類別調整"])}`
        )],
        ["說明", qualityComment(x)]
      ]
    )}

    ${analysisSection(
      "持倉曝險",
      [
        ["欄位", "FCN數量 / 投入比 / 健康度"],
        ["值", valueLine(
          `FCN數量：${num(exposure["FCN數量"])}`,
          `投入金額：USD ${formatInt(exposure["投入金額"])}`,
          `投入比：${formatNum(num(exposure["投入資金比"]), 2)}%`,
          `D/W/H：${num(exposure["Danger"])} / ${num(exposure["Watch"])} / ${num(exposure["Healthy"])}`
        )],
        ["分數", "不直接擋單，只做警示與排序參考"],
        ["說明", safe(x["曝險警示"]?.text)]
      ]
    )}

    <div class="analysis-section">
      <div class="analysis-title">Why / Why not</div>
      <div class="why-grid">
        <div class="why-box">
          <div class="why-title">Why</div>
          <div class="why-body">${renderWhyList(x["why_yes"])}</div>
        </div>
        <div class="why-box">
          <div class="why-title">Why not</div>
          <div class="why-body">${renderWhyList(x["why_no"])}</div>
        </div>
      </div>
    </div>
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
// 說明文字
// ------------------------------------------
function moneyComment(x) {
  const vr = num(x["量比"]);
  if (vr >= 1.5) return `量比 ${formatNum(vr, 2)}，市場資金明顯追捧，資金面偏強。`;
  if (vr >= 1.0) return `量比 ${formatNum(vr, 2)}，資金面中性偏穩。`;
  if (vr >= 0.7) return `量比 ${formatNum(vr, 2)}，短期資金略保守，但未明顯失血。`;
  return `量比 ${formatNum(vr, 2)} 偏低，資金參與度不足，需觀察是否只是等待量能回流。`;
}

function qualityComment(x) {
  const category = safe(x["分類"]);
  const risk = safe(x["風險等級"]);

  if (category === "core") return `屬核心可接標的，風險屬 ${risk}，適合做為 FCN 基本持股候選。`;
  if (category === "defensive") return `屬防禦型標的，風險相對可控，適合保守配置。`;
  if (category === "income") return `屬收益型標的，需同時觀察事件風險與結構。`;
  if (category === "cyclical_high_beta") return `屬高週期事件型標的，雖可能便宜，但價格可信度較低，不宜當核心。`;
  return `屬高風險投機類型，僅適合開發期觀察，不宜當作核心 FCN 標的。`;
}

// ------------------------------------------
// 可解釋分數
// ------------------------------------------
function showScoreDetail(encoded) {
  try {
    const score = JSON.parse(decodeURIComponent(encoded));

    const text = `
總分：${score["總分"] ?? "--"}

估值：${score["估值分"] ?? "--"}
趨勢：${score["趨勢分"] ?? "--"}
結構：${score["結構分"] ?? "--"}
時機：${score["時機分"] ?? "--"}
資金：${score["資金分"] ?? "--"}
品質：${score["品質分"] ?? "--"}
類別：${score["類別調整"] ?? "--"}

說明：
估值 = peScore + growthScore，再乘 qualityFactor
趨勢 = 1M / 3M / 6M / 12M 的方向判讀
結構 = M8 ShortSwing 對應甜度
時機 = Snapshot（0.4×1D + 0.5×1W + 0.1×1M）
資金 = 量比
品質 = 品質基礎分
類別 = 標的類別調整
`;
    alert(text);
  } catch (e) {
    alert("分數資料讀取失敗");
  }
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

function toggleList(id, btn, total) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle("hidden");
  btn.textContent = el.classList.contains("hidden") ? `展開全部 (${total})` : "收合";
}

function toggleDetail(btn) {
  const detail = btn.parentElement.nextElementSibling;
  if (!detail) return;
  detail.classList.toggle("hidden");
  btn.textContent = detail.classList.contains("hidden") ? "展開分析" : "收起分析";
}

// ------------------------------------------
// helpers
// ------------------------------------------
function renderWhyList(arr) {
  if (!Array.isArray(arr) || !arr.length) return "—";
  return arr.map(x => `<div class="why-item">• ${safe(x)}</div>`).join("");
}

function valueLine(...items) {
  return items.filter(Boolean).join(" ｜ ");
}

function scoreCls(score) {
  if (score >= 75) return "score-good";
  if (score >= 55) return "score-mid";
  return "score-bad";
}

function actionCls(action) {
  if (action === "加入") return "pill-add";
  if (action === "觀察") return "pill-watch";
  return "pill-remove";
}

function showValue(v) {
  return v === undefined || v === null || v === "" ? "--" : v;
}

function showPercentNum(v) {
  if (v === undefined || v === null || v === "") return "--";
  const n = Number(v);
  return Number.isFinite(n) ? `${n.toFixed(2)}%` : "--";
}

function formatNum(v, digits = 2) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(digits) : "--";
}

function fmtNum(v, digits = 2) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(digits) : "--";
}

function formatInt(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString() : "--";
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function safe(v) {
  return v === undefined || v === null ? "" : String(v);
}

document.addEventListener("DOMContentLoaded", loadM7);

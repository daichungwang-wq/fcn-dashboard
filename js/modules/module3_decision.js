function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function getNewsMode() {
  // 相容兩種命名
  // window.newsMode = "pure" / "news"
  // 或 window.newsMode = "off" / "on"
  const mode = window.newsMode || "news";
  if (mode === "pure" || mode === "off") return "pure";
  return "news";
}

function getAllNews(newsData) {
  if (!newsData || typeof newsData !== "object") return [];
  return [
    ...(newsData.global || []),
    ...(newsData.finance || []),
    ...(newsData.ai || []),
    ...(newsData.fcn || [])
  ];
}

function normalizeTags(stock) {
  const tags = new Set();

  const symbol = String(stock.symbol || "").toUpperCase();
  const sector = String(stock.sector || "").toLowerCase();
  const category = String(stock.category || "").toLowerCase();
  const name = String(stock.name || "").toLowerCase();

  if (symbol) tags.add(symbol);
  if (category) tags.add(category);

  // 中文 / 英文 sector 轉成可運算 tags
  if (sector.includes("ai")) tags.add("ai");
  if (sector.includes("半導體")) tags.add("semiconductor");
  if (sector.includes("設備")) tags.add("equipment");
  if (sector.includes("金融")) tags.add("financial");
  if (sector.includes("醫療")) tags.add("healthcare");
  if (sector.includes("消費")) tags.add("consumer");
  if (sector.includes("能源")) tags.add("energy");
  if (sector.includes("航空")) tags.add("travel");
  if (sector.includes("旅遊")) tags.add("travel");
  if (sector.includes("電商")) tags.add("ecommerce");
  if (sector.includes("軟體")) tags.add("software");
  if (sector.includes("債券")) tags.add("bond");
  if (sector.includes("國防")) tags.add("defense");
  if (sector.includes("支付")) tags.add("payment");
  if (sector.includes("平台")) tags.add("platform");
  if (sector.includes("高波動")) tags.add("high_beta");
  if (sector.includes("景氣")) tags.add("cyclical");
  if (sector.includes("防守")) tags.add("defensive");
  if (sector.includes("電動車")) tags.add("ev");
  if (sector.includes("汽車")) tags.add("auto");
  if (sector.includes("記憶體")) tags.add("memory");
  if (sector.includes("網通")) tags.add("networking");
  if (sector.includes("伺服器")) tags.add("server");

  if (name.includes("tesla")) tags.add("ev");
  if (name.includes("ford")) tags.add("traditional_auto");
  if (name.includes("united airlines")) tags.add("travel");
  if (name.includes("norwegian")) tags.add("travel");
  if (name.includes("carnival")) tags.add("travel");

  return Array.from(tags);
}

function calculateNewsScore(stock, allNews, newsMode) {
  if (newsMode === "pure") {
    return { score: 0, hitNews: [] };
  }

  const symbol = String(stock.symbol || "").toUpperCase();
  const tags = normalizeTags(stock);

  let score = 0;
  const hitNews = [];

  allNews.forEach((news) => {
    let matched = false;

    const directImpact = Array.isArray(news.impact) ? news.impact.map(x => String(x).toUpperCase()) : [];
    const impactTags = Array.isArray(news.impact_tags) ? news.impact_tags.map(x => String(x).toLowerCase()) : [];

    // 1. 直接命中股票
    if (directImpact.includes(symbol)) {
      matched = true;
      score += 2;
    }

    // 2. tag 命中
    if (!matched && impactTags.length) {
      const tagHit = impactTags.some(tag => tags.includes(tag));
      if (tagHit) {
        matched = true;
        score += 1;
      }
    }

    // 3. 相容舊資料：沒有 impact_tags 時，嘗試用 sector/category 做簡單對應
    if (!matched && directImpact.length === 0) {
      const title = String(news.title || "").toLowerCase();
      const summary = String(news.summary || "").toLowerCase();
      const text = `${title} ${summary}`;

      if (text.includes("ai") && tags.includes("ai")) {
        matched = true;
        score += 1;
      } else if ((text.includes("利率") || text.includes("降息") || text.includes("殖利率")) && (tags.includes("financial") || tags.includes("bond"))) {
        matched = true;
        score += 1;
      } else if ((text.includes("油價") || text.includes("能源")) && (tags.includes("energy") || tags.includes("travel"))) {
        matched = true;
        score += 1;
      }
    }

    if (matched) {
      const direction = String(news.ai_direction || "").toLowerCase();
      if (direction === "negative" || direction === "負向") score -= 1;
      if (direction === "positive" || direction === "正向") score += 1;
      hitNews.push(news.title || "未命名新聞");
    }
  });

  return { score, hitNews };
}

function mapBucket(stock) {
  const pref = String(stock.fcn_preference || "").toLowerCase();
  const allow = stock.allow_fcn !== false;
  const category = String(stock.category || "").toLowerCase();
  const sector = String(stock.sector || "").toLowerCase();

  if (!allow || pref === "avoid" || pref === "low") return "avoid";

  if (sector.includes("債券") || sector.includes("bond") || sector.includes("高收益債")) return "income";

  if (category === "core") return "core";

  if (category === "defensive" || category === "financial" || category === "etf" || category === "bond") {
    return "defensive";
  }

  if (category === "growth" || category === "cyclical" || category === "turnaround" || category === "high_beta") {
    return "balanced";
  }

  return "balanced";
}

function bucketLabel(bucket) {
  return {
    core: "核心",
    defensive: "防守",
    balanced: "平衡",
    income: "收益",
    avoid: "避免"
  }[bucket] || bucket;
}

function fmtScore(n) {
  return Number(n).toFixed(2).replace(/\.00$/, "");
}

function buildStockModel(stock, allNews, newsMode) {
  const base = safeNum(stock.preference_score);
  const newsResult = calculateNewsScore(stock, allNews, newsMode);
  const news = safeNum(newsResult.score);
  const final = base + news;

  return {
    ...stock,
    bucket: mapBucket(stock),
    tags: normalizeTags(stock),
    baseScore: base,
    newsScore: news,
    finalScore: final,
    hitNews: newsResult.hitNews
  };
}

function renderBucketCard(bucket, list) {
  const recommend = list.filter(s => s.allow_fcn !== false && s.finalScore >= 80);
  const percent = list.length ? Math.round((recommend.length / list.length) * 100) : 0;

  return `
    <div class="m3-card ${bucket === "avoid" ? "m3-danger-card" : ""}">
      <div class="m3-header">
        <div class="m3-title">${bucketLabel(bucket)}</div>
        <div class="m3-meta">
          <span>總數 ${list.length}</span>
          <span>建議 ${recommend.length}</span>
          <span>${percent}%</span>
        </div>
      </div>

      <div class="m3-btn-row">
        <button class="m3-btn" onclick="toggleM3('${bucket}-recommend')">建議展開</button>
        <button class="m3-btn" onclick="toggleM3('${bucket}-detail')">詳細展開</button>
      </div>

      <div id="${bucket}-recommend" class="m3-hidden">
        ${recommend.length
          ? recommend.slice(0, 8).map(s => `
            <div class="m3-item">
              <strong>${escapeHtml(s.symbol)}</strong> ｜ ${escapeHtml(s.name)}<br>
              base ${fmtScore(s.baseScore)} ｜ news ${s.newsScore >= 0 ? "+" : ""}${fmtScore(s.newsScore)} ｜ final ${fmtScore(s.finalScore)}
            </div>
          `).join("")
          : `<div class="m3-item">目前無建議標的</div>`
        }
      </div>

      <div id="${bucket}-detail" class="m3-hidden">
        ${list.map(s => renderStockDetail(s)).join("")}
      </div>
    </div>
  `;
}

function renderStockDetail(s) {
  return `
    <div class="m3-stock-row">
      <div><strong>${escapeHtml(s.symbol)}</strong> ｜ ${escapeHtml(s.sector || "")} ｜ <strong>${escapeHtml(s.bucket)}</strong></div>
      <div>base ${fmtScore(s.baseScore)} ｜ news ${s.newsScore >= 0 ? "+" : ""}${fmtScore(s.newsScore)} ｜ final ${fmtScore(s.finalScore)}</div>
      <div>risk ${fmtScore(s.risk_score)} ｜ ${escapeHtml(s.risk_level || "")} ｜ ${escapeHtml(s.fcn_preference || "")}</div>
      <div>價格：$${fmtScore(s.price)} ｜ 漲跌幅：-- ｜ 1M：-- ｜ 6M：--</div>
      <div>PE25：-- ｜ PE26：-- ｜ EPS26：--</div>
      <div>新聞數：${s.hitNews.length}${s.hitNews.length ? ` ｜ ${escapeHtml(s.hitNews.join(" / "))}` : ""}</div>
    </div>
  `;
}

function renderRecommendationCards(models) {
  const candidates = models
    .filter(s => s.allow_fcn !== false && s.finalScore >= 80)
    .sort((a, b) => b.finalScore - a.finalScore);

  const groups = {
    "FCN-1": candidates.filter(s => s.bucket === "core").slice(0, 3),
    "FCN-2": [...candidates.filter(s => s.bucket === "core").slice(0, 2), ...candidates.filter(s => s.bucket === "defensive").slice(0, 1)].slice(0, 3),
    "FCN-3": candidates.filter(s => s.bucket === "defensive").slice(0, 3)
  };

  const descriptions = {
    "FCN-1": "優先採用核心高分標的",
    "FCN-2": "降低波動，保留主題性",
    "FCN-3": "震盪環境下的保守型組合"
  };

  const styles = {
    "FCN-1": "核心主軸",
    "FCN-2": "核心 + 防守",
    "FCN-3": "防守穩健"
  };

  return Object.entries(groups).map(([name, list]) => {
    const avg = list.length ? (list.reduce((sum, s) => sum + s.finalScore, 0) / list.length) : 0;
    return `
      <div class="m3-card">
        <div class="m3-big-title">${name}</div>
        <div>風格：${styles[name]}</div>
        <div>組成：${list.length ? list.map(s => s.symbol).join(" / ") : "目前無資料"}</div>
        <div>平均分數：${fmtScore(avg)}</div>
        <div>說明：${descriptions[name]}</div>
      </div>
    `;
  }).join("");
}

function renderSingleStockPanel(models) {
  const options = models
    .filter(s => s.allow_fcn !== false)
    .sort((a, b) => b.finalScore - a.finalScore);

  const top = options[0] || null;

  return `
    <div class="m3-card">
      <div class="m3-big-title">Module3-C ｜ 外部 FCN 單評區</div>

      <div class="m3-grid-2">
        <input id="m3-symbol-1" class="m3-input" placeholder="標的1">
        <input id="m3-symbol-2" class="m3-input" placeholder="標的2">
      </div>
      <input id="m3-symbol-3" class="m3-input" placeholder="標的3">
      <div class="m3-grid-2">
        <input id="m3-ki" class="m3-input" placeholder="KI">
        <input id="m3-strike" class="m3-input" placeholder="Strike">
      </div>
      <div class="m3-grid-2">
        <input id="m3-coupon" class="m3-input" placeholder="利率">
        <input id="m3-tenor" class="m3-input" placeholder="天期">
      </div>
      <div class="m3-btn-row">
        <button class="m3-btn" onclick="scoreExternalFCN()">開始評分</button>
      </div>

      <div id="m3-external-result" class="m3-item">
        總分：-- ｜ 建議：-- ｜ 組成：-- ｜ 利率：-- ｜ 天期：--
      </div>

      <div class="m3-query-box">
        <div class="m3-query-row">
          <input id="m3-stock-query" class="m3-input" placeholder="輸入股票代號，例如 NVDA">
          <button class="m3-btn" onclick="queryPoolStock()">查詢</button>
        </div>
        <div id="m3-stock-query-result" class="m3-item">
          ${
            top
              ? `<strong>${top.symbol}</strong> ｜ ${top.sector} <br>
                 base ${fmtScore(top.baseScore)} ｜ news ${top.newsScore >= 0 ? "+" : ""}${fmtScore(top.newsScore)} ｜ final ${fmtScore(top.finalScore)}<br>
                 risk ${fmtScore(top.risk_score)} ｜ ${top.risk_level} ｜ ${top.fcn_preference}<br>
                 價格：$${fmtScore(top.price)} ｜ 新聞數：${top.hitNews.length}${top.hitNews.length ? ` ｜ ${escapeHtml(top.hitNews.join(" / "))}` : ""}`
              : `目前無資料`
          }
        </div>
      </div>
    </div>
  `;
}

export function renderModule3(data) {
  const pool = data?.pool || [];
  const allNews = getAllNews(data?.newsData || {});
  const newsMode = getNewsMode();

  const models = pool.map(stock => buildStockModel(stock, allNews, newsMode));

  const buckets = {
    core: models.filter(s => s.bucket === "core").sort((a, b) => b.finalScore - a.finalScore),
    defensive: models.filter(s => s.bucket === "defensive").sort((a, b) => b.finalScore - a.finalScore),
    balanced: models.filter(s => s.bucket === "balanced").sort((a, b) => b.finalScore - a.finalScore),
    income: models.filter(s => s.bucket === "income").sort((a, b) => b.finalScore - a.finalScore),
    avoid: models.filter(s => s.bucket === "avoid").sort((a, b) => b.finalScore - a.finalScore)
  };

  // 給查詢和外部 FCN 評分用
  window.__M3_POOL__ = models;

  return `
    <div class="m3-wrap">
      <div class="m3-big-title">Module3-A ｜ 分類決策</div>
      ${renderBucketCard("core", buckets.core)}
      ${renderBucketCard("defensive", buckets.defensive)}
      ${renderBucketCard("balanced", buckets.balanced)}
      ${renderBucketCard("income", buckets.income)}
      ${renderBucketCard("avoid", buckets.avoid)}

      <div class="m3-big-title">Module3-B ｜ 今日 FCN 推薦</div>
      ${renderRecommendationCards(models)}

      ${renderSingleStockPanel(models)}
    </div>
  `;
}

window.toggleM3 = function(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle("m3-hidden");
};

window.queryPoolStock = function() {
  const q = document.getElementById("m3-stock-query")?.value?.trim()?.toUpperCase();
  const resultEl = document.getElementById("m3-stock-query-result");
  const pool = window.__M3_POOL__ || [];
  if (!resultEl) return;

  const hit = pool.find(s => s.symbol === q);
  if (!hit) {
    resultEl.innerHTML = `查無資料`;
    return;
  }

  resultEl.innerHTML = `
    <strong>${hit.symbol}</strong> ｜ ${hit.sector}<br>
    base ${fmtScore(hit.baseScore)} ｜ news ${hit.newsScore >= 0 ? "+" : ""}${fmtScore(hit.newsScore)} ｜ final ${fmtScore(hit.finalScore)}<br>
    risk ${fmtScore(hit.risk_score)} ｜ ${hit.risk_level} ｜ ${hit.fcn_preference}<br>
    價格：$${fmtScore(hit.price)} ｜ 新聞數：${hit.hitNews.length}${hit.hitNews.length ? ` ｜ ${escapeHtml(hit.hitNews.join(" / "))}` : ""}
  `;
};

window.scoreExternalFCN = function() {
  const pool = window.__M3_POOL__ || [];
  const symbols = [
    document.getElementById("m3-symbol-1")?.value?.trim()?.toUpperCase(),
    document.getElementById("m3-symbol-2")?.value?.trim()?.toUpperCase(),
    document.getElementById("m3-symbol-3")?.value?.trim()?.toUpperCase()
  ].filter(Boolean);

  const coupon = safeNum(document.getElementById("m3-coupon")?.value);
  const tenor = safeNum(document.getElementById("m3-tenor")?.value);
  const resultEl = document.getElementById("m3-external-result");
  if (!resultEl) return;

  const hits = symbols.map(sym => pool.find(s => s.symbol === sym)).filter(Boolean);
  if (!hits.length) {
    resultEl.innerHTML = `總分：-- ｜ 建議：資料不足 ｜ 組成：-- ｜ 利率：-- ｜ 天期：--`;
    return;
  }

  const avgBase = hits.reduce((sum, s) => sum + s.baseScore, 0) / hits.length;
  const avgNews = hits.reduce((sum, s) => sum + s.newsScore, 0) / hits.length;

  let score = avgBase + avgNews;

  if (coupon >= 18) score += 5;
  else if (coupon >= 15) score += 2;
  else if (coupon < 10) score -= 5;

  if (tenor > 9) score -= 3;
  else if (tenor >= 6) score += 0;
  else if (tenor > 0 && tenor < 6) score += 2;

  let advice = "可觀察";
  if (score >= 85) advice = "可做";
  else if (score >= 75) advice = "審慎可做";
  else if (score < 65) advice = "不建議";

  resultEl.innerHTML = `
    總分：${fmtScore(score)} ｜ 建議：${advice} ｜ 組成：${hits.map(s => s.symbol).join(" / ")} ｜ 利率：${coupon || "--"} ｜ 天期：${tenor || "--"}
  `;
};

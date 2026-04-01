// ==========================================
// macro_to_stock_engine.js V2
// 振宇 FCN 系統｜M1 → Stock Engine
// 功能：把市場 / 新聞 / 股票靜態資料 / 價格快照
//      轉成 M1 最後頁面要用的 stock card runtime
// ==========================================

// ------------------------------------------
// 工具
// ------------------------------------------
function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function safeText(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function average(values = []) {
  const nums = values.filter(v => Number.isFinite(v));
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function includesAny(text, keywords = []) {
  const lower = safeText(text).toLowerCase();
  return keywords.some(k => lower.includes(String(k).toLowerCase()));
}

// ------------------------------------------
// 1) baseline/category 對應分數
// 只允許既定五大類
// ------------------------------------------
export function getBaselineScore(stock = {}) {
  const category = safeText(stock.category, "");

  const map = {
    core: 8,
    growth: 6,
    defensive: 5,
    income: 4,
    speculative: 2
  };

  return toNumber(map[category], 0);
}

// ------------------------------------------
// 2) macro 對 sector 的影響
// macro 格式建議：
// {
//   vix: 21,
//   us10y: 4.26,
//   cpi_yoy: 2.4,
//   ppi_yoy: 0.7,
//   sp500_change: 0.8,
//   nasdaq_change: 1.3
// }
// ------------------------------------------
export function evaluateMacroEnvironment(macro = {}, stock = {}) {
  const sector = safeText(stock.sector, "");
  let score = 0;
  const reasons = [];

  const vix = toNumber(macro.vix, 0);
  const us10y = toNumber(macro.us10y, 0);
  const cpi_yoy = toNumber(macro.cpi_yoy, 0);
  const ppi_yoy = toNumber(macro.ppi_yoy, 0);
  const sp500_change = toNumber(macro.sp500_change, 0);
  const nasdaq_change = toNumber(macro.nasdaq_change, 0);

  // VIX
  if (vix >= 30) {
    score -= 4;
    reasons.push("VIX >= 30，市場恐慌偏高");
  } else if (vix >= 25) {
    score -= 2;
    reasons.push("VIX >= 25，波動偏高");
  } else if (vix > 0 && vix <= 15) {
    score += 1;
    reasons.push("VIX <= 15，市場相對穩定");
  }

  // 利率：成長 / AI 類股較敏感
  if (us10y >= 4.8) {
    if (["AI_SEMI", "AI_APPLICATION", "PLATFORM"].includes(sector)) {
      score -= 3;
      reasons.push("美債殖利率偏高，壓抑成長/AI估值");
    } else {
      score -= 1;
      reasons.push("美債殖利率偏高");
    }
  } else if (us10y > 0 && us10y <= 3.8) {
    if (["AI_SEMI", "AI_APPLICATION", "PLATFORM"].includes(sector)) {
      score += 2;
      reasons.push("美債殖利率相對溫和，有利成長/AI估值");
    } else {
      score += 1;
      reasons.push("美債殖利率相對溫和");
    }
  }

  // CPI
  if (cpi_yoy >= 3.5) {
    score -= 2;
    reasons.push("CPI 偏高，通膨壓力仍在");
  } else if (cpi_yoy > 0 && cpi_yoy <= 2.5) {
    score += 1;
    reasons.push("CPI 相對溫和");
  }

  // PPI
  if (ppi_yoy >= 3.5) {
    score -= 1;
    reasons.push("PPI 偏高，企業成本壓力較大");
  }

  // 指數氣氛
  if (sp500_change <= -2) {
    score -= 2;
    reasons.push("S&P 500 單日跌幅較大");
  } else if (sp500_change >= 1.5) {
    score += 1;
    reasons.push("S&P 500 單日表現偏正向");
  }

  if (nasdaq_change <= -2.5) {
    if (["AI_SEMI", "AI_APPLICATION", "PLATFORM"].includes(sector)) {
      score -= 3;
      reasons.push("NASDAQ 單日跌幅較大，科技/AI 壓力升高");
    } else {
      score -= 1;
      reasons.push("NASDAQ 單日跌幅較大");
    }
  } else if (nasdaq_change >= 2) {
    if (["AI_SEMI", "AI_APPLICATION", "PLATFORM"].includes(sector)) {
      score += 2;
      reasons.push("NASDAQ 單日表現偏強，有利科技/AI");
    } else {
      score += 1;
      reasons.push("NASDAQ 單日表現偏強");
    }
  }

  let bias = "neutral";
  if (score >= 3) bias = "positive";
  else if (score <= -3) bias = "negative";

  return {
    score,
    bias,
    reasons
  };
}

// ------------------------------------------
// 3) 純股票分數
// 優先使用 stock.pure_score，沒有就退回 baseline_score
// ------------------------------------------
export function getPureScore(stock = {}) {
  if (Number.isFinite(Number(stock.pure_score))) {
    return Number(stock.pure_score);
  }
  return getBaselineScore(stock);
}

// ------------------------------------------
// 4) 新聞事件分數
// newsList 正式欄位：
// {
//   title,
//   impact: ["NVDA","TSM"] 或 "NVDA",
//   direction: "positive" | "negative" | "neutral",
//   strength: "low" | "medium" | "high",
//   event_score: 數字,
//   reason
// }
// ------------------------------------------
export function evaluateNewsBias(stock = {}, newsList = []) {
  const symbol = safeText(stock.symbol, "");
  let score = 0;
  const reasons = [];
  const matchedNews = [];

  newsList.forEach(news => {
    const impactRaw = news?.impact;
    const impactList = Array.isArray(impactRaw)
      ? impactRaw
      : (typeof impactRaw === "string" && impactRaw ? [impactRaw] : []);

    if (!impactList.includes(symbol)) return;

    const direction = safeText(news.direction, "neutral").toLowerCase();
    const strength = safeText(news.strength, "medium").toLowerCase();
    const baseEventScore = toNumber(news.event_score, 0);

    let weighted = baseEventScore;

    // 若沒給 event_score，則用方向+強度推估
    if (!baseEventScore) {
      if (direction === "positive") weighted = 1;
      else if (direction === "negative") weighted = -1;
      else weighted = 0;

      if (strength === "high") weighted *= 2;
      else if (strength === "medium") weighted *= 1.2;
      else weighted *= 0.8;
    } else {
      if (direction === "negative" && weighted > 0) weighted = -weighted;
    }

    score += weighted;
    matchedNews.push({
      title: safeText(news.title, ""),
      direction,
      strength,
      event_score: weighted,
      reason: safeText(news.reason, "")
    });

    const reasonText = safeText(news.reason, safeText(news.title, "事件影響"));
    reasons.push(`${symbol}：${reasonText}`);
  });

  return { score, reasons, matched_news: matchedNews };
}

// ------------------------------------------
// 5) 股票價格快照
// stockRuntime 格式：
// {
//   NVDA: {
//     price_now,
//     price_ref_1d,
//     price_ref_1w,
//     price_ref_1m,
//     price_ref_3m,
//     price_ref_6m,
//     price_ref_12m,
//     ret_1d,
//     ret_1w,
//     ret_1m,
//     ret_3m,
//     ret_6m,
//     ret_12m
//   }
// }
// ------------------------------------------
export function buildSnapshotInfo(stock = {}, stockRuntime = {}) {
  const symbol = safeText(stock.symbol, "");
  const runtime = stockRuntime?.[symbol] || {};

  const price_now = toNumber(runtime.price_now, null);

  const ret_1d = runtime.ret_1d != null ? toNumber(runtime.ret_1d, null) * 100 : null;
  const ret_1w = runtime.ret_1w != null ? toNumber(runtime.ret_1w, null) * 100 : null;
  const ret_1m = runtime.ret_1m != null ? toNumber(runtime.ret_1m, null) * 100 : null;
  const ret_3m = runtime.ret_3m != null ? toNumber(runtime.ret_3m, null) * 100 : null;
  const ret_6m = runtime.ret_6m != null ? toNumber(runtime.ret_6m, null) * 100 : null;
  const ret_12m = runtime.ret_12m != null ? toNumber(runtime.ret_12m, null) * 100 : null;

  // 如果沒有 ret_3m / ret_6m / ret_12m，也容忍 price_ref 推算
  function calcPct(ref) {
    if (!Number.isFinite(price_now) || !Number.isFinite(ref) || ref === 0) return null;
    return ((price_now - ref) / ref) * 100;
  }

  const delta_1d_pct = Number.isFinite(ret_1d) ? ret_1d : calcPct(toNumber(runtime.price_ref_1d, null));
  const delta_1w_pct = Number.isFinite(ret_1w) ? ret_1w : calcPct(toNumber(runtime.price_ref_1w, null));
  const delta_1m_pct = Number.isFinite(ret_1m) ? ret_1m : calcPct(toNumber(runtime.price_ref_1m, null));
  const delta_3m_pct = Number.isFinite(ret_3m) ? ret_3m : calcPct(toNumber(runtime.price_ref_3m, null));
  const delta_6m_pct = Number.isFinite(ret_6m) ? ret_6m : calcPct(toNumber(runtime.price_ref_6m, null));
  const delta_12m_pct = Number.isFinite(ret_12m) ? ret_12m : calcPct(toNumber(runtime.price_ref_12m, null));

  const momentum_avg = average([
    delta_1d_pct,
    delta_1w_pct,
    delta_1m_pct,
    delta_3m_pct
  ]);

  let snapshot_label = "neutral";
  if (momentum_avg >= 5) snapshot_label = "strong";
  else if (momentum_avg <= -5) snapshot_label = "weak";

  return {
    price_now,
    delta_1d_pct,
    delta_1w_pct,
    delta_1m_pct,
    delta_3m_pct,
    delta_6m_pct,
    delta_12m_pct,
    snapshot_label
  };
}

// ------------------------------------------
// 6) 同 sector 公司
// ------------------------------------------
export function findSameSectorPeers(stock = {}, pool = []) {
  const symbol = safeText(stock.symbol, "");
  const sector = safeText(stock.sector, "");
  const subsector = safeText(stock.subsector, "");

  return safeArray(pool)
    .filter(x => safeText(x.symbol, "") !== symbol)
    .filter(x => safeText(x.sector, "") === sector)
    .map(x => ({
      symbol: safeText(x.symbol, ""),
      name: safeText(x.name, ""),
      subsector: safeText(x.subsector, ""),
      same_subsector: safeText(x.subsector, "") === subsector
    }));
}

// ------------------------------------------
// 7) M1 action
// ------------------------------------------
export function decideM1Action({ pure_score = 0, event_stock_score = 0, snapshot = {} } = {}) {
  const snapshot_label = safeText(snapshot.snapshot_label, "neutral");

  let action = "neutral";
  let reason = "事件與價格訊號中性，建議持續觀察";

  if (pure_score >= 6 && event_stock_score >= 2) {
    action = "worth_considering";
    reason = "Pure score 足夠，事件面偏正向，可考慮納入 FCN basket 或 Pool 觀察";
  } else if (event_stock_score <= -2) {
    action = "not_recommended";
    reason = "事件面偏負向，不建議近期納入 FCN 組合";
  } else if (snapshot_label === "strong" && pure_score >= 5) {
    action = "worth_considering";
    reason = "價格動能偏強，且純股票分數達標";
  } else if (snapshot_label === "weak" && pure_score <= 4) {
    action = "not_recommended";
    reason = "價格動能偏弱，且基礎分數不足";
  }

  return { action, reason };
}

// ------------------------------------------
// 8) 單檔輸出
// ------------------------------------------
export function buildMacroStockSignal(
  stock = {},
  macro = {},
  newsList = [],
  stockRuntime = {},
  pool = []
) {
  const symbol = safeText(stock.symbol, "");
  const name = safeText(stock.name, "");
  const sector = safeText(stock.sector, "");
  const subsector = safeText(stock.subsector, "");
  const category = safeText(stock.category, "");

  const baseline_score = getBaselineScore(stock);
  const pure_score = getPureScore(stock);

  const macroPart = evaluateMacroEnvironment(macro, stock);
  const newsPart = evaluateNewsBias(stock, newsList);

  const event_stock_score = macroPart.score + newsPart.score;
  const snapshot = buildSnapshotInfo(stock, stockRuntime);
  const same_sector_peers = findSameSectorPeers(stock, pool);

  const decision = decideM1Action({
    pure_score,
    event_stock_score,
    snapshot
  });

  return {
    symbol,
    name,
    sector,
    subsector,
    category,

    baseline_score,
    pure_score,
    event_stock_score,

    snapshot,

    same_sector_peers,

    macro_score: macroPart.score,
    news_score: newsPart.score,

    matched_news: newsPart.matched_news,

    m1_action: decision.action,
    reason: [
      ...macroPart.reasons,
      ...newsPart.reasons,
      decision.reason
    ]
  };
}

// ------------------------------------------
// 9) 整個股票池批次輸出
// ------------------------------------------
export function buildMacroStockSignals({
  pool = [],
  macro = {},
  newsList = [],
  stockRuntime = {}
} = {}) {
  const safePool = safeArray(pool);
  return safePool.map(stock =>
    buildMacroStockSignal(stock, macro, newsList, stockRuntime, safePool)
  );
}

// ------------------------------------------
// 10) 舊版接口相容
// ------------------------------------------
export function applyMacroToStock({ macroEvents, stock, stockRuntime, pool, macro }) {
  return buildMacroStockSignal(
    stock,
    macro || {},
    macroEvents || [],
    stockRuntime || {},
    pool || []
  );
}

import { normalizeNewsWithAI } from "./ai_normalizer.js";
import { getCached, setCached } from "./news_cache.js";

/* =========================
   Fallback 規則（AI失敗時）
========================= */
function fallbackNews(item, i) {
  const text = `${item.title || ""} ${item.summary || ""}`.toLowerCase();

  let type = "macro";
  let subtype = "利率下降";
  let sid_label = "中性";
  let sid_score = 1;
  let affected_sectors = ["AI_SEMI"];

  // 利率 / Fed
  if (
    text.includes("fed") ||
    text.includes("rate") ||
    text.includes("yield") ||
    text.includes("treasury")
  ) {
    type = "macro";

    if (
      text.includes("cut") ||
      text.includes("easing") ||
      text.includes("lower rate") ||
      text.includes("rate down")
    ) {
      subtype = "利率下降";
      sid_label = "利多";
      sid_score = 2;
      affected_sectors = ["AI_SEMI", "AI_APPLICATION", "PLATFORM", "ETF"];
    } else {
      subtype = "利率上升";
      sid_label = "利空";
      sid_score = -2;
      affected_sectors = ["AI_SEMI", "AI_APPLICATION", "PLATFORM", "ETF"];
    }
  }

  // 通膨
  else if (
    text.includes("inflation") ||
    text.includes("cpi") ||
    text.includes("ppi")
  ) {
    type = "macro";

    if (
      text.includes("rise") ||
      text.includes("hotter") ||
      text.includes("higher")
    ) {
      subtype = "通膨上升";
      sid_label = "利空";
      sid_score = -2;
      affected_sectors = ["CONSUMER", "TRAVEL", "ETF"];
    } else {
      subtype = "通膨下降";
      sid_label = "利多";
      sid_score = 2;
      affected_sectors = ["CONSUMER", "TRAVEL", "ETF"];
    }
  }

  // 油價 / 能源
  else if (
    text.includes("oil") ||
    text.includes("crude") ||
    text.includes("energy")
  ) {
    type = "macro";

    if (
      text.includes("rise") ||
      text.includes("surge") ||
      text.includes("higher")
    ) {
      subtype = "油價上升";
      sid_label = "利空";
      sid_score = -2;
      affected_sectors = ["TRAVEL", "ENERGY"];
    } else {
      subtype = "油價下跌";
      sid_label = "利多";
      sid_score = 2;
      affected_sectors = ["TRAVEL", "ENERGY"];
    }
  }

  // VIX / 波動
  else if (
    text.includes("vix") ||
    text.includes("volatility") ||
    text.includes("fear")
  ) {
    type = "macro";

    if (
      text.includes("rise") ||
      text.includes("spike") ||
      text.includes("higher")
    ) {
      subtype = "VIX上升";
      sid_label = "利空";
      sid_score = -2;
      affected_sectors = ["AI_SEMI", "AI_APPLICATION", "TRAVEL"];
    } else {
      subtype = "VIX下降";
      sid_label = "利多";
      sid_score = 2;
      affected_sectors = ["AI_SEMI", "AI_APPLICATION", "PLATFORM"];
    }
  }

  // AI / 半導體 / 晶片
  else if (
    text.includes("ai") ||
    text.includes("chip") ||
    text.includes("semiconductor") ||
    text.includes("gpu")
  ) {
    type = "industry";
    subtype = "AI需求強勁";
    sid_label = "利多";
    sid_score = 2;
    affected_sectors = ["AI_SEMI", "AI_APPLICATION"];
  }

  // 旅遊 / 航空 / 郵輪
  else if (
    text.includes("travel") ||
    text.includes("airline") ||
    text.includes("cruise") ||
    text.includes("casino")
  ) {
    type = "industry";
    subtype = "旅遊需求復甦";
    sid_label = "利多";
    sid_score = 2;
    affected_sectors = ["TRAVEL"];
  }

  // 金融 / 銀行 / Fintech / Crypto
  else if (
    text.includes("bank") ||
    text.includes("financial") ||
    text.includes("fintech") ||
    text.includes("crypto")
  ) {
    type = "industry";
    subtype = "金融監管收緊";
    sid_label = "利空";
    sid_score = -1;
    affected_sectors = ["FINANCIAL"];
  }

  return {
    id: "N" + String(i + 1).padStart(3, "0"),
    title: item.title || "",
    summary: item.summary || "",
    source: item.source || "",
    published_at: item.published_at || "",
    type,
    subtype,
    sid_label,
    sid_score,
    affected_sectors,
    affected_subsectors: [],
    affected_categories: [],
    duration: 7,
    confidence: 0.4,
    is_active: true
  };
}

/* =========================
   Main Builder（低成本 + fallback）
========================= */
export async function buildNewsInput(rawNewsList = []) {
  const result = [];

  // ⭐ 成本控制：只取前10則
  const limited = rawNewsList.slice(0, 10);

  for (let i = 0; i < limited.length; i++) {
    const raw = limited[i];

    try {
      // ⭐ 先查 cache
      const cached = getCached(raw.title);
      if (cached) {
        console.log("⚡ cache 命中:", raw.title);
        result.push(cached);
        continue;
      }

      // ⭐ AI 分類
      const normalized = await normalizeNewsWithAI(raw, i + 1);

      // ⭐ 結果存 cache
      setCached(raw.title, normalized);

      result.push(normalized);
      console.log(`🤖 AI OK: ${normalized.id} ${normalized.title}`);
    } catch (err) {
      console.warn(`⚠️ fallback: ${raw.title}`, err);

      const fallback = fallbackNews(raw, i);
      result.push(fallback);
    }
  }

  console.log("💰 成本控制後 news_input =", result);
  return result;
}

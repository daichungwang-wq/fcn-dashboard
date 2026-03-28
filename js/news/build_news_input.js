import { normalizeNewsWithAI } from "./ai_normalizer.js";
import { getCached, setCached } from "./news_cache.js";

/* =========================
   小工具
========================= */
function normalizeType(type = "") {
  const t = String(type || "").toLowerCase().trim();

  if (t === "macro") return "macro";
  if (t === "market") return "market";
  if (t === "industry") return "industry";
  if (t === "stock") return "stock";

  return "macro";
}

function safeArray(arr, fallback = []) {
  return Array.isArray(arr) ? arr : fallback;
}

/* =========================
   Market / Macro / Industry / Stock
   fallback subtype 規則
========================= */
function inferFallbackSubtype(item = {}) {
  const title = String(item.title || "").toLowerCase();
  const summary = String(item.summary || "").toLowerCase();
  const text = `${title} ${summary}`;
  const detectedType = normalizeType(item.detected_type);

  // ---------- market ----------
  if (detectedType === "market") {
    if (
      text.includes("selloff") ||
      text.includes("correction") ||
      text.includes("slump") ||
      text.includes("stocks fall") ||
      text.includes("stocks tumble") ||
      text.includes("market drop") ||
      text.includes("risk-off") ||
      text.includes("risk off")
    ) {
      return {
        type: "market",
        subtype: "risk_off",
        sid_label: "利空",
        sid_score: -2,
        ticker: null,
        affected_sectors: [],
        affected_subsectors: [],
        affected_categories: ["growth", "speculative"]
      };
    }

    if (
      text.includes("rally") ||
      text.includes("rebound") ||
      text.includes("stocks rise") ||
      text.includes("market gains") ||
      text.includes("risk-on") ||
      text.includes("risk on")
    ) {
      return {
        type: "market",
        subtype: "risk_on",
        sid_label: "利多",
        sid_score: 2,
        ticker: null,
        affected_sectors: [],
        affected_subsectors: [],
        affected_categories: ["growth", "speculative"]
      };
    }

    return {
      type: "market",
      subtype: "risk_off",
      sid_label: "利空",
      sid_score: -1,
      ticker: null,
      affected_sectors: [],
      affected_subsectors: [],
      affected_categories: ["growth"]
    };
  }

  // ---------- macro ----------
  if (detectedType === "macro") {
    if (
      text.includes("fed") ||
      text.includes("rate") ||
      text.includes("yield") ||
      text.includes("treasury")
    ) {
      if (
        text.includes("cut") ||
        text.includes("easing") ||
        text.includes("lower") ||
        text.includes("fall")
      ) {
        return {
          type: "macro",
          subtype: "利率下降",
          sid_label: "利多",
          sid_score: 2,
          ticker: null,
          affected_sectors: ["AI_SEMI", "AI_APPLICATION", "PLATFORM", "ETF"],
          affected_subsectors: [],
          affected_categories: []
        };
      }

      return {
        type: "macro",
        subtype: "利率上升",
        sid_label: "利空",
        sid_score: -2,
        ticker: null,
        affected_sectors: ["AI_SEMI", "AI_APPLICATION", "PLATFORM", "ETF"],
        affected_subsectors: [],
        affected_categories: []
      };
    }

    if (
      text.includes("inflation") ||
      text.includes("cpi") ||
      text.includes("ppi")
    ) {
      if (
        text.includes("rise") ||
        text.includes("hotter") ||
        text.includes("higher")
      ) {
        return {
          type: "macro",
          subtype: "通膨上升",
          sid_label: "利空",
          sid_score: -2,
          ticker: null,
          affected_sectors: ["CONSUMER", "TRAVEL", "ETF"],
          affected_subsectors: [],
          affected_categories: []
        };
      }

      return {
        type: "macro",
        subtype: "通膨下降",
        sid_label: "利多",
        sid_score: 2,
        ticker: null,
        affected_sectors: ["CONSUMER", "TRAVEL", "ETF"],
        affected_subsectors: [],
        affected_categories: []
      };
    }

    if (
      text.includes("oil") ||
      text.includes("crude") ||
      text.includes("brent") ||
      text.includes("wti")
    ) {
      if (
        text.includes("rise") ||
        text.includes("surge") ||
        text.includes("higher")
      ) {
        return {
          type: "macro",
          subtype: "油價上升",
          sid_label: "利空",
          sid_score: -2,
          ticker: null,
          affected_sectors: ["TRAVEL", "CONSUMER", "ENERGY", "ETF"],
          affected_subsectors: [],
          affected_categories: []
        };
      }

      return {
        type: "macro",
        subtype: "油價下降",
        sid_label: "利多",
        sid_score: 2,
        ticker: null,
        affected_sectors: ["TRAVEL", "CONSUMER", "ETF"],
        affected_subsectors: [],
        affected_categories: []
      };
    }

    if (text.includes("vix") || text.includes("volatility")) {
      if (
        text.includes("rise") ||
        text.includes("spike") ||
        text.includes("higher")
      ) {
        return {
          type: "macro",
          subtype: "VIX上升",
          sid_label: "利空",
          sid_score: -2,
          ticker: null,
          affected_sectors: ["AI_SEMI", "AI_APPLICATION", "TRAVEL", "ETF"],
          affected_subsectors: [],
          affected_categories: []
        };
      }

      return {
        type: "macro",
        subtype: "VIX下降",
        sid_label: "利多",
        sid_score: 2,
        ticker: null,
        affected_sectors: ["AI_SEMI", "AI_APPLICATION", "PLATFORM", "ETF"],
        affected_subsectors: [],
        affected_categories: []
      };
    }

    return {
      type: "macro",
      subtype: "利率下降",
      sid_label: "中性",
      sid_score: 1,
      ticker: null,
      affected_sectors: ["AI_SEMI"],
      affected_subsectors: [],
      affected_categories: []
    };
  }

  // ---------- industry ----------
  if (detectedType === "industry") {
    if (
      text.includes("ai") ||
      text.includes("chip") ||
      text.includes("semiconductor") ||
      text.includes("gpu")
    ) {
      return {
        type: "industry",
        subtype: "AI需求強勁",
        sid_label: "利多",
        sid_score: 2,
        ticker: null,
        affected_sectors: ["AI_SEMI", "AI_APPLICATION"],
        affected_subsectors: [],
        affected_categories: []
      };
    }

    if (
      text.includes("travel") ||
      text.includes("airline") ||
      text.includes("cruise") ||
      text.includes("casino")
    ) {
      return {
        type: "industry",
        subtype: "旅遊需求復甦",
        sid_label: "利多",
        sid_score: 2,
        ticker: null,
        affected_sectors: ["TRAVEL"],
        affected_subsectors: [],
        affected_categories: []
      };
    }

    if (
      text.includes("bank") ||
      text.includes("financial") ||
      text.includes("fintech")
    ) {
      return {
        type: "industry",
        subtype: "金融監管收緊",
        sid_label: "利空",
        sid_score: -1,
        ticker: null,
        affected_sectors: ["FINANCIAL"],
        affected_subsectors: [],
        affected_categories: []
      };
    }

    return {
      type: "industry",
      subtype: "AI需求強勁",
      sid_label: "中性",
      sid_score: 1,
      ticker: null,
      affected_sectors: ["AI_APPLICATION"],
      affected_subsectors: [],
      affected_categories: []
    };
  }

  // ---------- stock ----------
  return {
    type: "stock",
    subtype: "個股消息",
    sid_label: "中性",
    sid_score: 1,
    ticker: item.ticker || null,
    affected_sectors: [],
    affected_subsectors: [],
    affected_categories: []
  };
}

/* =========================
   fallback
========================= */
function fallbackNews(item, i) {
  const inferred = inferFallbackSubtype(item);

  return {
    id: "N" + String(i + 1).padStart(3, "0"),
    title: item.title || "",
    summary: item.summary || "",
    source: item.source || "",
    published_at: item.published_at || "",
    type: inferred.type,
    subtype: inferred.subtype,
    sid_label: inferred.sid_label,
    sid_score: inferred.sid_score,
    ticker: inferred.ticker,
    affected_sectors: safeArray(inferred.affected_sectors),
    affected_subsectors: safeArray(inferred.affected_subsectors),
    affected_categories: safeArray(inferred.affected_categories),
    duration: 7,
    confidence: 0.4,
    is_active: true,
    detected_type: normalizeType(item.detected_type),
    _filter_score: item._filter_score || 0,
    _filter_meta: item._filter_meta || {}
  };
}

/* =========================
   轉成 M1 可用的標準格式
========================= */
function normalizeOutput(item = {}, fallbackItem = {}) {
  const finalType = normalizeType(item.type || fallbackItem.type);
  const finalSubtype = item.subtype || fallbackItem.subtype || "未分類";

  return {
    id: item.id || fallbackItem.id || "",
    title: item.title || fallbackItem.title || "",
    summary: item.summary || fallbackItem.summary || "",
    source: item.source || fallbackItem.source || "",
    published_at: item.published_at || fallbackItem.published_at || "",
    type: finalType,
    subtype: finalSubtype,
    sid_label: item.sid_label || fallbackItem.sid_label || "中性",
    sid_score: Number.isFinite(Number(item.sid_score))
      ? Number(item.sid_score)
      : Number(fallbackItem.sid_score || 0),
    ticker: item.ticker || fallbackItem.ticker || null,
    affected_sectors: safeArray(item.affected_sectors, fallbackItem.affected_sectors || []),
    affected_subsectors: safeArray(item.affected_subsectors, fallbackItem.affected_subsectors || []),
    affected_categories: safeArray(item.affected_categories, fallbackItem.affected_categories || []),
    duration: Number.isFinite(Number(item.duration))
      ? Number(item.duration)
      : Number(fallbackItem.duration || 7),
    confidence: Number.isFinite(Number(item.confidence))
      ? Number(item.confidence)
      : Number(fallbackItem.confidence || 0.5),
    is_active: item.is_active !== false,
    detected_type: normalizeType(item.detected_type || fallbackItem.detected_type),
    _filter_score: item._filter_score ?? fallbackItem._filter_score ?? 0,
    _filter_meta: item._filter_meta || fallbackItem._filter_meta || {}
  };
}

/* =========================
   Main Builder
========================= */
export async function buildNewsInput(rawNewsList = []) {
  const result = [];

  for (let i = 0; i < rawNewsList.length; i++) {
    const raw = rawNewsList[i];

    try {
      const cached = getCached(raw.title);
      if (cached) {
        const mergedCached = normalizeOutput(
          {
            ...cached,
            detected_type: raw.detected_type || cached.detected_type,
            _filter_score: raw._filter_score ?? cached._filter_score,
            _filter_meta: raw._filter_meta || cached._filter_meta
          },
          fallbackNews(raw, i)
        );

        console.log("⚡ cache 命中:", raw.title, mergedCached.type, mergedCached.subtype);
        result.push(mergedCached);
        continue;
      }

      const normalized = await normalizeNewsWithAI(raw, i + 1);
      const merged = normalizeOutput(
        {
          ...normalized,
          detected_type: raw.detected_type || normalized.detected_type,
          _filter_score: raw._filter_score ?? normalized._filter_score,
          _filter_meta: raw._filter_meta || normalized._filter_meta
        },
        fallbackNews(raw, i)
      );

      setCached(raw.title, merged);

      result.push(merged);
      console.log(`🤖 AI OK: ${merged.id} ${merged.type} ${merged.subtype} ${merged.title}`);
    } catch (err) {
      console.warn(`⚠️ fallback: ${raw.title}`, err);

      const fallback = fallbackNews(raw, i);
      result.push(fallback);
    }
  }

  console.log("💰 成本控制後 news_input =", result);
  console.log(
    "📊 news_input type summary =",
    result.reduce(
      (acc, x) => {
        acc[x.type] = (acc[x.type] || 0) + 1;
        return acc;
      },
      {}
    )
  );

  return result;
}

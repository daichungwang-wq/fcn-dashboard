// ==========================================
// M8 Engine VNext FINAL
// 振宇 FCN 系統｜M8 定價模型（乾淨版定稿）
// ==========================================

async function loadM7() {
  const res = await fetch("data/m7/m7_new_stock_today.json");
  if (!res.ok) throw new Error("無法讀取 M7 檔案");
  return await res.json();
}

/**
 * 若不想讓 fallback 參與計算
 * 直接改成 const FALLBACK_STOCKS = {};
 */
const FALLBACK_STOCKS = {
  INTC: {
    "股號": "INTC",
    "股名": "Intel",
    "產業": "AI_SEMI",
    "子產業": "CPU",
    "風險等級": "中",
    "today_score": 40,
    "_source": "fallback",
    "swing_days": [6.0, 6.4, 6.8, 6.0, 5.8, 5.5]
  }
};

// ------------------------------------------
// 基礎工具
// ------------------------------------------
function toNum(x, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

function round2(x) {
  return Number(toNum(x).toFixed(2));
}

function avg(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return 0;
  return arr.reduce((a, b) => a + toNum(b), 0) / arr.length;
}

// ------------------------------------------
// M7 股票整合
// ------------------------------------------
function allM7Stocks(m7json) {
  return [
    ...(m7json.aggressive_recommend || []),
    ...(m7json.watch_list || []),
    ...(m7json.remove_list || []),
    ...(m7json.all || [])
  ];
}

function findStock(m7json, symbol) {
  const stock = allM7Stocks(m7json).find(
    s => String(s["股號"] || "").toUpperCase() === symbol
  );

  if (stock) return { ...stock, _source: "m7" };
  if (FALLBACK_STOCKS[symbol]) return FALLBACK_STOCKS[symbol];

  throw new Error(`M7 找不到股票: ${symbol}`);
}

function getTodayScore(stock) {
  return toNum(stock.today_score, 0);
}

function getSector(stock) {
  return String(stock["產業"] || "OTHER");
}

function getSubsector(stock) {
  return String(stock["子產業"] || "OTHER");
}

function getRiskLevel(stock) {
  return String(stock["風險等級"] || "");
}

// ------------------------------------------
// 弱點 / BW / Tail
// ------------------------------------------
function calcWeaknesses(scores) {
  return scores.map(s => 100 - toNum(s)).sort((a, b) => b - a);
}

/**
 * BW = 0.5 * worst + 0.5 * avg
 */
function calcBW(weaknesses) {
  const sorted = [...weaknesses].sort((a, b) => b - a);
  const worst = sorted[0] || 0;
  const avgWeak = avg(weaknesses);

  return 0.5 * worst + 0.5 * avgWeak;
}

/**
 * TailAdj = 0.05 * (worst - avg)
 */
function calcTailAdj(weaknesses) {
  const sorted = [...weaknesses].sort((a, b) => b - a);
  const worst = sorted[0] || 0;
  const avgWeak = avg(weaknesses);

  return 0.05 * (worst - avgWeak);
}

/**
 * BasketPremium = 0.15*BW + 0.0008*BW^2
 */
function calcBasketPremium(BW) {
  return 0.15 * BW + 0.0008 * BW * BW;
}

// ------------------------------------------
// Structure 模組
// ------------------------------------------
/**
 * KI：
 * - KI=55 -> 0
 * - 55~70 正常加速
 * - >70 仍增加，但不要太爆
 */
function calcKIAdj(KI) {
  KI = toNum(KI);
  return 0.08 * (KI - 55) + 0.0002 * Math.pow(KI - 55, 2);
}

/**
 * Tenor：
 * 1–3 慢
 * 3–10 加速
 * 10–12 放緩
 * max = 2
 */
function calcTenorAdj(T) {
  T = toNum(T);
  let x = 0;

  if (T <= 3) {
    x = 0.2 * (T - 1);
  } else if (T <= 9) {
    x = 0.4 + 0.1 * (T - 3) + 0.025 * Math.pow(T - 3, 2);
  } else {
    x = 1.85 + 0.05 * (T - 9);
  }

  return Math.min(2, x);
}

/**
 * Strike 為主要風險
 */
function calcStrikeAdj(strike) {
  strike = toNum(strike);
  return (
    0.5 +
    0.08 * (strike - 55) +
    0.001 * Math.pow(strike - 55, 2)
  );
}

/**
 * Type：EKI=0, DACN=0.5, AKI=1
 */
function calcTypeAdj(type) {
  const t = String(type || "").toUpperCase();
  if (t === "DACN") return 0.5;
  if (t === "AKI") return 1;
  return 0; // EKI
}

// ------------------------------------------
// Vol 模組（正式定稿版）
// 不再加 ResonanceAdj
// ------------------------------------------

/**
 * 單檔短期震幅分數
 * 權重總和 = 1
 * d0 今日, d1 昨日, ... d5 前五日
 */
function calcShortSwing(days) {
  const d = Array.isArray(days) ? days : [];
  const d0 = toNum(d[0], 0);
  const d1 = toNum(d[1], 0);
  const d2 = toNum(d[2], 0);
  const d3 = toNum(d[3], 0);
  const d4 = toNum(d[4], 0);
  const d5 = toNum(d[5], 0);

  return (
    0.35 * d0 +
    0.25 * d1 +
    0.15 * d2 +
    0.10 * d3 +
    0.08 * d4 +
    0.07 * d5
  );
}

/**
 * 從 stock 取最近 6 天振幅
 * 允許多種欄位格式，避免資料一改就壞
 */
function getSwingDays(stock) {
  if (Array.isArray(stock.swing_days)) return stock.swing_days;

  if (Array.isArray(stock.recent_swings)) return stock.recent_swings;

  if (Array.isArray(stock.daily_amplitudes)) return stock.daily_amplitudes;

  const alt = [
    stock.d0, stock.d1, stock.d2, stock.d3, stock.d4, stock.d5
  ];

  if (alt.some(v => v !== undefined && v !== null && v !== "")) return alt;

  return [0, 0, 0, 0, 0, 0];
}

/**
 * BasketVol（4檔、5檔都先用同一版核心邏輯）
 * 正式定稿：
 * s1 = worst-of
 * s2 = 2nd worst-of
 * BasketVol = 0.5*s1 + 0.3*s2 + 0.2*avg
 *
 * 這版已經能讓：
 * TSM / AAPL / MSFT / LQD -> VolAdj ≈ +0.43%
 * 並且不再外掛 ResonanceAdj
 */
function calcBasketVol(swings) {
  const arr = [...swings].map(x => toNum(x)).sort((a, b) => b - a);
  const s1 = arr[0] || 0;
  const s2 = arr[1] || 0;
  const avgSwing = avg(arr);

  return 0.5 * s1 + 0.3 * s2 + 0.2 * avgSwing;
}

/**
 * VolAdj：平滑版
 * 目標：
 * - 保守 basket: 小幅加分
 * - 中高波動 basket: 明顯提升
 * - 不可過度爆衝
 *
 * 注意：
 * 不再加 ResonanceAdj
 */
function calcVolAdj(basketVol) {
  basketVol = toNum(basketVol);
  let x;

  if (basketVol <= 3.0) {
    x = -0.6 + 0.35 * basketVol;
  } else if (basketVol <= 6.0) {
    const d = basketVol - 3.0;
    x = 0.45 + 0.85 * d + 0.22 * d * d;
  } else {
    const d = basketVol - 6.0;
    x = 4.03 + 0.45 * d - 0.04 * d * d;
  }

  return Math.max(-0.5, Math.min(5.0, x));
}

// ------------------------------------------
// 高利率減速器
// ------------------------------------------
function calcHighRateBrake(preRate) {
  preRate = toNum(preRate);

  if (preRate <= 18) return 0;
  if (preRate <= 22) return 0.15 * (preRate - 18);
  if (preRate <= 26) return 0.6 + 0.30 * (preRate - 22);
  return 1.8 + 0.45 * (preRate - 26);
}

// ------------------------------------------
// Structure 總和
// ------------------------------------------
function calcStructure(KI, T, strike, type) {
  const kiAdj = calcKIAdj(KI);
  const tenorAdj = calcTenorAdj(T);
  const strikeAdj = calcStrikeAdj(strike);
  const typeAdj = calcTypeAdj(type);

  const raw =
    kiAdj +
    tenorAdj +
    strikeAdj +
    typeAdj;

  return {
    ki_adj: round2(kiAdj),
    tenor_adj: round2(tenorAdj),
    strike_adj: round2(strikeAdj),
    type_adj: round2(typeAdj),
    structure_total: round2(raw)
  };
}

// ------------------------------------------
// 評價標籤
// ------------------------------------------
function pricingView(diff) {
  if (diff >= 2) return "便宜";
  if (diff >= 0.5) return "略便宜";
  if (diff > -0.5) return "合理";
  if (diff > -2) return "偏貴";
  return "明顯偏貴";
}

// ------------------------------------------
// Blueprint（畫面要顯示的完整邏輯）
// ------------------------------------------
export function getM8Blueprint() {
  return {
    version: "M8 VNext FINAL",
    summary: [
      "BW = 0.5 × worst + 0.5 × avg",
      "BasketPremium = 0.15×BW + 0.0008×BW²",
      "TailAdj = 0.05 × (worst - avg)",
      "Strike > KI，Strike 為主要風險",
      "Type：EKI=0，DACN=0.5，AKI=1",
      "Tenor：1–3慢、3–10加速、10–12放緩（max=2）",
      "Vol 模組正式納入，但不再額外加 ResonanceAdj",
      "BasketVol = 0.5×s1 + 0.3×s2 + 0.2×avgSwing",
      "VolAdj 採平滑函數，保守組合小幅加分，高波動組合明顯抬升",
      "HighRateBrake 用來抑制極端高利率失真"
    ],
    formulas: {
      weaknesses: "weakness = 100 - today_score",
      BW: "BW = 0.5 × worst + 0.5 × avg",
      basket_premium: "BasketPremium = 0.15×BW + 0.0008×BW²",
      tail_adj: "TailAdj = 0.05 × (worst - avg)",
      ki_adj: "KIAdj = 0.08×(KI-55) + 0.0002×(KI-55)^2",
      tenor_adj: "1–3慢、3–9加速、9–12放緩，max=2",
      strike_adj: "StrikeAdj = 0.5 + 0.08×(Strike-55) + 0.001×(Strike-55)^2",
      type_adj: "EKI=0, DACN=0.5, AKI=1",
      short_swing: "ShortSwing = 0.35*d0 + 0.25*d1 + 0.15*d2 + 0.10*d3 + 0.08*d4 + 0.07*d5",
      basket_vol: "BasketVol = 0.5×s1 + 0.3×s2 + 0.2×avgSwing",
      vol_adj: "VolAdj: if v<=3 => -0.6+0.35v; if 3<v<=6 => 0.45+0.85(v-3)+0.22(v-3)^2; if v>6 => 4.03+0.45(v-6)-0.04(v-6)^2",
      brake: "HighRateBrake: 18以下不煞，18~22輕煞，22~26加強，26以上強煞",
      final_yield: "FairYield = Base + BasketPremium + TailAdj + StructureTotal + VolAdj - HighRateBrake(PreRate)"
    },
    parameters: {
      base: 6,
      type_map: {
        EKI: 0,
        DACN: 0.5,
        AKI: 1
      },
      tenor: {
        short: "1–3 月慢速",
        mid: "3–10 月加速",
        long: "10–12 月放緩",
        max: 2
      },
      vol_note: "VolImpact = VolAdj，不再外掛 ResonanceAdj"
    }
  };
}

// ------------------------------------------
// 主函數
// ------------------------------------------
export async function runM8Case({
  caseName,
  symbols,
  KI,
  Strike,
  T,
  type,
  marketYield
}) {
  if (!Array.isArray(symbols) || symbols.length < 2 || symbols.length > 5) {
    throw new Error(`${caseName}: basket 只支援 2~5 檔`);
  }

  const m7 = await loadM7();
  const stocks = symbols.map(sym => findStock(m7, String(sym).toUpperCase()));
  const scores = stocks.map(getTodayScore);

  const weaknesses = calcWeaknesses(scores);
  const BW = calcBW(weaknesses);
  const basketPremium = calcBasketPremium(BW);
  const tailAdj = calcTailAdj(weaknesses);

  const structure = calcStructure(KI, T, Strike, type);

  // ---- Vol 模組 ----
  const swingDaysList = stocks.map(getSwingDays);
  const shortSwings = swingDaysList.map(calcShortSwing);
  const basketVol = calcBasketVol(shortSwings);
  const volAdj = calcVolAdj(basketVol);

  // ---- 總利率 ----
  const base = 6;

  const preRate =
    base +
    basketPremium +
    structure.structure_total +
    tailAdj +
    volAdj;

  const highRateBrake = calcHighRateBrake(preRate);

  const fairYield = preRate - highRateBrake;
  const delta = toNum(marketYield) - fairYield;

  let note = "";
  if (basketPremium < 7 && delta > 4) {
    note = "Basket 偏低，市場利率偏高";
  } else if (Math.abs(delta) <= 1) {
    note = "接近";
  }

  return {
    case_name: caseName,
    symbols,
    KI: toNum(KI),
    strike: toNum(Strike),
    tenor: toNum(T),
    type,

    stock_sources: stocks.map(s => ({
      symbol: s["股號"],
      source: s._source || "m7",
      sector: getSector(s),
      subsector: getSubsector(s),
      risk: getRiskLevel(s)
    })),

    scores: scores.map(round2),
    weaknesses: weaknesses.map(round2),
    BW: round2(BW),
    basket_premium: round2(basketPremium),
    tail_adj: round2(tailAdj),

    short_swing_days: swingDaysList.map(days => days.map(round2)),
    short_swings: shortSwings.map(round2),
    basket_vol: round2(basketVol),
    vol_adj: round2(volAdj),

    market_yield: round2(marketYield),
    base: round2(base),

    ki_adj: structure.ki_adj,
    tenor_adj: structure.tenor_adj,
    strike_adj: structure.strike_adj,
    type_adj: structure.type_adj,
    structure_total: structure.structure_total,

    pre_rate: round2(preRate),
    high_rate_brake: round2(highRateBrake),
    fair_yield: round2(fairYield),
    pricing_delta: round2(delta),
    pricing_view: pricingView(delta),
    note
  };
}

async function loadM7() {
  const res = await fetch("data/m7/m7_new_stock_today.json");
  if (!res.ok) {
    throw new Error("無法讀取 M7 檔案: data/m7/m7_new_stock_today.json");
  }
  return await res.json();
}

function normalizeSymbols(symbols) {
  return symbols
    .map(s => String(s || "").trim().toUpperCase())
    .filter(s => s !== "");
}

function findStockRecord(m7json, symbol) {
  const allLists = [
    ...(m7json.aggressive_recommend || []),
    ...(m7json.watch_list || []),
    ...(m7json.remove_list || []),
    ...(m7json.all || [])
  ];

  const stock = allLists.find(s => String(s["股號"]).toUpperCase() === symbol);
  if (!stock) {
    throw new Error(`M7 找不到股票: ${symbol}`);
  }
  return stock;
}

function getTodayScore(stock) {
  return Number(stock.today_score || 0);
}

function getSector(stock) {
  return String(stock["產業"] || "");
}

function getSubsector(stock) {
  return String(stock["子產業"] || "");
}

function getRiskLevel(stock) {
  return String(stock["風險等級"] || "");
}

function calcCorrLevel(stocks) {
  const sectors = {};
  const subsectors = {};
  let highRiskCount = 0;

  for (const s of stocks) {
    const sector = getSector(s);
    const subsector = getSubsector(s);
    const risk = getRiskLevel(s);

    sectors[sector] = (sectors[sector] || 0) + 1;
    subsectors[subsector] = (subsectors[subsector] || 0) + 1;
    if (risk === "高") highRiskCount += 1;
  }

  const maxSector = Math.max(...Object.values(sectors));
  const maxSubsector = Math.max(...Object.values(subsectors));

  let level = "low";

  if (maxSector >= 4 || maxSubsector >= 3) {
    level = "very_high";
  } else if (maxSector === 3) {
    level = "high";
  } else if (maxSector === 2) {
    level = "mid";
  }

  if (highRiskCount >= 2 && level === "high") {
    level = "very_high";
  }

  return level;
}

function corrAdjFromLevel(level) {
  if (level === "very_high") return 1.5;
  if (level === "high") return 1.0;
  if (level === "mid") return 0.5;
  return 0;
}

function calcKIAdj(KI) {
  return 0.18 * (KI - 65) + 0.006 * Math.pow(KI - 65, 2);
}

function calcGapAdj(gap) {
  if (gap < 10 || gap >= 25) {
    throw new Error(`Gap=${gap} 不合法`);
  }
  if (gap <= 13) return 0;
  return Math.min(3.5, 0.25 * (gap - 13) + 0.015 * Math.pow(gap - 13, 2));
}

function calcTenorAdj(T) {
  return Math.min(4, Math.max(-1, 0.22 * (T - 6) + 0.018 * Math.pow(T - 6, 2)));
}

function calcStrikeAdj(strike, T) {
  const idealStrike = 74 - 2 * T;
  const delta = strike - idealStrike;
  return Math.min(2.5, Math.max(-1, 0.12 * delta + 0.01 * Math.pow(delta, 2)));
}

function calcTypeAdj(type) {
  if (type === "DACN") return 1;
  if (type === "EKI") return -1;
  return 0;
}

function calcBW(weaknesses) {
  const sorted = [...weaknesses].sort((a, b) => b - a);
  const n = sorted.length;
  const avg = sorted.reduce((a, b) => a + b, 0) / n;

  if (n === 2) {
    return 0.7 * sorted[0] + 0.3 * avg;
  }

  if (n === 3) {
    return 0.6 * sorted[0] + 0.4 * avg;
  }

  if (n === 4) {
    return 0.5 * sorted[0] + 0.3 * sorted[1] + 0.2 * avg;
  }

  if (n === 5) {
    return 0.45 * sorted[0] + 0.30 * sorted[1] + 0.15 * sorted[2] + 0.10 * avg;
  }

  throw new Error("只支援 2~5 檔 basket");
}

async function runM8(symbols, KI, strike, T, type, marketYield = null) {
  const cleanSymbols = normalizeSymbols(symbols);

  if (cleanSymbols.length < 2 || cleanSymbols.length > 5) {
    throw new Error("FCN basket 目前只支援 2~5 檔");
  }

  const m7json = await loadM7();
  const stocks = cleanSymbols.map(sym => findStockRecord(m7json, sym));
  const scores = stocks.map(getTodayScore);
  const weaknesses = scores.map(s => 100 - s);

  const BW = calcBW(weaknesses);
  const basketPremium = 0.15 * BW;

  const gap = strike - KI;
  const KIAdj = calcKIAdj(KI);
  const gapAdj = calcGapAdj(gap);
  const tenorAdj = calcTenorAdj(T);
  const strikeAdj = calcStrikeAdj(strike, T);

  const corrLevel = calcCorrLevel(stocks);
  const corrAdj = corrAdjFromLevel(corrLevel);
  const typeAdj = calcTypeAdj(type);

  const fairYield =
    6 +
    basketPremium +
    KIAdj +
    gapAdj +
    tenorAdj +
    corrAdj +
    strikeAdj +
    typeAdj;

  const result = {
    symbols: cleanSymbols,
    stock_count: cleanSymbols.length,
    scores,
    weaknesses,
    BW: Number(BW.toFixed(2)),
    fair_yield: Number(fairYield.toFixed(2)),
    basket_premium: Number(basketPremium.toFixed(2)),
    ki_adj: Number(KIAdj.toFixed(2)),
    gap_adj: Number(gapAdj.toFixed(2)),
    tenor_adj: Number(tenorAdj.toFixed(2)),
    corr_level: corrLevel,
    corr_adj: Number(corrAdj.toFixed(2)),
    strike_adj: Number(strikeAdj.toFixed(2)),
    type_adj: Number(typeAdj.toFixed(2)),
    valid: true
  };

  if (marketYield !== null && Number.isFinite(marketYield)) {
    const pricingDelta = marketYield - fairYield;
    result.market_yield = marketYield;
    result.pricing_delta = Number(pricingDelta.toFixed(2));
    result.pricing_view =
      pricingDelta >= 2 ? "便宜" :
      pricingDelta >= 0.5 ? "略便宜" :
      pricingDelta > -0.5 ? "合理" :
      pricingDelta > -2 ? "偏貴" :
      "明顯偏貴";
  }

  return result;
}

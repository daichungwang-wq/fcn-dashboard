// ============================================
// 振宇 FCN 系統 - M1 Event Engine V4（最終版）
// ============================================

/*
核心升級：
1. Macro = sid × sector × sensitivity
2. macro_avg = total / news_count
3. event_score = 加權平均
*/

// ========= 工具 =========
function toNumber(v, def = 0) {
  const n = Number(v);
  return isNaN(n) ? def : n;
}

function addImpact(map, symbol, score, newsId) {
  if (!map[symbol]) {
    map[symbol] = { total: 0, news_ids: [] };
  }
  map[symbol].total += score;

  if (newsId && !map[symbol].news_ids.includes(newsId)) {
    map[symbol].news_ids.push(newsId);
  }
}

function getStockSensitivity(symbol, subtype, sensitivityMap) {
  return (
    sensitivityMap?.[symbol]?.[subtype] ??
    1
  );
}

// ========= Sector → Stocks =========
function getStocksBySector(sector, sectorMap) {
  return sectorMap?.[sector] || [];
}

// ============================================
// 1️⃣ Macro Engine（V4 核心）
// ============================================

function buildMacroImpactMap(
  newsList,
  impactTable,
  sectorMap,
  stockSensitivityMap
) {
  const result = {};

  newsList.forEach((news) => {
    const subtype = news.subtype;
    const sid = toNumber(news.sid_score, 0);
    const newsId = news.id;

    const weightTable = impactTable?.[subtype] || {};

    const affectedSectors =
      Array.isArray(news.affected_sectors) &&
      news.affected_sectors.length > 0
        ? news.affected_sectors
        : Object.keys(weightTable);

    affectedSectors.forEach((sector) => {
      const sectorWeight = toNumber(weightTable[sector], 0);
      if (sectorWeight === 0) return;

      const stocks = getStocksBySector(sector, sectorMap);

      stocks.forEach((symbol) => {
        const sensitivity = getStockSensitivity(
          symbol,
          subtype,
          stockSensitivityMap
        );

        const score = sid * sectorWeight * sensitivity;

        addImpact(result, symbol, score, newsId);
      });
    });
  });

  return result;
}

// ============================================
// 2️⃣ Industry（簡化版）
// ============================================

function buildIndustryImpactMap(newsList, sectorMap) {
  const result = {};

  newsList.forEach((news) => {
    if (news.type !== "industry") return;

    const score = toNumber(news.sid_score, 0);
    const sectors = news.affected_sectors || [];

    sectors.forEach((sector) => {
      const stocks = getStocksBySector(sector, sectorMap);

      stocks.forEach((symbol) => {
        addImpact(result, symbol, score, news.id);
      });
    });
  });

  return result;
}

// ============================================
// 3️⃣ Market（簡化版）
// ============================================

function buildMarketImpactMap(newsList, pool) {
  const result = {};

  newsList.forEach((news) => {
    if (news.type !== "market") return;

    const score = toNumber(news.sid_score, 0);

    pool.forEach((stock) => {
      addImpact(result, stock.symbol, score, news.id);
    });
  });

  return result;
}

// ============================================
// 4️⃣ 組合計算（最重要）
// ============================================

function combineScores(
  macroMap,
  industryMap,
  marketMap
) {
  const result = {};
  const allSymbols = new Set([
    ...Object.keys(macroMap),
    ...Object.keys(industryMap),
    ...Object.keys(marketMap),
  ]);

  allSymbols.forEach((symbol) => {
    const macro = macroMap[symbol] || { total: 0, news_ids: [] };
    const industry = industryMap[symbol] || { total: 0, news_ids: [] };
    const market = marketMap[symbol] || { total: 0, news_ids: [] };

    const macro_avg =
      macro.news_ids.length > 0
        ? macro.total / macro.news_ids.length
        : 0;

    const industry_avg =
      industry.news_ids.length > 0
        ? industry.total / industry.news_ids.length
        : 0;

    const market_avg =
      market.news_ids.length > 0
        ? market.total / market.news_ids.length
        : 0;

    // 🔥 最終權重（可調）
    const event_score =
      macro_avg * 0.5 +
      industry_avg * 0.3 +
      market_avg * 0.2;

    result[symbol] = {
      event_score,
      macro_avg,
      industry_avg,
      market_avg,
      news_count: macro.news_ids.length,
    };
  });

  return result;
}

// ============================================
// 5️⃣ 主入口
// ============================================

export function buildNewsRuntime({
  newsList,
  pool,
  impactTable,
  sectorMap,
  stockSensitivityMap,
}) {
  // 1. Macro
  const macroMap = buildMacroImpactMap(
    newsList,
    impactTable,
    sectorMap,
    stockSensitivityMap
  );

  // 2. Industry
  const industryMap = buildIndustryImpactMap(
    newsList,
    sectorMap
  );

  // 3. Market
  const marketMap = buildMarketImpactMap(
    newsList,
    pool
  );

  // 4. Combine
  const combined = combineScores(
    macroMap,
    industryMap,
    marketMap
  );

  // 5. 排序 Top 10
  const top10 = Object.entries(combined)
    .map(([symbol, data]) => ({
      symbol,
      ...data,
    }))
    .sort((a, b) => b.event_score - a.event_score)
    .slice(0, 10);

  return {
    combined,
    top10,
  };
}

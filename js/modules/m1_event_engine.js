function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function avg(arr = []) {
  if (!Array.isArray(arr) || arr.length === 0) return 0;
  return arr.reduce((sum, x) => sum + toNumber(x, 0), 0) / arr.length;
}

function round(value, digits = 4) {
  return Number(toNumber(value, 0).toFixed(digits));
}

function getStocksBySector(sector, sectorMap) {
  return Array.isArray(sectorMap?.[sector]) ? sectorMap[sector] : [];
}

function addImpact(targetMap, symbol, score, newsId) {
  if (!targetMap[symbol]) {
    targetMap[symbol] = { total: 0, scores: [], news_ids: [] };
  }
  targetMap[symbol].total += score;
  targetMap[symbol].scores.push(score);
  if (!targetMap[symbol].news_ids.includes(newsId)) {
    targetMap[symbol].news_ids.push(newsId);
  }
}

function getMaxSensitivity(map = {}) {
  let max = 1;
  Object.values(map).forEach((v) => {
    Object.values(v || {}).forEach((x) => {
      if (x > max) max = x;
    });
  });
  return max;
}

/* ===== Macro ===== */
function buildMacroImpactMap(news, impactTable, sectorMap, sensitivityMap, max) {
  const result = {};
  const sid = toNumber(news.sid_score);
  const table = impactTable?.[news.subtype] || {};

  const sectors = news.affected_sectors?.length
    ? news.affected_sectors
    : Object.keys(table);

  sectors.forEach((sector) => {
    const weight = toNumber(table[sector]);
    if (!weight) return;

    const stocks = getStocksBySector(sector, sectorMap);

    stocks.forEach((symbol) => {
      const s = sensitivityMap?.[symbol]?.[news.subtype] ?? 1;
      const score = sid * (weight / 3) * (s / max);
      addImpact(result, symbol, score, news.id);
    });
  });

  return result;
}

/* ===== Industry ===== */
function buildIndustryImpactMap(news, stockPool, sensitivityMap, max) {
  const result = {};
  const sid = toNumber(news.sid_score);

  stockPool.forEach((stock) => {
    const hitSector = news.affected_sectors?.includes(stock.sector) || false;
    const hitSub = news.affected_subsectors?.includes(stock.subsector) || false;

    // ✅ 修正：sector 或 subsector 任一命中即可
    if (!hitSector && !hitSub) return;

    const s = sensitivityMap?.[stock.symbol]?.[news.subtype] ?? 1;
    const score = sid * (3 / 3) * (s / max);

    addImpact(result, stock.symbol, score, news.id);
  });

  return result;
}

/* ===== Market ===== */
function buildMarketImpactMap(news, ruleTable, stockPool) {
  const result = {};
  const sid = toNumber(news.sid_score);
  const rule = ruleTable?.[news.subtype] || {};

  stockPool.forEach((stock) => {
    const r = toNumber(rule[stock.category]);
    if (!r) return;
    addImpact(result, stock.symbol, sid * r, news.id);
  });

  return result;
}

/* ===== Main ===== */
export function buildStockEventMap(
  newsItems,
  impactTable,
  sectorMap,
  marketRuleTable,
  stockPool,
  sensitivityMap
) {
  const map = {};
  const max = getMaxSensitivity(sensitivityMap);

  // ⭐ 先建立全部30檔
  stockPool.forEach((s) => {
    map[s.symbol] = {
      macro_scores: [],
      industry_scores: [],
      market_scores: [],
      macro_avg: 0,
      industry_avg: 0,
      market_avg: 0,
      event_score: 0,
      news_count: 0,
      active_news_ids: []
    };
  });

  newsItems.forEach((news) => {
    if (!news.is_active) return;

    let impact = {};

    if (news.type === "macro") {
      impact = buildMacroImpactMap(
        news,
        impactTable,
        sectorMap,
        sensitivityMap,
        max
      );
    } else if (news.type === "industry") {
      impact = buildIndustryImpactMap(
        news,
        stockPool,
        sensitivityMap,
        max
      );
    } else if (news.type === "market") {
      impact = buildMarketImpactMap(news, marketRuleTable, stockPool);
    }

    Object.entries(impact).forEach(([symbol, v]) => {
      const score = v.total;

      if (news.type === "macro") map[symbol].macro_scores.push(score);
      if (news.type === "industry") map[symbol].industry_scores.push(score);
      if (news.type === "market") map[symbol].market_scores.push(score);

      v.news_ids.forEach((id) => {
        if (!map[symbol].active_news_ids.includes(id)) {
          map[symbol].active_news_ids.push(id);
        }
      });
    });
  });

  Object.keys(map).forEach((s) => {
    const m = map[s];
    m.macro_avg = round(avg(m.macro_scores));
    m.industry_avg = round(avg(m.industry_scores));
    m.market_avg = round(avg(m.market_scores));

    m.event_score = round(
      0.5 * m.macro_avg +
      0.3 * m.industry_avg +
      0.2 * m.market_avg
    );

    m.news_count = m.active_news_ids.length;
  });

  return map;
}

export function buildNewsRuntime(
  date,
  news,
  impactTable,
  sectorMap,
  marketRuleTable,
  stockPool,
  sensitivityMap
) {
  return {
    date,
    news_items: news,
    stock_event_map: buildStockEventMap(
      news,
      impactTable,
      sectorMap,
      marketRuleTable,
      stockPool,
      sensitivityMap
    )
  };
}

// ==========================================
// M6 Engine v1
// 振宇專用｜Positions + Market Runtime 聚合引擎
// 路徑：/js/m6/m6_engine.js
// ==========================================

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function safeDivide(a, b, fallback = 0) {
  const x = Number(a);
  const y = Number(b);
  if (!Number.isFinite(x) || !Number.isFinite(y) || y === 0) return fallback;
  return x / y;
}

function round2(value) {
  return Math.round(toNumber(value, 0) * 100) / 100;
}

function sum(arr, selector) {
  return arr.reduce((acc, item) => acc + toNumber(selector(item), 0), 0);
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// ==========================================
// 讀取 JSON
// ==========================================

export async function loadJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`讀取失敗: ${url} (${res.status})`);
  }
  return await res.json();
}

export async function loadM6Data(options = {}) {
  const positionsUrl = options.positionsUrl || "data/positions.json";
  const marketUrl = options.marketUrl || "data/market_runtime.json";
  const metaUrl = options.metaUrl || "data/stock_meta.json";

  const [positions, marketRuntime, stockMeta] = await Promise.all([
    loadJson(positionsUrl),
    loadJson(marketUrl),
    loadJson(metaUrl).catch(() => ({}))
  ]);

  return {
    positions: Array.isArray(positions) ? positions : [],
    marketRuntime: marketRuntime && typeof marketRuntime === "object" ? marketRuntime : {},
    stockMeta: stockMeta && typeof stockMeta === "object" ? stockMeta : {}
  };
}

// ==========================================
// Runtime 對接
// 先用：
// 1M -> 代 MA50
// 6M -> 代 MA200
// 12M -> 年線
// ==========================================

export function applyMarketRuntime(positionLike, marketRuntime = {}, stockMeta = {}) {
  const symbol = String(positionLike.symbol || "").toUpperCase();
  const rt = marketRuntime[symbol] || {};
  const meta = stockMeta[symbol] || {};

  const current = toNumber(
    rt.price_now,
    toNumber(positionLike.current, 0)
  );

  const line1W = toNumber(rt.price_ref_1w, current);
  const line1M = toNumber(rt.price_ref_1m, current);   // 代 MA50
  const line6M = toNumber(rt.price_ref_6m, current);   // 代 MA200
  const line12M = toNumber(rt.price_ref_12m, current); // 年線

  return {
    ...positionLike,
    symbol,
    name: meta.name || positionLike.name || symbol,
    category: meta.category || positionLike.category || "",
    risk_level: meta.risk_level || positionLike.risk_level || "",
    switch_to: Array.isArray(meta.switch_to) ? meta.switch_to : (positionLike.switch_to || []),

    current,
    line_1w: line1W,
    line_1m: line1M,
    line_6m: line6M,
    line_12m: line12M,

    volume: toNumber(rt.volume, 0),
    volume_ratio: toNumber(rt.volume_ratio, 0),
    delta_1d: toNumber(rt.delta_1d, 0),
    ret_1d: toNumber(rt.ret_1d, 0),
    ret_1w: toNumber(rt.ret_1w, 0),
    ret_1m: toNumber(rt.ret_1m, 0),
    ret_3m: toNumber(rt.ret_3m, 0),
    ret_6m: toNumber(rt.ret_6m, 0),
    ret_12m: toNumber(rt.ret_12m, 0),
    swing_days: Array.isArray(rt.swing_days) ? rt.swing_days : [],

    last_update: rt.last_update || "-"
  };
}

// ==========================================
// 單筆部位損益
// ==========================================

export function calcPositionPnl(position) {
  const quantity = toNumber(position.quantity, 0);
  const cost = toNumber(position.cost, 0);
  const current = toNumber(position.current, 0);

  const marketValue = round2(quantity * current);
  const totalCost = round2(quantity * cost);
  const pnlAmount = round2((current - cost) * quantity);
  const pnlPct = round2(safeDivide(current - cost, cost, 0) * 100);
  const priceGap = round2(current - cost);

  return {
    quantity,
    cost,
    current,
    market_value: marketValue,
    total_cost: totalCost,
    pnl_amount: pnlAmount,
    pnl_pct: pnlPct,
    price_gap: priceGap
  };
}

// ==========================================
// 強弱 / 狀態 引擎
// 先走簡版規則
// ==========================================

export function calcStrength(item) {
  let score = 0;

  const current = toNumber(item.current, 0);
  const cost = toNumber(item.cost, 0);
  const line1W = toNumber(item.line_1w, current);
  const line1M = toNumber(item.line_1m, current);
  const line6M = toNumber(item.line_6m, current);
  const line12M = toNumber(item.line_12m, current);
  const rsi = toNumber(item.rsi, 55);

  if (current >= line1W) score += 1;
  if (current >= line1M) score += 2;
  if (current >= line6M) score += 2;
  if (current >= line12M) score += 1;
  if (rsi >= 50 && rsi <= 70) score += 1;
  if (current > cost) score += 2;

  if (score >= 6) return "強";
  if (score >= 3) return "中";
  return "弱";
}

export function calcStatus(item) {
  const current = toNumber(item.current, 0);
  const cost = toNumber(item.cost, 0);
  const line1M = toNumber(item.line_1m, current);
  const line6M = toNumber(item.line_6m, current);
  const support1 = Array.isArray(item.support) && item.support.length
    ? toNumber(item.support[0], 0)
    : 0;

  const pnlPct = round2(safeDivide(current - cost, cost, 0) * 100);
  const nearSupport = support1 > 0 ? current <= support1 * 1.03 : false;
  const below1M = current < line1M;
  const below6M = current < line6M;

  if (pnlPct <= -8 || (nearSupport && below1M) || (below1M && below6M && current < cost)) {
    return "危險";
  }

  if (pnlPct < 0 || below1M) {
    return "觀察";
  }

  return "健康";
}

export function calcHealthNote(item) {
  const strength = calcStrength(item);
  const status = calcStatus(item);

  if (status === "危險") {
    return "低於 1M 代理線，且接近支撐，列優先處理";
  }

  if (status === "觀察" && strength === "弱") {
    return "仍弱於 1M / 6M 代理線，先看反彈";
  }

  if (status === "觀察") {
    return "位於關鍵區，等待是否站回 1M 代理線";
  }

  return "結構尚可，可續抱追蹤";
}

// ==========================================
// 單筆部位 enrich
// ==========================================

export function enrichPosition(position, marketRuntime = {}, stockMeta = {}) {
  const base = applyMarketRuntime(position, marketRuntime, stockMeta);
  const pnl = calcPositionPnl(base);

  const merged = {
    ...base,
    ...pnl
  };

  return {
    ...merged,
    strength: calcStrength(merged),
    status_eval: calcStatus(merged),
    health_note: calcHealthNote(merged)
  };
}

// ==========================================
// 同股票多筆部位聚合
// 左側總覽卡使用
// ==========================================

export function aggregatePositions(positions = [], marketRuntime = {}, stockMeta = {}) {
  const enriched = positions.map((p) => enrichPosition(p, marketRuntime, stockMeta));
  const map = new Map();

  for (const p of enriched) {
    const symbol = p.symbol;

    if (!map.has(symbol)) {
      map.set(symbol, {
        symbol,
        name: p.name || symbol,
        category: p.category || "",
        risk_level: p.risk_level || "",
        switch_to: Array.isArray(p.switch_to) ? clone(p.switch_to) : [],

        quantity: 0,
        total_cost_amount: 0,
        market_value: 0,

        current: p.current,
        line_1w: p.line_1w,
        line_1m: p.line_1m,
        line_6m: p.line_6m,
        line_12m: p.line_12m,

        volume: p.volume,
        volume_ratio: p.volume_ratio,
        delta_1d: p.delta_1d,
        last_update: p.last_update,

        source_types: new Set(),
        source_ids: new Set(),
        banks: new Set(),
        roles: new Set(),

        details: []
      });
    }

    const row = map.get(symbol);

    row.quantity += toNumber(p.quantity, 0);
    row.total_cost_amount += toNumber(p.total_cost, 0);
    row.market_value += toNumber(p.market_value, 0);

    row.source_types.add(p.source_type || "");
    row.source_ids.add(p.source_id || "");
    row.banks.add(p.bank || "");
    row.roles.add(p.role || "");

    row.details.push(p);
  }

  const result = [];

  for (const [, row] of map.entries()) {
    const quantity = toNumber(row.quantity, 0);
    const cost = round2(safeDivide(row.total_cost_amount, quantity, 0));
    const current = toNumber(row.current, 0);
    const pnlAmount = round2(row.market_value - row.total_cost_amount);
    const pnlPct = round2(safeDivide(current - cost, cost, 0) * 100);
    const priceGap = round2(current - cost);

    const aggregateItem = {
      symbol: row.symbol,
      name: row.name,
      category: row.category,
      risk_level: row.risk_level,
      switch_to: row.switch_to,

      quantity,
      cost,
      current,
      total_cost: round2(row.total_cost_amount),
      market_value: round2(row.market_value),
      pnl_amount: pnlAmount,
      pnl_pct: pnlPct,
      price_gap: priceGap,

      line_1w: row.line_1w,
      line_1m: row.line_1m,
      line_6m: row.line_6m,
      line_12m: row.line_12m,

      volume: row.volume,
      volume_ratio: row.volume_ratio,
      delta_1d: row.delta_1d,
      last_update: row.last_update,

      source_type: Array.from(row.source_types).filter(Boolean).join(" / "),
      source_id: Array.from(row.source_ids).filter(Boolean).join(" / "),
      bank: Array.from(row.banks).filter(Boolean).join(" / "),
      role: Array.from(row.roles).filter(Boolean).join(" / "),

      details: row.details
    };

    result.push({
      ...aggregateItem,
      strength: calcStrength(aggregateItem),
      status_eval: calcStatus(aggregateItem),
      health_note: calcHealthNote(aggregateItem)
    });
  }

  return result;
}

// ==========================================
// 右側詳情卡：某股票所有原始部位
// ==========================================

export function buildPositionDetails(symbol, positions = [], marketRuntime = {}, stockMeta = {}) {
  const target = String(symbol || "").toUpperCase();

  return positions
    .filter((p) => String(p.symbol || "").toUpperCase() === target)
    .map((p) => enrichPosition(p, marketRuntime, stockMeta))
    .sort((a, b) => {
      const aMain = a.role === "核心部位" ? 0 : 1;
      const bMain = b.role === "核心部位" ? 0 : 1;
      return aMain - bMain;
    });
}

// ==========================================
// 排序
// ==========================================

export function sortAggregates(items = [], mode = "risk") {
  const arr = [...items];

  function statusWeight(v) {
    if (v === "危險") return 0;
    if (v === "觀察") return 1;
    return 2;
  }

  function strengthWeight(v) {
    if (v === "強") return 2;
    if (v === "中") return 1;
    return 0;
  }

  arr.sort((a, b) => {
    if (mode === "risk") {
      return (
        statusWeight(a.status_eval) - statusWeight(b.status_eval) ||
        strengthWeight(a.strength) - strengthWeight(b.strength) ||
        a.symbol.localeCompare(b.symbol)
      );
    }

    if (mode === "strength") {
      return (
        strengthWeight(b.strength) - strengthWeight(a.strength) ||
        statusWeight(a.status_eval) - statusWeight(b.status_eval) ||
        a.symbol.localeCompare(b.symbol)
      );
    }

    if (mode === "pnl") {
      return toNumber(a.pnl_amount, 0) - toNumber(b.pnl_amount, 0);
    }

    if (mode === "return") {
      return toNumber(a.pnl_pct, 0) - toNumber(b.pnl_pct, 0);
    }

    return a.symbol.localeCompare(b.symbol);
  });

  return arr;
}

// ==========================================
// 總覽統計
// ==========================================

export function buildSummary(aggregateItems = []) {
  const count = aggregateItems.length;
  const totalCost = round2(sum(aggregateItems, (x) => x.total_cost));
  const totalValue = round2(sum(aggregateItems, (x) => x.market_value));
  const totalPnl = round2(totalValue - totalCost);

  const healthy = aggregateItems.filter((x) => x.status_eval === "健康").length;
  const watch = aggregateItems.filter((x) => x.status_eval === "觀察").length;
  const danger = aggregateItems.filter((x) => x.status_eval === "危險").length;

  return {
    count,
    total_cost: totalCost,
    total_value: totalValue,
    total_pnl: totalPnl,
    healthy,
    watch,
    danger
  };
}

// ==========================================
// 策略模擬（先做基礎版）
// 之後可給 M6 / M7 共用
// ==========================================

export function simulateSell(positionOrAggregate, sellPrice, sellQty) {
  const quantity = toNumber(positionOrAggregate.quantity, 0);
  const cost = toNumber(positionOrAggregate.cost, 0);
  const price = toNumber(sellPrice, 0);
  const qty = Math.max(0, Math.min(quantity, toNumber(sellQty, 0)));

  const cashBack = round2(price * qty);
  const realizedPnl = round2((price - cost) * qty);
  const remainingQty = round2(quantity - qty);

  return {
    sell_price: price,
    sell_qty: qty,
    cash_back: cashBack,
    realized_pnl: realizedPnl,
    remaining_qty: remainingQty
  };
}

export function simulateSellByRatio(positionOrAggregate, sellPrice, ratio) {
  const quantity = toNumber(positionOrAggregate.quantity, 0);
  const qty = quantity * toNumber(ratio, 0);
  return simulateSell(positionOrAggregate, sellPrice, qty);
}

// ==========================================
// M6 主流程
// 給 UI 一次吃
// ==========================================

export function buildM6ViewModel(raw = {}) {
  const positions = Array.isArray(raw.positions) ? raw.positions : [];
  const marketRuntime = raw.marketRuntime || {};
  const stockMeta = raw.stockMeta || {};

  const aggregateItems = aggregatePositions(positions, marketRuntime, stockMeta);
  const summary = buildSummary(aggregateItems);

  return {
    positions,
    marketRuntime,
    stockMeta,
    aggregates: aggregateItems,
    summary
  };
}

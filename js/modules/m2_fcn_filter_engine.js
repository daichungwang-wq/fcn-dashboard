// ==========================================
// M2 FCN Filter Engine
// 路徑：js/modules/m2_fcn_filter_engine.js
// 用途：M2 / 6.1 FCN 清單第二層透視篩選
// ==========================================

// ---------- 基本工具 ----------
export function toNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function calcDaysSince(dateStr) {
  if (!dateStr) return null;
  const t = new Date(dateStr).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.floor((Date.now() - t) / 86400000);
}

export function safeDivide(a, b, fallback = 0) {
  const x = Number(a);
  const y = Number(b);
  if (!Number.isFinite(x) || !Number.isFinite(y) || y === 0) return fallback;
  return x / y;
}

// ---------- 取價格 ----------
export function getStockEntryPrice(stock) {
  return toNumber(
    stock?.entry_price ??
    stock?.entry ??
    stock?.price_entry,
    0
  );
}

export function getStockCurrentPrice(stock) {
  return toNumber(
    stock?.price_now ??
    stock?.price,
    0
  );
}

export function getStrikePrice(entryPrice, strikePct) {
  if (!entryPrice || !strikePct) return 0;
  return entryPrice * (toNumber(strikePct) / 100);
}

export function getKIPrice(entryPrice, kiPct) {
  if (!entryPrice || !kiPct) return 0;
  return entryPrice * (toNumber(kiPct) / 100);
}

// ---------- ratio / distance ----------
export function getRawBasketRatio(stock) {
  const entry = getStockEntryPrice(stock);
  const now = getStockCurrentPrice(stock);
  return safeDivide(now, entry, 0);
}

export function getCappedBasketRatio(stock) {
  return clamp(getRawBasketRatio(stock), 0, 1);
}

export function getPctVsEntry(stock) {
  const ratio = getRawBasketRatio(stock);
  if (!ratio) return null;
  return (ratio - 1) * 100;
}

export function getDistanceToStrikePct(stock, fcn) {
  const entry = getStockEntryPrice(stock);
  const now = getStockCurrentPrice(stock);
  const strikePrice = getStrikePrice(entry, fcn?.strike);
  if (!strikePrice) return null;
  return ((now - strikePrice) / strikePrice) * 100;
}

export function getDistanceToKIPct(stock, fcn) {
  const entry = getStockEntryPrice(stock);
  const now = getStockCurrentPrice(stock);
  const kiPrice = getKIPrice(entry, fcn?.ki);
  if (!kiPrice) return null;
  return ((now - kiPrice) / kiPrice) * 100;
}

// ---------- 單一 FCN 明細 ----------
export function buildFCNStockMetrics(stock, fcn) {
  const entry = getStockEntryPrice(stock);
  const now = getStockCurrentPrice(stock);

  const rawRatio = getRawBasketRatio(stock);
  const cappedRatio = getCappedBasketRatio(stock);

  const strikePrice = getStrikePrice(entry, fcn?.strike);
  const kiPrice = getKIPrice(entry, fcn?.ki);

  const pctVsEntry = entry ? ((now - entry) / entry) * 100 : null;
  const distToStrikePct = strikePrice ? ((now - strikePrice) / strikePrice) * 100 : null;
  const distToKIPct = kiPrice ? ((now - kiPrice) / kiPrice) * 100 : null;

  return {
    symbol: stock?.symbol || "-",
    entry,
    now,
    raw_ratio: rawRatio,
    capped_ratio: cappedRatio,
    pct_vs_entry: pctVsEntry,
    strike_price: strikePrice,
    ki_price: kiPrice,
    dist_to_strike_pct: distToStrikePct,
    dist_to_ki_pct: distToKIPct
  };
}

// ---------- 單一 FCN 指標 ----------
export function buildFCNMetrics(fcn) {
  const stocks = Array.isArray(fcn?.stocks) ? fcn.stocks : [];

  const stockMetrics = stocks.map(stock => buildFCNStockMetrics(stock, fcn));

  const cappedRatios = stockMetrics
    .map(x => x.capped_ratio)
    .filter(v => Number.isFinite(v));

  const avgBasketPct = cappedRatios.length
    ? (cappedRatios.reduce((sum, v) => sum + v, 0) / cappedRatios.length) * 100
    : 0;

  const worstBasketPct = cappedRatios.length
    ? Math.min(...cappedRatios) * 100
    : 0;

  const strikeDistances = stockMetrics
    .map(x => x.dist_to_strike_pct)
    .filter(v => Number.isFinite(v));

  const kiDistances = stockMetrics
    .map(x => x.dist_to_ki_pct)
    .filter(v => Number.isFinite(v));

  const minDistToStrikePct = strikeDistances.length
    ? Math.min(...strikeDistances)
    : null;

  const minDistToKIPct = kiDistances.length
    ? Math.min(...kiDistances)
    : null;

  const daysSinceEntry = calcDaysSince(fcn?.entry_time);

  const allAboveEntry = stockMetrics.length
    ? stockMetrics.every(x => x.now >= x.entry && x.entry > 0)
    : false;

  const worstStock = stockMetrics.length
    ? stockMetrics.reduce((worst, cur) => {
        if (!worst) return cur;
        return toNumber(cur.capped_ratio, 999) < toNumber(worst.capped_ratio, 999) ? cur : worst;
      }, null)
    : null;

  return {
    fcn_id: fcn?.fcn_id || "",
    basket: Array.isArray(fcn?.basket) ? fcn.basket : [],
    strike: toNumber(fcn?.strike, 0),
    ki: toNumber(fcn?.ki, 0),
    rate: toNumber(fcn?.rate, 0),
    tenor: toNumber(fcn?.tenor, 0),
    amt: toNumber(fcn?.amt, 0),
    entry_time: fcn?.entry_time || "",
    days_since_entry: daysSinceEntry,

    avg_basket_pct: avgBasketPct,
    worst_basket_pct: worstBasketPct,
    min_dist_to_strike_pct: minDistToStrikePct,
    min_dist_to_ki_pct: minDistToKIPct,
    all_above_entry: allAboveEntry,

    worst_of: fcn?.worst_of || worstStock?.symbol || "-",
    stock_metrics: stockMetrics,
    source_fcn: fcn
  };
}

// ---------- 比較 ----------
export function compareMetric(value, operator, target) {
  if (!Number.isFinite(Number(value)) || !Number.isFinite(Number(target))) return false;

  const v = Number(value);
  const t = Number(target);

  if (operator === "gte") return v >= t;
  if (operator === "gt") return v > t;
  if (operator === "lte") return v <= t;
  if (operator === "lt") return v < t;
  if (operator === "eq") return v === t;

  return true;
}

// ---------- 欄位映射 ----------
export function getMetricValue(metrics, field) {
  if (field === "avg") return metrics.avg_basket_pct;
  if (field === "worst") return metrics.worst_basket_pct;
  if (field === "dist_strike") return metrics.min_dist_to_strike_pct;
  if (field === "dist_ki") return metrics.min_dist_to_ki_pct;
  if (field === "days") return metrics.days_since_entry;
  return null;
}

// ---------- 單條件 ----------
export function evaluateCondition(metrics, condition) {
  if (!condition || !condition.field || condition.field === "none") return true;

  const value = getMetricValue(metrics, condition.field);
  const target = toNumber(condition.value, NaN);

  return compareMetric(value, condition.operator || "gte", target);
}

// ---------- 雙條件 ----------
export function evaluateAdvancedFilter(metrics, advancedFilter) {
  if (!advancedFilter) return true;

  const cond1 = {
    field: advancedFilter.f1,
    operator: advancedFilter.op1,
    value: advancedFilter.v1
  };

  const cond2 = {
    field: advancedFilter.f2,
    operator: advancedFilter.op2,
    value: advancedFilter.v2
  };

  const c1 = evaluateCondition(metrics, cond1);
  const c2 = evaluateCondition(metrics, cond2);

  if ((advancedFilter.logic || "and") === "or") {
    return c1 || c2;
  }

  return c1 && c2;
}

// ---------- 篩選整個 FCN List ----------
export function filterFCNList(fcns, advancedFilter = null) {
  const list = Array.isArray(fcns) ? fcns : [];

  return list.filter(fcn => {
    const metrics = buildFCNMetrics(fcn);
    return evaluateAdvancedFilter(metrics, advancedFilter);
  });
}

// ---------- 排序 ----------
export function sortFCNList(fcns, sortBy = "avg_desc") {
  const list = [...(Array.isArray(fcns) ? fcns : [])];

  return list.sort((a, b) => {
    const ma = buildFCNMetrics(a);
    const mb = buildFCNMetrics(b);

    if (sortBy === "avg_desc") {
      if (mb.avg_basket_pct !== ma.avg_basket_pct) {
        return mb.avg_basket_pct - ma.avg_basket_pct;
      }
      if (toNumber(mb.days_since_entry, -9999) !== toNumber(ma.days_since_entry, -9999)) {
        return toNumber(mb.days_since_entry, -9999) - toNumber(ma.days_since_entry, -9999);
      }
      return mb.amt - ma.amt;
    }

    if (sortBy === "worst_desc") {
      if (mb.worst_basket_pct !== ma.worst_basket_pct) {
        return mb.worst_basket_pct - ma.worst_basket_pct;
      }
      return mb.amt - ma.amt;
    }

    if (sortBy === "strike_asc") {
      if (toNumber(ma.min_dist_to_strike_pct, 999999) !== toNumber(mb.min_dist_to_strike_pct, 999999)) {
        return toNumber(ma.min_dist_to_strike_pct, 999999) - toNumber(mb.min_dist_to_strike_pct, 999999);
      }
      return mb.amt - ma.amt;
    }

    if (sortBy === "ki_asc") {
      if (toNumber(ma.min_dist_to_ki_pct, 999999) !== toNumber(mb.min_dist_to_ki_pct, 999999)) {
        return toNumber(ma.min_dist_to_ki_pct, 999999) - toNumber(mb.min_dist_to_ki_pct, 999999);
      }
      return mb.amt - ma.amt;
    }

    if (sortBy === "days_desc") {
      if (toNumber(mb.days_since_entry, -9999) !== toNumber(ma.days_since_entry, -9999)) {
        return toNumber(mb.days_since_entry, -9999) - toNumber(ma.days_since_entry, -9999);
      }
      return mb.amt - ma.amt;
    }

    return 0;
  });
}

// ---------- 快捷篩選 ----------
export function getQuickFilterPreset(presetName) {
  if (presetName === "early_exit_candidate") {
    return {
      f1: "avg",
      op1: "gte",
      v1: 100,
      logic: "and",
      f2: "days",
      op2: "gte",
      v2: 15
    };
  }

  if (presetName === "near_exit") {
    return {
      f1: "avg",
      op1: "gte",
      v1: 95,
      logic: "and",
      f2: "days",
      op2: "gte",
      v2: 15
    };
  }

  if (presetName === "near_strike") {
    return {
      f1: "dist_strike",
      op1: "lte",
      v1: 10,
      logic: "and",
      f2: "days",
      op2: "gte",
      v2: 0
    };
  }

  if (presetName === "near_ki") {
    return {
      f1: "dist_ki",
      op1: "lte",
      v1: 10,
      logic: "and",
      f2: "days",
      op2: "gte",
      v2: 0
    };
  }

  return null;
}

// ---------- 一次完成：篩選＋排序 ----------
export function runFCNFilterEngine(fcns, options = {}) {
  const {
    advancedFilter = null,
    quickPreset = null,
    sortBy = "avg_desc"
  } = options;

  const filterToUse = quickPreset
    ? getQuickFilterPreset(quickPreset)
    : advancedFilter;

  const filtered = filterFCNList(fcns, filterToUse);
  const sorted = sortFCNList(filtered, sortBy);

  return sorted.map(fcn => ({
    fcn,
    metrics: buildFCNMetrics(fcn)
  }));
}

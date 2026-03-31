// ==========================================
// M2 Health Engine V1
// 振宇 FCN 系統｜持倉健檢引擎
// ==========================================

// -----------------------------
// 工具
// -----------------------------
function toNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// -----------------------------
// 股票層計算
// -----------------------------
function calcStockHealth(stock, fcn, market) {
  const symbol = stock;

  const entry_price = toNumber(fcn.entry_prices?.[symbol]);
  const price_now = toNumber(market?.[symbol]?.price_now);

  const ki_pct = toNumber(fcn.ki);
  const strike_pct = toNumber(fcn.strike);

  if (!entry_price || !price_now) return null;

  const ki_price = entry_price * ki_pct / 100;
  const strike_price = entry_price * strike_pct / 100;

  const dist_to_ki_pct = ((price_now - ki_price) / ki_price) * 100;
  const dist_to_strike_pct = ((price_now - strike_price) / strike_price) * 100;

  // 狀態判斷
  let stock_health = "healthy";

  if (price_now < ki_price) {
    stock_health = "danger";
  } else if (price_now < strike_price) {
    stock_health = "watch";
  }

  return {
    symbol,
    entry_price,
    price_now,
    ki_pct,
    strike_pct,
    ki_price,
    strike_price,
    dist_to_ki_pct,
    dist_to_strike_pct,
    stock_health,

    // optional runtime
    pure_stock: market?.[symbol]?.pure_stock ?? null,
    snapshot_score: market?.[symbol]?.snapshot_score ?? null,
    event_stock: market?.[symbol]?.event_stock ?? null,
    trend: market?.[symbol]?.trend ?? "",
    trend_note: market?.[symbol]?.trend_note ?? ""
  };
}

// -----------------------------
// 股票排序（問題最大在前）
// -----------------------------
function sortStocks(stocks) {
  return [...stocks].sort((a, b) => {
    const rank = { danger: 0, watch: 1, healthy: 2 };

    if (rank[a.stock_health] !== rank[b.stock_health]) {
      return rank[a.stock_health] - rank[b.stock_health];
    }

    // 同類別比較距離
    return a.dist_to_ki_pct - b.dist_to_ki_pct;
  });
}

// -----------------------------
// FCN 層判斷
// -----------------------------
function calcFCNHealth(fcn, market) {
  const stocks = fcn.basket
    .map(s => calcStockHealth(s, fcn, market))
    .filter(Boolean);

  if (!stocks.length) return null;

  const sorted = sortStocks(stocks);

  const hasDanger = sorted.some(s => s.stock_health === "danger");
  const hasWatch = sorted.some(s => s.stock_health === "watch");

  let fcn_health = "healthy";
  if (hasDanger) fcn_health = "danger";
  else if (hasWatch) fcn_health = "watch";

  const worst = sorted[0];

  return {
    fcn_id: fcn.fcn_id,
    basket: fcn.basket,
    amt: fcn.amt,
    currency: fcn.currency,

    fcn_health,
    worst_of: worst.symbol,

    danger_count: sorted.filter(s => s.stock_health === "danger").length,
    watch_count: sorted.filter(s => s.stock_health === "watch").length,
    healthy_count: sorted.filter(s => s.stock_health === "healthy").length,

    worst_dist_to_ki_pct: worst.dist_to_ki_pct,
    worst_dist_to_strike_pct: worst.dist_to_strike_pct,

    stocks: sorted
  };
}

// -----------------------------
// 主入口
// -----------------------------
export function runM2HealthEngine({ fcnPool = [], marketRuntime = {} }) {
  // 只看 active
  const activeFcns = fcnPool.filter(f => f.status === "active");

  const results = activeFcns
    .map(f => calcFCNHealth(f, marketRuntime))
    .filter(Boolean);

  // 分區
  const danger = results.filter(f => f.fcn_health === "danger");
  const watch = results.filter(f => f.fcn_health === "watch");
  const healthy = results.filter(f => f.fcn_health === "healthy");

  return {
    total: results.length,
    total_amt: results.reduce((s, f) => s + toNumber(f.amt), 0),

    danger,
    watch,
    healthy,

    fcns: results
  };
}

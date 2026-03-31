// ==========================================
// M2 Health Engine V1.1 FINAL
// 振宇 FCN 系統｜持倉健檢引擎（升級版）
// ==========================================

// -----------------------------
function toNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// -----------------------------
// 股票計算
// -----------------------------
function calcStockHealth(symbol, fcn, market) {
  const entry_price = toNumber(fcn.entry_prices?.[symbol]);
  const price_now = toNumber(market?.[symbol]?.price_now);

  if (!entry_price || !price_now) return null;

  const ki_price = entry_price * fcn.ki / 100;
  const strike_price = entry_price * fcn.strike / 100;

  const dist_to_ki_pct = (price_now - ki_price) / ki_price * 100;
  const dist_to_strike_pct = (price_now - strike_price) / strike_price * 100;

  let stock_health = "healthy";
  if (price_now < ki_price) stock_health = "danger";
  else if (price_now < strike_price) stock_health = "watch";

  return {
    symbol,
    entry_price,
    price_now,
    ki_price,
    strike_price,
    dist_to_ki_pct,
    dist_to_strike_pct,
    stock_health,

    pure_stock: market?.[symbol]?.pure_stock ?? null,
    snapshot_score: market?.[symbol]?.snapshot_score ?? null,
    event_stock: market?.[symbol]?.event_stock ?? null,
    trend: market?.[symbol]?.trend ?? "",
    trend_note: market?.[symbol]?.trend_note ?? ""
  };
}

// -----------------------------
// 排序
// -----------------------------
function sortStocks(stocks) {
  const rank = { danger: 0, watch: 1, healthy: 2 };

  return stocks.sort((a, b) => {
    if (rank[a.stock_health] !== rank[b.stock_health]) {
      return rank[a.stock_health] - rank[b.stock_health];
    }
    return a.dist_to_ki_pct - b.dist_to_ki_pct;
  });
}

// -----------------------------
// FCN
// -----------------------------
function calcFCN(fcn, market) {
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

  return {
    ...fcn,
    fcn_health,
    worst_of: sorted[0].symbol,
    stocks: sorted
  };
}

// -----------------------------
// 主引擎
// -----------------------------
export function runM2HealthEngine({ fcnPool = [], marketRuntime = {} }) {

  const active = fcnPool.filter(f => f.status === "active");

  const fcns = active.map(f => calcFCN(f, marketRuntime)).filter(Boolean);

  // 分區
  const danger = fcns.filter(f => f.fcn_health === "danger");
  const watch = fcns.filter(f => f.fcn_health === "watch");
  const healthy = fcns.filter(f => f.fcn_health === "healthy");

  // -----------------------------
  // 股票分析（V1.1升級）
  // -----------------------------
  const stockMap = {};

  fcns.forEach(f => {
    f.stocks.forEach(s => {

      if (!stockMap[s.symbol]) {
        stockMap[s.symbol] = {
          count: 0,
          amt: 0,
          danger: 0,
          watch: 0,
          healthy: 0,
          fcns: [],
          details: []
        };
      }

      const obj = stockMap[s.symbol];

      obj.count += 1;
      obj.amt += toNumber(f.amt);
      obj.fcns.push(f.fcn_id);

      obj.details.push({
        fcn_id: f.fcn_id,
        fcn: f
      });

      if (s.stock_health === "danger") obj.danger++;
      else if (s.stock_health === "watch") obj.watch++;
      else obj.healthy++;
    });
  });

  return {
    fcns,
    danger,
    watch,
    healthy,
    stockMap,
    total: fcns.length,
    total_amt: fcns.reduce((s, f) => s + toNumber(f.amt), 0)
  };
}

// -----------------------------
// UI Helper（V1.1新增）
// -----------------------------

export function buildFCNMeta(f) {
  return `
    <div style="font-size:13px; color:#444; margin-bottom:10px;">
      <b>📦 結構：</b>
      Tenor ${f.tenor}M｜
      Rate ${f.rate}%｜
      KI ${f.ki}%｜
      Strike ${f.strike}%｜
      Autocall ${f.autocall}%｜
      EKI ${f.eki ? "YES" : "NO"}<br>
      建立：${f.created_time || "-"}｜
      進場：${f.entry_time || "-"}
    </div>
  `;
}

// -----------------------------
// 股票 drill down toggle
// -----------------------------
window.toggleStock = function (id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = el.style.display === "none" ? "block" : "none";
};

// -----------------------------
// 限制顯示（防爆）
// -----------------------------
export function limitDisplay(arr, type) {
  if (type === "healthy") return arr.slice(0, 5);
  return arr;
}

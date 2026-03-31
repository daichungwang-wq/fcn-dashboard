// ==========================================
// M2 Health Engine V1.2 FINAL
// 振宇 FCN 系統｜持倉健檢引擎（到期損益版）
// ==========================================

function toNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function round(v, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(toNumber(v) * factor) / factor;
}

// ------------------------------
// 利息與損益計算
// ------------------------------
function calcInterestAndPL(fcn, stock) {
  const investAmt = toNumber(fcn.amt, 0);
  const annualRate = toNumber(fcn.rate, 0) / 100;
  const tenorMonths = toNumber(fcn.tenor, 0);

  const entryPrice = toNumber(stock.entry_price, 0);
  const priceNow = toNumber(stock.price_now, 0);
  const strikePct = toNumber(fcn.strike, 0) / 100;

  if (!investAmt || !annualRate || !tenorMonths || !entryPrice || !strikePct) {
    return {
      total_interest_amt: 0,
      total_interest_pct: 0,
      stock_loss_amt_if_mature_today: 0,
      stock_loss_pct_if_mature_today: 0,
      net_pl_if_mature_today_amt: 0,
      net_pl_if_mature_today_pct: 0
    };
  }

  // 總利息（完整天期）
  const totalInterestAmt = investAmt * annualRate * (tenorMonths / 12);
  const totalInterestPct = totalInterestAmt / investAmt * 100;

  // 接股成本（以 strike 計）
  const strikePrice = entryPrice * strikePct;

  // 若今天到期，股價損益百分比（以 strike 成本為基準）
  const stockLossPct = strikePrice
    ? ((priceNow - strikePrice) / strikePrice) * 100
    : 0;

  // 對整筆投資金額的損益金額
  const stockLossAmt = investAmt * (stockLossPct / 100);

  // 算入整期利息後的淨損益
  const netPLAmt = stockLossAmt + totalInterestAmt;
  const netPLPct = investAmt ? (netPLAmt / investAmt) * 100 : 0;

  return {
    total_interest_amt: round(totalInterestAmt),
    total_interest_pct: round(totalInterestPct),
    stock_loss_amt_if_mature_today: round(stockLossAmt),
    stock_loss_pct_if_mature_today: round(stockLossPct),
    net_pl_if_mature_today_amt: round(netPLAmt),
    net_pl_if_mature_today_pct: round(netPLPct)
  };
}

// ------------------------------
// 單一股票健康計算
// ------------------------------
function calcStockHealth(symbol, fcn, market) {
  const entry_price = toNumber(fcn.entry_prices?.[symbol]);
  const price_now = toNumber(market?.[symbol]?.price_now);

  if (!entry_price || !price_now) return null;

  const ki_pct = toNumber(fcn.ki);
  const strike_pct = toNumber(fcn.strike);

  const ki_price = entry_price * ki_pct / 100;
  const strike_price = entry_price * strike_pct / 100;

  const dist_to_ki_pct = ki_price
    ? ((price_now - ki_price) / ki_price) * 100
    : 0;

  const dist_to_strike_pct = strike_price
    ? ((price_now - strike_price) / strike_price) * 100
    : 0;

  let stock_health = "healthy";
  if (price_now < ki_price) stock_health = "danger";
  else if (price_now < strike_price) stock_health = "watch";

  const pnl = calcInterestAndPL(fcn, {
    entry_price,
    price_now
  });

  return {
    symbol,
    entry_price,
    price_now,
    ki_pct,
    strike_pct,
    ki_price,
    strike_price,
    dist_to_ki_pct: round(dist_to_ki_pct),
    dist_to_strike_pct: round(dist_to_strike_pct),
    stock_health,

    pure_stock: market?.[symbol]?.pure_stock ?? null,
    snapshot_score: market?.[symbol]?.snapshot_score ?? null,
    event_stock: market?.[symbol]?.event_stock ?? null,
    trend: market?.[symbol]?.trend ?? "",
    trend_note: market?.[symbol]?.trend_note ?? "",

    ...pnl
  };
}

// ------------------------------
// 股票排序（最危險在前）
// ------------------------------
function sortStocks(stocks) {
  const order = { danger: 0, watch: 1, healthy: 2 };

  return [...stocks].sort((a, b) => {
    if (order[a.stock_health] !== order[b.stock_health]) {
      return order[a.stock_health] - order[b.stock_health];
    }
    return a.dist_to_ki_pct - b.dist_to_ki_pct;
  });
}

// ------------------------------
// FCN 層級計算
// ------------------------------
function calcFCN(fcn, market) {
  const stocks = (fcn.basket || [])
    .map(symbol => calcStockHealth(symbol, fcn, market))
    .filter(Boolean);

  if (!stocks.length) return null;

  const sorted = sortStocks(stocks);

  const danger_count = sorted.filter(s => s.stock_health === "danger").length;
  const watch_count = sorted.filter(s => s.stock_health === "watch").length;
  const healthy_count = sorted.filter(s => s.stock_health === "healthy").length;

  let fcn_health = "healthy";
  if (danger_count > 0) fcn_health = "danger";
  else if (watch_count > 0) fcn_health = "watch";

  const worst = sorted[0];

  return {
    ...fcn,
    fcn_health,
    worst_of: worst.symbol,
    danger_count,
    watch_count,
    healthy_count,
    worst_dist_to_ki_pct: worst.dist_to_ki_pct,
    worst_dist_to_strike_pct: worst.dist_to_strike_pct,
    worst_stock_loss_amt_if_mature_today: worst.stock_loss_amt_if_mature_today,
    worst_stock_loss_pct_if_mature_today: worst.stock_loss_pct_if_mature_today,
    worst_total_interest_amt: worst.total_interest_amt,
    worst_total_interest_pct: worst.total_interest_pct,
    worst_net_pl_if_mature_today_amt: worst.net_pl_if_mature_today_amt,
    worst_net_pl_if_mature_today_pct: worst.net_pl_if_mature_today_pct,
    stocks: sorted
  };
}

// ------------------------------
// 股票聚合（5.1 / 5.2 / 5.3 用）
// ------------------------------
function buildStockAggregation(fcns) {
  const map = {};

  fcns.forEach(f => {
    (f.stocks || []).forEach(s => {
      if (!map[s.symbol]) {
        map[s.symbol] = {
          symbol: s.symbol,
          count: 0,
          amt: 0,
          danger: 0,
          watch: 0,
          healthy: 0,
          fcns: [],
          details: []
        };
      }

      map[s.symbol].count += 1;
      map[s.symbol].amt += toNumber(f.amt);
      map[s.symbol].fcns.push(f.fcn_id);
      map[s.symbol].details.push({
        fcn_id: f.fcn_id,
        fcn: f,
        stock: s
      });

      if (s.stock_health === "danger") map[s.symbol].danger += 1;
      else if (s.stock_health === "watch") map[s.symbol].watch += 1;
      else map[s.symbol].healthy += 1;
    });
  });

  return Object.values(map).sort((a, b) => b.amt - a.amt);
}

// ------------------------------
// 主入口
// ------------------------------
export function runM2HealthEngine({ fcnPool = [], marketRuntime = {} }) {
  const active = (fcnPool || []).filter(f => f.status === "active");

  const fcns = active
    .map(f => calcFCN(f, marketRuntime))
    .filter(Boolean);

  const danger = fcns.filter(f => f.fcn_health === "danger");
  const watch = fcns.filter(f => f.fcn_health === "watch");
  const healthy = fcns.filter(f => f.fcn_health === "healthy");

  const stockMap = buildStockAggregation(fcns);

  return {
    fcns,
    danger,
    watch,
    healthy,
    stockMap,
    total: fcns.length,
    total_amt: round(fcns.reduce((s, f) => s + toNumber(f.amt), 0))
  };
}

// ------------------------------
// FCN 結構資訊
// ------------------------------
export function buildFCNMeta(f) {
  return `
    <div style="font-size:13px; color:#444; margin-bottom:10px; line-height:1.6;">
      <b>📦 結構：</b>
      Tenor ${f.tenor ?? "-"}M｜
      Rate ${f.rate ?? "-"}%｜
      KI ${f.ki ?? "-"}%｜
      Strike ${f.strike ?? "-"}%｜
      Autocall ${f.autocall ?? "-"}%｜
      EKI ${f.eki ? "YES" : "NO"}<br>
      建立：${f.created_time || "-"}｜
      進場：${f.entry_time || "-"}
    </div>
  `;
}

// ------------------------------
// 健康區防爆
// ------------------------------
export function limitDisplay(arr, type, showAllHealthy = false) {
  if (type === "healthy" && !showAllHealthy) {
    return arr.slice(0, 5);
  }
  return arr;
}

(function () {
  "use strict";

  const ROOT = location.pathname.includes("/fcn-dashboard/") ? "/fcn-dashboard/" : "../";
  const PATHS = {
    fcnPool: `${ROOT}data/fcn_pool.json`,
    pool30: `${ROOT}data/pool30.json`,
    universe: `${ROOT}data/m1/universe_150.json`,
    marketRuntime: `${ROOT}data/market_runtime.json`,
    prepost: `${ROOT}data/mm/prepost_runtime.json`,
    m1Scores: `${ROOT}data/m1/m1_scores.json`,
    m7Scores: `${ROOT}data/m7_sandbox/m7_v2_scores.json`
  };

  const EXCLUDED = new Set(["DX-Y.NYB", "TWD=X", "JPY=X", "CL=F", "GC=F", "SPY", "QQQ", "SMH", "DIA", "0050.TW", "^TWII", "^VIX", "^TNX"]);
  const SPECIAL_TARGETS = new Set(["NVDA", "TSM", "SMH", "GOOG"]);
  const CACHE = {};

  function esc(v) {
    return String(v ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
  }

  function normalizeSymbol(v) {
    return String(v || "").trim().toUpperCase();
  }

  function isTradableStockSymbol(symbol, row = {}) {
    const sym = normalizeSymbol(symbol);
    if (!sym) return false;
    if (row.runtime_category && row.runtime_category !== "stock") return false;
    if (sym.startsWith("^")) return false;
    if (EXCLUDED.has(sym)) return false;
    return /^[A-Z][A-Z0-9.\-]{0,9}$/.test(sym);
  }

  function asArray(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw.rows)) return raw.rows;
    if (Array.isArray(raw.data)) return raw.data;
    if (Array.isArray(raw.stocks)) return raw.stocks;
    if (raw.rows && typeof raw.rows === "object") return Object.entries(raw.rows).map(([symbol, row]) => ({ symbol, ...row }));
    if (raw.data && typeof raw.data === "object") return Object.entries(raw.data).map(([symbol, row]) => ({ symbol, ...row }));
    if (typeof raw === "object") return Object.entries(raw).map(([symbol, row]) => ({ symbol, ...(row && typeof row === "object" ? row : { value: row }) }));
    return [];
  }

  function collectSymbols(raw, out = new Set(), depth = 0) {
    if (!raw || depth > 6) return out;
    if (typeof raw === "string") {
      const sym = normalizeSymbol(raw);
      if (isTradableStockSymbol(sym)) out.add(sym);
      return out;
    }
    if (Array.isArray(raw)) {
      raw.forEach(item => collectSymbols(item, out, depth + 1));
      return out;
    }
    if (typeof raw !== "object") return out;
    ["symbol", "ticker", "underlying"].forEach(key => {
      const sym = normalizeSymbol(raw[key]);
      if (isTradableStockSymbol(sym, raw)) out.add(sym);
    });
    ["basket", "underlyings", "symbols", "stocks"].forEach(key => collectSymbols(raw[key], out, depth + 1));
    return out;
  }

  function bySymbol(raw) {
    const map = new Map();
    asArray(raw).forEach(row => {
      const sym = normalizeSymbol(row.symbol || row.ticker || row.underlying);
      if (sym) map.set(sym, row);
    });
    return map;
  }

  async function fetchJson(path) {
    if (CACHE[path]) return CACHE[path];
    try {
      const res = await fetch(path, { cache: "no-store" });
      CACHE[path] = res.ok ? await res.json() : null;
    } catch (err) {
      console.warn("[C2RadarV2] JSON load failed", path, err);
      CACHE[path] = null;
    }
    return CACHE[path];
  }

  function num(v, digits = 2) {
    const n = Number(v);
    if (!Number.isFinite(n)) return "--";
    return n.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits });
  }

  function pct(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return "--";
    return `${n.toFixed(2)}%`;
  }

  function firstNum(...values) {
    for (const value of values) {
      const n = Number(value);
      if (Number.isFinite(n)) return n;
    }
    return null;
  }

  function getAmount(deal) {
    return firstNum(deal.amount, deal.notional, deal.principal, deal.investment_amount, deal.face_value, deal.amt) || 0;
  }

  function buildInvestedMap(fcnPool) {
    const invested = new Map();
    asArray(fcnPool).forEach(deal => {
      const status = String(deal.status || "").toLowerCase();
      if (deal.has_position === false || ["closed", "matured", "expired", "redeemed"].includes(status)) return;
      const amount = getAmount(deal);
      collectSymbols(deal).forEach(sym => invested.set(sym, (invested.get(sym) || 0) + amount));
    });
    return invested;
  }

  function rowCategory(symbol, pool30Map, universeMap) {
    const row = pool30Map.get(symbol) || universeMap.get(symbol) || {};
    return String(row.category || row.category_main || "").toLowerCase();
  }

  function targetAmount(symbol, category) {
    if (SPECIAL_TARGETS.has(symbol)) return 700000;
    if (category === "core") return 500000;
    if (category === "growth") return 300000;
    if (category === "defensive") return 300000;
    if (category === "income") return 200000;
    if (category === "speculative") return 30000;
    return 300000;
  }

  function sourceLabel(symbol, fcnSymbols, pool30Symbols) {
    if (fcnSymbols.has(symbol)) return "FCN";
    if (pool30Symbols.has(symbol)) return "Pool30";
    return "Universe";
  }

  function pickScore(row, ...keys) {
    for (const key of keys) {
      const n = Number(row?.[key]);
      if (Number.isFinite(n)) return n;
    }
    return null;
  }

  async function buildRows() {
    const [fcnPool, pool30, universe, marketRuntime, prepost, m1Scores, m7Scores] = await Promise.all(Object.values(PATHS).map(fetchJson));
    const fcnSymbols = collectSymbols(fcnPool);
    const pool30Symbols = collectSymbols(pool30);
    const universeSymbols = collectSymbols(universe);
    const runtimeMap = bySymbol(marketRuntime);
    const pool30Map = bySymbol(pool30);
    const universeMap = bySymbol(universe);
    const prepostMap = bySymbol(prepost);
    const m1Map = bySymbol(m1Scores);
    const m7Map = bySymbol(m7Scores);
    const investedMap = buildInvestedMap(fcnPool);
    const ordered = [...new Set([...fcnSymbols, ...pool30Symbols, ...universeSymbols])].filter(sym => isTradableStockSymbol(sym, runtimeMap.get(sym) || {}));

    return ordered.map(symbol => {
      const runtime = runtimeMap.get(symbol) || {};
      const pp = prepostMap.get(symbol) || {};
      const category = rowCategory(symbol, pool30Map, universeMap);
      const invested = investedMap.get(symbol) || 0;
      const target = targetAmount(symbol, category);
      const available = target - invested;
      const m1 = m1Map.get(symbol) || {};
      const m7 = m7Map.get(symbol) || {};
      return {
        symbol,
        name: runtime.name || pool30Map.get(symbol)?.name || universeMap.get(symbol)?.name || symbol,
        source: sourceLabel(symbol, fcnSymbols, pool30Symbols),
        price: firstNum(runtime.price, runtime.last_price, runtime.close, runtime.current_price),
        delta: firstNum(runtime.change, runtime.change_1d, runtime.delta_1d),
        deltaPct: firstNum(runtime.change_pct, runtime.change_1d_pct, runtime.ret_1d),
        oneWeek: firstNum(runtime.ret_1w, runtime.change_1w_pct),
        oneMonth: firstNum(runtime.ret_1m, runtime.change_1m_pct),
        prepost: firstNum(pp.price_active, pp.price_pre, pp.price_post),
        session: pp.session || "regular",
        invested,
        target,
        available,
        m1: pickScore(m1, "M1_score", "m1_score", "score"),
        m7: pickScore(m7, "m7_v2_score", "M7_score", "m7_score", "score"),
        fcnView: invested > target ? "Over" : invested > 0 ? "Invested" : "Available"
      };
    });
  }

  function renderTable(el, rows) {
    el.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Link</th><th>Symbol</th><th>Name</th><th>Source</th><th>Price</th><th>Delta</th><th>Delta%</th><th>1W</th><th>1M</th><th>Pre/Post</th><th>Session</th><th>FCN Invested</th><th>Target Amount</th><th>Available Amount</th><th>M1</th><th>M7</th><th>FCN View</th></tr></thead><tbody>${rows.map(row => `<tr><td><a href="../m1_new_stock.html?symbol=${encodeURIComponent(row.symbol)}">研究</a></td><td>${esc(row.symbol)}</td><td>${esc(row.name)}</td><td>${esc(row.source)}</td><td>${num(row.price)}</td><td>${num(row.delta)}</td><td>${pct(row.deltaPct)}</td><td>${pct(row.oneWeek)}</td><td>${pct(row.oneMonth)}</td><td>${num(row.prepost)}</td><td>${esc(row.session)}</td><td>${num(row.invested, 0)}</td><td>${num(row.target, 0)}</td><td>${row.available < 0 ? `Over ${num(Math.abs(row.available), 0)}` : num(row.available, 0)}</td><td>${num(row.m1)}</td><td>${num(row.m7)}</td><td>${esc(row.fcnView)}</td></tr>`).join("")}</tbody></table></div>`;
  }

  async function render() {
    const el = document.getElementById("c2-all-stock-radar");
    if (!el) return;
    el.innerHTML = "<div class='muted'>Loading C2 Stock Radar v2...</div>";
    try {
      renderTable(el, await buildRows());
    } catch (err) {
      console.warn("[C2RadarV2] render failed", err);
      el.innerHTML = "<div class='muted'>C2 Stock Radar v2 load failed.</div>";
    }
  }

  async function filterC1Select() {
    const select = document.getElementById("mm-c1-symbol-fallback");
    if (!select) return;
    const runtimeMap = bySymbol(await fetchJson(PATHS.marketRuntime));
    let changed = false;
    [...select.options].forEach(option => {
      const sym = normalizeSymbol(option.value);
      if (!isTradableStockSymbol(sym, runtimeMap.get(sym) || {})) {
        option.remove();
        changed = true;
      }
    });
    if (changed && select.value && !isTradableStockSymbol(select.value, runtimeMap.get(select.value) || {})) {
      select.value = "NVDA";
      select.dispatchEvent(new Event("change"));
    }
  }

  function watchC1Select() {
    filterC1Select();
    const observer = new MutationObserver(filterC1Select);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  window.MMModuleRadarV2 = { render, isTradableStockSymbol };
  document.addEventListener("DOMContentLoaded", () => {
    watchC1Select();
    render();
  });
})();

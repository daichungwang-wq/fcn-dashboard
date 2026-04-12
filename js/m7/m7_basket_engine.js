// ==========================================
// M7 Basket Engine FINAL（振宇專用）
// 1. 來源：只用 simulation_pool
// 2. 核心：分類 → 曝險排序 → basket
// 3. 產出三組 basket 建議：積極 / 理性 / 保守
// 4. 固定 FCN 條件：55 / 65 / 6m / AKI / 3~5檔
// 5. 初期先人工檢視，不直接串 M8 rate engine
// ==========================================

async function loadBasketData() {
  const res = await fetch("./data/m7/m7_new_stock_today.json?v=" + Date.now());
  if (!res.ok) throw new Error("無法讀取資料");
  return await res.json();
}

function n(v, d = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}

function round2(v) {
  return Math.round(n(v) * 100) / 100;
}

// ==========================================
// 分類
// ==========================================
function getCategory(s) {
  const c = String(s["分類"] || "").toLowerCase();

  if (c.includes("core")) return "CORE";
  if (c.includes("defensive")) return "DEFENSIVE";
  if (c.includes("income")) return "INCOME";
  if (c.includes("speculative") || c.includes("cyclical")) return "EVENT";

  return "GROWTH";
}

// ==========================================
// 建立 Universe（🔥只用 simulation pool）
// ==========================================
function buildUniverse(data) {
  const pool = Array.isArray(data.simulation_pool)
    ? data.simulation_pool
    : [];

  return pool.map(s => ({
    symbol: s["股號"],
    name: s["股名"],
    category: getCategory(s),

    total: n(s.today_score),
    valuation: n(s.valuation_score),
    trend: n(s.trend_score),
    structure: n(s.structure_score),
    timing: n(s.timing_score),
    money: n(s.money_score),

    exposure: s["曝險警示"]?.level || "normal",
    raw: s
  }))
  .sort((a, b) => {
    const order = { high: 2, normal: 1, low: 0 };
    const eA = order[a.exposure] ?? 1;
    const eB = order[b.exposure] ?? 1;

    if (eB !== eA) return eB - eA;
    return b.total - a.total;
  });
}

// ==========================================
// 分組
// ==========================================
function groupByCategory(universe) {
  const map = {
    CORE: [],
    GROWTH: [],
    DEFENSIVE: [],
    INCOME: [],
    EVENT: []
  };

  universe.forEach(s => {
    map[s.category].push(s);
  });

  return map;
}

// ==========================================
// Basket 邏輯
// ==========================================
function pickTop(arr, n) {
  return arr.slice(0, n);
}

function mergeUnique(...arrs) {
  const map = new Map();
  arrs.flat().forEach(x => map.set(x.symbol, x));
  return Array.from(map.values());
}

// ❗避免 high exposure 被選進 basket
function removeHighExposure(list) {
  return list.filter(s => s.exposure !== "high");
}

// -----------------------------
// 積極
// -----------------------------
function pickAggressive(grouped) {
  const core = removeHighExposure(grouped.CORE);
  const growth = removeHighExposure(grouped.GROWTH);
  const def = removeHighExposure(grouped.DEFENSIVE);

  return mergeUnique(
    pickTop(core, 2),
    pickTop(growth, 2),
    pickTop(def, 1)
  ).slice(0, 5);
}

// -----------------------------
// 理性
// -----------------------------
function pickRational(grouped) {
  const core = removeHighExposure(grouped.CORE);
  const growth = removeHighExposure(grouped.GROWTH);
  const def = removeHighExposure(grouped.DEFENSIVE);
  const inc = removeHighExposure(grouped.INCOME);

  return mergeUnique(
    pickTop(core, 2),
    pickTop(growth, 1),
    pickTop(def, 1),
    pickTop(inc, 1)
  ).slice(0, 5);
}

// -----------------------------
// 保守
// -----------------------------
function pickConservative(grouped) {
  const core = removeHighExposure(grouped.CORE);
  const def = removeHighExposure(grouped.DEFENSIVE);
  const inc = removeHighExposure(grouped.INCOME);

  return mergeUnique(
    pickTop(core, 2),
    pickTop(def, 2),
    pickTop(inc, 1)
  ).slice(0, 5);
}

// ==========================================
// UI Render
// ==========================================
function renderStructure(grouped) {
  const el = document.getElementById("today-structure");

  el.innerHTML = `
    <div class="summary-grid">
      ${Object.entries(grouped).map(([k,v]) => `
        <div class="summary-item">
          <span>${k}</span>
          <strong>${v.length}</strong>
        </div>
      `).join("")}
    </div>
  `;
}

function renderCategory(grouped) {
  const el = document.getElementById("category-breakdown");

  el.innerHTML = Object.entries(grouped).map(([cat,list]) => `
    <div class="cat-block">
      <div class="cat-title">${cat}</div>
      ${list.map(s => `
        <div class="stock-line">
          ${s.symbol}
          <span class="pill">${s.exposure}</span>
          ${round2(s.total)}
        </div>
      `).join("")}
    </div>
  `).join("");
}

function renderBasket(id, title, stocks) {
  const el = document.getElementById(id);

  el.innerHTML = `
    <h3>${title}</h3>
    ${stocks.map(s => `
      <div class="stock-line">
        ${s.symbol} (${s.category})
        <span class="pill">${s.exposure}</span>
      </div>
    `).join("")}
  `;
}

// ==========================================
// INIT
// ==========================================
async function init() {
  const data = await loadBasketData();

  const universe = buildUniverse(data);
  const grouped = groupByCategory(universe);

  renderStructure(grouped);
  renderCategory(grouped);

  const aggr = pickAggressive(grouped);
  const rat = pickRational(grouped);
  const cons = pickConservative(grouped);

  renderBasket("aggr", "積極型", aggr);
  renderBasket("rat", "理性型", rat);
  renderBasket("cons", "保守型", cons);
}

document.addEventListener("DOMContentLoaded", init);

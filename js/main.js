// =========================
// 振宇 FCN 系統｜main.js V7.1
// M3 完整引擎版（自動 Vol｜四大公式）
// 不影響 M2
// =========================

const appState = {
  stocksRaw: [],
  stocksComputed: []
};

// =========================
// 🔹 Baseline（AI分類）
// =========================
const BASELINE_SCORE_MAP = {
  core: 10,
  defensive: 7,
  growth: 8,
  financial: 4,
  cyclical: 4,
  high_beta: 1,
  turnaround: 1,
  ETF: 7,
  bond: 7
};

// =========================
// 🔹 安全值
// =========================
function safe(v, d = 0) {
  return v === null || v === undefined || isNaN(v) ? d : v;
}

// =========================
// 🔹 Vol（自動計算｜定稿）
// =========================
function calcVolFromReturns(s) {
  const v1 = Math.abs(safe(s.ret_1m));
  const v6 = Math.abs(safe(s.ret_6m));
  const v12 = Math.abs(safe(s.ret_12m));

  const score = 0.1 * v1 + 0.3 * v6 + 0.6 * v12;

  return {
    vol_1m: v1,
    vol_6m: v6,
    vol_12m: v12,
    vol_score: score
  };
}

// =========================
// 🔹 P Risk（定稿）
// =========================
function calcPRisk(strike, ki) {
  if (!strike || !ki) return 0;

  const gap = strike - ki;

  if (gap >= 20) return -3;
  if (gap >= 15) return -2;
  if (gap >= 10) return -1;
  if (gap >= 5) return 0;

  return -2;
}

// =========================
// 🔹 SRI（暫定）
// =========================
function calcSRI(s) {
  return safe(s.risk_score) > 60 ? -2 : 0;
}

// =========================
// 🔹 股票 Pure
// =========================
function calcStockPure(s, volScore) {
  const base = BASELINE_SCORE_MAP[s.category] || 5;

  const volAdjust = -volScore / 10;

  return base + volAdjust;
}

// =========================
// 🔹 Event Impact
// =========================
function calcEventImpact(s) {
  return safe(s.event_bias);
}

// =========================
// 🔹 股票 Event（定稿）
// =========================
function calcStockEvent(pure, impact) {
  const weight = 0.5;
  return pure + impact * weight;
}

// =========================
// 🔹 FCN Pure（定稿）
// =========================
function calcFCNPure(s, pure) {
  return (
    0.4 * pure +
    0.2 * safe(s.coupon) +
    0.1 * safe(s.tenor) +
    0.1 * calcPRisk(s.strike, s.ki) +
    0.1 * calcSRI(s) +
    (s.eki ? 2 : 0)
  );
}

// =========================
// 🔹 FCN Event（定稿）
// =========================
function calcFCNEvent(s, pure, eventScore, volScore) {
  return (
    0.5 * pure +
    0.25 * eventScore +
    0.25 * volScore +
    (s.eki ? 2 : 0)
  );
}

// =========================
// 🔹 核心引擎
// =========================
function buildEngine(raw) {
  return raw.map(s => {
    const volData = calcVolFromReturns(s);

    const pure = calcStockPure(s, volData.vol_score);
    const impact = calcEventImpact(s);
    const event = calcStockEvent(pure, impact);

    const fcnPure = calcFCNPure(s, pure);
    const fcnEvent = calcFCNEvent(s, pure, event, volData.vol_score);

    return {
      ...s,
      ...volData,

      baseline_score: BASELINE_SCORE_MAP[s.category] || 5,

      pure_score: Number(pure.toFixed(2)),
      event_score: Number(event.toFixed(2)),

      fcn_pure: Number(fcnPure.toFixed(2)),
      fcn_event: Number(fcnEvent.toFixed(2))
    };
  });
}

// =========================
// 🔹 載入資料
// =========================
async function loadData() {
  const res = await fetch("./data/pool.json");
  const data = await res.json();

  appState.stocksRaw = data;
  appState.stocksComputed = buildEngine(data);

  renderM3();
}

// =========================
// 🔹 M3 顯示（引擎版）
// =========================
function renderM3() {
  const el = document.getElementById("m3a-content");
  if (!el) return;

  el.innerHTML = appState.stocksComputed.map(s => `
    <div class="stock-card">

      <div style="font-size:18px;font-weight:800;">
        ${s.symbol} ｜ ${s.name}
      </div>

      <div>Baseline：${s.baseline_score}</div>

      <div>Vol：
        ${s.vol_score.toFixed(2)}
        <span style="color:#6b7280;font-size:12px;">
        (${s.vol_1m.toFixed(2)} / ${s.vol_6m.toFixed(2)} / ${s.vol_12m.toFixed(2)})
        </span>
      </div>

      <div>Pure：${s.pure_score}</div>
      <div>Event：${s.event_score}</div>

      <div style="margin-top:8px;">
        FCN Pure：${s.fcn_pure}
      </div>

      <div>
        FCN Event：${s.fcn_event}
      </div>

    </div>
  `).join("");
}

// =========================
// 🔹 初始化
// =========================
document.addEventListener("DOMContentLoaded", () => {
  loadData();
});

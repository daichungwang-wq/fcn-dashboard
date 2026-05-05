// ==========================================
// MM B ZONE v3 (MERGED: DATA + DECISION)
// ==========================================

window.renderBZone = function(data) {
  const el = document.getElementById("b-zone");
  if (!el) return;

  const fcnPool = data?.fcn_pool || [];
  const m1 = data?.m1_scores || {};

  const b1 = computeB1(fcnPool);
  const b2 = computeB2(fcnPool);
  const b5 = m1.summary || {};
  const decision = computeDecision(b1, b2);

  el.innerHTML = `
    ${renderDecision(decision)}
    ${renderB2(b2)}
    ${renderB1(b1)}
    ${renderB5(b5)}
  `;
};

// ==========================================
// B1 — FULL FCN VIEW + BROKER
// ==========================================

function computeB1(pool) {
  let total = 0;

  let maturity = 0, danger = 0, watch = 0, healthy = 0;
  let maturity_cnt = 0, danger_cnt = 0, watch_cnt = 0, healthy_cnt = 0;

  const broker = {};
  const alerts = [];

  pool.forEach(f => {
    const amt = f.amount || 0;
    total += amt;

    const b = getBroker(f);
    if (!broker[b]) {
      broker[b] = { total: 0, count: 0, maturity: 0, danger: 0, watch: 0, healthy: 0 };
    }

    broker[b].total += amt;
    broker[b].count++;

    if (f.status === "maturity") {
      maturity += amt;
      maturity_cnt++;
      broker[b].maturity += amt;
      alerts.push(`📅 到期：${fmt(amt)}`);
    } else if (f.status === "danger") {
      danger += amt;
      danger_cnt++;
      broker[b].danger += amt;
      alerts.push(`⚠️ ${f.worst_of || "標的"} 破線`);
    } else if (f.status === "watch") {
      watch += amt;
      watch_cnt++;
      broker[b].watch += amt;
    } else {
      healthy += amt;
      healthy_cnt++;
      broker[b].healthy += amt;
    }
  });

  return {
    total,
    maturity, danger, watch, healthy,
    maturity_cnt, danger_cnt, watch_cnt, healthy_cnt,
    broker,
    alerts
  };
}

// ==========================================
// B2 — CAPITAL
// ==========================================

function computeB2(pool) {
  const total_capital = 1200000;
  const invested = pool.reduce((s, f) => s + (f.amount || 0), 0);
  const available = total_capital - invested;
  const ratio = invested / total_capital;

  return { total_capital, invested, available, ratio };
}

// ==========================================
// DECISION ENGINE
// ==========================================

function computeDecision(b1, b2) {
  let action = "正常配置";
  let level = "標準";
  let color = "green";

  if (b2.ratio > 0.9) {
    action = "暫停加碼";
    level = "保守";
    color = "red";
  } else if (b2.ratio > 0.7) {
    action = "降低節奏";
    level = "標準";
    color = "orange";
  } else if (b2.ratio < 0.4) {
    action = "可積極布局";
    level = "積極";
    color = "green";
  }

  return { action, level, color };
}

// ==========================================
// UI — DECISION
// ==========================================

function renderDecision(d) {
  return `
  <div class="b-block" style="border:2px solid #ddd;padding:12px;border-radius:12px;">
    <div style="font-weight:900;font-size:16px;">Portfolio Decision</div>
    <div>👉 ${d.action}</div>
    <div>配置等級：${d.level}</div>
  </div>
  `;
}

// ==========================================
// UI — B2
// ==========================================

function renderB2(d) {
  return `
  <div class="b-block">
    <h3>B2 資金配置</h3>
    <div>總資金：USD ${fmt(d.total_capital)}</div>
    <div>已投：USD ${fmt(d.invested)}</div>
    <div>可用：USD ${fmt(d.available)}</div>
    <div>水位：${(d.ratio * 100).toFixed(1)}%</div>
  </div>
  `;
}

// ==========================================
// UI — B1
// ==========================================

function renderB1(d) {
  return `
  <div class="b-block">
    <h3>B1 M2 / FCN 全貌</h3>

    <div>總金額：USD ${fmt(d.total)}</div>

    <div>
      到期：${fmt(d.maturity)} (${d.maturity_cnt}) |
      破線：${fmt(d.danger)} (${d.danger_cnt}) |
      追蹤：${fmt(d.watch)} (${d.watch_cnt}) |
      健康：${fmt(d.healthy)} (${d.healthy_cnt})
    </div>

    <div style="margin-top:8px;font-weight:700;">Broker</div>
    ${Object.entries(d.broker).map(([k,v])=>`
      <div>${k}：USD ${fmt(v.total)} (${v.count})</div>
    `).join("")}

    <div style="margin-top:8px;color:#b9770e;">
      ${d.alerts.map(a=>`<div>${a}</div>`).join("")}
    </div>
  </div>
  `;
}

// ==========================================
// UI — B5
// ==========================================

function renderB5(s) {
  return `
  <div class="b-block">
    <h3>B5 M1 / 股票品質</h3>
    <div>Coverage：${s.profile_count || 0} / ${s.total || 0}</div>
    <div>Candidate：${s.candidate_count || 0}</div>
    <div>Pool30：${s.pool30_count || 0}</div>
    <div>M1 Avg：${fmt(s.avg_m1_score)}</div>
  </div>
  `;
}

// ==========================================
// UTIL
// ==========================================

function fmt(x){ return (x||0).toLocaleString(); }

function getBroker(row){
  const raw = String(row?.broker || row?.bank || "").toLowerCase();
  if(raw.includes("fubon")) return "富邦";
  if(raw.includes("sinopac")) return "永豐";
  return "其他";
}

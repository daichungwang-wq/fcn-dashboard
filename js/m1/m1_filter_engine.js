// ==========================================
// M1 Filter Engine（正式版）
// 決策層：STRONG / PASS / WATCH / DROP
// ==========================================

// ---------- utils ----------
function n(v, d = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}

// ---------- 預設 config ----------
export function buildDefaultFilterConfig(pool30Rules) {
  const cfg = {};

  Object.keys(pool30Rules).forEach(cat => {
    const rule = pool30Rules[cat];
    cfg[cat] = buildPreset(cat, rule.strictness, rule);
  });

  return cfg;
}

// ---------- preset ----------
function buildPreset(cat, type, rule) {
  const p50 = n(rule.pass);
  const p75 = n(rule.strong);

  if (type === "strict") {
    return {
      preset: "strict",
      strong: p75,
      pass: p50,
      watch: p50 - 0.3
    };
  }

  if (type === "medium") {
    return {
      preset: "medium",
      strong: p75,
      pass: p50 - 0.15,
      watch: p50 - 0.4
    };
  }

  if (type === "loose") {
    return {
      preset: "loose",
      strong: p75 - 0.1,
      pass: p50 - 0.3,
      watch: p50 - 0.6
    };
  }

  return {
    preset: "custom",
    strong: p75,
    pass: p50,
    watch: p50 - 0.3
  };
}

// ---------- 正規化（避免亂序） ----------
function normalize(cfg) {
  let { strong, pass, watch } = cfg;

  strong = n(strong);
  pass = n(pass);
  watch = n(watch);

  if (pass > strong) pass = strong;
  if (watch > pass) watch = pass;

  return {
    ...cfg,
    strong: +strong.toFixed(2),
    pass: +pass.toFixed(2),
    watch: +watch.toFixed(2)
  };
}

// ---------- 主判斷 ----------
export function evaluateM1(row, cfgMap, pool30Rules) {
  const cat = String(row.category || "").toLowerCase();

  const cfg = normalize(cfgMap[cat] || {});
  const rule = pool30Rules[cat];

  if (!cfg || !rule) {
    return {
      result: "N/A",
      reason: ["no rule"]
    };
  }

  const m1 = n(row.M1_score);
  const capex = n(row.breakdown?.capex_score);
  const m7 = n(row.breakdown?.m7_score);

  let result = "DROP";
  let reason = [];

  // ---------- SPEC 特例 ----------
  if (cat === "speculative") {
    if (m1 >= cfg.strong) {
      result = "SPEC_POOL";
      reason.push("spec strong");
    } else if (m1 >= cfg.pass) {
      result = "WATCH";
      reason.push("spec pass");
    } else {
      result = "DROP";
      reason.push("spec drop");
    }
  }

  // ---------- normal ----------
  else {
    if (m1 >= cfg.strong) {
      result = "STRONG";
      reason.push("m1 >= strong");
    } else if (m1 >= cfg.pass) {
      result = "PASS";
      reason.push("m1 >= pass");
    } else if (m1 >= cfg.watch) {
      result = "WATCH";
      reason.push("m1 near");
    } else {
      result = "DROP";
      reason.push("m1 weak");
    }
  }

  // ---------- 類別補強 ----------
  if (cat === "core") {
    if (capex >= n(rule.pass)) reason.push("capex ok");
    else reason.push("capex low");
  }

  if (cat === "growth") {
    if (m7 >= n(rule.pass)) reason.push("m7 ok");
    else reason.push("m7 weak");
  }

  if (cat === "income") {
    if (capex >= n(rule.watch)) reason.push("cashflow ok");
  }

  if (cat === "defensive") {
    if (m7 >= n(rule.watch)) reason.push("stable ok");
  }

  return {
    result,
    reason
  };
}

// ---------- 批次處理 ----------
export function applyFilter(rows, cfgMap, pool30Rules) {
  return rows.map(row => {
    const r = evaluateM1(row, cfgMap, pool30Rules);

    return {
      ...row,
      filter_result: r.result,
      filter_reason: r.reason
    };
  });
}

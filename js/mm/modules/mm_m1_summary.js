/* ========================================================================== 
   MM M1 Summary — Professional B5 Dashboard
   File: js/mm/modules/mm_m1_summary.js

   Goal:
   - Render B5 M1 / 股票品質 as a professional mini dashboard.
   - Prefer data/m1/m1_scores.json summary.
   - Fallback to counting rows if summary is missing.
   - Read-only display module; no write-back.
   Expected DOM:
   - #b5-m1-summary
   ========================================================================== */

(function () {
  "use strict";

  const PATHS = {
    m1Scores: "/fcn-dashboard/data/m1/m1_scores.json",
    pool30: "/fcn-dashboard/data/pool30.json",
    candidate: "/fcn-dashboard/data/m1/m1_candidate_80.json",
    universe: "/fcn-dashboard/data/m1/universe_150.json",
    profileAll: "/fcn-dashboard/data/m1/m1_stock_profile_all.json",
    profileDeep: "/fcn-dashboard/data/m1/m1_stock_profile.json"
  };

  function $(id) { return document.getElementById(id); }

  function esc(v) {
    return String(v ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function num(v, fallback = null) {
    if (v === null || v === undefined || v === "") return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function fmt(v, digits = 0, dash = "--") {
    const n = num(v);
    if (n === null) return dash;
    return n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }

  function pct(v, digits = 0) {
    const n = num(v);
    if (n === null) return "--";
    return `${n.toFixed(digits)}%`;
  }

  function arr(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw.data)) return raw.data;
    if (Array.isArray(raw.items)) return raw.items;
    if (Array.isArray(raw.rows)) return raw.rows;
    if (Array.isArray(raw.scores)) return raw.scores;
    if (raw.data && typeof raw.data === "object") return Object.entries(raw.data).map(([symbol, v]) => ({ symbol, ...(v || {}) }));
    if (typeof raw === "object") {
      return Object.entries(raw)
        .filter(([k, v]) => /^[A-Z0-9.\-]{1,8}$/.test(k) && v && typeof v === "object")
        .map(([symbol, v]) => ({ symbol, ...(v || {}) }));
    }
    return [];
  }

  async function fetchJson(path) {
    try {
      const res = await fetch(path, { cache: "no-store" });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.warn("[MMM1Summary] load failed", path, e);
      return null;
    }
  }

  function countBy(rows, getter) {
    const out = {};
    rows.forEach(r => {
      const k = String(getter(r) || "unknown").toLowerCase();
      out[k] = (out[k] || 0) + 1;
    });
    return out;
  }

  function avg(values) {
    const xs = values.map(num).filter(v => v !== null);
    if (!xs.length) return null;
    return xs.reduce((a, b) => a + b, 0) / xs.length;
  }

  function fallbackSummary(data) {
    const rows = arr(data.m1Scores);
    const candidate = arr(data.candidate);
    const universe = arr(data.universe);
    const pool = arr(data.pool30);
    const profiles = arr(data.profileAll);
    const deepProfiles = arr(data.profileDeep);

    return {
      total: rows.length || candidate.length || universe.length || 0,
      candidate_count: candidate.length || rows.filter(r => r.is_candidate || r.in_candidate).length,
      universe_count: universe.length || rows.filter(r => r.is_universe || r.in_universe).length,
      pool30_count: pool.length || rows.filter(r => r.is_pool30 || r.in_pool30).length,
      profile_count: profiles.length || rows.filter(r => r.has_profile || r.has_generic_profile).length,
      deep_profile_count: deepProfiles.length || rows.filter(r => r.has_deep_profile).length,
      avg_m1_score: avg(rows.map(r => r.M1_score ?? r.m1_score)),
      max_m1_score: rows.length ? Math.max(...rows.map(r => num(r.M1_score ?? r.m1_score, -Infinity))) : null,
      min_m1_score: rows.length ? Math.min(...rows.map(r => num(r.M1_score ?? r.m1_score, Infinity))) : null,
      cc_rank_counts: countBy(rows, r => r.eps_coverage_grade || r.cc_rank || (r.eps_engine && r.eps_engine.cc_rank)),
      score_quality_counts: countBy(rows, r => r.score_quality),
      category_counts: countBy(rows, r => r.category),
      scope_counts: countBy(rows, r => r.m1_scope || (r.is_candidate ? "candidate" : r.is_universe ? "universe" : "other")),
      problem_counts: buildProblemCounts(rows)
    };
  }

  function buildProblemCounts(rows) {
    const out = {};
    rows.forEach(r => {
      const flags = Array.isArray(r.problem_flags) ? r.problem_flags : [];
      flags.forEach(f => { out[f] = (out[f] || 0) + 1; });
      if (r.has_m7 === false) out.missing_m7 = (out.missing_m7 || 0) + 1;
      if (r.has_runtime === false) out.missing_runtime = (out.missing_runtime || 0) + 1;
      if (r.is_candidate === false) out.not_in_candidate_80 = (out.not_in_candidate_80 || 0) + 1;
      if (r.is_universe === false) out.not_in_universe_150 = (out.not_in_universe_150 || 0) + 1;
    });
    return out;
  }

  function normalizeSummary(data) {
    const s = (data.m1Scores && data.m1Scores.summary) ||
              (data.m1Scores && data.m1Scores.meta && data.m1Scores.meta.summary) ||
              null;
    return s || fallbackSummary(data);
  }

  function topEntries(obj, max = 3) {
    return Object.entries(obj || {})
      .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
      .slice(0, max);
  }

  function healthLevel(summary) {
    const total = num(summary.total, 0) || 0;
    const profile = num(summary.profile_count, 0) || 0;
    const missingRuntime = num(summary.problem_counts && summary.problem_counts.missing_runtime, 0) || 0;
    const profilePct = total ? profile / total * 100 : 0;
    const missPct = total ? missingRuntime / total * 100 : 0;
    if (profilePct >= 70 && missPct <= 20) return { cls: "ok", label: "High" };
    if (profilePct >= 30 || missPct <= 60) return { cls: "warn", label: "Medium" };
    return { cls: "bad", label: "Low" };
  }

  function mini(label, value, note, cls = "") {
    return `
      <div class="mm-m1-mini ${cls}">
        <div class="mm-m1-mini-k">${esc(label)}</div>
        <div class="mm-m1-mini-v">${esc(value)}</div>
        <div class="mm-m1-mini-d">${esc(note || "")}</div>
      </div>
    `;
  }

  function render(summary) {
    const el = $("b5-m1-summary");
    if (!el) return;

    const total = num(summary.total, 0) || 0;
    const candidate = num(summary.candidate_count, 0) || 0;
    const universe = num(summary.universe_count, 0) || 0;
    const pool30 = num(summary.pool30_count, 0) || 0;
    const profile = num(summary.profile_count, 0) || 0;
    const deepProfile = num(summary.deep_profile_count, 0) || 0;
    const avgScore = num(summary.avg_m1_score);
    const quality = healthLevel(summary);
    const cc = summary.cc_rank_counts || {};
    const issues = topEntries(summary.problem_counts || {}, 4);
    const cats = topEntries(summary.category_counts || {}, 5);

    const coveragePct = total ? profile / total * 100 : null;
    const deepPct = total ? deepProfile / total * 100 : null;
    const candidatePct = total ? candidate / total * 100 : null;
    const poolPct = candidate ? pool30 / candidate * 100 : null;

    el.innerHTML = `
      ${styleBlock()}
      <div class="mm-m1-summary-pro">
        <div class="mm-m1-topline">
          <div>
            <div class="mm-m1-title">M1 Data Readiness</div>
            <div class="mm-m1-sub">程式已可跑；此區重點看資料覆蓋與選股漏斗是否可信。</div>
          </div>
          <span class="mm-m1-health ${quality.cls}">${quality.label}</span>
        </div>

        <div class="mm-m1-mini-grid">
          ${mini("Total", fmt(total), "m1_scores universe", "")}
          ${mini("Candidate", `${fmt(candidate)} / ${fmt(total)}`, `${pct(candidatePct, 1)} of total`, "ok")}
          ${mini("Pool30", fmt(pool30), `${pct(poolPct, 1)} of candidate`, "ok")}
          ${mini("M1 Avg", avgScore === null ? "--" : fmt(avgScore, 2), `max ${fmt(summary.max_m1_score, 2)} / min ${fmt(summary.min_m1_score, 2)}`, "")}
        </div>

        <div class="mm-m1-bar-block">
          <div class="mm-m1-bar-head"><span>Profile Coverage</span><b>${fmt(profile)} / ${fmt(total)} (${pct(coveragePct, 1)})</b></div>
          <div class="mm-m1-bar"><i style="width:${Math.max(0, Math.min(100, coveragePct || 0))}%"></i></div>
          <div class="mm-m1-bar-foot">Deep profile：${fmt(deepProfile)} / ${fmt(total)} (${pct(deepPct, 1)})</div>
        </div>

        <div class="mm-m1-line"><span>CC Quality</span><b>A ${fmt(cc.A || cc.a || 0)}｜B ${fmt(cc.B || cc.b || 0)}｜C ${fmt(cc.C || cc.c || 0)}｜D ${fmt(cc.D || cc.d || 0)}</b></div>
        <div class="mm-m1-line"><span>Category</span><b>${cats.map(([k,v]) => `${k}:${v}`).join("｜") || "--"}</b></div>
        <div class="mm-m1-line warn"><span>Data Issues</span><b>${issues.map(([k,v]) => `${k}:${v}`).join("｜") || "--"}</b></div>
      </div>
    `;
  }

  function styleBlock() {
    if (document.getElementById("mm-m1-summary-pro-style")) return "";
    return `
      <style id="mm-m1-summary-pro-style">
        .mm-m1-summary-pro{display:grid;gap:10px}
        .mm-m1-topline{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;border:1px solid #e4edf6;background:#f8fbff;border-radius:14px;padding:10px}
        .mm-m1-title{font-size:13px;font-weight:1000;color:#0f172a}
        .mm-m1-sub{font-size:11px;line-height:1.45;color:#667085;margin-top:3px;font-weight:750}
        .mm-m1-health{border-radius:999px;padding:4px 8px;font-size:11px;font-weight:1000;border:1px solid #d0d5dd;background:#fff}
        .mm-m1-health.ok{background:#eaf8f1;color:#188b58;border-color:#ccead9}
        .mm-m1-health.warn{background:#fff4df;color:#b9770e;border-color:#f1dfb5}
        .mm-m1-health.bad{background:#fff0f0;color:#be3f3f;border-color:#f0cfcf}
        .mm-m1-mini-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
        .mm-m1-mini{border:1px solid #e4edf6;border-radius:13px;background:#fff;padding:9px}
        .mm-m1-mini.ok{background:#fbfffd;border-color:#ccead9}
        .mm-m1-mini-k{font-size:10px;color:#667085;font-weight:900;text-transform:uppercase}
        .mm-m1-mini-v{font-size:17px;font-weight:1000;margin-top:4px;color:#0f172a}
        .mm-m1-mini-d{font-size:10px;color:#667085;margin-top:3px;font-weight:750;line-height:1.35}
        .mm-m1-bar-block{border:1px solid #e4edf6;background:#fff;border-radius:13px;padding:9px}
        .mm-m1-bar-head,.mm-m1-bar-foot,.mm-m1-line{display:flex;justify-content:space-between;gap:8px;align-items:center;font-size:11px;color:#667085;font-weight:800}
        .mm-m1-bar-head b,.mm-m1-line b{color:#0f172a;text-align:right}
        .mm-m1-bar{height:8px;border-radius:999px;background:#edf2f7;overflow:hidden;margin:8px 0}
        .mm-m1-bar i{display:block;height:100%;background:linear-gradient(90deg,#7bc6ff,#2f80ed)}
        .mm-m1-line{border-top:1px dashed #e8eef5;padding-top:7px;line-height:1.4}
        .mm-m1-line.warn b{color:#b9770e}
      </style>
    `;
  }

  async function init() {
    const existing = window.MM_DASHBOARD_DATA || window.mmDashboardData || window.MM_STATE || {};
    const data = {
      m1Scores: existing.m1Scores || await fetchJson(PATHS.m1Scores),
      pool30: existing.pool30 || await fetchJson(PATHS.pool30),
      candidate: existing.m1Candidate || await fetchJson(PATHS.candidate),
      universe: existing.m1Universe || await fetchJson(PATHS.universe),
      profileAll: existing.profileAll || await fetchJson(PATHS.profileAll),
      profileDeep: existing.profileDeep || await fetchJson(PATHS.profileDeep)
    };
    render(normalizeSummary(data));
  }

  window.MMM1Summary = { init, render, normalizeSummary };
  window.MMModuleM1Summary = window.MMM1Summary;

  document.addEventListener("DOMContentLoaded", init);
})();

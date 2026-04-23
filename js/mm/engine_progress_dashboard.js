(function () {
  const DATA_PATH = "../data/mm/engine_progress_dashboard.json";

  function statusPill(status) {
    if (status === "PRODUCTION") return '<span class="pill ok">PRODUCTION</span>';
    if (status === "SANDBOX" || status === "STAGING") return `<span class="pill warn">${status}</span>`;
    return `<span class="pill bad">${status}</span>`;
  }

  function yn(v) {
    return v ? "✅" : "—";
  }

  function setError(msg) {
    const box = document.getElementById("dashboard-error");
    box.style.display = "block";
    box.textContent = msg;
  }

  function renderOverview(overview) {
    const el = document.getElementById("overview");
    el.innerHTML = [
      card("Overall Progress", `${overview.overall_progress_pct ?? "--"}%`),
      card("Production Stability", overview.production_stability || "--"),
      card("Critical Blockers", String(overview.critical_blockers_count ?? "--")),
      card("Active Milestones", String((overview.active_milestones || []).length))
    ].join("");
  }

  function renderModuleSwitch(items) {
    const box = document.getElementById("module-switch");
    if (!box) return;
    const allowed = new Set(["M1", "M3", "M7", "M8", "M9"]);
    box.innerHTML = (items || []).filter(x => allowed.has(x?.module_id)).map(x => {
      if (x?.enabled) {
        return `<a class="module-btn" href="${x.path || '#'}">${x.label || x.module_id || "--"}</a>`;
      }
      return `<span class="module-btn disabled">${x.label || x.module_id || "--"}（coming soon）</span>`;
    }).join("");
  }

  function renderParameterController(data) {
    const box = document.getElementById("param-controller");
    if (!box) return;
    box.innerHTML = [
      `<div><b>目前 MM 參數檔（Current Config）：</b> ${data?.config_file || "--"}</div>`,
      `<div class="control-grid" style="margin-top:8px;">
        <div class="control-item">
          <label>market_regime</label>
          <select disabled><option>${data?.current_market_regime || "--"}</option></select>
        </div>
        <div class="control-item">
          <label>industry_regime</label>
          <select disabled><option>${data?.current_industry_regime_policy || "--"}</option></select>
        </div>
        <div class="control-item">
          <label>valuation_archetype toggle</label>
          <input disabled value="${data?.archetype_layer_enabled ? "Enabled" : "Disabled"}" />
        </div>
        <div class="control-item">
          <label>valuation curve profile</label>
          <select disabled><option>${data?.valuation_curve_profile || "--"}</option></select>
        </div>
      </div>`,
      `<div style="margin-top:8px;"><b>scoring weights summary：</b> ${data?.scoring_weights_summary || "--"}</div>`,
      `<div class="formula-box">${data?.anchor_formula_summary || "--"}</div>`
    ].join("");
  }

  function renderEngineActions(rows) {
    const box = document.getElementById("engine-actions");
    if (!box) return;
    box.innerHTML = `<div class="actions-grid">${(rows || []).map(x => `
      <div class="action-card">
        <div style="font-weight:700;">${x.name || "--"}</div>
        <div style="font-size:12px; color:#667085; margin-top:4px;">${x.description || "--"}</div>
        <button class="action-btn" disabled>${x.button_label || "Run"}</button>
      </div>
    `).join("")}</div>`;
  }

  function renderOutputDemo(data) {
    const box = document.getElementById("output-demo");
    if (!box) return;

    const demoItems = (data?.demo_outputs || []).map(x => `
      <div class="demo-item">
        <div><a href="${x.path || '#'}" target="_blank" rel="noopener noreferrer">${x.name || "--"}</a></div>
        <div style="font-size:12px; color:#667085; margin-top:4px;">${x.summary || "--"}</div>
      </div>
    `).join("");

    const topM7 = (data?.top_m7_preview || []).map(x =>
      `#${x.rank} ${x.symbol}（FCN ${x.fcn_score ?? "--"} / Active ${x.active_score ?? "--"}）`
    ).join("<br>");

    box.innerHTML = [
      `<div style="font-weight:700; margin:0 0 6px;">Dynamic Anchor Demo</div>`,
      `<div>${data?.dynamic_anchor_focus || "--"}</div>`,
      `<div class="demo-grid" style="margin-top:8px;">${demoItems || "<div class='demo-item'>無</div>"}</div>`,
      `<div style="font-weight:700; margin:10px 0 6px;">M7 Top Score Preview（Single-stock engine output）</div>`,
      `<div>${topM7 || "無"}</div>`,
      `<div style="font-weight:700; margin:10px 0 6px;">關鍵分歧摘要（Divergence Highlights）</div>`,
      `<div>${(data?.divergence_highlights || []).map(x => `• ${x}`).join("<br>") || "無"}</div>`
    ].join("");
  }

  function renderActiveBuildContext(ctx) {
    const box = document.getElementById("active-build-context");
    if (!box) return;

    const line = (v) => {
      if (Array.isArray(v)) return v.length ? v.join(", ") : "--";
      if (typeof v === "string") return v.trim() || "--";
      return v ?? "--";
    };

    box.innerHTML = [
      "目前任務 Current Task：",
      line(ctx?.current_task),
      "",
      "本輪重點 Current Focus：",
      line(ctx?.current_focus),
      "",
      "正式版已鎖定模組 Production Locked：",
      line(ctx?.production_modules_locked),
      "",
      "目前 Sandbox：",
      line(ctx?.sandbox_modules_active),
      "",
      "本輪可做 Allowed Scope：",
      line(ctx?.allowed_scope),
      "",
      "本輪禁止 Forbidden Scope：",
      line(ctx?.forbidden_scope)
    ].join("<br>");
  }

  function card(k, v) {
    return `<div class="card"><div class="k">${k}</div><div class="v">${v}</div></div>`;
  }

  function renderEngines(rows) {
    const tbody = document.getElementById("engine-table");
    tbody.innerHTML = (rows || []).map(r => `
      <tr>
        <td>${r.name || r.engine_id || "--"}</td>
        <td>${statusPill(r.status || "--")}</td>
        <td>${r.readiness_score ?? "--"}</td>
        <td>${r.formula_externalized_pct ?? "--"}%</td>
        <td>${r.next_gate || "--"}</td>
        <td>${r.notes || "--"}</td>
      </tr>
    `).join("");
  }

  function renderDataReadiness(rows) {
    const tbody = document.getElementById("data-table");
    tbody.innerHTML = (rows || []).map(r => `
      <tr>
        <td>${r.artifact_id || "--"}</td>
        <td>${statusPill(r.status || "--")}</td>
        <td>${r.coverage_pct ?? "--"}%</td>
        <td>${r.missing_rate ?? "--"}</td>
        <td>${r.freshness || "--"}</td>
        <td>${r.validator_status || "--"}</td>
      </tr>
    `).join("");
  }

  function renderFormulas(rows) {
    const tbody = document.getElementById("formula-table");
    tbody.innerHTML = (rows || []).map(r => `
      <tr>
        <td>${r.domain || "--"}</td>
        <td>${r.total_formulas ?? "--"}</td>
        <td>${r.registered_formulas ?? "--"}</td>
        <td>${r.hardcoded_formulas ?? "--"}</td>
        <td>${r.normalization_pct ?? "--"}%</td>
        <td>${yn(r.policy_linked)}</td>
      </tr>
    `).join("");
  }

  function renderModules(rows) {
    const tbody = document.getElementById("module-table");
    tbody.innerHTML = (rows || []).map(r => `
      <tr>
        <td>${r.module_id || "--"}</td>
        <td>${statusPill(r.status || "--")}</td>
        <td>${r.module_readiness_score ?? "--"}</td>
        <td>${yn(r.runtime_dependency_ready)}</td>
        <td>${yn(r.adapter_dependency_ready)}</td>
        <td>${yn(r.go_live_gate_passed)}</td>
      </tr>
    `).join("");
  }

  function renderRisks(rows) {
    const box = document.getElementById("risk-list");
    const list = (rows || []).map(r => `• [${r.severity || "--"}] ${r.title || "--"}（${r.status || "--"}）`).join("<br>");
    box.innerHTML = list || "無";
  }

  function renderMilestones(rows) {
    const box = document.getElementById("milestone-list");
    const list = (rows || []).map(r => `• ${r.name || "--"} / ${r.phase || "--"} / ${r.status || "--"}`).join("<br>");
    box.innerHTML = list || "無";
  }

  function renderHandoffMemory(mem) {
    const box = document.getElementById("handoff-memory");
    if (!box) return;

    const created = (mem?.recently_created_files || []).length
      ? (mem.recently_created_files || []).map(x => `  - ${x}`).join("<br>")
      : "  - 無";

    const modified = (mem?.recently_modified_files || []).length
      ? (mem.recently_modified_files || []).map(x => `  - ${x}`).join("<br>")
      : "  - 無";

    const risks = (mem?.known_risks || []).length
      ? (mem.known_risks || []).map(x => `  - ${x}`).join("<br>")
      : "  - 無";

    box.innerHTML = [
      "• 最近新增檔案：",
      created,
      "• 最近修改檔案：",
      modified,
      `• 上一個完成任務：${mem?.last_completed_task || "--"}`,
      `• 下一步：${mem?.next_task || "--"}`,
      "• 目前風險提醒：",
      risks
    ].join("<br>");
  }

  async function init() {
    try {
      const res = await fetch(DATA_PATH, { cache: "no-store" });
      if (!res.ok) throw new Error(`讀取失敗：${res.status}`);
      const dashboardData = await res.json();

      document.getElementById("generatedAt").textContent = `資料時間：${dashboardData.generated_at || "--"} ｜ 版本：${dashboardData.version || "--"}`;
      renderModuleSwitch(dashboardData.module_switch || []);
      renderParameterController(dashboardData.parameter_controller || {});
      renderEngineActions(dashboardData.engine_actions || []);
      renderOutputDemo(dashboardData.output_demo || {});
      renderActiveBuildContext(dashboardData.active_build_context || {});
      renderOverview(dashboardData.overview || {});
      renderEngines(dashboardData.engines || []);
      renderDataReadiness(dashboardData.data_artifacts || []);
      renderFormulas(dashboardData.formula_domains || []);
      renderModules(dashboardData.modules || []);
      renderRisks(dashboardData.blockers || []);
      renderMilestones(dashboardData.milestones || []);
      renderHandoffMemory(dashboardData.handoff_memory || {});
    } catch (err) {
      setError(`Engine Progress Dashboard 載入失敗：${err.message}`);
    }
  }

  init();
})();

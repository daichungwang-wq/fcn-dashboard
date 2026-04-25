(function () {
  const DATA_PATH = "../data/mm/engine_progress_dashboard.json";
  const SCORES_PATH = "../data/m7_sandbox/m7_v2_scores.json";
  const AUDIT_PATH = "../data/m7_sandbox/m7_formula_input_audit.json";
  const RUNTIME_PATH = "../data/runtime_staging/market_runtime_long_horizon.json";

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
    if (!box) return;
    box.style.display = "block";
    box.textContent = msg;
  }

  function card(k, v) {
    return `
      <div class="card">
        <div class="k">${k}</div>
        <div class="v">${v}</div>
      </div>
    `;
  }

  function renderOverview(overview) {
    const el = document.getElementById("overview");
    if (!el) return;

    el.innerHTML = [
      card("Overall Progress", `${overview.overall_progress_pct ?? "--"}%`),
      card("Production Stability", overview.production_stability || "--"),
      card("Critical Blockers", overview.critical_blockers_count ?? "--"),
      card("Active Milestones", (overview.active_milestones || []).length)
    ].join("");
  }

  function renderModuleSwitch(items) {
    const box = document.getElementById("module-switch");
    if (!box) return;

    box.innerHTML = (items || []).map(x => {
      if (x.enabled) {
        return `
          <a class="module-btn" href="${x.path}">
            ${x.label}
          </a>
        `;
      }

      return `
        <span class="module-btn disabled">
          ${x.label}
        </span>
      `;
    }).join("");
  }

  //---------------------------------------------------
  // MM CONTROL CENTER (NEW)
  //---------------------------------------------------
  function renderParameterController(data) {
    const box = document.getElementById("param-controller");
    if (!box) return;

    const savedConfig = JSON.parse(
      localStorage.getItem("mm_parameter_config_v1") || "{}"
    );

    function controlBlock(title, items) {
      return `
        <details class="collapsible-section">
          <summary>${title}</summary>

          <div class="group-box">
            <div class="control-grid">
              ${(items || []).map(x => {
                const currentVal =
                  savedConfig[x.key] ??
                  x.value ??
                  "";

                return `
                  <div class="control-item">
                    <label>${x.label || "--"}</label>

                    <input
                      class="mm-param-input"
                      data-param="${x.key || "unknown"}"
                      value="${currentVal}"
                    />

                    <div class="mini" style="margin-top:6px;">
                      original: ${x.value || "--"}
                    </div>

                    <div class="mini">
                      ${x.note || ""}
                    </div>
                  </div>
                `;
              }).join("")}
            </div>
          </div>
        </details>
      `;
    }

    box.innerHTML = `
      <div>
        <b>Current Config File:</b>
        ${data.config_file || "--"}
      </div>

      ${controlBlock(
        "A. Core Valuation Controls",
        data?.groups?.core_valuation_controls
      )}

      ${controlBlock(
        "B. Score Architecture Controls",
        data?.groups?.score_architecture_controls
      )}

      ${controlBlock(
        "C. Runtime Controls",
        data?.groups?.runtime_execution_controls
      )}

      <div style="margin-top:16px; display:flex; gap:10px;">
        <button id="save-mm-config" class="action-btn">
          Save Config
        </button>

        <button id="reset-mm-config" class="action-btn">
          Reset Config
        </button>

        <button id="export-mm-config" class="action-btn">
          Export Config
        </button>
      </div>
    `;
  }

  function initParameterControlActions() {
    const saveBtn = document.getElementById("save-mm-config");
    const resetBtn = document.getElementById("reset-mm-config");
    const exportBtn = document.getElementById("export-mm-config");

    if (saveBtn) {
      saveBtn.addEventListener("click", () => {
        const inputs =
          document.querySelectorAll(".mm-param-input");

        const config = {};

        inputs.forEach(input => {
          const key = input.dataset.param;
          const val = Number(input.value);

          config[key] = Number.isFinite(val)
            ? val
            : input.value;
        });

        localStorage.setItem(
          "mm_parameter_config_v1",
          JSON.stringify(config)
        );

        alert("MM config saved.");
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        localStorage.removeItem(
          "mm_parameter_config_v1"
        );

        alert("MM config reset.");
        location.reload();
      });
    }

    if (exportBtn) {
      exportBtn.addEventListener("click", () => {
        const config =
          localStorage.getItem(
            "mm_parameter_config_v1"
          );

        console.log(
          "MM CONFIG EXPORT:",
          config
        );

        alert(
          "Config exported to browser console."
        );
      });
    }
  }

  function setupGlobalExpandCollapse() {
    const expandBtn =
      document.getElementById("expand-all-btn");

    const collapseBtn =
      document.getElementById("collapse-all-btn");

    const all = () =>
      Array.from(
        document.querySelectorAll(
          ".collapsible-section"
        )
      );

    if (expandBtn) {
      expandBtn.addEventListener(
        "click",
        () => {
          all().forEach(el => {
            el.open = true;
          });
        }
      );
    }

    if (collapseBtn) {
      collapseBtn.addEventListener(
        "click",
        () => {
          all().forEach(el => {
            el.open = false;
          });
        }
      );
    }
  }

  async function init() {
    try {
      const [
        dashboardRes,
        scoresRes,
        auditRes,
        runtimeRes
      ] = await Promise.all([
        fetch(DATA_PATH),
        fetch(SCORES_PATH),
        fetch(AUDIT_PATH),
        fetch(RUNTIME_PATH)
      ]);

      const dashboardData =
        await dashboardRes.json();

      const scoresData =
        await scoresRes.json();

      const auditData =
        await auditRes.json();

      const runtimeData =
        await runtimeRes.json();

      document.getElementById(
        "generatedAt"
      ).textContent =
        `資料時間：${dashboardData.generated_at || "--"}`;

      renderModuleSwitch(
        dashboardData.module_switch || []
      );

      renderParameterController(
        dashboardData.parameter_controller || {}
      );

      renderOverview(
        dashboardData.overview || {}
      );

      setupGlobalExpandCollapse();

      initParameterControlActions();

      console.log(
        "M7 rows:",
        scoresData?.rows?.length || 0
      );

      console.log(
        "Audit rows:",
        auditData?.rows?.length || 0
      );

      console.log(
        "Runtime rows:",
        Object.keys(
          runtimeData?.rows || {}
        ).length
      );

    } catch (err) {
      setError(err.message);
    }
  }

  init();

})();

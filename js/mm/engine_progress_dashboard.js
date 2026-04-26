(function () {
  const DASHBOARD_PATH = "../data/mm/engine_progress_dashboard.json";
  const SCORE_PATH = "../data/m7_sandbox/m7_v2_scores.json";

  // ------------------------
  // helpers
  // ------------------------
  function $(id) {
    return document.getElementById(id);
  }

  function safe(v, d = "--") {
    return v === null || v === undefined || v === ""
      ? d
      : v;
  }

  function num(v, d = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  }

  function loadMMConfig() {
    try {
      return JSON.parse(
        localStorage.getItem("mm_parameter_config_v1") || "{}"
      );
    } catch (e) {
      return {};
    }
  }

  function saveMMConfig(config) {
    localStorage.setItem(
      "mm_parameter_config_v1",
      JSON.stringify(config)
    );
  }

  function formatDelta(a, b) {
    const oldVal = num(a, null);
    const newVal = num(b, null);

    if (oldVal === null || newVal === null) {
      return "--";
    }

    const delta = newVal - oldVal;

    if (delta > 0) return `+${delta.toFixed(2)}`;
    if (delta < 0) return delta.toFixed(2);

    return "0";
  }

  // ------------------------
  // overview
  // ------------------------
  function renderOverview(data) {
    const box = $("overview-section");
    if (!box) return;

    const overview = data.overview || {};

    box.innerHTML = `
      <div class="metric-grid">
        <div class="metric-card">
          <div class="metric-title">Overall Progress</div>
          <div class="metric-value">${safe(
            overview.overall_progress_pct
          )}%</div>
        </div>

        <div class="metric-card">
          <div class="metric-title">Critical Blockers</div>
          <div class="metric-value">${safe(
            overview.critical_blockers_count
          )}</div>
        </div>

        <div class="metric-card">
          <div class="metric-title">Production Stability</div>
          <div class="metric-value">${safe(
            overview.production_stability
          )}</div>
        </div>
      </div>
    `;
  }

  // ------------------------
  // MM CONTROL CENTER
  // ------------------------
  function renderParameterController(data) {
    const box = $("param-controller");
    if (!box) return;

    const savedConfig = loadMMConfig();

    function buildGroup(title, rows) {
      return `
        <details class="collapsible-section" open>
          <summary>${title}</summary>

          <div class="control-grid">

            ${(rows || [])
              .map((row) => {
                const originalVal = row.value;
                const currentVal =
                  savedConfig[row.key] ?? originalVal;

                return `
                  <div class="control-card">

                    <div class="control-title">
                      ${safe(row.label)}
                    </div>

                    <input
                      class="mm-param-input"
                      data-key="${row.key}"
                      data-original="${originalVal}"
                      value="${currentVal}"
                    />

                    <div class="mini-row">
                      original:
                      ${safe(originalVal)}
                    </div>

                    <div class="mini-row delta-box">
                      changed:
                      ${safe(currentVal)}
                    </div>

                    <div class="mini-row delta-box">
                      delta:
                      ${formatDelta(
                        originalVal,
                        currentVal
                      )}
                    </div>

                    <div class="mini-note">
                      ${safe(row.note, "")}
                    </div>

                  </div>
                `;
              })
              .join("")}

          </div>
        </details>
      `;
    }

    box.innerHTML = `
      <div class="config-header">
        Current Config:
        ${safe(data.config_file)}
      </div>

      ${buildGroup(
        "A. Core Valuation Controls",
        data?.groups?.core_valuation_controls
      )}

      ${buildGroup(
        "B. Score Architecture Controls",
        data?.groups?.score_architecture_controls
      )}

      ${buildGroup(
        "C. Runtime Controls",
        data?.groups?.runtime_execution_controls
      )}

      <div class="action-row">
        <button id="save-mm-config">
          Save Config
        </button>

        <button id="reset-mm-config">
          Reset Config
        </button>

        <button id="export-mm-config">
          Export Config
        </button>
      </div>
    `;
  }

  function initParameterActions() {
    const saveBtn = $("save-mm-config");
    const resetBtn = $("reset-mm-config");
    const exportBtn = $("export-mm-config");

    if (saveBtn) {
      saveBtn.addEventListener("click", () => {
        const inputs =
          document.querySelectorAll(
            ".mm-param-input"
          );

        const config = {};

        inputs.forEach((input) => {
          const key = input.dataset.key;
          const val = Number(input.value);

          config[key] = Number.isFinite(val)
            ? val
            : input.value;
        });

        saveMMConfig(config);

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
        console.log(
          "MM CONFIG:",
          localStorage.getItem(
            "mm_parameter_config_v1"
          )
        );

        alert(
          "Config exported to browser console."
        );
      });
    }
  }

  // ------------------------
  // output preview
  // ------------------------
  function renderOutputPreview(scoreData) {
    const box = $("output-preview");
    if (!box) return;

    const rows = scoreData.rows || [];

    const top = rows
      .sort(
        (a, b) =>
          (b.m7_final_score || 0) -
          (a.m7_final_score || 0)
      )
      .slice(0, 10);

    box.innerHTML = `
      <table class="preview-table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Final</th>
            <th>Valuation</th>
            <th>Trend</th>
            <th>Structure</th>
          </tr>
        </thead>

        <tbody>
          ${top
            .map(
              (x) => `
              <tr>
                <td>${x.symbol}</td>
                <td>${safe(
                  x.m7_final_score
                )}</td>
                <td>${safe(
                  x.valuation_score
                )}</td>
                <td>${safe(
                  x.trend_score
                )}</td>
                <td>${safe(
                  x.structure_score
                )}</td>
              </tr>
            `
            )
            .join("")}
        </tbody>
      </table>
    `;
  }

  // ------------------------
  // automation panel
  // ------------------------
  function renderAutomationPanel() {
    const box = $("automation-panel");
    if (!box) return;

    box.innerHTML = `
      <div class="automation-box">
        Future Scope:
        python rerun / auto batch / config sync
      </div>
    `;
  }

  // ------------------------
  // module routing
  // ------------------------
  function renderModuleRouting(data) {
    const box = $("module-routing");
    if (!box) return;

    const rows =
      data.module_switch || [];

    box.innerHTML = rows
      .map(
        (x) => `
      <a
        class="module-link"
        href="${x.path}"
      >
        ${x.label}
      </a>
    `
      )
      .join("");
  }

  // ------------------------
  // reporting
  // ------------------------
  function renderReporting(data) {
    const box = $("system-reporting");
    if (!box) return;

    box.innerHTML = `
      <div class="report-box">
        Generated:
        ${safe(data.generated_at)}
      </div>
    `;
  }

  // ------------------------
  // expand collapse
  // ------------------------
  function initExpandCollapse() {
    const expandBtn =
      $("expand-all-btn");

    const collapseBtn =
      $("collapse-all-btn");

    if (expandBtn) {
      expandBtn.onclick = () => {
        document
          .querySelectorAll(
            ".collapsible-section"
          )
          .forEach((x) => {
            x.open = true;
          });
      };
    }

    if (collapseBtn) {
      collapseBtn.onclick = () => {
        document
          .querySelectorAll(
            ".collapsible-section"
          )
          .forEach((x) => {
            x.open = false;
          });
      };
    }
  }

  // ------------------------
  // init
  // ------------------------
  async function init() {
    try {
      const [
        dashboardRes,
        scoreRes
      ] = await Promise.all([
        fetch(DASHBOARD_PATH),
        fetch(SCORE_PATH)
      ]);

      const dashboardData =
        await dashboardRes.json();

      const scoreData =
        await scoreRes.json();

      renderOverview(
        dashboardData
      );

      renderParameterController(
        dashboardData.parameter_controller
      );

      renderOutputPreview(
        scoreData
      );

      renderAutomationPanel();

      renderModuleRouting(
        dashboardData
      );

      renderReporting(
        dashboardData
      );

      initParameterActions();
      initExpandCollapse();

      console.log(
        "MM dashboard loaded"
      );
    } catch (err) {
      console.error(err);
    }
  }

  init();
})();

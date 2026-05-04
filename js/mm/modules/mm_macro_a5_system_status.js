// ==========================================
// A5 MODULE: System Status / M&M Progress
// ==========================================

export function renderA5SystemStatus(containerId, data) {
  const el = document.getElementById(containerId);
  if (!el) return;

  const modules = normalizeModules(data);
  const confidence = computeSystemConfidence(modules);

  el.innerHTML = `
    <div class="mm-card a5-card">
      <div class="mm-card-header" onclick="toggleA5Expand()">
        <div class="title">A5 系統狀態（M&M Progress）</div>
        <div class="summary">
          <span class="confidence ${confidence.color}">
            ${confidence.label}
          </span>
          <span class="hint">（點擊展開）</span>
        </div>
      </div>

      <div class="mm-card-body collapsed" id="a5-body">

        <!-- 收合版 -->
        <div class="a5-collapsed">
          ${renderCollapsed(modules)}
        </div>

        <!-- 展開版 -->
        <div class="a5-expanded">
          ${renderExpanded(modules, confidence)}
        </div>

      </div>
    </div>
  `;
}

// ==========================================
// TOGGLE
// ==========================================
window.toggleA5Expand = function () {
  const el = document.getElementById("a5-body");
  if (!el) return;
  el.classList.toggle("collapsed");
};

// ==========================================
// NORMALIZE INPUT
// ==========================================
function normalizeModules(data) {
  // 預設 fallback（避免資料還沒接上）
  const defaults = {
    M1: { status: "partial", note: "資料不足" },
    M2: { status: "partial", note: "開發中" },
    M6: { status: "not_ready", note: "未完成" },
    M7: { status: "testing", note: "V2測試中" },
    MM: { status: "partial", note: "整合中" }
  };

  return { ...defaults, ...(data || {}) };
}

// ==========================================
// CONFIDENCE ENGINE（核心）
// ==========================================
function computeSystemConfidence(modules) {
  let score = 0;
  let total = 0;

  Object.values(modules).forEach(m => {
    total++;
    if (m.status === "ready") score += 1;
    else if (m.status === "testing") score += 0.6;
    else if (m.status === "partial") score += 0.4;
    else score += 0.1;
  });

  const ratio = score / total;

  if (ratio >= 0.8) {
    return {
      label: "🟢 High（可依系統執行）",
      color: "green"
    };
  } else if (ratio >= 0.5) {
    return {
      label: "🟡 Medium（可用但需判斷）",
      color: "yellow"
    };
  } else {
    return {
      label: "🔴 Low（不可依賴）",
      color: "red"
    };
  }
}

// ==========================================
// RENDER COLLAPSED
// ==========================================
function renderCollapsed(modules) {
  return Object.entries(modules)
    .map(([k, v]) => {
      return `
        <div class="row">
          <span class="name">${k}</span>
          <span class="status ${getColor(v.status)}">
            ${getLabel(v)}
          </span>
        </div>
      `;
    })
    .join("");
}

// ==========================================
// RENDER EXPANDED
// ==========================================
function renderExpanded(modules, confidence) {
  return `
    <div class="confidence-detail ${confidence.color}">
      系統可信度：${confidence.label}
    </div>

    ${Object.entries(modules)
      .map(([k, v]) => renderModuleDetail(k, v))
      .join("")}
  `;
}

function renderModuleDetail(name, m) {
  return `
    <div class="module-block ${getColor(m.status)}">
      <div class="module-title">${name}</div>
      <div class="module-status">${getLabel(m)}</div>
      <div class="module-note">${m.note || ""}</div>
    </div>
  `;
}

// ==========================================
// HELPERS
// ==========================================
function getColor(status) {
  switch (status) {
    case "ready":
      return "green";
    case "testing":
      return "yellow";
    case "partial":
      return "gray";
    case "not_ready":
      return "red";
    default:
      return "gray";
  }
}

function getLabel(m) {
  if (m.status === "ready") return "Ready";
  if (m.status === "testing") return "Testing";
  if (m.status === "partial") return "Partial";
  if (m.status === "not_ready") return "Not Ready";
  return "Unknown";
}

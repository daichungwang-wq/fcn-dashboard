function renderNewsItem(item, idx, prefix) {
  const id = `${prefix}-${idx}`;

  return `
    <div class="news-card">
      <div class="news-title">${item.title}</div>

      <div class="news-summary">
        ${item.summary}
      </div>

      <div class="news-meta">
        影響：${item.impact || "-"} ｜ 強度：${item.level || "-"}
      </div>

      <div class="news-expand" onclick="toggleNews('${id}')">
        點擊展開 / 收合
      </div>

      <div id="${id}" class="hidden news-meta">
        （這裡之後可以放完整分析 / 連結）
      </div>
    </div>
  `;
}

function renderSection(title, list, key) {
  const items = (list || []).slice(0, 10);

  return `
    <div class="section">
      <h3>${title}（${items.length}）</h3>
      ${items.length > 0
        ? items.map((n, i) => renderNewsItem(n, i, key)).join("")
        : `<p>目前無資料</p>`}
    </div>
  `;
}

export function renderModule1News(data) {
  if (!data) return `<p>目前無新聞資料</p>`;

  return `
    <div class="module1">

      <div class="summary">
        Module1 新聞雷達<br>
        國際：${data.global?.length || 0} ｜ 
        財經：${data.finance?.length || 0} ｜ 
        AI：${data.ai?.length || 0}
      </div>

      ${renderSection("國際新聞", data.global, "global")}
      ${renderSection("財經新聞", data.finance, "finance")}
      ${renderSection("AI 趨勢", data.ai, "ai")}
      ${renderSection("FCN 影響", data.fcn, "fcn")}

    </div>
  `;
}

window.toggleNews = function(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle("hidden");
};

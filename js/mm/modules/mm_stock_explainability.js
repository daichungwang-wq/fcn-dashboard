window.MMStockExplainability = (function () {

  function safe(v, fallback = "--") {
    return v === null || v === undefined || v === "" ? fallback : v;
  }

  function num(v, fallback = null) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function findStockBySymbol(symbol) {
    const rows = window.SCORES_DATA?.rows || [];

    if (!rows.length) return null;

    const target = (symbol || "NVDA").toUpperCase();

    return rows.find(
      x => (x.symbol || "").toUpperCase() === target
    ) || rows[0];
  }

  function renderStandardStockCard(symbol = "NVDA") {
    const stock = findStockBySymbol(symbol);

    const container = document.getElementById("standard-stock-card");

    if (!container || !stock) return;

    container.innerHTML = `
      <div class="metric-grid">
        <div class="metric-card">
          <div class="metric-label">Symbol</div>
          <div class="metric-value">${safe(stock.symbol)}</div>
        </div>

        <div class="metric-card">
          <div class="metric-label">Valuation</div>
          <div class="metric-value">${safe(stock.valuation_score)}</div>
        </div>

        <div class="metric-card">
          <div class="metric-label">Trend</div>
          <div class="metric-value">${safe(stock.trend_score)}</div>
        </div>

        <div class="metric-card">
          <div class="metric-label">Structure</div>
          <div class="metric-value">${safe(stock.structure_score)}</div>
        </div>

        <div class="metric-card">
          <div class="metric-label">Data Health</div>
          <div class="metric-value">${safe(stock.coverage_pct)}%</div>
        </div>

        <div class="metric-card">
          <div class="metric-label">M7 Score</div>
          <div class="metric-value">${safe(stock.m7_v2_score)}</div>
        </div>
      </div>

      <details style="margin-top:12px;">
        <summary>Trend Detail</summary>
        <div>Linear: ${safe(stock.linear_slope)}</div>
        <div>MA200: ${safe(stock.ma200_slope)}</div>
        <div>Acceleration: ${safe(stock.quadratic_a)}</div>
      </details>

      <details>
        <summary>Valuation Detail</summary>
        <div>Forward PE: ${safe(stock.forward_pe)}</div>
        <div>Anchor PE: ${safe(stock.anchor_pe)}</div>
      </details>

      <details>
        <summary>Structure Detail</summary>
        <div>Best Model: ${safe(stock.best_structure_model)}</div>
        <div>R²: ${safe(stock.best_structure_r2)}</div>
      </details>
    `;
  }

  function bindStockQuery() {
    const btn = document.getElementById("stock-query-btn");
    const input = document.getElementById("stock-query-input");

    if (!btn || !input) return;

    btn.onclick = () => {
      const symbol = input.value.trim() || "NVDA";
      renderStandardStockCard(symbol);
    };
  }

  function init() {
    renderStandardStockCard("NVDA");
    bindStockQuery();
  }

  return {
    init,
    renderStandardStockCard,
    findStockBySymbol
  };

})();

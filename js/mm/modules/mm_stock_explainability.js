window.MMStockExplainability=(function(){

function render(symbol="NVDA"){

  const rows=MM_STATE.scores.rows || [];
  const stock=rows.find(x=>x.symbol===symbol) || rows[0];

  const box=document.getElementById("standard-stock-card");
  if(!box || !stock) return;

  box.innerHTML=`
    <div class="panel">
      <h3>${stock.symbol} | ${stock.name}</h3>

      <div class="metric">
        <span>Valuation</span>
        <b>${stock.valuation_score}</b>
      </div>

      <div class="metric">
        <span>Trend</span>
        <b>${stock.trend_score}</b>
      </div>

      <div class="metric">
        <span>Structure</span>
        <b>${stock.structure_score}</b>
      </div>

      <div class="metric">
        <span>Data Health</span>
        <b>${stock.coverage_pct}%</b>
      </div>
    </div>
  `;
}

return {render};

})();

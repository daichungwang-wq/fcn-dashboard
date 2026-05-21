(function(){
  function fmt(v,d=2){const x=Number(v||0);return x.toLocaleString('en-US',{maximumFractionDigits:d})}
  function wan(v){return Number.isFinite(Number(v))?`${fmt(v,0)}萬`:'--'}
  function pct(v){return Number.isFinite(Number(v))?`${fmt(v,1)}%`:'--'}
  function render(state){
    const e=MMUI.q('b1-m2-summary');
    if(!e) return;
    if(!window.MMM2CashflowEngine){
      e.innerHTML='<div class="metric"><span>M2 Cashflow Engine</span><b>not loaded</b></div>';
      return;
    }
    const m2=window.MMM2CashflowEngine.build(state);
    const inputPlan=Object.entries(m2.input_plan_strategy_wan||{})
      .map(([k,v])=>`${k} ${wan(v)}`)
      .join(' / ') || '--';
    const stageHtml=Object.entries(m2.stages||{})
      .map(([k,v])=>`${k}：${wan(v)}`)
      .join('<br>');
    e.innerHTML=`
      <div class='metric'><span>Total AMT</span><b>${wan(m2.total_amt_wan)}</b></div>
      <div class='metric'><span>Input AMT</span><b>${wan(m2.input_amt_wan)}</b></div>
      <div class='metric'><span>Achieve Rate</span><b>${pct(m2.achieve_rate_pct)}</b></div>
      <div class='metric'><span>Output AMT 本月確定出場</span><b>${wan(m2.output_amt_wan)}</b></div>
      <div class='metric'><span>Input Plan</span><b>${inputPlan}</b></div>
      <div class='metric'><span>FCN Pool Evaluation</span><b>${m2.fcn_pool_evaluation}</b></div>
      <div class='metric'><span>Danger QTY / AMT</span><b>${m2.danger.qty} / ${wan(m2.danger.amt_wan)}</b></div>
      <div class='metric'><span>Tracking QTY / AMT</span><b>${m2.tracking.qty} / ${wan(m2.tracking.amt_wan)}</b></div>
      <div class='metric'><span>Health QTY / AMT</span><b>${m2.health.qty} / ${wan(m2.health.amt_wan)}</b></div>
      <div class='sub' style='margin-top:8px'><b>三階段規劃</b><br>${stageHtml}</div>
      <div class='metric'><span>今日規劃 / 已選 FCN</span><b>${wan(Object.values(m2.stages||{}).reduce((a,b)=>a+b,0))} / ${wan(m2.selected_total_wan)}</b></div>
      <div class='card-actions'>
        <a href='./m2/index.html' class='btn'>2. Holding Zones</a>
        <a href='./m2/index.html' class='btn'>3. Maturity Cashflow</a>
        <a href='./m2/index.html' class='btn'>4.D FCN 遴選</a>
      </div>`;
  }
  window.MMModuleM2={render};
})();

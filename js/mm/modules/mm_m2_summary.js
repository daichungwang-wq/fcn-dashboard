(function(){
  function fmt(v,d=2){const x=Number(v||0);return x.toLocaleString('en-US',{maximumFractionDigits:d})}
  function wan(v){return Number.isFinite(Number(v))?`${fmt(v,0)}萬`:'--'}
  function pct(v){return Number.isFinite(Number(v))?`${fmt(v,1)}%`:'--'}
  function safeObj(v){return v&&typeof v==='object'?v:{qty:0,amt_wan:0}}
  function miniTable(title,head,rows){return `<div class='sub' style='margin-top:8px'><b>${title}</b><br><span style='color:#64748b'>${head}</span><br>${rows.join('<br>')}</div>`}
  function render(state){
    const e=MMUI.q('b1-m2-summary');
    if(!e) return;
    if(!window.MMM2CashflowEngine){e.innerHTML='<div class="metric"><span>M2 Cashflow Engine</span><b>not loaded</b></div>';return;}
    const m2=window.MMM2CashflowEngine.build(state)||{};
    const signal=m2.fcn_pool_signal||{};
    const danger=safeObj(m2.danger), tracking=safeObj(m2.tracking), health=safeObj(m2.health);
    const color=signal.level==='good'?'#188b58':signal.level==='warn'?'#b9770e':'#c62828';
    const bankTarget=m2.bank_target_wan||{}, bankInput=m2.bank_input_wan||{}, bankGap=m2.bank_gap_wan||{};
    const bankOut=m2.bank_out_wan||{}, bankExpect=m2.bank_expected_out_wan||{};
    const bankDemandRows=['永豐','富邦'].map(b=>`${b}｜${wan(bankTarget[b])}｜${wan(bankInput[b])}｜${wan(bankOut[b]||0)}｜${wan(bankExpect[b]||0)}｜${wan((bankGap[b]||0)+(bankOut[b]||0)+(bankExpect[b]||0))}`);
    const actionRows=(m2.monthly_action_plan&&m2.monthly_action_plan.rows)||[];
    const planRows=actionRows.length?actionRows.map(r=>`${r.stage}｜${wan(r.plan_wan)}｜${wan(r.spec_wan||0)}｜${wan(r.aggressive_wan||0)}｜${wan(r.cashflow_wan||0)}｜${wan(r.reasonable_wan||0)}`):(m2.monthly_action_plan_lines||['目前無需投入規劃']);
    e.innerHTML=`
      ${miniTable('投資水位','Target｜Pool｜Achieve｜Signal',[`${wan(m2.fcn_target_amt_wan||m2.total_amt_wan)}｜${wan(m2.fcn_pool_amt_wan||m2.input_amt_wan)}｜${pct(m2.achieve_rate_pct)}｜<b style='color:${color}'>${m2.fcn_pool_evaluation||'--'}</b>`])}
      ${miniTable('本月 Cash Flow','Output｜Input Plan｜In Plan｜Selected',[`${wan(m2.output_amt_wan)}｜${wan(m2.input_plan_wan)}｜${wan(m2.in_plan_wan)}｜${wan(m2.selected_total_wan)}`])}
      ${miniTable('本月投資計畫','Stage｜Plan｜投機｜積極｜現金流｜合理',planRows)}
      ${miniTable('銀行資金需求','Bank｜Target｜Used｜Out｜Expect｜待補',bankDemandRows)}
      <div class='sub' style='margin-top:8px;color:#667085'>${m2.dashboard_note||''}<br>${m2.planner_hint||''}</div>
      <div class='metric'><span>Danger / Tracking / Health</span><b>${danger.qty||0} / ${tracking.qty||0} / ${health.qty||0}</b></div>
      <div class='card-actions'><a href='./m2/index.html' class='btn'>2. Holding Zones</a><a href='./m2/index.html' class='btn'>3. Maturity Cashflow</a><a href='./m2/index.html' class='btn'>4.D FCN 遴選</a></div>`;
  }
  window.MMModuleM2={render};
})();
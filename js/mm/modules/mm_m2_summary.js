(function(){
  function fmt(v,d=2){const x=Number(v||0);return x.toLocaleString('en-US',{maximumFractionDigits:d})}
  function wan(v){const x=Number(v||0);return x===0?'N/A':`${fmt(x,0)}萬`}
  function wanKeepZero(v){return Number.isFinite(Number(v))?`${fmt(v,0)}萬`:'--'}
  function pct(v){return Number.isFinite(Number(v))?`${fmt(v,1)}%`:'--'}
  function safeObj(v){return v&&typeof v==='object'?v:{qty:0,amt_wan:0}}
  function miniTable(title,heads,rows){return `<div class='sub' style='margin-top:10px'><b>${title}</b><table style='width:100%;border-collapse:collapse;margin-top:5px;font-size:12px'><thead><tr>${heads.map(h=>`<th style='text-align:left;color:#64748b;border-bottom:1px solid #e5e7eb;padding:3px 4px'>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td style='border-bottom:1px dashed #eef2f7;padding:3px 4px;white-space:nowrap'>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`}
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
    const bankRows=['永豐','富邦'].map(b=>[b,wan(bankTarget[b]),wan(bankInput[b]),wan(bankOut[b]),wan(bankExpect[b]),wan((bankGap[b]||0)+(bankOut[b]||0)+(bankExpect[b]||0))]);
    const actionRows=(m2.monthly_action_plan&&m2.monthly_action_plan.rows)||[];
    const planRows=actionRows.length?actionRows.map(r=>[r.stage,wan(r.plan_wan),wan(r.spec_wan),wan(r.aggressive_wan),wan(r.cashflow_wan),wan(r.reasonable_wan)]):[['第一階段','N/A','N/A','N/A','N/A','N/A'],['第二階段','N/A','N/A','N/A','N/A','N/A'],['第三階段','N/A','N/A','N/A','N/A','N/A']];
    const cashFlowText=Number(m2.output_amt_wan||0)>0?`本期確定出場 ${wanKeepZero(m2.output_amt_wan)}，可規劃第一階段投入 ${wanKeepZero(m2.input_plan_wan)}。`:'本期無 FCN 出場，故暫無第一階段投入計畫。';
    e.innerHTML=`
      ${miniTable('投資水位',['Target','Pool','Achieve','Signal'],[[wan(m2.fcn_target_amt_wan||m2.total_amt_wan),wan(m2.fcn_pool_amt_wan||m2.input_amt_wan),pct(m2.achieve_rate_pct),`<b style='color:${color}'>${m2.fcn_pool_evaluation||'--'}</b>`]])}
      <div class='sub' style='margin-top:10px'><b>本月 Cash Flow</b><br>${cashFlowText}</div>
      ${miniTable('本月投資計畫',['Stage','Plan','投機','積極','現金流','合理'],planRows)}
      ${miniTable('銀行資金需求',['Bank','Target','Used','Out','Expect','待補'],bankRows)}
      <div class='sub' style='margin-top:8px;color:#667085'>${m2.dashboard_note||''}<br>${m2.planner_hint||''}</div>
      <div class='metric'><span>Danger / Tracking / Health</span><b>${danger.qty||0} / ${tracking.qty||0} / ${health.qty||0}</b></div>
      <div class='card-actions'><a href='./m2/index.html' class='btn'>2. Holding Zones</a><a href='./m2/index.html' class='btn'>3. Maturity Cashflow</a><a href='./m2/index.html' class='btn'>4.D FCN 遴選</a></div>`;
  }
  window.MMModuleM2={render};
})();
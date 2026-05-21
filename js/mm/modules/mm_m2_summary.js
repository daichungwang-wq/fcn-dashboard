(function(){
  function fmt(v,d=2){const x=Number(v||0);return x.toLocaleString('en-US',{maximumFractionDigits:d})}
  function wan(v){const x=Number(v||0);return x===0?'N/A':`${fmt(x,0)}萬`}
  function wanKeepZero(v){return Number.isFinite(Number(v))?`${fmt(v,0)}萬`:'--'}
  function pct(v){return Number.isFinite(Number(v))?`${fmt(v,1)}%`:'--'}
  function safeObj(v){return v&&typeof v==='object'?v:{qty:0,amt_wan:0}}
  function section(title,html){return `<div class='sub' style='margin-top:8px'><b>${title}</b><div style='margin-top:3px;font-size:12px;line-height:1.55;color:#334155'>${html}</div></div>`}
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
    const actionRows=(m2.monthly_action_plan&&m2.monthly_action_plan.rows)||[];
    const planLine=actionRows.length?actionRows.map(r=>{
      const stage=String(r.stage||'').replace('第一階段','一').replace('第二階段','二').replace('第三階段','三');
      const parts=[]; if(Number(r.spec_wan)>0)parts.push(`投機 ${wan(r.spec_wan)}`); if(Number(r.aggressive_wan)>0)parts.push(`積極 ${wan(r.aggressive_wan)}`); if(Number(r.cashflow_wan)>0)parts.push(`現金 ${wan(r.cashflow_wan)}`); if(Number(r.reasonable_wan)>0)parts.push(`合理 ${wan(r.reasonable_wan)}`);
      return `${stage}：${wan(r.plan_wan)}${parts.length?'｜'+parts.join(' / '):''}`;
    }).join('<br>'):'一：N/A<br>二：N/A<br>三：N/A';
    const bankLine=['永豐','富邦'].map(b=>`${b}：T${wan(bankTarget[b])}｜U${wan(bankInput[b])}｜Out ${wan(bankOut[b])}｜Exp ${wan(bankExpect[b])}｜補 ${wan((bankGap[b]||0)+(bankOut[b]||0)+(bankExpect[b]||0))}`).join('<br>');
    const cashFlowText=Number(m2.output_amt_wan||0)>0?`本期確定出場 ${wanKeepZero(m2.output_amt_wan)}，可規劃第一階段投入 ${wanKeepZero(m2.input_plan_wan)}。`:'本期無 FCN 出場，故暫無第一階段投入計畫。';
    e.innerHTML=`
      ${section('投資水位',`Target ${wan(m2.fcn_target_amt_wan||m2.total_amt_wan)}｜Pool ${wan(m2.fcn_pool_amt_wan||m2.input_amt_wan)}｜達成 ${pct(m2.achieve_rate_pct)}｜<b style='color:${color}'>${m2.fcn_pool_evaluation||'--'}</b>`)}
      ${section('本月 Cash Flow',cashFlowText)}
      ${section('本月投資計畫',planLine)}
      ${section('銀行資金需求',bankLine)}
      <div class='sub' style='margin-top:8px;color:#667085;font-size:12px'>${m2.dashboard_note||''}<br>${m2.planner_hint||''}</div>
      <div class='metric'><span>Danger / Tracking / Health</span><b>${danger.qty||0} / ${tracking.qty||0} / ${health.qty||0}</b></div>
      <div class='card-actions'><a href='./m2/index.html' class='btn'>2. Holding Zones</a><a href='./m2/index.html' class='btn'>3. Maturity Cashflow</a><a href='./m2/index.html' class='btn'>4.D FCN 遴選</a></div>`;
  }
  window.MMModuleM2={render};
})();
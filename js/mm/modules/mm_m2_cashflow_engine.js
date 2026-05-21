(function(){
  if(window.MMM2CashflowEngine) return;

  const TARGET_BANK_WAN={"富邦":110,"永豐":40};
  const TOTAL_TARGET_WAN=150;
  const n=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
  const arr=v=>Array.isArray(v)?v:[];
  const sum=(list,fn)=>arr(list).reduce((s,x)=>s+n(fn(x),0),0);
  const wan=v=>Math.floor(n(v,0));

  const amountWan=x=>{
    const v=n(x&&(x.amt??x.amount_usd??x.notional_usd??x.principal_usd),NaN);
    if(Number.isFinite(v)) return v/10000;
    const w=n(x&&(x.amount_wan??x.principal_wan),NaN);
    if(Number.isFinite(w)) return w;
    const legacy=n(x&&(x.amount??x.principal??x.exposure??x.total_exposure),0);
    return legacy>1000?legacy/10000:legacy;
  };
  function isActive(row){return row&&row.status==='active'&&row.has_position===true&&row.is_portfolio===true;}
  function getBank(row){
    const raw=String(row&&(row.tw_bank||row.broker_tw||row.channel_bank||row.bank_channel||row.bank||row.broker||row.source||row.bank_source)||'').toLowerCase();
    if(raw.includes('sinopac')||raw.includes('永豐')) return '永豐';
    if(raw.includes('fubon')||raw.includes('富邦')) return '富邦';
    return '';
  }
  function inputByBank(rows){const out={"富邦":0,"永豐":0};arr(rows).forEach(r=>{const b=getBank(r);if(out[b]!=null)out[b]+=amountWan(r);});return out;}
  function evalSignal(rate){
    if(rate>=95) return {label:'健康',color:'green',color_class:'good',level:'good'};
    if(rate>=90) return {label:'注意',color:'yellow',color_class:'warn',level:'warn'};
    return {label:'偏低',color:'red',color_class:'bad',level:'bad'};
  }
  function pickRuntime(data){return data.m2Runtime||data.m2_runtime||data.runtime||data.healthRuntime||data.health_runtime||{};}
  function firstNumber(){for(const v of arguments){const x=n(v,NaN);if(Number.isFinite(x))return x;}return 0;}

  function build(state){
    const data=(state&&state.data)||{};
    const fcn=arr(data.fcnPool||data.fcn_pool);
    const pos=arr(data.positions);
    const runtimeRows=arr(data.marketRuntime||data.market_runtime);
    const allRows=fcn.length?fcn:(pos.length?pos:runtimeRows);
    const activeRows=fcn.length?fcn.filter(isActive):allRows;
    const rt=pickRuntime(data);

    const bankInput=inputByBank(activeRows);
    const inputAmtWan=bankInput['富邦']+bankInput['永豐'];
    const achieveRatePct=TOTAL_TARGET_WAN?inputAmtWan/TOTAL_TARGET_WAN*100:0;

    const confirmedOutWan=firstNumber(rt.confirmed_output_wan,rt.output_amt_wan,rt.confirmed_maturity_wan)+firstNumber(rt.confirmed_early_exit_wan)-firstNumber(rt.confirmed_assignment_wan);
    const expectedPoolWan=firstNumber(rt.expected_output_wan,rt.expected_maturity_wan)+firstNumber(rt.expected_early_exit_wan)-firstNumber(rt.expected_assignment_wan);
    const softOutputWan=Math.max(0,Math.floor(expectedPoolWan*0.5));
    const strategicOutputWan=Math.max(0,Math.floor(expectedPoolWan-softOutputWan));
    const inputPlanWan=Math.max(0,Math.floor(confirmedOutWan));
    const inPlanWan=inputPlanWan+softOutputWan+strategicOutputWan;
    const signal=evalSignal(achieveRatePct);

    return {
      version:'mm_m2_cashflow_engine_v2_dashboard_summary_only',
      total_amt_wan:TOTAL_TARGET_WAN,
      fcn_target_amt_wan:TOTAL_TARGET_WAN,
      input_amt_wan:inputAmtWan,
      fcn_pool_amt_wan:inputAmtWan,
      achieve_rate_pct:achieveRatePct,
      output_amt_wan:Math.max(0,Math.floor(confirmedOutWan)),
      input_plan_wan:inputPlanWan,
      soft_output_amt_wan:softOutputWan,
      strategic_output_amt_wan:strategicOutputWan,
      in_plan_wan:inPlanWan,
      stages:{'第一階段｜確定資金':inputPlanWan,'第二階段｜預計資金50%':softOutputWan,'第三階段｜本月投資計畫':strategicOutputWan},
      bank_target_wan:TARGET_BANK_WAN,
      bank_input_wan:bankInput,
      bank_gap_wan:{'富邦':TARGET_BANK_WAN['富邦']-bankInput['富邦'],'永豐':TARGET_BANK_WAN['永豐']-bankInput['永豐']},
      fcn_pool_evaluation_pct:achieveRatePct,
      fcn_pool_evaluation:signal.label,
      fcn_pool_signal:signal,
      dashboard_note:confirmedOutWan>0?'本月已有確定出場資金，可進入第一階段投入規劃。':'目前無確定出場金額，第一階段無需投入規劃。',
      planner_hint:inPlanWan>0?'本月投資計畫以預計出場資金為主，仍需等實際出場確認。':'目前沒有本月投入規劃。',
      selected_total_wan:n(window.__M2_MARKET_FCN_SELECTION_SUMMARY__&&window.__M2_MARKET_FCN_SELECTION_SUMMARY__.selected_total_wan,0),
      selected_summary:window.__M2_MARKET_FCN_SELECTION_SUMMARY__||null,
      source_rows:allRows.length,
      active_rows:activeRows.length
    };
  }
  window.MMM2CashflowEngine={build};
})();

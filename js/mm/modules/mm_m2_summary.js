(function(){
  function arr(v){return Array.isArray(v)?v:[]}
  function num(v,d=0){const x=Number(v);return Number.isFinite(x)?x:d}
  function isNum(v){return Number.isFinite(Number(v))}
  function fmt(v,d=2){return num(v,0).toLocaleString('en-US',{maximumFractionDigits:d})}
  function wan(v){return isNum(v)?`${fmt(v,0)}萬`:'待接 M2'}
  function pct(v){return isNum(v)?`${fmt(v,1)}%`:'待接 M2'}
  function readJson(key){try{return JSON.parse(localStorage.getItem(key)||'null')||null}catch(e){return null}}
  function sum(list,fn){return arr(list).reduce((s,x)=>s+num(fn(x),0),0)}
  function statusText(x){return String(x.status||x.zone||x.state||'').toLowerCase()}
  function amt(x){return num(x.amount_wan??x.amount??x.principal_wan??x.principal??x.exposure??x.total_exposure,0)}
  function countAmt(list,pred){const rows=arr(list).filter(pred);return {qty:rows.length,amt:sum(rows,amt)}}
  function readM2(){return {
    handoff:window.__M2_TO_MARKET_FCN_HANDOFF__||readJson('MM_M2_PLANNER_HANDOFF'),
    selection:window.__M2_MARKET_FCN_SELECTION_SUMMARY__||readJson('MM_M2_SELECTION_SUMMARY'),
    runtime:window.__M2_RUNTIME_CONTEXT__||readJson('MM_M2_RUNTIME_CONTEXT')||readJson('M2_RUNTIME_CONTEXT')
  }}
  function stageSummary(steps){const out={};arr(steps).forEach(s=>{const k=s.stage||'未分階段';out[k]=(out[k]||0)+num(s.amount_wan,0)});return out}
  function strategySummary(steps){const out={};arr(steps).forEach(s=>{const k=s.strategy||'未分類';out[k]=(out[k]||0)+num(s.amount_wan,0)});return out}
  function firstStagePlan(steps){return arr(steps).filter(s=>String(s.stage||'').includes('第一階段')||String(s.stage||'').includes('優先規劃'))}
  function totalPlanWan(ctx){
    const r=ctx.runtime||{};
    if(isNum(r.plan_base_wan)) return num(r.plan_base_wan);
    if(isNum(r.planning_base_wan)) return num(r.planning_base_wan);
    if(isNum(r.total_plan_base_wan)) return num(r.total_plan_base_wan);
    const targets=r.bank_targets_wan||r.bank_target_wan||r.bank_plan_base_wan||{};
    const t=sum(Object.values(targets),x=>x);
    if(t>0) return t;
    const bp=ctx.handoff&&ctx.handoff.base_policy;
    if(bp&&isNum(bp.total_plan_base_wan)) return num(bp.total_plan_base_wan);
    return NaN;
  }
  function inputWan(ctx){
    const r=ctx.runtime||{};
    const banks=r.bank_amounts_wan||r.bank_used_wan||r.broker_amounts_wan||{};
    const b=sum(Object.values(banks),x=>x);
    if(b>0) return b;
    if(isNum(r.active_wan)) return num(r.active_wan);
    if(isNum(r.input_wan)) return num(r.input_wan);
    if(isNum(r.invested_wan)) return num(r.invested_wan);
    return NaN;
  }
  function outputWan(ctx,rows){
    const r=ctx.runtime||{};
    if(isNum(r.hard_release_wan)) return num(r.hard_release_wan);
    if(isNum(r.confirmed_release_wan)) return num(r.confirmed_release_wan);
    if(isNum(r.output_wan)) return num(r.output_wan);
    const output=countAmt(rows,x=>/hard|release|maturity|exit|到期|出場/.test(statusText(x)));
    return output.amt>0?output.amt:NaN;
  }
  function render(state){
    const e=MMUI.q('b1-m2-summary'); if(!e) return;
    const runtime=arr(state.data.marketRuntime), fcn=arr(state.data.fcnPool), pos=arr(state.data.positions);
    const rows=fcn.length?fcn:(pos.length?pos:runtime);
    const ctx=readM2();
    const steps=arr(ctx.handoff&&ctx.handoff.steps);
    const totalAmt=totalPlanWan(ctx);
    const inputAmt=inputWan(ctx);
    const achieveRate=isNum(totalAmt)&&totalAmt>0&&isNum(inputAmt)?inputAmt/totalAmt*100:NaN;
    const outputAmt=outputWan(ctx,rows);
    const danger=countAmt(rows,x=>/danger|ki|risk|破|下限|危險/.test(statusText(x))||num(x.total_exposure,0)>=15);
    const tracking=countAmt(rows,x=>/watch|tracking|追蹤|觀察/.test(statusText(x))||(num(x.total_exposure,0)>=8&&num(x.total_exposure,0)<15));
    const health=countAmt(rows,x=>/healthy|safe|健康|安全/.test(statusText(x))||(num(x.total_exposure,0)>0&&num(x.total_exposure,0)<8));
    const stages=stageSummary(steps);
    const firstPlan=firstStagePlan(steps);
    const inputPlan=Object.entries(strategySummary(firstPlan)).map(([k,v])=>`${k} ${wan(v)}`).join(' / ')||'待接 M2';
    const planWan=sum(steps,x=>x.amount_wan);
    const selectedWan=num(ctx.selection&&ctx.selection.selected_total_wan,0);
    const poolEval=danger.qty>0?'需處理風險':tracking.qty>0?'需追蹤':(rows.length?'健康':'待接 M2');
    e.innerHTML=`
      <div class='metric'><span>Total AMT</span><b>${wan(totalAmt)}</b></div>
      <div class='metric'><span>Input AMT</span><b>${wan(inputAmt)}</b></div>
      <div class='metric'><span>Achieve Rate</span><b>${pct(achieveRate)}</b></div>
      <div class='metric'><span>Output AMT 本月確定出場</span><b>${wan(outputAmt)}</b></div>
      <div class='metric'><span>Input Plan</span><b>${inputPlan}</b></div>
      <div class='metric'><span>FCN Pool Evaluation</span><b>${poolEval}</b></div>
      <div class='metric'><span>Danger QTY / AMT</span><b>${danger.qty} / ${wan(danger.amt)}</b></div>
      <div class='metric'><span>Tracking QTY / AMT</span><b>${tracking.qty} / ${wan(tracking.amt)}</b></div>
      <div class='metric'><span>Health QTY / AMT</span><b>${health.qty} / ${wan(health.amt)}</b></div>
      <div class='sub' style='margin-top:8px'><b>三階段規劃</b><br>${Object.keys(stages).length?Object.entries(stages).map(([k,v])=>`${k}：${wan(v)}`).join('<br>'):'待接 Maturity Cashflow'}</div>
      <div class='metric'><span>今日規劃 / 已選 FCN</span><b>${planWan?wan(planWan):'待接 M2'} / ${wan(selectedWan)}</b></div>
      <div class='card-actions'><a href='./m2/index.html' class='btn'>2. Holding Zones</a><a href='./m2/index.html' class='btn'>3. Maturity Cashflow</a><a href='./m2/index.html' class='btn'>4.D FCN 遴選</a></div>`;
  }
  window.MMModuleM2={render};
})();

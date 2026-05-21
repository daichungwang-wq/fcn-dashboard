// ============================================================
// MM/M2 作戰中心 - V69 Planner Driven Market FCN Selector Runtime
// Path: js/mm/m2/m2_v069_selector_runtime.js
// Purpose: D. FCN 遴選系統 uses plannerResult x market_fcn_history x M8 Fair.
// Notes:
// - Does not write back or place orders.
// - Uses M8 Fair Rate as primary ranking; Final Fair only reference.
// - Planner need comes from window.__M2_PLANNER_RESULT__ if available, else v066 fallback.
// ============================================================
(function(){
  const PATCH_ID='m2-v069-selector-runtime';
  if(window.__M2_V069_SELECTOR_RUNTIME__) return;
  window.__M2_V069_SELECTOR_RUNTIME__=true;

  const n=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
  const fmt=(v,d=0)=>n(v).toLocaleString('en-US',{maximumFractionDigits:d});
  const wan=v=>`${fmt(n(v,0),0)}萬`;
  const pct=v=>`${n(v,0)>=0?'+':''}${fmt(v,2)}%`;
  let marketRowsCache=null;

  function needDisplayName(need){
    const catMap={short_spec:'短期投機機會',aggressive:'積極增配',core_income:'核心收息',defensive_balance:'防禦降波',watch:'觀察'};
    return need.title||catMap[need.category]||need.category||'-';
  }

  function needAmountWan(v){
    return Math.max(1,Math.round(n(v,0)/10000));
  }

  async function loadMarketRows(){
    if(marketRowsCache) return marketRowsCache;
    const res=await fetch('../../data/mm/market_fcn_history.json',{cache:'no-store'});
    marketRowsCache=await res.json();
    return marketRowsCache;
  }

  function css(){return `<style id="${PATCH_ID}-css">
#marketWorkspaceContent .v69{display:grid!important;gap:14px!important;width:100%!important;max-width:100%!important}
#marketWorkspaceContent .v69 *{box-sizing:border-box!important}
#marketWorkspaceContent .v69-banner{border:1px solid #bfdbfe!important;background:#eff6ff!important;border-radius:16px!important;padding:14px!important;line-height:1.65!important;font-size:14px!important}
#marketWorkspaceContent .v69-banner b{font-size:15px!important}
#marketWorkspaceContent .v69-mark{display:inline-block;margin-left:8px;border-radius:999px;background:#dcfce7;color:#166534;border:1px solid #86efac;padding:3px 8px;font-size:12px;font-weight:950}
#marketWorkspaceContent .v69-slot{border:1px solid #e5e7eb!important;border-radius:18px!important;padding:14px!important;background:#fff!important;box-shadow:0 2px 8px rgba(15,23,42,.04)!important;overflow:hidden!important}
#marketWorkspaceContent .v69-slot-head{display:flex!important;justify-content:space-between!important;gap:12px!important;align-items:flex-start!important;margin-bottom:10px!important}
#marketWorkspaceContent .v69-slot-title{font-size:17px!important;font-weight:950!important;line-height:1.35!important}
#marketWorkspaceContent .v69-slot-sub{font-size:13px!important;color:#64748b!important;margin-top:4px!important;line-height:1.45!important}
#marketWorkspaceContent .v69-slot-status{font-weight:950!important;color:#0f766e!important;background:#ecfdf5!important;border:1px solid #bbf7d0!important;border-radius:999px!important;padding:6px 10px!important;white-space:nowrap!important;font-size:12px!important}
#marketWorkspaceContent .v69-diag{display:flex!important;gap:6px!important;flex-wrap:wrap!important;margin:8px 0 10px!important}
#marketWorkspaceContent .v69-diag span{display:inline-block!important;border-radius:999px!important;background:#f8fafc!important;color:#334155!important;border:1px solid #e2e8f0!important;padding:4px 8px!important;font-size:11px!important;font-weight:900!important}
#marketWorkspaceContent .v69-cards{display:flex!important;flex-wrap:nowrap!important;gap:12px!important;overflow-x:auto!important;overflow-y:hidden!important;padding:4px 2px 16px!important;width:100%!important;max-width:100%!important;scrollbar-gutter:stable!important}
#marketWorkspaceContent .v69-card{display:grid!important;grid-template-rows:auto auto auto auto auto auto 1fr!important;flex:0 0 334px!important;width:334px!important;max-width:334px!important;min-width:334px!important;min-height:314px!important;border:1px solid #e5e7eb!important;border-radius:18px!important;background:#fff!important;padding:12px!important;box-shadow:0 2px 8px rgba(15,23,42,.05)!important;overflow:hidden!important;white-space:normal!important}
#marketWorkspaceContent .v69-card.selected{outline:3px solid #bbf7d0!important;border-color:#22c55e!important}
#marketWorkspaceContent .v69-grade-promote{border-left:6px solid #16a34a!important}
#marketWorkspaceContent .v69-grade-update{border-left:6px solid #2563eb!important}
#marketWorkspaceContent .v69-grade-watch{border-left:6px solid #f59e0b!important}
#marketWorkspaceContent .v69-card-top{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:8px!important;align-items:start!important}
#marketWorkspaceContent .v69-card-title{display:flex!important;gap:6px!important;align-items:center!important;font-weight:950!important;font-size:13px!important;line-height:1.35!important;min-width:0!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
#marketWorkspaceContent .v69-card-title input{flex:0 0 auto!important;margin:0!important}
#marketWorkspaceContent .v69-amt{display:grid!important;grid-template-columns:auto 62px auto!important;align-items:center!important;gap:4px!important;font-size:12px!important;color:#334155!important;white-space:nowrap!important}
#marketWorkspaceContent .v69-amt input{width:62px!important;min-width:62px!important;border:1px solid #cbd5e1!important;border-radius:8px!important;padding:5px!important;text-align:center!important;font-weight:900!important;background:#fff!important;color:#111!important}
#marketWorkspaceContent .v69-source{font-size:12px!important;color:#64748b!important;margin-top:6px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
#marketWorkspaceContent .v69-chips{display:flex!important;gap:5px!important;flex-wrap:wrap!important;margin:8px 0!important;min-height:22px!important;max-height:48px!important;overflow:hidden!important}
#marketWorkspaceContent .v69-chip{display:inline-block!important;border-radius:999px!important;background:#f1f5f9!important;color:#334155!important;padding:3px 7px!important;font-size:11px!important;font-weight:900!important;line-height:1.25!important;white-space:nowrap!important}
#marketWorkspaceContent .v69-chip.good{background:#dcfce7!important;color:#166534!important}
#marketWorkspaceContent .v69-chip.warn{background:#fef3c7!important;color:#92400e!important}
#marketWorkspaceContent .v69-chip.bad{background:#fee2e2!important;color:#991b1b!important}
#marketWorkspaceContent .v69-chip.blue{background:#dbeafe!important;color:#1d4ed8!important}
#marketWorkspaceContent .v69-terms,#marketWorkspaceContent .v69-fair,#marketWorkspaceContent .v69-why{font-size:13px!important;line-height:1.55!important;color:#334155!important;margin-top:7px!important;word-break:break-word!important;white-space:normal!important}
#marketWorkspaceContent .v69-terms{min-height:42px!important;border-bottom:1px dashed #e5e7eb!important;padding-bottom:7px!important}
#marketWorkspaceContent .v69-terms b{font-size:17px!important;color:#0f172a!important}
#marketWorkspaceContent .v69-fair{min-height:58px!important;border-top:0!important;padding-top:0!important}
#marketWorkspaceContent .v69-fair b{color:#0f172a!important}
#marketWorkspaceContent .v69-why{align-self:end!important;background:#f8fafc!important;border:1px solid #e5e7eb!important;border-radius:12px!important;padding:8px!important;min-height:39px!important;font-weight:850!important}
#marketWorkspaceContent .v69-empty{border:1px dashed #cbd5e1!important;border-radius:14px!important;padding:12px!important;color:#64748b!important;background:#f8fafc!important}
#marketWorkspaceContent .v69-blueprint{border:1px solid #d8dde6!important;border-radius:18px!important;background:linear-gradient(135deg,#fff,#f8fafc)!important;padding:14px!important}
#marketWorkspaceContent .v69-bp-grid{display:grid!important;grid-template-columns:repeat(4,1fr)!important;gap:10px!important;margin-top:10px!important}
#marketWorkspaceContent .v69-bp-card{border:1px solid #e5e7eb!important;border-radius:14px!important;background:#fff!important;padding:10px!important}
#marketWorkspaceContent .v69-bp-card label{display:block!important;font-size:12px!important;color:#64748b!important;font-weight:900!important}
#marketWorkspaceContent .v69-bp-card b{font-size:20px!important}
#marketWorkspaceContent .v69-bp-list{margin-top:10px!important;display:grid!important;gap:8px!important}
#marketWorkspaceContent .v69-bp-row{border:1px solid #e5e7eb!important;background:#fff!important;border-radius:12px!important;padding:9px!important;font-size:13px!important;line-height:1.55!important;white-space:normal!important}
#marketWorkspaceContent .v69 details{border:1px solid #e5e7eb!important;border-radius:16px!important;background:#fff!important;padding:12px!important}
#marketWorkspaceContent .v69 summary{font-weight:950!important;cursor:pointer!important}
@media(max-width:900px){#marketWorkspaceContent .v69-bp-grid{grid-template-columns:1fr!important}#marketWorkspaceContent .v69-slot-head{display:block!important}#marketWorkspaceContent .v69-slot-status{display:inline-block!important;margin-top:8px!important}#marketWorkspaceContent .v69-card{flex-basis:302px!important;width:302px!important;max-width:302px!important;min-width:302px!important}}
</style>`}

  function diagnosticsHtml(d){
    return `<div class="v69-diag">
      <span>Market rows ${d.market_rows||0}</span>
      <span>Planner matched ${d.planner_matched||0}</span>
      <span>M8 fair OK ${d.m8_fair_ok||0}</span>
      <span>Risk fit ${d.risk_fit||0}</span>
      <span>Displayed ${d.displayed||0} / 10</span>
    </div>`;
  }

  function bankScore(c){
    const source=String(c.source||'').toLowerCase();
    const bank=String(c.bank||'');
    if(bank==='永豐' && source.includes('sinopac')) return 10;
    if(bank==='富邦' && source.includes('fubon')) return 10;
    if(n(c.bank_fit_score,0)>0) return n(c.bank_fit_score,0);
    return 0;
  }

  function candidateCard(need,c){
    const grade=String(c.action||'Watch').toLowerCase();
    const amount=needAmountWan(c.min_amount||need.min_amount||30000);
    const kiText=Number.isFinite(Number(c.ki_pct))?fmt(c.ki_pct,1):'NA';
    const strikeText=Number.isFinite(Number(c.strike_pct))?fmt(c.strike_pct,1):'NA';
    const penalties=(c.diversity_penalties||[]).length?`｜降權 ${c.diversity_penalties.join(', ')}`:'';
    const finalRef = Number.isFinite(Number(c.final_fair_ref)) ? `${fmt(c.final_fair_ref,2)}%` : '-';
    return `<div class="v69-card v69-grade-${grade}" data-v69-need="${need.need_id}" data-v69-candidate="${c.product_id}">
      <div class="v69-card-top">
        <label class="v69-card-title"><input type="checkbox" class="v69-check" data-v69-need="${need.need_id}" data-v69-candidate="${c.product_id}"> ${c.action}｜${c.product_id}</label>
        <div class="v69-amt"><span>建議</span><input class="v69-amt-input" data-v69-need="${need.need_id}" data-v69-candidate="${c.product_id}" type="number" min="0" step="1" value="${amount}"><span>萬</span></div>
      </div>
      <div class="v69-source">${c.source}｜${c.generated_at||'-'}｜上手 ${c.upstream_bank||'-'}｜Score ${fmt(c.candidate_score,2)}</div>
      <div class="v69-chips">${(c.symbols||[]).slice(0,6).map(s=>`<span class="v69-chip">${s}</span>`).join('')}</div>
      <div class="v69-terms"><b>${fmt(c.coupon_pct,2)}%</b>｜${fmt(c.tenor_month,0)}M｜${c.barrier_type||'NA'} ${c.memory_type||''}<br>Strike/KI ${strikeText}/${kiText}</div>
      <div class="v69-fair"><b>Market ${fmt(c.coupon_pct,2)}%</b>｜M8 Fair ${fmt(c.m8_fair_rate,2)}%<br>Gap ${pct(c.fair_gap)}｜Final Ref ${finalRef}</div>
      <div class="v69-chips"><span class="v69-chip ${c.action==='Promote'?'good':c.action==='Update'?'blue':'warn'}">${c.action}</span><span class="v69-chip">${c.template_group}</span><span class="v69-chip">${c.risk_bucket}</span><span class="v69-chip">${c.tenor_bucket}</span></div>
      <div class="v69-why">配對 ${fmt(c.planner_need_match,1)}/10｜Risk ${fmt(c.risk_fit_score,1)}/10｜Bank ${fmt(bankScore(c),1)}/10${penalties}</div>
    </div>`;
  }

  function renderWorkspace(pack){
    const groups=pack.result||{};
    const slots=Object.values(groups).sort((a,b)=>n(a.need.priority,99)-n(b.need.priority,99));
    const totalDisplayed=slots.reduce((s,g)=>s+(g.candidates||[]).length,0);
    return `${css()}<div class="v69" data-v69="1"><div class="v69-banner"><b>D. FCN遴選系統｜v69 Planner Driven</b><span class="v69-mark">plannerResult × market_fcn_history × M8 Fair</span><br>3. Maturity Cashflow / m2_planner 決定「要補什麼」，D 區只負責拿 market_fcn_history 找候選。排序主軸使用 <b>Market Coupon - M8 Fair Rate</b>；Final Fair 只當參考。</div>${slots.map(group=>{const need=group.need;const candidates=group.candidates||[];return `<section class="v69-slot"><div class="v69-slot-head"><div><div class="v69-slot-title">${need.bank||'-'}｜${needDisplayName(need)}｜需求 ${wan(n(need.target_amount,0)/10000)}</div><div class="v69-slot-sub">need_id ${need.need_id}｜min ${wan(n(need.min_amount,0)/10000)}｜priority ${need.priority??'-'}｜候選目標 at least 10</div></div><div class="v69-slot-status" id="v69-status-${need.need_id}">未勾選</div></div>${diagnosticsHtml(group.diagnostics||{})}<div class="v69-cards">${candidates.map(c=>candidateCard(need,c)).join('')||'<div class="v69-empty">目前沒有符合此 planner need 的 market_fcn_history 候選。</div>'}</div></section>`}).join('')}<div id="v69Blueprint"></div><details><summary>分析過程｜v69 Candidate Diagnostics</summary><div class="muted" style="line-height:1.7;margin-top:8px">已分類 market rows ${pack.rows.length} 筆；planner needs ${slots.length} 組；畫面候選 ${totalDisplayed} 筆。若 Displayed 不足 10，表示市場資料或條件不足，不再用硬過濾隱藏原因。</div></details></div>`;
  }

  function bindEvents(box,pack){
    const groups=pack.result||{};
    const flat={};
    Object.values(groups).forEach(g=>(g.candidates||[]).forEach(c=>{flat[`${g.need.need_id}::${c.product_id}`]={need:g.need,candidate:c};}));
    const update=()=>{
      const selected=[];
      box.querySelectorAll('.v69-check:checked').forEach(ch=>{
        const key=`${ch.dataset.v69Need}::${ch.dataset.v69Candidate}`;
        const item=flat[key];
        const amt=n(box.querySelector(`.v69-amt-input[data-v69-need="${ch.dataset.v69Need}"][data-v69-candidate="${ch.dataset.v69Candidate}"]`)?.value,0);
        if(item) selected.push({...item,amount_wan:amt});
      });
      const total=selected.reduce((s,x)=>s+x.amount_wan,0);
      const byBank=b=>selected.filter(x=>x.candidate.bank===b).reduce((s,x)=>s+x.amount_wan,0);
      const byCat=cat=>selected.filter(x=>x.need.category===cat).reduce((s,x)=>s+x.amount_wan,0);
      const rows=selected.map(x=>`<div class="v69-bp-row"><b>${x.candidate.bank}｜${needDisplayName(x.need)}｜${x.candidate.product_id}</b>｜${(x.candidate.symbols||[]).join('/')}｜${wan(x.amount_wan)}<br><span class="muted">Market ${fmt(x.candidate.coupon_pct,2)}%｜M8 Fair ${fmt(x.candidate.m8_fair_rate,2)}%｜Gap ${pct(x.candidate.fair_gap)}｜${x.candidate.template_group}｜${x.candidate.risk_bucket}</span></div>`).join('')||'<div class="v69-bp-row muted">尚未勾選 FCN，今日投資藍圖暫為待分配。</div>';
      const needRemaining=Object.values(groups).map(g=>{
        const used=selected.filter(x=>x.need.need_id===g.need.need_id).reduce((s,x)=>s+x.amount_wan,0);
        const needWan=needAmountWan(g.need.target_amount);
        return {need:g.need,used,remain:Math.max(0,needWan-used)};
      });
      const bp=box.querySelector('#v69Blueprint');
      if(bp) bp.innerHTML=`<div class="v69-blueprint"><h3>OUTPUT｜今日投資藍圖｜V69</h3><div class="decision-note"><b>一句話：</b>${selected.length?'今日可依 planner need 補市場單；排序依 M8 fair gap，Final Fair 只參考。':'尚未勾選候選，先保留現金等待更合適市場單。'}</div><div class="v69-bp-grid"><div class="v69-bp-card"><label>總投入</label><b>${wan(total)}</b></div><div class="v69-bp-card"><label>永豐</label><b>${wan(byBank('永豐'))}</b></div><div class="v69-bp-card"><label>富邦</label><b>${wan(byBank('富邦'))}</b></div><div class="v69-bp-card"><label>短投 / 積極</label><b>${wan(byCat('short_spec'))} / ${wan(byCat('aggressive'))}</b></div></div><div class="v69-bp-list">${rows}</div><div class="v69-bp-list"><div class="v69-bp-row"><b>待分配 / 未完成 need</b><br>${needRemaining.filter(x=>x.remain>0).map(x=>`${x.need.bank} ${needDisplayName(x.need)} 剩餘 ${wan(x.remain)}`).join('｜')||'全部完成'}</div></div></div>`;
      box.querySelectorAll('.v69-card').forEach(card=>{
        const checked=box.querySelector(`.v69-check[data-v69-need="${card.dataset.v69Need}"][data-v69-candidate="${card.dataset.v69Candidate}"]`)?.checked;
        card.classList.toggle('selected',!!checked);
      });
      Object.values(groups).forEach(g=>{
        const used=selected.filter(x=>x.need.need_id===g.need.need_id).reduce((s,x)=>s+x.amount_wan,0);
        const needWan=needAmountWan(g.need.target_amount);
        const el=box.querySelector(`#v69-status-${g.need.need_id}`);
        if(el) el.textContent=used>0?`已選 ${wan(used)}｜剩餘 ${wan(Math.max(0,needWan-used))}`:'未勾選';
      });
    };
    box.querySelectorAll('.v69-check,.v69-amt-input').forEach(el=>{el.addEventListener('input',update);el.addEventListener('change',update);});
    update();
  }

  async function renderV69Selector(force=false){
    const box=document.getElementById('marketWorkspaceContent');
    if(!box) return;
    const text=box.textContent||'';
    const shouldPatch=force || text.includes('FCN遴選系統') || box.querySelector('.dsel') || box.dataset.v69Target==='1';
    if(!shouldPatch) return;
    if(box.dataset.v69Patched==='1' && !force) return;
    box.dataset.v69Patched='1';
    box.dataset.v69Target='1';
    box.innerHTML='<div class="muted">V69：載入 plannerResult × market_fcn_history 候選...</div>';
    try{
      if(!window.M2MarketCandidateEngine) throw new Error('M2MarketCandidateEngine not loaded');
      const rows=await loadMarketRows();
      const pack=window.M2MarketCandidateEngine.buildMarketCandidatesFromPlanner(null,rows);
      box.innerHTML=renderWorkspace(pack);
      bindEvents(box,pack);
    }catch(err){
      console.error(err);
      box.innerHTML=`<div class="decision-note bad"><b>V69 載入失敗</b><br>${err.message}</div>`;
      box.dataset.v69Patched='0';
    }
  }

  function install(){
    document.addEventListener('click',ev=>{
      const btn=ev.target.closest('[data-market-tab]');
      if(!btn) return;
      if(btn.dataset.marketTab==='selector'){
        setTimeout(()=>renderV69Selector(true),180);
        setTimeout(()=>renderV69Selector(true),650);
      }
    });
    const obs=new MutationObserver(()=>renderV69Selector(false));
    obs.observe(document.body,{childList:true,subtree:true});
    setInterval(()=>renderV69Selector(false),1200);
    renderV69Selector(false);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install);
  else install();
})();

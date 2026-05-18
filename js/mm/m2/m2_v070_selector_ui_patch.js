// ============================================================
// M2 v70 Selector UI Patch
// Path: js/mm/m2/m2_v070_selector_ui_patch.js
// Purpose: after v69 renders, clarify FCN Score / Basket DNA / M1-M7 fallback.
// ============================================================
(function(){
  if(window.__M2_V070_SELECTOR_UI_PATCH__) return;
  window.__M2_V070_SELECTOR_UI_PATCH__=true;

  function patchText(){
    const box=document.getElementById('marketWorkspaceContent');
    if(!box) return;
    const banner=box.querySelector('.v69-banner');
    if(banner && !banner.dataset.v70Text){
      banner.dataset.v70Text='1';
      banner.innerHTML='<b>D. FCN遴選系統｜v70 FCN Score + Basket DNA</b><span class="v69-mark">plannerResult × market_fcn_history × FCN Score</span><br>3. Maturity Cashflow / m2_planner 決定「要補什麼」，D 區只負責拿 market_fcn_history 找候選。排序主軸改為 <b>FCN Score = 0.40 Market Coupon + 0.25 FCN Condition + 0.15 M1 + 0.20 M7</b>；M1/M7 尚未接入時以 6 分中性值代替並提醒。';
    }
  }

  function patchCards(){
    const box=document.getElementById('marketWorkspaceContent');
    if(!box || !window.M2MarketCandidateEngine || !window.M2MarketCandidateEngine.__lastPack) return;
    const pack=window.M2MarketCandidateEngine.__lastPack;
    const map={};
    Object.values(pack.result||{}).forEach(group=>{
      (group.candidates||[]).forEach(c=>{ map[`${group.need.need_id}::${c.product_id}`]=c; });
    });
    box.querySelectorAll('.v69-card').forEach(card=>{
      if(card.dataset.v70Patched==='1') return;
      const c=map[`${card.dataset.v69Need}::${card.dataset.v69Candidate}`];
      if(!c) return;
      card.dataset.v70Patched='1';
      const dna=c.basket_dna||{};
      const fallback=[];
      if(c.m1_fallback) fallback.push('M1=6 fallback');
      if(c.m7_fallback) fallback.push('M7=6 fallback');
      const fair=card.querySelector('.v69-fair');
      if(fair){
        fair.innerHTML=`<b>FCN Score ${Number(c.fcn_score||c.candidate_score||0).toFixed(2)}</b>｜MarketScore ${Number(c.market_coupon_score||0).toFixed(2)}｜Condition ${Number(c.fcn_condition_score||0).toFixed(2)}｜M1 ${Number(c.m1_score||6).toFixed(1)}｜M7 ${Number(c.m7_score||6).toFixed(1)}`;
      }
      const chips=card.querySelectorAll('.v69-chips')[1];
      if(chips){
        chips.insertAdjacentHTML('beforeend', `<span class="v69-chip blue">DNA ${dna.personality||'-'}</span><span class="v69-chip">Type ${c.final_fcn_type||dna.final_fcn_type||'-'}</span>`);
      }
      const why=card.querySelector('.v69-why');
      if(why){
        why.innerHTML += `<br>DNA Tags: ${(dna.basket_tags||[]).join(' / ')||'-'}｜${fallback.length?fallback.join(' / '):'M1/M7 source ready'}`;
      }
    });
  }

  function patchBlueprintText(){
    const box=document.getElementById('marketWorkspaceContent');
    if(!box) return;
    const notes=box.querySelectorAll('.decision-note');
    notes.forEach(note=>{
      if(note.dataset.v70Text==='1') return;
      if(note.textContent.includes('M8 fair gap')){
        note.dataset.v70Text='1';
        note.innerHTML=note.innerHTML.replace('排序依 M8 fair gap，Final Fair 只參考。','排序依 FCN Score；M1/M7 若無資料以 6 分中性值代替。');
      }
    });
  }

  function patch(){
    patchText();
    patchCards();
    patchBlueprintText();
  }

  const obs=new MutationObserver(patch);
  if(document.body) obs.observe(document.body,{childList:true,subtree:true});
  setInterval(patch,1200);
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',patch);
  else patch();
})();

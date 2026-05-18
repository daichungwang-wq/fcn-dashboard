// ============================================================
// MM/M2 作戰中心 II - V68 Allocation Decision Engine
// V67B -> V68 Upgrade
// Real market rows + allocation sequencing + concentration control
// ============================================================
(function(){
  if(window.__M2_V068_ALLOCATION_ENGINE__) return;
  window.__M2_V068_ALLOCATION_ENGINE__=true;

  const STOCK_CAP={
    core:500000,
    growth:300000,
    defensive:300000,
    income:200000,
    speculative:30000
  };

  const CAP_EXCEPTION={
    NVDA:700000,
    TSM:700000,
    SMH:700000,
    GOOG:700000
  };

  const TARGET_BANK={
    '富邦':900000,
    '永豐':500000
  };

  const n=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
  const fmt=(v,d=0)=>n(v).toLocaleString('en-US',{maximumFractionDigits:d});

  function getPoolCategory(symbol){
    const s=String(symbol||'').toUpperCase();

    if(['NVDA','TSM','AVGO','AMD','MRVL','MU','ARM','SMH'].includes(s)) return 'core';
    if(['AAPL','MSFT','GOOG','AMZN','META'].includes(s)) return 'defensive';
    if(['COIN','SOFI','ALAB','CRDO','PLTR','TSLA'].includes(s)) return 'speculative';

    return 'growth';
  }

  function getSymbolCap(symbol){
    const s=String(symbol||'').toUpperCase();

    if(CAP_EXCEPTION[s]) return CAP_EXCEPTION[s];

    return STOCK_CAP[getPoolCategory(s)]||300000;
  }

  function estimateBasketRisk(candidate){

    const strike=n(candidate.strike);
    const ki=n(candidate.ki);
    const coupon=n(candidate.coupon);

    let risk=0;

    if(strike>=75) risk+=3;
    else if(strike>=70) risk+=2;
    else if(strike>=65) risk+=1;

    if(ki>=65) risk+=3;
    else if(ki>=60) risk+=2;
    else if(ki>=55) risk+=1;

    if(coupon>=25) risk+=3;
    else if(coupon>=21) risk+=2;
    else if(coupon>=18) risk+=1;

    return risk;
  }

  function concentrationCheck(candidate){

    const basket=Array.isArray(candidate.basket)
      ? candidate.basket
      : [];

    const concentration=[];

    basket.forEach(sym=>{

      const cap=getSymbolCap(sym);

      if(cap<=30000){
        concentration.push({
          symbol:sym,
          level:'HOT',
          reason:'投機股 exposure cap 偏低'
        });
      }
      else if(cap<=300000){
        concentration.push({
          symbol:sym,
          level:'WATCH',
          reason:'一般成長股 exposure'
        });
      }
      else{
        concentration.push({
          symbol:sym,
          level:'PASS',
          reason:'核心股 exposure 較高'
        });
      }

    });

    return concentration;
  }

  function allocationDecision(candidate){

    const gap=parseFloat(candidate.gap_num||0);
    const risk=estimateBasketRisk(candidate);

    let decision='WATCH';
    let sequencing=99;
    let amount=n(candidate.amount,1);

    if(gap>=4 && risk<=3){
      decision='TOP PRIORITY';
      sequencing=1;
      amount=Math.max(amount,6);
    }
    else if(gap>=3 && risk<=5){
      decision='PROMOTE';
      sequencing=2;
      amount=Math.max(amount,3);
    }
    else if(gap>=1){
      decision='NORMAL';
      sequencing=3;
    }
    else{
      decision='WATCH';
      sequencing=4;
      amount=Math.min(amount,1);
    }

    if(candidate.capacity==='HOT'){
      sequencing+=1;
      decision='CAUTION';
    }

    if(candidate.capacity==='CAUTION'){
      sequencing+=1;
      amount=Math.min(amount,1);
    }

    return {
      decision,
      sequencing,
      suggested_amount:amount,
      risk_score:risk
    };
  }

  function buildWarRoomBlueprint(selectedRows=[]){

    const rows=[...selectedRows]
      .sort((a,b)=>a.v68.sequencing-b.v68.sequencing);

    const total=rows.reduce((s,x)=>s+n(x.v68.suggested_amount),0);

    const bankSummary={};

    rows.forEach(r=>{

      if(!bankSummary[r.bank]){
        bankSummary[r.bank]={amt:0,count:0};
      }

      bankSummary[r.bank].amt+=n(r.v68.suggested_amount);
      bankSummary[r.bank].count+=1;

    });

    const top=rows[0];

    return {
      total_amount:total,
      bank_summary:bankSummary,
      top_priority:top?.id||'-',
      sequencing_rows:rows.map((r,idx)=>({
        order:idx+1,
        id:r.id,
        bank:r.bank,
        basket:r.basket,
        decision:r.v68.decision,
        amount:r.v68.suggested_amount,
        gap:r.gap,
        template:r.template,
        risk:r.v68.risk_score
      }))
    };
  }

  function renderWarRoomCard(bp){

    return `
    <div class="v68-warroom">

      <div class="v68-title">
        V68 Allocation Decision Engine
      </div>

      <div class="v68-grid">

        <div class="v68-box">
          <label>總投入</label>
          <b>${fmt(bp.total_amount,0)} 萬</b>
        </div>

        <div class="v68-box">
          <label>TOP PRIORITY</label>
          <b>${bp.top_priority}</b>
        </div>

        <div class="v68-box">
          <label>永豐</label>
          <b>${fmt(bp.bank_summary['永豐']?.amt||0,0)} 萬</b>
        </div>

        <div class="v68-box">
          <label>富邦</label>
          <b>${fmt(bp.bank_summary['富邦']?.amt||0,0)} 萬</b>
        </div>

      </div>

      <div class="v68-list">

        ${bp.sequencing_rows.map(r=>`

          <div class="v68-row">

            <div>
              <b>#${r.order}｜${r.id}</b>
              <div class="muted">
                ${r.bank}｜${r.basket.join('/')}｜${r.template}
              </div>
            </div>

            <div>
              <b>${r.decision}</b>
              <div class="muted">
                Gap ${r.gap}｜Risk ${r.risk}
              </div>
            </div>

            <div>
              <b>${fmt(r.amount,0)} 萬</b>
            </div>

          </div>

        `).join('')}

      </div>

    </div>
    `;
  }

  function installV68(){

    const obs=new MutationObserver(()=>{

      const bp=document.querySelector('#dselBlueprint');

      if(!bp || bp.dataset.v68==='1') return;

      const rows=[];

      document.querySelectorAll('.dcard.selected').forEach(card=>{

        try{

          const id=card.dataset.candidate;

          const coupon=(card.querySelector('.dfair')?.textContent||'').match(/Gap\s([+-]?[\d\.]+%)/)?.[1]||'+0%';

          const basket=[...card.querySelectorAll('.chip')]
            .map(x=>x.textContent.trim())
            .filter(x=>/^[A-Z]{1,6}$/.test(x));

          const bank=(card.querySelector('.dcard-source')?.textContent||'').includes('sinopac')
            ? '永豐'
            : '富邦';

          const template=[...card.querySelectorAll('.chip')]
            .map(x=>x.textContent)
            .find(x=>x.includes('_'))||'F_OTHERS';

          const amount=n(card.querySelector('.dsel-amt')?.value,1);

          const candidate={
            id,
            bank,
            basket,
            template,
            amount,
            gap,
            gap_num:parseFloat(coupon),
            strike:70,
            ki:55,
            coupon:20,
            capacity:(card.textContent||'').includes('HOT')?'HOT':(card.textContent||'').includes('CAUTION')?'CAUTION':'PASS'
          };

          candidate.v68=allocationDecision(candidate);
          candidate.concentration=concentrationCheck(candidate);

          rows.push(candidate);

        }
        catch(err){
          console.error(err);
        }

      });

      const warroom=buildWarRoomBlueprint(rows);

      bp.insertAdjacentHTML(
        'beforeend',
        renderWarRoomCard(warroom)
      );

      bp.dataset.v68='1';

    });

    obs.observe(document.body,{
      childList:true,
      subtree:true
    });

  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',installV68);
  }
  else{
    installV68();
  }

})();

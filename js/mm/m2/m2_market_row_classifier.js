// ============================================================
// M2 Market Row Classifier v70
// Path: js/mm/m2/m2_market_row_classifier.js
// Purpose: classify market_fcn_history rows for M2/4D selector.
// ============================================================
(function(){
  if(window.M2MarketRowClassifier) return;

  const n=(v,d=null)=>Number.isFinite(Number(v))?Number(v):d;

  const SPECULATIVE_MOMENTUM=['COIN','SOFI','ALAB','CRDO','PLTR','COHR','LITE'];
  const MEMORY_TACTICAL=['MU','SNDK','WDC'];
  const TURNAROUND_TACTICAL=['INTC'];
  const AI_CORE=['NVDA','TSM','AVGO','AMAT','QCOM','SMH','AMD','MRVL','ARM'];
  const DEFENSIVE_PLATFORM=['AAPL','GOOG','GOOGL','MSFT','LQD','UNH','REGN'];

  function normalizeSymbol(x){
    return String(x||'')
      .trim()
      .toUpperCase()
      .replace(/\s+(UW|UN|UQ|UR)$/,'')
      .replace(/\s+/g,'');
  }

  function normalizeBasketSymbols(v){
    const raw=Array.isArray(v)?v:String(v||'').split(/[,+/|;\s]+/);
    return raw.map(normalizeSymbol).filter(Boolean).filter(s=>s!=='-'&&s!=='--');
  }

  function normalizedBasketKey(symbols){
    return Array.from(new Set(normalizeBasketSymbols(symbols))).sort().join('+');
  }

  function sourceToBank(source){
    const s=String(source||'').toLowerCase();
    if(s.includes('sinopac')||s.includes('永豐')) return '永豐';
    if(s.includes('fubon')||s.includes('富邦')) return '富邦';
    return source||'-';
  }

  function detectTemplate(symbols){
    const set=new Set(normalizeBasketSymbols(symbols));
    if(MEMORY_TACTICAL.some(s=>set.has(s))) return 'B_MEMORY';
    if(SPECULATIVE_MOMENTUM.some(s=>set.has(s))) return 'D_SPECULATIVE';
    if(DEFENSIVE_PLATFORM.some(s=>set.has(s))) return 'E_DEFENSIVE';
    if(AI_CORE.some(s=>set.has(s))) return 'A_AI_CORE';
    if(TURNAROUND_TACTICAL.some(s=>set.has(s))) return 'T_TURNAROUND';
    if(['TSLA'].some(s=>set.has(s))) return 'C_TSLA_MOMENTUM';
    return 'F_OTHERS';
  }

  function classifyBasketDNA(symbols){
    const set=new Set(symbols||[]);
    const dna={
      personality:'F_OTHERS',
      basket_tags:[],
      final_fcn_type:'aggressive',
      aggressive_allowed:true,
      speculative_required:false,
      dual_type_allowed:false
    };

    if([...set].some(s=>SPECULATIVE_MOMENTUM.includes(s))){
      dna.personality='SPECULATIVE_MOMENTUM';
      dna.basket_tags=['HIGH_BETA','NARRATIVE'];
      dna.final_fcn_type='short_spec';
      dna.aggressive_allowed=false;
      dna.speculative_required=true;
      return dna;
    }

    if([...set].some(s=>MEMORY_TACTICAL.includes(s))){
      dna.personality='MEMORY_TACTICAL';
      dna.basket_tags=['MEMORY','TACTICAL'];
      dna.final_fcn_type='dual';
      dna.dual_type_allowed=true;
      return dna;
    }

    if([...set].some(s=>TURNAROUND_TACTICAL.includes(s))){
      dna.personality='TURNAROUND_TACTICAL';
      dna.basket_tags=['TURNAROUND','TACTICAL'];
      dna.final_fcn_type='dual';
      dna.dual_type_allowed=true;
      return dna;
    }

    if([...set].some(s=>DEFENSIVE_PLATFORM.includes(s))){
      dna.personality='DEFENSIVE_PLATFORM';
      dna.basket_tags=['LOW_VOL','PLATFORM'];
      dna.final_fcn_type='defensive_balance';
      return dna;
    }

    if([...set].some(s=>AI_CORE.includes(s))){
      dna.personality='AI_CORE';
      dna.basket_tags=['AI','INSTITUTIONAL'];
      dna.final_fcn_type='aggressive';
      return dna;
    }

    return dna;
  }

  function tenorBucket(tenor){
    tenor=n(tenor,0);
    if(tenor<=3) return 'VERY_SHORT';
    if(tenor<=6) return 'SHORT';
    if(tenor<=9) return 'MID';
    if(tenor<=12) return 'LONG';
    return 'VERY_LONG';
  }

  function riskBucket(strike,ki,tenor){
    strike=n(strike,0);
    ki=n(ki,0);
    tenor=n(tenor,0);
    let score=0;
    if(strike>=80) score+=4; else if(strike>=75) score+=3; else if(strike>=70) score+=2; else if(strike>=65) score+=1;
    if(ki>=70) score+=4; else if(ki>=65) score+=3; else if(ki>=60) score+=2; else if(ki>=55) score+=1;
    if(tenor>=12) score+=1;
    if(score>=7) return 'VERY_HIGH';
    if(score>=5) return 'HIGH';
    if(score>=3) return 'MEDIUM_HIGH';
    if(score>=2) return 'MEDIUM';
    if(score>=1) return 'MEDIUM_LOW';
    return 'LOW';
  }

  function categoryCandidates(row){
    const out=[];
    const dna=row.basket_dna||{};

    if(dna.speculative_required){
      out.push('short_spec');
      return out;
    }

    if(dna.personality==='MEMORY_TACTICAL' || dna.personality==='TURNAROUND_TACTICAL'){
      out.push('short_spec');
      out.push('aggressive');
      return out;
    }

    if(dna.personality==='DEFENSIVE_PLATFORM'){
      out.push('defensive_balance');
      out.push('core_income');
      return out;
    }

    if(dna.personality==='AI_CORE'){
      out.push('aggressive');
      out.push('core_income');
      return out;
    }

    out.push('watch');
    return out;
  }

  function classifyMarketRow(row,idx=0){
    const symbols=normalizeBasketSymbols(row.symbols||row.basket||row.basket_display);
    const coupon=n(row.coupon_pct??row.market_coupon??row.market_rate,null);
    const tenor=n(row.tenor_month??row.tenor,null);
    const strike=n(row.strike_pct??row.strike,null);
    const ki=n(row.ki_pct??row.ki,null);

    const basket_dna=classifyBasketDNA(symbols);

    const classified={
      ...row,
      row_index:idx,
      product_id:row.product_id||row.fcn_id||`MKT-${idx+1}`,
      source:row.source||'-',
      bank:sourceToBank(row.source),
      symbols,
      basket_key:normalizedBasketKey(symbols),
      coupon_pct:coupon,
      tenor_month:tenor,
      strike_pct:strike,
      ki_pct:ki,
      barrier_type:row.barrier_type||row.type||'NA',
      memory_type:row.memory_type||row.memory||'',
      upstream_bank:row.upstream_bank||'-',
      basket_dna,
      m1_score:n(row.m1_score,6),
      m7_score:n(row.m7_score,6),
      m1_fallback:!Number.isFinite(Number(row.m1_score)),
      m7_fallback:!Number.isFinite(Number(row.m7_score))
    };

    classified.template_group=detectTemplate(symbols);
    classified.tenor_bucket=tenorBucket(tenor);
    classified.risk_bucket=riskBucket(strike,ki,tenor);
    classified.slot_candidates=categoryCandidates(classified);
    classified.final_fcn_type=basket_dna.final_fcn_type;

    return classified;
  }

  window.M2MarketRowClassifier={
    normalizeBasketSymbols,
    normalizedBasketKey,
    sourceToBank,
    detectTemplate,
    classifyBasketDNA,
    tenorBucket,
    riskBucket,
    classifyMarketRow
  };
})();

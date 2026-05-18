// ============================================================
// MM/M2 V67B Patch
// Dynamic Market Candidate Engine
// market_fcn_history.json → candidate cards
// ============================================================

export function normalizeBasketSymbols(v){
  if(Array.isArray(v)) return v.map(x=>String(x).toUpperCase());
  return String(v||'')
    .split(/[,+/ ]+/)
    .map(x=>x.trim().toUpperCase())
    .filter(Boolean);
}

export function buildDynamicSelectorCandidates(marketHistory=[], n=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d){

  const rows = Array.isArray(marketHistory)
    ? marketHistory
    : [];

  const result = {
    'sinopac-spec':[],
    'sinopac-aggr':[],
    'fubon-spec':[]
  };

  rows.forEach((r,idx)=>{

    const bankRaw = String(r.source||'').toLowerCase();

    const bank =
      bankRaw.includes('sinopac')
        ? '永豐'
        : '富邦';

    const coupon = n(r.coupon_pct);
    const tenor = n(r.tenor_month);
    const strike = n(r.strike_pct);
    const ki = n(r.ki_pct);

    const symbols = normalizeBasketSymbols(r.symbols);

    let category = '合理投資型';

    if(coupon >= 21 && tenor <= 6){
      category = '短期投機單';
    }
    else if(coupon >= 21){
      category = '積極單';
    }
    else if(coupon >= 18){
      category = '合理投資型';
    }
    else{
      category = '長期穩定現金流';
    }

    let slot = null;

    if(bank === '永豐' && category === '短期投機單'){
      slot = 'sinopac-spec';
    }

    if(bank === '永豐' && category === '積極單'){
      slot = 'sinopac-aggr';
    }

    if(bank === '富邦' && category === '短期投機單'){
      slot = 'fubon-spec';
    }

    if(!slot) return;

    const estimatedFair = Math.max(8, coupon - 2);
    const finalFair = estimatedFair + 0.5;
    const gap = coupon - finalFair;

    let template = 'F_OTHERS';

    if(symbols.includes('NVDA') || symbols.includes('TSM') || symbols.includes('AVGO')){
      template = 'A_AI_CORE';
    }
    else if(symbols.includes('MU') || symbols.includes('SNDK')){
      template = 'B_MEMORY';
    }
    else if(symbols.includes('TSLA')){
      template = 'C_TSLA';
    }
    else if(symbols.includes('COIN') || symbols.includes('SOFI')){
      template = 'D_SPECULATIVE';
    }

    let action = 'Watch';

    if(gap >= 3){
      action = 'Promote';
    }
    else if(gap >= 1){
      action = 'Update';
    }

    let capacity = 'PASS';

    if(symbols.includes('TSLA') || symbols.includes('COIN')){
      capacity = 'HOT';
    }

    if(strike >= 75 || ki >= 65){
      capacity = 'CAUTION';
    }

    let amount = 3;

    if(bank === '富邦'){
      amount = 1;
    }

    result[slot].push({
      id:r.product_id || `ROW-${idx+1}`,
      grade:gap >= 3 ? 'A' : gap >= 1 ? 'B' : 'C',
      bank,
      category,
      basket:symbols,
      coupon,
      tenor:`${tenor}M`,
      type:`${r.barrier_type || 'NA'} ${r.memory_type || ''}`,
      strike,
      ki,
      m8:Number(estimatedFair.toFixed(1)),
      final:Number(finalFair.toFixed(1)),
      gap:`${gap >= 0 ? '+' : ''}${gap.toFixed(1)}%`,
      template,
      action,
      capacity,
      amount,
      reason:`${template} 模板｜Market ${coupon.toFixed(1)}% vs Final ${finalFair.toFixed(1)}%｜Gap ${gap.toFixed(1)}%。`
    });
  });

  Object.keys(result).forEach(k=>{
    result[k].sort((a,b)=>parseFloat(b.gap)-parseFloat(a.gap));
  });

  return result;
}

// ============================================================
// M2 Market Diversity Engine v69
// Path: js/mm/m2/m2_market_diversity_engine.js
// Purpose: score penalty, not hard filter, to avoid NVDA universe.
// ============================================================
(function(){
  if(window.M2MarketDiversityEngine) return;

  function applyDiversity(candidates){
    const basketCount={}, templateCount={}, symbolCount={};
    return (candidates||[]).map(c=>{
      let score=Number(c.base_score||c.candidate_score||0);
      const penalties=[];
      const key=c.basket_key||'';
      const template=c.template_group||'F_OTHERS';
      const symbols=Array.isArray(c.symbols)?c.symbols:[];

      if(key && basketCount[key]>=1){ score*=0.70; penalties.push('same_basket'); }
      if(templateCount[template]>=4){ score*=0.85; penalties.push('same_template'); }
      const hotSymbols=symbols.filter(s=>(symbolCount[s]||0)>=6);
      if(hotSymbols.length){ score*=0.85; penalties.push(`symbol_concentration:${hotSymbols.join('/')}`); }

      basketCount[key]=(basketCount[key]||0)+1;
      templateCount[template]=(templateCount[template]||0)+1;
      symbols.forEach(s=>{symbolCount[s]=(symbolCount[s]||0)+1;});

      return {...c,candidate_score:score,diversity_penalties:penalties};
    });
  }

  window.M2MarketDiversityEngine={applyDiversity};
})();

// ============================================================
// M8 Single Batch Adapter v1.0.0
// Path: js/mm/m2/m8_single_batch_adapter.js
// Purpose: Reuse m8_batch single-run market regression logic for M2 A-zone.
// Note: m8_batch.html remains the benchmark page and is not modified.
// ============================================================

import { runM8Case } from '../../core/m8_batch_engine.js';

const ROOT='../../';
const SURFACE_PATH='data/mm/m8_template_surface.json?v=20260511_partial_depth_final';
const HISTORY_PATH='data/mm/market_fcn_history.json?v=20260510_market_flat';

const toNum=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const round2=v=>Number.isFinite(Number(v))?Math.round(Number(v)*100)/100:null;
const arr=v=>Array.isArray(v)?v:[];
const avg=xs=>{const a=arr(xs).map(Number).filter(Number.isFinite);return a.length?a.reduce((s,x)=>s+x,0)/a.length:null};

function withRootFetch(){
  if(window.__M8_M2_SINGLE_FETCH_PATCHED__)return;
  const nativeFetch=window.fetch.bind(window);
  window.fetch=(input,init)=>{
    try{
      const url=typeof input==='string'?input:input?.url;
      if(typeof url==='string'&&url.startsWith('data/'))return nativeFetch(ROOT+url,init);
    }catch(err){}
    return nativeFetch(input,init);
  };
  window.__M8_M2_SINGLE_FETCH_PATCHED__=true;
}

export function normalizeSurfaceSymbols(symbols){
  if(!symbols)return[];
  if(typeof symbols==='string')symbols=symbols.split(/[,+|\s]+/);
  return [...new Set(arr(symbols).map(s=>String(s||'').replace(/\s+(UW|UN|US|JP|HK)$/i,'').trim().toUpperCase()).filter(Boolean).map(s=>s==='GOOGL'?'GOOG':s))].sort();
}
export function normalizeSurfaceKey(symbols){return normalizeSurfaceSymbols(symbols).join('+')}

const DNA={
  C_TSLA_MOMENTUM_CORE:{any_required:['TSLA']},
  D_SPECULATIVE_MOMENTUM:{any_required:['COIN','CRDO','ALAB','SOFI','COHR','COHRN','LITE','CRDW','PLTR']},
  B_MEMORY_SEMI_TACTICAL:{any_required:['MU','SNDK']},
  E_DEFENSIVE_STABILIZER:{any_required:['LQD','AAPL','BAC','C','UNH','REGN','TGT']},
  A_AI_CORE_INSTITUTIONAL:{any_required:['NVDA','TSM','AVGO','SMH','QQQ','AMD','MRVL','ARM','AMAT']}
};
function normalizeTemplateId(t){const s=String(t||'').toUpperCase();for(const k of Object.keys(DNA)){if(s.includes(k)||s===k[0])return k}return s||'F_OTHERS_M7_BASKET_DRIVEN'}
function passTemplateDna(symbols,templateId){const rule=DNA[normalizeTemplateId(templateId)];if(!rule)return true;const set=new Set(normalizeSurfaceSymbols(symbols));return (rule.any_required||[]).some(s=>set.has(String(s).toUpperCase()))}
function classifyLargeTemplateFromSymbols(symbols){const set=new Set(normalizeSurfaceSymbols(symbols));const any=(...xs)=>xs.some(x=>set.has(x));if(any('COIN','CRDO','ALAB','SOFI','COHR','COHRN','LITE','CRDW','PLTR'))return'D_SPECULATIVE_MOMENTUM';if(any('MU','SNDK'))return'B_MEMORY_SEMI_TACTICAL';if(any('TSLA'))return'C_TSLA_MOMENTUM_CORE';if(any('LQD','AAPL','BAC','C','UNH','REGN','TGT'))return'E_DEFENSIVE_STABILIZER';if(any('NVDA','TSM','AVGO','SMH','QQQ','AMD','MRVL','ARM','AMAT'))return'A_AI_CORE_INSTITUTIONAL';return'F_OTHERS_M7_BASKET_DRIVEN'}
function detectThemeTemplate(symbols){const set=new Set(normalizeSurfaceSymbols(symbols));return (set.has('SMH')||set.has('QQQ'))&&(set.has('TSM')||set.has('NVDA')||set.has('AVGO'))?'ETF_SEMI_CORE':null}
function listSurfaceTemplates(collection){const out=[];const walk=x=>{if(!x)return;if(Array.isArray(x)){x.forEach(walk);return}if(typeof x!=='object')return;const looks=x.template_id||x.match_symbols||x.avg_market_coupon!=null||x.avg_new_fair_rate!=null||x.count!=null||x.sample_ids;if(looks){out.push(x);return}Object.values(x).forEach(walk)};walk(collection);return out}
function getSurfaceTemplateByKey(collection,key){const normalizedKey=normalizeSurfaceKey(key);return listSurfaceTemplates(collection).find(t=>normalizeSurfaceKey(t.template_id||t.match_symbols||'')===normalizedKey)||null}
function getMinimumPartialSubsetSize(n){n=Number(n||0);if(n>=5)return 3;if(n>=4)return 2;if(n>=3)return 2;return n}
function findBestSurfacePartial(symbols,smallTemplates){const q=normalizeSurfaceSymbols(symbols);const qSet=new Set(q);const min=getMinimumPartialSubsetSize(q.length);let best=null;listSurfaceTemplates(smallTemplates).forEach(t=>{const parent=t.parent_template||t.large_template||t.basket_template_label||t.template||'';if(!passTemplateDna(q,parent))return;const ts=normalizeSurfaceSymbols(t.match_symbols||t.template_id||'');if(!ts.length)return;const overlap=ts.filter(s=>qSet.has(s)).length;const missing=ts.filter(s=>!qSet.has(s)).length;if(missing>0||ts.length>=q.length||ts.length<min||overlap!==ts.length)return;const score=(t.eligible===false?0:500)+overlap*1000+Number(t.count||0)+(t.eligible===false?-100:0);if(!best||score>best.score)best={score,template:t,overlap,subset_size:ts.length,min_subset_size:min}});return best}

let SURFACE_CACHE=null;
async function loadM8TemplateSurface(){
  if(SURFACE_CACHE)return SURFACE_CACHE;
  try{const res=await fetch(SURFACE_PATH,{cache:'no-store'});if(!res.ok)throw new Error(`m8_template_surface ${res.status}`);SURFACE_CACHE=await res.json();return SURFACE_CACHE}catch(err){console.warn('[M8/M2] surface load failed',err);SURFACE_CACHE=null;return null}
}
function resolveSurfaceTemplateInWindow(symbols,windowData,label){
  if(!windowData)return{level:`${label}_no_surface`,template:null,window:label};
  const key=normalizeSurfaceKey(symbols),themeKey=detectThemeTemplate(symbols);const small=windowData.small_templates||windowData.smallTemplates||windowData.templates||{};const themes=windowData.theme_templates||windowData.themeTemplates||{};
  const exact=getSurfaceTemplateByKey(small,key)||small?.[key];
  if(exact)return{level:exact.eligible===false?`${label}_exact_small_template_low_count`:`${label}_exact_small_template`,template:exact,window:label,low_count:exact.eligible===false};
  const partial=findBestSurfacePartial(symbols,small);if(partial)return{level:`${label}_partial_small_template`,template:partial.template,window:label,overlap:partial.overlap,partial_reason:`query basket contains observed ${partial.subset_size}-stock small template; min allowed subset=${partial.min_subset_size}`};
  const theme=themeKey?themes?.[themeKey]:null;if(theme&&theme.eligible!==false)return{level:`${label}_theme_template`,template:theme,window:label,requested_theme:themeKey};
  return{level:`${label}_no_same_template`,template:null,window:label,requested_theme:themeKey||null};
}
function resolveSurfaceTemplate(symbols,surface){
  if(!surface)return{level:'legacy_fallback',template:null,window:'none'};
  const windows=surface.surface_windows||{'3m':surface};const order=['1w','1m','2m','3m'];const trace=[];
  for(const w of order){const r=resolveSurfaceTemplateInWindow(symbols,windows[w],w);trace.push({window:w,level:r.level,key:r.template?.template_id||r.requested_theme||normalizeSurfaceKey(symbols),count:r.template?.count||0,eligible:!!r.template});if(r.template){r.trace=trace;return r}}
  return{level:'no_recent_surface_beta_0',template:null,window:'none',trace,reason:'No exact/theme/DNA-safe partial subset surface within 3 months.'};
}
function getNewFairFromResult(result){return round2(result?.market_regression?.new_fair_rate??result?.fair_yield??result?.pre_rate)}
function buildNoCorrectionMarketRegression(payload,result,match){const newFair=getNewFairFromResult(result);const current=toNum(payload.marketYield,0);if(!Number.isFinite(Number(newFair)))return null;const gap=current-Number(newFair);return{status:'no_recent_surface_no_correction',method:'m8_template_surface_1w_1m_2m_3m_no_correction',large_template:classifyLargeTemplateFromSymbols(payload.symbols||[]),template:'no_recent_surface_beta_0',small_template:normalizeSurfaceKey(payload.symbols||[]),surface_matched_key:'NO_RECENT_SURFACE_WITHIN_3M',surface_template_id:null,surface_level:'no_recent_surface_beta_0',surface_window:'none',request_basket_key:normalizeSurfaceKey(payload.symbols||[]),history_weighted_market_rate:null,new_fair_rate:round2(newFair),global_regression_rate:round2(newFair),final_fair_rate:round2(newFair),residual_premium:0,overlay_beta:0,convergence_strength:0,gap_after:round2(gap),gap_after_pct:Number(newFair)?round2(gap/Number(newFair)*100):null,pricing_gap_vs_final:round2(gap),pricing_gap_vs_final_pct:Number(newFair)?round2(gap/Number(newFair)*100):null,lookup_count:0,sample_count:0,surface_confidence:'none',confidence:0,surface_candidate_trace:match?.trace||[],comment:`近 1W/1M/2M/3M 都找不到同模板；β=0，Final Fair=New Fair=${round2(newFair)}%。`}}
function buildMarketRegressionFromSurface(payload,result,surface){const match=resolveSurfaceTemplate(payload.symbols||[],surface);if(!match.template)return buildNoCorrectionMarketRegression(payload,result,match);const t=match.template;const newFair=Number.isFinite(Number(t.avg_new_fair_rate))?Number(t.avg_new_fair_rate):Number(t.avg_market_coupon);const hist=Number(t.avg_market_coupon);const beta=Number.isFinite(Number(t.avg_beta))?Number(t.avg_beta):1;const finalFair=newFair+beta*(hist-newFair);const current=toNum(payload.marketYield,0);const gap=current-finalFair;const before=hist-newFair;const after=hist-finalFair;const improve=Math.abs(before)>0.0001?(1-Math.abs(after)/Math.abs(before))*100:0;return{status:'ok',method:'m8_template_surface_windowed_1w_1m_2m_3m',large_template:t.parent_template||classifyLargeTemplateFromSymbols(payload.symbols||[]),template:match.level,small_template:match.requested_theme||(match.level.includes('theme_template')?t.template_id:normalizeSurfaceKey(payload.symbols||[])),surface_matched_key:t.template_id,surface_template_id:t.template_id,surface_level:match.level,surface_window:match.window||'3m',theme_type:t.theme_type||null,request_basket_key:normalizeSurfaceKey(payload.symbols||[]),history_weighted_market_rate:round2(hist),new_fair_rate:round2(newFair),global_regression_rate:round2(newFair),final_fair_rate:round2(finalFair),residual_premium:round2(hist-newFair),overlay_beta:round2(beta),convergence_strength:round2(beta),history_market_gap:round2(hist-newFair),history_gap_pct:newFair?round2((hist-newFair)/newFair*100):null,gap_before:round2(before),gap_before_pct:newFair?round2(before/newFair*100):null,gap_after:round2(gap),gap_after_pct:finalFair?round2(gap/finalFair*100):null,pricing_gap_vs_final:round2(gap),pricing_gap_vs_final_pct:finalFair?round2(gap/finalFair*100):null,market_gap:round2(gap),gap_pct:finalFair?round2(gap/finalFair*100):null,improvement_pct:round2(improve),lookup_count:t.count||0,sample_count:t.count||0,surface_confidence:t.confidence||'low',confidence:t.avg_confidence??t.confidence??'low',surface_sample_ids:t.sample_ids||[],surface_candidate_trace:match.trace||[],latest_observation_date:t.latest_observation_date||null,oldest_observation_date:t.oldest_observation_date||null,comment:`使用 ${match.window||'3m'} 視窗：${match.level} → ${t.template_id}，樣本 ${t.count||0} 筆；Surface Market=${round2(hist)}%，New Fair=${round2(newFair)}%，β=${round2(beta)}，Final Fair=${round2(finalFair)}%。Current Market Yield=${round2(current)}% 只做 gap 判定。`}}

async function buildMarketRegressionForPayload(payload,result){const surface=await loadM8TemplateSurface();return buildMarketRegressionFromSurface(payload,result,surface)}
function pricingViewFromGap(gapPct,fallback){if(Number.isFinite(Number(gapPct))){const g=Number(gapPct);if(g>=10)return'便宜';if(g>=2)return'略便宜';if(g<=-10)return'偏貴';if(g<=-2)return'略貴';return'合理'}return fallback||'-'}

export async function runSingleMarketFcnFullCheck(input={}){
  withRootFetch();
  const symbols=normalizeSurfaceSymbols(input.symbols||input.basket);
  const payload={caseName:'M2_SINGLE_MARKET_FCN',symbols,KI:toNum(input.ki,null),Strike:toNum(input.strike,null),T:toNum(input.tenor,null),type:input.type||input.barrier_type||'AKI',marketYield:toNum(input.coupon,0),issuer:input.bank||'',upstreamBank:input.upstreamBank||'',inquiryDate:new Date().toISOString().slice(0,10)};
  const pref=await runM8Case(payload);
  const marketRegression=await buildMarketRegressionForPayload(payload,pref);
  const market=toNum(payload.marketYield,0);const final=toNum(marketRegression?.final_fair_rate,pref?.fair_yield);const gap=market-final;const gapPct=final?round2(gap/final*100):null;
  return{...pref,market_regression:marketRegression,m8_market_regression:marketRegression,final_fair_rate:round2(final),pricing_gap_vs_final:round2(gap),pricing_gap_vs_final_pct:gapPct,pricing_delta:round2(gap),pricing_view:pricingViewFromGap(gapPct,pref?.pricing_view),single_adapter_version:'m8_single_batch_adapter_v1.0.0'};
}

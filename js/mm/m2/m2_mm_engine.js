// ============================================================
// MM/M2 新作戰中心 Engine v0.5.4
// Patch: M8 batch mirror single result UI
// ============================================================
import { runM2HealthEngine } from '../../core/m2_health_engine_v1.js';
import { renderLegacyHoldingZones } from './m2_holding_zones_legacy_cards.js';
import {
  runBatchMarketWorkspace,
  buildTemplateSummary,
  buildSubtemplateSummaryForRows,
  buildUpdateRadar
} from './m8_market_analysis_bridge_v1.js';
import { runSingleMarketFcnFullCheck as runSingleMarketFcnCheck } from './m8_single_batch_adapter.js';

const TARGET_BANK={富邦:900000,永豐:500000};
const STOCK_CAP={core:500000,growth:300000,defensive:300000,income:200000,speculative:30000};
const CAP_EXCEPTION={NVDA:700000,TSM:700000,SMH:700000,GOOG:700000};
const BUCKET_COLOR={'長期穩定現金流':'#2563eb','合理投資型':'#0f766e','積極單':'#f97316','短期投機單':'#7c3aed','其他':'#94a3b8'};
const MODULE_META={summary:['1. Summary Dashboard','資金水位 / 配置 / 健康 / 預計出場'],zones:['2. Holding Zones','到期專區 / 預計提前到期 / Danger / Watch / Healthy'],planning:['3. Maturity Cashflow','Planner A/B/C/D/E0：到期資金流與佈局重建'],market:['4. Market FCN Analysis','A / B1 / B2 / C：單筆、模板理解、Radar、配置建議'],management:['5. FCN / Stock Management','完整 FCN 查詢 + 股票風險分析'],pool:['6. Pool Manual Ops','手動建新單 / 編輯 / 複製 / Soft Delete / 匯出']};
let runtime=null, plannerRows=[], poolMap={}, currentModule='summary', stockCapacityRowsData=[], marketHistory=[], m8Surface=null, marketTab='single', batchWorkspaceCache=null;
const n=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const fmt=(v,d=0)=>n(v).toLocaleString('en-US',{maximumFractionDigits:d});
const pct=(v,b,d=1)=>b?fmt(v/b*100,d):'0';
const sum=list=>list.reduce((s,x)=>s+n(x.amt),0);
function bucket(x){const r=n(x.rate),t=n(x.tenor);if(t<=6&&r>20.99)return'短期投機單';if(r>=21&&r<=25)return'積極單';if(r>=18&&r<=20.99)return'合理投資型';if(r>=12&&r<=17.99)return'長期穩定現金流';return'其他'}
function kpi(k,v,d,a,extra=''){return `<div class="kpi" style="--accent:${a}"><div class="kpi-label">${k}</div><div class="kpi-value">${v}</div><div class="kpi-sub">${d}</div>${extra}</div>`}
function flowCard(k,v,d,a){return `<div class="flow-card" style="--accent:${a}"><div class="flow-label">${k}</div><div class="flow-value">${v}</div><div class="flow-sub">${d}</div></div>`}
function metricBlock(t,m,s,a){return `<div class="mini-metric" style="--accent:${a}"><div class="metric-title">${t}</div><div class="metric-main">${m}</div><div class="metric-sub">${s}</div></div>`}
function listCard(title,body,cls=''){return `<div class="list-card ${cls}"><b>${title}</b><br>${body}</div>`}
function conic(parts,total){let cur=0;return parts.map(p=>{const deg=total?p.amt/total*360:0;const s=`${BUCKET_COLOR[p.k]||'#ddd'} ${cur}deg ${cur+deg}deg`;cur+=deg;return s}).join(',')}
function miniBar(rows,total){return `<div class="mini-stack">${rows.map(r=>`<div><div class="mini-line"><span style="--bar:${r.color};width:${Math.min(100,total?r.value/total*100:0)}%"></span></div><span class="kpi-chip">${r.label} ${total?fmt(r.value/total*100,0):0}%</span></div>`).join('')}</div>`}
function dateValue(v){if(!v)return null;const d=new Date(v);return Number.isNaN(d.getTime())?null:d}
function entryDateRaw(f){return f.entry_date||f.create_date||f.trade_date||f.start_date||f.date||f.created_at||f.issue_date||null}
function daysSinceEntry(f){const d=dateValue(entryDateRaw(f));if(!d)return null;return Math.floor((Date.now()-d.getTime())/86400000)}
function stockRatio(s){const cur=n(s.price_now??s.current_price??s.spot??s.now,NaN);const ent=n(s.entry_price??s.entry??s.start_price,NaN);return Number.isFinite(cur)&&Number.isFinite(ent)&&ent>0?cur/ent:null}
function worstEntryRatio(f){const ratios=(f.stocks||[]).map(stockRatio).filter(x=>x!==null);if(!ratios.length)return null;return Math.min(...ratios)}
function isEarlyExitCandidate(f){const d=daysSinceEntry(f);const r=worstEntryRatio(f);return d!==null&&d>=27&&r!==null&&r>1}
function productType(f){return String(f.type||f.fcn_type||f.note_type||f.structure||f.product_type||'').toUpperCase().includes('AKI')?'AKI':'EKI'}
function stockNow(s){return n(s.price_now??s.current_price??s.spot??s.now,NaN)}
function stockKI(s){return n(s.ki_price??s.ki??s.knock_in_price??s.lower_barrier_price??s.barrier_price,NaN)}
function stockStrike(s){return n(s.strike_price??s.strike??s.execution_price??s.exec_price,NaN)}
function terminalBelowKI(s){const cur=stockNow(s),ki=stockKI(s);return Number.isFinite(cur)&&Number.isFinite(ki)&&ki>0?cur<ki:null}
function terminalBelowStrike(s){const cur=stockNow(s),strike=stockStrike(s);return Number.isFinite(cur)&&Number.isFinite(strike)&&strike>0?cur<strike:null}
function everBarrierBreached(s){const v=s.period_barrier_breached??s.barrier_breached??s.ki_breached??s.has_knock_in??s.knock_in_event??s.touched_ki; if(v===true||v==='true'||v==='Y'||v==='yes'||v===1)return true;if(v===false||v==='false'||v==='N'||v==='no'||v===0)return false;return null}
function projectedMaturityDate(f){const e=dateValue(entryDateRaw(f));const months=n(f.period??f.tenor??f.tenor_months,NaN);if(!e||!Number.isFinite(months))return null;const d=new Date(e);d.setMonth(d.getMonth()+months);d.setDate(d.getDate()+7);return d.toISOString().slice(0,10)}
function hasReachedProjectedMaturity(f){const p=projectedMaturityDate(f);const d=dateValue(p);return d?Date.now()>=d.getTime():false}
function maturityPayoffState(f){const type=productType(f),projected=projectedMaturityDate(f);if(!hasReachedProjectedMaturity(f)){return{maturity_state:'maturity_observe',maturity_reason:`尚未進入 entry + period + 7 days 的實際滿期結算日（${projected||'日期不足'}），列為預計滿期 / 觀察。`,maturity_type_rule:type,period_barrier_breached:null,terminal_barrier_breached:null,terminal_all_above_strike:false,terminal_any_below_strike:false,projected_maturity_date:projected}}
const stocks=f.stocks||[];const terminal=stocks.map(s=>({belowKI:terminalBelowKI(s),belowStrike:terminalBelowStrike(s),breached:everBarrierBreached(s)}));const anyBelowKI=terminal.some(x=>x.belowKI===true);const anyBelowStrike=terminal.some(x=>x.belowStrike===true);const allAboveStrike=terminal.length&&terminal.every(x=>x.belowStrike===false);const anyDataMissing=terminal.some(x=>x.belowKI===null||x.belowStrike===null||(type==='AKI'&&x.breached===null));let state='maturity_observe',reason='已進入實際滿期結算日，但資料不足；先列入預計滿期 / 觀察。';if(type==='EKI'){if(anyBelowKI){state='stock_delivery_risk';reason='EKI：滿期時任一股票破下限價，列為接股可能。';}else if(terminal.length&&!terminal.some(x=>x.belowKI===null)){state='safe_maturity';reason='EKI：滿期時至少一支 / 全部可判定未破下限價，列為滿期安全。';}}
else{const anyBreached=terminal.some(x=>x.breached===true);const noneBreached=terminal.length&&terminal.every(x=>x.breached===false);if(anyBelowKI){state='stock_delivery_risk';reason='AKI：期末任一股票破下限價，列為接股可能。';}else if(anyBreached&&anyBelowStrike){state='stock_delivery_risk';reason='AKI：期間曾破下限價，且期末任一股票低於執行價，列為接股可能。';}else if(noneBreached&&!anyBelowKI&&!anyDataMissing){state='safe_maturity';reason='AKI：期間未破下限價，且期末未破下限價，列為滿期安全。';}else if(anyBreached&&allAboveStrike){state='safe_maturity';reason='AKI：期間曾破下限價，但期末每一隻股票都高於執行價，列為滿期安全。';}}
return{maturity_state:state,maturity_reason:reason,maturity_type_rule:type,period_barrier_breached:type==='AKI'?terminal.some(x=>x.breached===true):null,terminal_barrier_breached:anyBelowKI,terminal_all_above_strike:!!allAboveStrike,terminal_any_below_strike:anyBelowStrike,projected_maturity_date:projected}}
function getGroups(){const active=plannerRows,base=active.filter(x=>x.planner_tag==='Planning Base'),ready=active.filter(x=>x.planner_tag==='Early Exit Ready'),maturity=active.filter(x=>x.planner_tag==='30D Maturity'),candidate=active.filter(x=>x.planner_tag==='Early Exit Candidate'),cash=[...ready,...maturity,...candidate];return{active,base,ready,maturity,candidate,cash,hard:[...ready,...maturity]}}
function buildPlannerRows(fcns){plannerRows=fcns.map(f=>{const d=f.maturity?.days_to_maturity??9999;let tag='Planning Base';const ratio=worstEntryRatio(f);const days=daysSinceEntry(f);const payoff=maturityPayoffState(f);if(f.early_exit_ready)tag='Early Exit Ready';else if(d<=30)tag='30D Maturity';else if(isEarlyExitCandidate(f))tag='Early Exit Candidate';return{...f,...payoff,planner_tag:tag,excluded:tag!=='Planning Base',early_exit_candidate_rule:'entry+27_and_worst_of_over_100pct_entry',early_exit_candidate_days_since_entry:days,early_exit_candidate_worst_entry_ratio:ratio,early_exit_candidate_worst_entry_pct:ratio===null?null:ratio*100}})}
function buildStockCapacityRows(){const stockMap={};plannerRows.forEach(f=>(f.basket||[]).forEach(s=>{if(!stockMap[s])stockMap[s]={symbol:s,active:0,release:0,base:0,count:0,danger:0,watch:0};stockMap[s].active+=n(f.amt);stockMap[s].count++;if(f.excluded)stockMap[s].release+=n(f.amt);else stockMap[s].base+=n(f.amt);const st=(f.stocks||[]).find(x=>x.symbol===s);if(st?.stock_health==='danger')stockMap[s].danger++;if(st?.stock_health==='watch')stockMap[s].watch++}));stockCapacityRowsData=Object.values(stockMap).map(r=>{const meta=poolMap[r.symbol]||{},category=meta.category||'growth',max=CAP_EXCEPTION[r.symbol]||STOCK_CAP[category]||300000,staticRemain=Math.max(0,max-r.active),dynamic=Math.max(0,max-r.base);let light='GREEN',comment='可正常布局';if(r.danger>0){light='RED';comment='有 danger 紀錄，先處理風險'}else if(dynamic<=0){light='RED';comment='超過上限'}else if(dynamic/max<0.2||r.watch>0){light='YELLOW';comment='接近滿載或有 watch'}return{...r,category,max,staticRemain,dynamic,light,comment}}).sort((a,b)=>a.light.localeCompare(b.light)||b.dynamic-a.dynamic)}
function allocParts(list){const targets={'長期穩定現金流':40,'合理投資型':30,'積極單':20,'短期投機單':10,'其他':0};return Object.keys(targets).map(k=>({k,target:targets[k],amt:sum(list.filter(x=>bucket(x)===k))}))}
function compactFCN(f){return `<div class="compact-fcn"><div><div class="compact-main">${f.fcn_id}</div><div class="compact-sub">${(f.basket||[]).join(' / ')}｜Worst ${f.worst_of||'-'}</div></div><div class="compact-amt">USD ${fmt(f.amt)}</div><div><span class="pill ${f.fcn_health==='danger'?'pill-bad':f.fcn_health==='watch'?'pill-warn':'pill-good'}">${f.fcn_health||'-'}</span></div><button class="detail-toggle" type="button">明細</button><div class="fcn-more">Bank: ${f.tw_bank||''}｜Rate ${fmt(f.rate,2)}%｜Tenor ${f.tenor||''}M｜Tag ${f.planner_tag}<br>Decision: ${f.decision_label||''}<br>Days to maturity: ${f.maturity?.days_to_maturity??'-'}｜Early Exit ${f.early_exit_remark_count??0}/${f.early_exit_total_count??0}</div></div>`}
function bindDetailToggles(){document.querySelectorAll('.detail-toggle').forEach(btn=>btn.addEventListener('click',()=>btn.closest('.compact-fcn')?.classList.toggle('open')))}
function renderTopDashboard(){const g=getGroups(),parts=allocParts(g.active),total=sum(g.active)||1,bankF=sum(g.active.filter(x=>(x.tw_bank||'').includes('富邦'))),bankS=sum(g.active.filter(x=>(x.tw_bank||'').includes('永豐'))),cashTotal=sum(g.cash)||1;topDashboard.innerHTML=[kpi('FCN 資金水位',`USD ${fmt(sum(g.active))}`,`${g.active.length} 檔｜富邦 ${fmt(bankF)} / 永豐 ${fmt(bankS)}`,'#2563eb',miniBar([{label:'富邦',value:bankF,color:'#2563eb'},{label:'永豐',value:bankS,color:'#0f766e'}],sum(g.active))),kpi('本月預計出場',`USD ${fmt(sum(g.cash))}`,`到期 ${fmt(sum(g.maturity))}｜提前 ${fmt(sum(g.ready))}｜候選 ${fmt(sum(g.candidate))}`,'#f97316',miniBar([{label:'到期',value:sum(g.maturity),color:'#dc2626'},{label:'提前',value:sum(g.ready),color:'#0f766e'},{label:'候選',value:sum(g.candidate),color:'#f97316'}],cashTotal)),kpi('健康狀態',`${runtime.danger.length+runtime.watch.length} 需看`,`Danger ${runtime.danger.length}｜Watch ${runtime.watch.length}｜Healthy ${runtime.healthy.length}`,'#dc2626',miniBar([{label:'Danger',value:runtime.danger.length,color:'#dc2626'},{label:'Watch',value:runtime.watch.length,color:'#f97316'},{label:'Healthy',value:runtime.healthy.length,color:'#0f766e'}],Math.max(1,runtime.total))),kpi('Planning Base',`USD ${fmt(sum(g.base))}`,`${g.base.length} 檔｜扣除本月出場後母體`,'#0f766e'),kpi('配置主軸',parts.map(p=>`${p.k.slice(0,2)} ${fmt(p.amt/total*100,0)}%`).join('｜'),'目前 active 配置粗覽','#7c3aed',miniBar(parts.map(p=>({label:p.k.slice(0,2),value:p.amt,color:BUCKET_COLOR[p.k]})),total)),kpi('系統模式','Read-only','不改舊 M2 / Planner，不寫回資料','#64748b')].join('')}
function setModule(m){currentModule=m;document.querySelectorAll('.menu-btn').forEach(b=>b.classList.toggle('active',b.dataset.module===m));document.getElementById('m2HoldingZonesSubnav')?.classList.toggle('show',m==='zones');document.getElementById('m2MaturityCashflowSubnav')?.classList.toggle('show',m==='planning');document.getElementById('m2MarketFcnSubnav')?.classList.toggle('show',m==='market');const meta=MODULE_META[m];activeTitle.textContent=meta[0];activeSub.textContent=meta[1];bottomTitle.textContent=`${meta[0]}｜大型資訊查詢區`;bottomSub.textContent=meta[1];renderCurrentModule()}
function renderCurrentModule(){if(!runtime)return;({summary:renderSummary,zones:renderZones,planning:renderPlanning,market:renderMarket,management:renderManagement,pool:renderPool}[currentModule]||renderSummary)();bindDetailToggles();bindFilters()}
function renderSummary(){const g=getGroups();rightDetail.innerHTML=`<div class="flow-panel">${flowCard('Active',`${g.active.length} / USD ${fmt(sum(g.active))}`,'目前持倉','#2563eb')}${flowCard('Expected Exit',`${g.cash.length} / USD ${fmt(sum(g.cash))}`,'本月預計出場','#f97316')}${flowCard('Planning Base',`${g.base.length} / USD ${fmt(sum(g.base))}`,'真正分析母體','#0f766e')}${flowCard('Risk',`${runtime.danger.length+runtime.watch.length}`,'Danger + Watch','#dc2626')}</div>`;rightInsight.innerHTML=`<div class="decision-note">M2 Summary 要一眼看完：現在有多少 FCN、健康度如何、本月預計釋放多少資金，以及釋放來源。下一步配置必須以 Planning Base 為母體，不是拿 Active 全部直接分析。</div>`;bottomQuery.innerHTML=`<div class="grid-3"><div class="panel"><h3>本月出場來源</h3>${listCard('30D Maturity',`${g.maturity.length} 檔｜USD ${fmt(sum(g.maturity))}`)}${listCard('Early Exit Ready',`${g.ready.length} 檔｜USD ${fmt(sum(g.ready))}`)}${listCard('Early Exit Candidate',`${g.candidate.length} 檔｜USD ${fmt(sum(g.candidate))}`)}</div><div class="panel"><h3>銀行資金水位</h3>${Object.keys(TARGET_BANK).map(b=>{const a=sum(g.active.filter(x=>(x.tw_bank||'').includes(b)));return listCard(b,`Active USD ${fmt(a)}｜Target USD ${fmt(TARGET_BANK[b])}｜Util ${pct(a,TARGET_BANK[b])}%`)}).join('')}</div><div class="panel"><h3>健康摘要</h3>${listCard('到期專區',`${runtime.maturity_zone.length} 檔`)}${listCard('Danger / Watch',`${runtime.danger.length} / ${runtime.watch.length} 檔`)}${listCard('Healthy',`${runtime.healthy.length} 檔`)}</div></div>`}
function renderZones(){renderLegacyHoldingZones({runtime,groups:getGroups(),rightDetail,rightInsight,bottomQuery})}
function renderBrokerBlock(){const g=getGroups();return `<div class="broker-grid">${Object.keys(TARGET_BANK).map(b=>{const target=TARGET_BANK[b],cur=g.active.filter(x=>(x.tw_bank||'').includes(b)),base=g.base.filter(x=>(x.tw_bank||'').includes(b)),exit=g.cash.filter(x=>(x.tw_bank||'').includes(b)),activeAmt=sum(cur),baseAmt=sum(base),exitAmt=sum(exit),future=Math.max(0,target-baseAmt);return `<div class="broker-card"><div class="broker-head"><div><b>${b}</b><div class="muted">Future Available</div></div><div class="broker-avail">USD ${fmt(future)}</div></div><div class="broker-metrics">${metricBlock('出場',`${exit.length} / USD ${fmt(exitAmt)}`,`${pct(exitAmt,activeAmt)}% Active`,'#f97316')}${metricBlock('剩餘母體',`${base.length} / USD ${fmt(baseAmt)}`,`${pct(baseAmt,activeAmt)}% Active`,'#0f766e')}${metricBlock('原母體',`${cur.length} / USD ${fmt(activeAmt)}`,`${pct(activeAmt,target)}% Target`,'#2563eb')}${metricBlock('可補',`USD ${fmt(future)}`,`${pct(future,target)}% open`,'#7c3aed')}</div></div>`}).join('')}</div>`}
function renderAllocBlock(){const g=getGroups(),base=g.base,total=sum(base)||1,parts=allocParts(base);return `<div class="alloc-layout"><div class="panel"><b>Planning Base 結構</b><div class="pie" style="background:conic-gradient(${conic(parts,total)})"></div>${parts.map(p=>`<div class="legend-row"><span><i class="legend-dot" style="background:${BUCKET_COLOR[p.k]}"></i>${p.k}</span><b>${fmt(p.amt/total*100,1)}%</b></div>`).join('')}</div><div class="panel"><b>Real vs Target</b>${parts.map(p=>{const bp=p.amt/total*100,gap=bp-p.target;return `<div class="alloc-row"><div><b>${p.k}</b><div class="muted">USD ${fmt(p.amt)} / ${fmt(bp,1)}%</div><div class="bar"><span style="--bar:${BUCKET_COLOR[p.k]};width:${Math.min(100,bp)}%"></span></div></div><div><b>Target ${p.target}%</b><div class="muted">Gap ${fmt(gap,1)}%</div></div></div>`}).join('')}</div><div class="panel"><div class="interpret-box"><div class="interpret-title">Planning Logic</div>此區是 m2_planner A/B/C/D/E0 的位置，負責到期資金流與重建佈局，不應佔滿整個 M2。</div></div></div>`}

function planningDecisionBlock(){
  const g=getGroups(),hard=sum(g.hard),soft=sum(g.candidate),conservative=hard,aggressive=hard+soft*0.5;
  const base=g.base,total=sum(base)||1,parts=allocParts(base).map(p=>({...p,pct:p.amt/total*100,gap:p.amt/total*100-p.target}));
  const under=parts.filter(p=>p.gap<0).sort((a,b)=>a.gap-b.gap);
  const over=parts.filter(p=>p.gap>0).sort((a,b)=>b.gap-a.gap);
  const bankLines=Object.keys(TARGET_BANK).map(b=>{const baseAmt=sum(g.base.filter(x=>(x.tw_bank||'').includes(b))),hardAmt=sum(g.hard.filter(x=>(x.tw_bank||'').includes(b))),candidateAmt=sum(g.candidate.filter(x=>(x.tw_bank||'').includes(b))),available=Math.max(0,TARGET_BANK[b]-baseAmt);return{bank:b,baseAmt,hardAmt,candidateAmt,available,util:TARGET_BANK[b]?baseAmt/TARGET_BANK[b]*100:0};});
  const bankBest=bankLines.slice().sort((a,b)=>b.available-a.available)[0];
  const first=under[0]?.k||'暫無明顯缺口';
  const second=under[1]?.k||'視市場單品質';
  return `<div class="planner-decision" id="planner-decision"><div class="planner-decision-title">Planner Decision｜本月資金結論</div><div class="planner-decision-grid"><div><label>保守可用</label><b>USD ${fmt(conservative)}</b><span>只計 Hard Release</span></div><div><label>積極可用</label><b>USD ${fmt(aggressive)}</b><span>Hard + 50% Candidate</span></div><div><label>優先銀行</label><b>${bankBest?.bank||'-'}</b><span>釋放後可用 USD ${fmt(bankBest?.available||0)}</span></div><div><label>優先補類別</label><b>${first}</b><span>第二順位：${second}</span></div></div><div class="planner-one-line">操作建議：先以 Hard Release 作保守資金池，Candidate 不全數視為現金；新單優先補「${first}」，若市場票息不足，再用「${second}」候補。</div>${over.length?`<div class="planner-warn">暫停或降權：${over.slice(0,2).map(p=>`${p.k} +${fmt(p.gap,1)}%`).join('｜')}</div>`:''}</div>`;
}
function renderCashInBlock(){
  const g=getGroups();
  return `<div class="cashflow-section" id="planner-cash-in"><div class="section-head"><div><h3>A. 本月可用資金總覽</h3><p>Hard Release 是保守可用資金，Soft Candidate 先列觀察，不全數當現金。</p></div></div><div class="flow-panel">${flowCard('確定釋放',`USD ${fmt(sum(g.hard))}`,`${g.hard.length} 檔｜30D + Ready`,'#dc2626')}${flowCard('可能釋放',`USD ${fmt(sum(g.candidate))}`,`${g.candidate.length} 檔｜Candidate`,'#f97316')}${flowCard('保守可用',`USD ${fmt(sum(g.hard))}`,'只計確定釋放','#0f766e')}${flowCard('積極可用',`USD ${fmt(sum(g.hard)+sum(g.candidate)*0.5)}`,'Hard + 50% Candidate','#7c3aed')}</div></div>`;
}
function renderBankCapacityBlock(){
  const g=getGroups();
  return `<div class="cashflow-section" id="planner-bank-capacity"><div class="section-head"><div><h3>B. 銀行資金水位</h3><p>釋放後看哪一家銀行有空間承接新單。</p></div></div><div class="broker-grid">${Object.keys(TARGET_BANK).map(b=>{const target=TARGET_BANK[b],active=sum(g.active.filter(x=>(x.tw_bank||'').includes(b))),hard=sum(g.hard.filter(x=>(x.tw_bank||'').includes(b))),candidate=sum(g.candidate.filter(x=>(x.tw_bank||'').includes(b))),base=sum(g.base.filter(x=>(x.tw_bank||'').includes(b))),available=Math.max(0,target-base);let msg=available>target*0.25?'有空間，可優先承接新單':available>target*0.1?'可小額承接，需控單':'偏滿，優先不補或只補小額';return `<div class="broker-card"><div class="broker-head"><div><b>${b}</b><div class="muted">${msg}</div></div><div class="broker-avail">USD ${fmt(available)}</div></div><div class="broker-metrics">${metricBlock('Active',`USD ${fmt(active)}`,`${pct(active,target)}% target`,'#2563eb')}${metricBlock('Expected Release',`USD ${fmt(hard)}`,`Candidate USD ${fmt(candidate)}`,'#f97316')}${metricBlock('Planning Base',`USD ${fmt(base)}`,`${pct(base,target)}% target`,'#0f766e')}${metricBlock('Available',`USD ${fmt(available)}`,`${pct(available,target)}% open`,'#7c3aed')}</div></div>`}).join('')}</div></div>`;
}
function renderReleaseDetailsBlock(){
  const g=getGroups();
  return `<div class="cashflow-section" id="planner-fcn-detail"><div class="section-head"><div><h3>C. FCN 明細</h3><p>左側快速導航會連到這三段：Hard Release / Soft Candidate / Planning Base。</p></div></div><div class="cash-grid"><div class="cash-card" id="planner-hard-release"><div class="cash-title">Hard Release｜確定釋放</div>${g.hard.map(compactFCN).join('')||'<div class="muted">none</div>'}</div><div class="cash-card" id="planner-soft-candidate"><div class="cash-title">Soft Candidate｜觀察釋放</div>${g.candidate.map(compactFCN).join('')||'<div class="muted">none</div>'}</div><div class="cash-card" id="planner-planning-base"><div class="cash-title">Planning Base｜扣除後母體</div>${g.base.slice(0,12).map(compactFCN).join('')}</div></div></div>`;
}
function renderPlanningBaseBlock(){
  return `<div class="cashflow-section" id="planner-allocation"><div class="section-head"><div><h3>D. 扣除後 Planning Base 配置</h3><p>扣除本月確定 / 可能出場後，檢查四大類距離目標配置。</p></div></div>${renderAllocBlock()}</div>`;
}
function bindMaturitySubnav(){
  const nav=document.getElementById('m2MaturityCashflowSubnav');
  if(!nav||nav.dataset.bound==='1')return;
  nav.dataset.bound='1';
  nav.addEventListener('click',ev=>{
    const btn=ev.target.closest('[data-planner-nav],[data-planner-action]');
    if(!btn)return;
    ev.preventDefault();
    const key=btn.dataset.plannerNav;
    const action=btn.dataset.plannerAction;
    setModule('planning');
    setTimeout(()=>{
      if(action==='toggle-dashboard'){
        document.getElementById('topDashboard')?.classList.toggle('m2-dashboard-open');
        return;
      }
      const map={cash:'planner-cash-in',bank:'planner-bank-capacity',detail:'planner-fcn-detail',hard:'planner-hard-release',soft:'planner-soft-candidate',base:'planner-planning-base',alloc:'planner-allocation',decision:'planner-decision'};
      const el=document.getElementById(map[key]||'bottomQuery');
      el?.scrollIntoView({behavior:'smooth',block:'start'});
    },220);
  });
}

function exposeM2RuntimeContext(){
  try{
    const g=getGroups();
    const base=g.base||[];
    const maturityRows=g.maturity||[];
    const readyRows=g.ready||[];
    const candidateRows=g.candidate||[];
    const wan=v=>Math.floor(n(v,0)/10000);
    const byState=state=>maturityRows.filter(x=>x.maturity_state===state);
    const confirmedMaturity=sum(byState('safe_maturity'));
    const confirmedEarly=sum(readyRows);
    const confirmedAssignment=sum(byState('stock_delivery_risk'));
    const expectedMaturity=sum(byState('maturity_observe'));
    const expectedEarly=sum(candidateRows);
    const expectedAssignment=0;
    const expectedPool=Math.max(0, expectedMaturity + expectedEarly - expectedAssignment);
    const strategy_amounts={};
    const strategy_amounts_wan={};
    ['長期穩定現金流','合理投資型','積極單','短期投機單'].forEach(k=>{
      const amt=sum(base.filter(x=>bucket(x)===k));
      strategy_amounts[k]=amt;
      strategy_amounts_wan[k]=wan(amt);
    });
    window.__M2_RUNTIME_CONTEXT__={
      version:'v071_runtime_context_stage_caps',
      groups:g,
      strategy_amounts,
      strategy_amounts_wan,
      target_bank:TARGET_BANK,
      confirmed_maturity:confirmedMaturity,
      confirmed_early_exit:confirmedEarly,
      confirmed_assignment:confirmedAssignment,
      expected_maturity:expectedMaturity,
      expected_early_exit:expectedEarly,
      expected_assignment:expectedAssignment,
      confirmed_maturity_wan:wan(confirmedMaturity),
      confirmed_early_exit_wan:wan(confirmedEarly),
      confirmed_assignment_wan:wan(confirmedAssignment),
      expected_maturity_wan:wan(expectedMaturity),
      expected_early_exit_wan:wan(expectedEarly),
      expected_assignment_wan:wan(expectedAssignment),
      expected_pool_wan:wan(expectedPool),
      release_stage_source:{
        confirmed_maturity_count:byState('safe_maturity').length,
        confirmed_early_exit_count:readyRows.length,
        confirmed_assignment_count:byState('stock_delivery_risk').length,
        expected_maturity_count:byState('maturity_observe').length,
        expected_early_exit_count:candidateRows.length,
        expected_assignment_count:0,
        formula:'stage1=confirmed_maturity+confirmed_early_exit-confirmed_assignment; stage2=floor(expected_pool*50%); stage3=expected_pool-stage2'
      },
      updated_at:new Date().toISOString()
    };
  }catch(err){
    console.warn('M2 runtime context expose failed',err);
  }
}
function renderPlanning(){const g=getGroups();exposeM2RuntimeContext();rightDetail.innerHTML=`<div class="flow-panel">${flowCard('本月可用',`USD ${fmt(sum(g.hard))}`,'保守：Hard Release','#0f766e')}${flowCard('積極可用',`USD ${fmt(sum(g.hard)+sum(g.candidate)*0.5)}`,'Hard + 50% Candidate','#7c3aed')}${flowCard('觀察釋放',`USD ${fmt(sum(g.candidate))}`,`${g.candidate.length} 檔 candidate`,'#f97316')}${flowCard('Planning Base',`USD ${fmt(sum(g.base))}`,`${g.base.length} 檔扣除後母體`,'#2563eb')}</div>`;rightInsight.innerHTML=`<div class="decision-note">Maturity Cashflow 只回答三件事：本月多少錢會回來、哪家銀行有空間、扣除後應該補哪一類 FCN。Candidate 先列觀察，不全數視為現金。</div>`;bottomQuery.innerHTML=`${planningDecisionBlock()}${renderCashInBlock()}${renderBankCapacityBlock()}${renderPlanningBaseBlock()}${renderReleaseDetailsBlock()}`;bindMaturitySubnav()}

function normalizeBasket(symbols=[]){return [...new Set((symbols||[]).map(s=>String(s||'').trim().toUpperCase()).filter(Boolean).map(s=>s==='GOOGL'?'GOOG':s))].sort().join('+')}
function safeVal(obj,keys){for(const k of keys){if(obj&&obj[k]!==undefined&&obj[k]!==null)return obj[k]}return null}
function getSingleInput(){return{symbols:(document.getElementById('inqBasket')?.value||'').toUpperCase().split(/[,+\/\s]+/).map(x=>x.trim()).filter(Boolean),coupon:n(document.getElementById('inqCoupon')?.value,0),tenor:n(document.getElementById('inqTenor')?.value,0),strike:n(document.getElementById('inqStrike')?.value,0),ki:n(document.getElementById('inqKI')?.value,NaN),type:document.getElementById('inqType')?.value||'AKI',memory:document.getElementById('inqMemory')?.value||'daily',bank:document.getElementById('inqBank')?.value||'富邦',amount:n(document.getElementById('inqAmount')?.value,0)}}
function renderCapacityGate(input){
  const syms=input.symbols||[];
  const amt=n(input.amount,0);
  const rows=syms.map(sym=>{
    const r=stockCapacityRowsData.find(x=>x.symbol===sym)||{symbol:sym,max:CAP_EXCEPTION[sym]||300000,active:0,base:0,release:0,dynamic:CAP_EXCEPTION[sym]||300000,light:'GREEN',comment:'無既有曝險'};
    const after=r.base+amt;
    const util=r.max?after/r.max*100:0;
    let status='OK',cls='pill-good';
    if(util>=100){status='OVER';cls='pill-bad'}else if(util>=80){status='HOT';cls='pill-warn'}
    return{...r,after,util,status,cls};
  });
  const vals=rows.filter(r=>Number.isFinite(r.dynamic)).map(r=>r.dynamic);
  const maxAllowed=vals.length?Math.max(0,Math.min(...vals)):0;
  return `<div class="panel" style="margin-top:12px"><h3>M2 Basket Capacity Gate｜Basket 投資水位分析</h3><div class="decision-note">以 Planning Base 曝險計算，不把一個月內預計出場部位當成長期占用。建議單筆上限取 basket 內最小 dynamic capacity。</div><div class="flow-panel">${flowCard('Input Amount',amt?`USD ${fmt(amt)}`:'未輸入','若輸入金額，會計算 after util','#2563eb')}${flowCard('Suggested Max',`USD ${fmt(maxAllowed)}`,'basket 最小可用 capacity','#0f766e')}${flowCard('Symbols',syms.length,normalizeBasket(syms),'#7c3aed')}${flowCard('Gate',rows.some(r=>r.status==='OVER')?'BLOCK':rows.some(r=>r.status==='HOT')?'CAUTION':'PASS','依 M2 stock capacity','#f97316')}</div><div class="table-wrap"><table><thead><tr><th>Stock</th><th>Max</th><th>Planning Base</th><th>Release</th><th>Dynamic</th><th>After</th><th>Util</th><th>Status</th><th>Comment</th></tr></thead><tbody>${rows.map(r=>`<tr><td><b>${r.symbol}</b></td><td>USD ${fmt(r.max)}</td><td>USD ${fmt(r.base)}</td><td>USD ${fmt(r.release)}</td><td>USD ${fmt(r.dynamic)}</td><td>USD ${fmt(r.after)}</td><td>${fmt(r.util,1)}%</td><td><span class="pill ${r.cls}">${r.status}</span></td><td>${r.comment}</td></tr>`).join('')}</tbody></table></div></div>`;
}
function renderSingleResult(res,input){
  const mr=res.market_regression||res.m8_market_regression||{};
  const market=n(input.coupon,NaN);
  const m8Fair=n(res.fair_yield??res.fair_rate??res.preference_fair,NaN);
  const finalFair=n(res.final_fair_rate??mr.final_fair_rate,NaN);
  const newFair=n(mr.new_fair_rate??res.new_fair_rate,NaN);
  const beta=mr.overlay_beta??mr.convergence_strength??res.overlay_beta;
  const marketGapPct=mr.pricing_gap_vs_final_pct??mr.gap_after_pct??res.pricing_gap_vs_final_pct;
  const marketGap=Number.isFinite(finalFair)&&Number.isFinite(market)?market-finalFair:null;
  const templateClass=mr.large_template||mr.template||res.template_parent||'-';
  const usedTemplate=mr.surface_matched_key||mr.surface_template_id||mr.small_template||res.template_used||'-';
  const globalRegression=mr.global_regression_rate??mr.clean_global_fair??newFair;
  const templateCount=mr.lookup_count??mr.sample_count??res.template_count??'-';
  const confidence=mr.surface_confidence??mr.confidence??res.confidence_label??res.confidence??'-';
  const surfaceMarket=mr.history_weighted_market_rate??mr.surface_market_coupon??mr.market_coupon_avg??mr.avg_market_coupon??res.market_coupon_avg;
  const surfaceCurrent=surfaceMarket==null||!Number.isFinite(market)?null:Number(surfaceMarket)-market;
  const betaEffect=mr.improvement_pct??res.beta_effect_pct;
  const view=res.pricing_view||'-';
  const viewSub=mr.status?'雙引擎':'Preference';
  const prefComment=Number.isFinite(market)&&Number.isFinite(m8Fair)
    ? (market-m8Fair>1?`Market ${fmt(market,2)}% 高於 M8 Fair ${fmt(m8Fair,2)}%，偏好模型下有利差。`:market-m8Fair<-1?`Market ${fmt(market,2)}% 低於 M8 Fair ${fmt(m8Fair,2)}%，偏好模型下偏貴。`:`Market ${fmt(market,2)}% 接近 M8 Fair ${fmt(m8Fair,2)}%，偏好模型屬合理附近。`)
    : 'Preference Engine 已回傳，但 fair_yield 欄位不足。';
  const marketDecision=Number.isFinite(Number(marketGapPct))
    ? (Math.abs(Number(marketGapPct))<=2?'市場判定：接近 Final Market Fair，屬合理報價。':Number(marketGapPct)>2?'市場判定：報價高於 Final Market Fair，屬偏甜 / aggressive quote。':'市場判定：報價低於 Final Market Fair，屬偏保守 / 可議價。')
    : '市場判定：B2 尚未取得有效 gap。';
  const marketComment=mr.comment||'Market Regression Engine 尚未取得 surface；請確認 data/mm/m8_template_surface.json。';
  function f2(v,suffix='%'){return Number.isFinite(Number(v))?`${fmt(Number(v),2)}${suffix}`:'-'}
  function meter(label,value,max,cls=''){
    const raw=Number(value);const v=Math.max(0,Math.min(100,max?((Number.isFinite(raw)?raw:0)/max)*100:0));
    return `<div class="meter-row"><div class="meter-label">${label}</div><div class="meter"><div class="meter-fill ${cls}" style="width:${v}%;"></div></div><div class="meter-value">${Number.isFinite(raw)?fmt(raw,2):'-'}</div></div>`;
  }
  const maxPref=Math.max(n(res.pre_rate,0),n(res.fair_yield,0),1);
  return `<div class="m8-batch-mirror">
    <div class="decision-grid">
      <div class="decision-box"><div class="k">Market</div><div class="v">${f2(market)}</div><div class="sub">銀行報價｜${normalizeBasket(input.symbols)}</div></div>
      <div class="decision-box"><div class="k">M8 Fair</div><div class="v">${f2(m8Fair)}</div><div class="sub">你的偏好</div></div>
      <div class="decision-box"><div class="k">Final Fair</div><div class="v">${f2(finalFair)}</div><div class="sub">市場公平利率</div></div>
      <div class="decision-box"><div class="k">Gap</div><div class="v">${Number.isFinite(Number(marketGapPct))?f2(marketGapPct):f2(marketGap)}</div><div class="sub">${Number.isFinite(Number(marketGapPct))?'vs Final Fair %':'Market - Final Fair'}</div></div>
      <div class="decision-box"><div class="k">判定</div><div class="v" style="font-size:18px;">${view}</div><div class="sub">${viewSub}</div></div>
      <div class="decision-box"><div class="k">Calibration</div><div class="v" style="font-size:14px;"><a class="calibration-link" href="./mm/m8_calibration_dashboard_v1.html" target="_blank">Go to m8_calibration</a></div><div class="sub">模板校正</div></div>
    </div>
    <div class="decision-comment">${marketDecision}</div>
    <div class="template-line">
      <div class="mini-kpi"><div class="k">分類模板</div><div class="v">${templateClass}</div></div>
      <div class="mini-kpi"><div class="k">使用模板</div><div class="v">${usedTemplate}</div></div>
      <div class="mini-kpi"><div class="k">New Fair</div><div class="v">${f2(newFair)}</div></div>
      <div class="mini-kpi"><div class="k">全域回歸推估利率</div><div class="v">${f2(globalRegression)}</div></div>
      <div class="mini-kpi"><div class="k">β 值 / β 效果</div><div class="v">${beta==null?'-':`${fmt(Number(beta),2)} / ${betaEffect==null?'-':f2(betaEffect)}`}</div></div>
      <div class="mini-kpi"><div class="k">樣本 / 信心</div><div class="v">${templateCount} / ${confidence}</div></div>
      <div class="mini-kpi"><div class="k">Market Coupon Avg</div><div class="v">${f2(surfaceMarket)}</div></div>
      <div class="mini-kpi"><div class="k">Surface - Current</div><div class="v">${f2(surfaceCurrent)}</div></div>
    </div>
    <div class="engine-grid">
      <div class="engine-card"><div class="engine-card-header"><h3>B1. M8 Preference Engine｜你的偏好</h3><span class="pill info">Preference</span></div><div class="engine-card-body"><div class="meter-wrap">
        ${meter('Base',res.base,maxPref)}${meter('Basket Premium',res.basket_premium,maxPref)}${meter('Structure Total',res.structure_total,maxPref)}${meter('VolAdj',res.vol_adj,maxPref)}${meter('RatePressureAdj',res.rate_pressure_adj,maxPref,n(res.rate_pressure_adj)>2?'warn':'')}${meter('PreRate',res.pre_rate,maxPref)}${meter('HighRateBrake',res.high_rate_brake,maxPref,'bad')}${meter('Final M8 Fair',res.fair_yield,maxPref)}
      </div><div class="engine-comment">${prefComment}</div></div></div>
      <div class="engine-card"><div class="engine-card-header"><h3>B2. Market Regression Engine｜市場公平利率</h3><span class="pill warn">β Market</span></div><div class="engine-card-body"><div class="meter-wrap">
        ${meter('New Fair',newFair,50)}${meter('Final Fair',finalFair,50)}${meter('β',beta,1)}${meter('Template Count',templateCount==='-'?0:templateCount,30)}${meter('Confidence',typeof confidence==='number'?confidence:0,100)}
      </div><div class="engine-comment">${marketComment}</div></div></div>
    </div>
    ${renderCapacityGate(input)}
    <details class="collapsible-section"><summary>C. Explainability｜Raw Trace / Stock Sources</summary><div class="collapsible-body"><pre style="white-space:pre-wrap;font-size:11px;max-height:320px;overflow:auto;background:#0f172a;color:#e5e7eb;border-radius:12px;padding:10px">${JSON.stringify(res,null,2)}</pre></div></details>
  </div>`
}
function renderBatchTemplateList(summary=[]){return `<div class="panel"><h3>Template List｜左分類</h3>${summary.length?summary.map((t,i)=>`<button class="m2-hz-subnav-btn ${i===0?'action':''}" data-template-index="${i}" type="button"><b>${t.template}</b><br><span class="muted">${t.count} rows｜Mkt ${fmt(t.market,2)}%｜Final AVG ${fmt(t.final_fair,2)}%</span></button>`).join(''):'<div class="muted">尚無 market rows。</div>'}</div>`}
function renderBatchTemplateDetail(t){if(!t)return `<div class="panel"><h3>Template Detail</h3><div class="muted">尚無資料。</div></div>`;return `<div class="panel"><h3>Template Detail｜${t.template}</h3><div class="flow-panel">${flowCard('Rows',t.count,'market_history rows','#2563eb')}${flowCard('Template Avg Market',fmt(t.market,2)+'%','整批市場平均','#0f766e')}${flowCard('Template Avg Final Fair',fmt(t.final_fair,2)+'%','模板平均，不是單筆','#7c3aed')}${flowCard('Gap After AVG',t.gap_final_pct===null?'-':fmt(t.gap_final_pct,2)+'%','Market vs Final AVG','#f97316')}</div><div class="grid-2" style="margin-top:12px"><div class="panel"><h3>Sub-template Cards</h3>${(t.subtemplates||[]).slice(0,12).map(s=>`<div class="list-card"><b>${s.key}</b>｜${s.group_type}｜${s.count} rows<br>Avg Market ${fmt(s.market,2)}%｜New Fair AVG ${fmt(s.new_fair,2)}%｜Final Fair AVG ${fmt(s.final_fair,2)}%｜Gap ${s.gap_after_pct===null?'-':fmt(s.gap_after_pct,2)+'%'}</div>`).join('')||'<div class="muted">No subtemplate</div>'}</div><div class="panel"><h3>Included Rows</h3><div class="table-wrap"><table><thead><tr><th>FCN</th><th>Basket</th><th>Market</th><th>Final AVG</th><th>Strike/KI</th><th>Tenor</th></tr></thead><tbody>${(t.subtemplates?.[0]?.included_rows||[]).slice(0,20).map(r=>`<tr><td>${r.fcn_id}</td><td>${r.basket}</td><td>${fmt(r.market_coupon,2)}%</td><td>${fmt(r.final_fair,2)}%</td><td>${fmt(r.strike,1)} / ${fmt(r.ki,1)}</td><td>${r.tenor}</td></tr>`).join('')}</tbody></table></div></div></div></div>`}
function renderRadar(radar=[]){return `<div class="panel" style="margin-top:12px"><h3>Template Update Radar</h3>${radar.slice(0,20).map(r=>`<div class="list-card"><b>${r.key}</b>｜${r.parent_template}｜${r.coverage}<br>Count ${r.count}｜Avg Coupon ${fmt(r.market,2)}%｜Action：${r.action}<br>${r.reason}</div>`).join('')||'<div class="muted">No radar rows.</div>'}</div>`}
async function renderBatchWorkspacePanel(mode='b1'){
  const wrap=document.getElementById('marketWorkspaceContent');
  if(!wrap)return;
  wrap.innerHTML='<div class="muted">載入 M8 Batch Decision Board...</div>';
  try{
    if(!batchWorkspaceCache)batchWorkspaceCache=await runBatchMarketWorkspace();
    const workspace={
      ...(batchWorkspaceCache||{}),
      templateSummary:batchWorkspaceCache.templateSummary||buildTemplateSummary(batchWorkspaceCache.marketRows||[]),
      radar:batchWorkspaceCache.radar||buildUpdateRadar(batchWorkspaceCache.marketRows||[])
    };
    if(typeof window.renderM8BatchDecisionBoard==='function'){
      const renderBoard=(index=0)=>{
        const rendered=window.renderM8BatchDecisionBoard(workspace,{mode,index,embedded:true});
        wrap.innerHTML=typeof rendered==='string'?rendered:'';
        if(rendered instanceof Node)wrap.appendChild(rendered);
        const selector=mode==='b2'?'[data-bdui-radar]':'[data-bdui-template]';
        wrap.querySelectorAll(selector).forEach(btn=>btn.addEventListener('click',()=>{
          const idx=n(mode==='b2'?btn.dataset.bduiRadar:btn.dataset.bduiTemplate,0);
          renderBoard(idx);
        }));
      };
      renderBoard(0);
      return;
    }
    const summary=workspace.templateSummary||[];
    const radar=workspace.radar||[];
    wrap.innerHTML=`<div class="decision-note bad"><b>B1/B2 helper 未載入</b><br>找不到 window.renderM8BatchDecisionBoard，暫時回退舊版 Template List / Radar。</div><div class="market-ab-layout"><aside>${renderBatchTemplateList(summary)}</aside><main id="templateDetailBox">${renderBatchTemplateDetail(summary[0])}${renderRadar(radar)}</main></div>`;
  }catch(err){
    console.error(err);
    wrap.innerHTML=`<div class="decision-note bad"><b>Batch Workspace 載入失敗</b><br>${err.message}</div>`;
  }
}
async function runSingleCheck(){
  const box=document.getElementById('singleResult');
  if(!box)return;

  const input=getSingleInput();
  box.innerHTML='<div class="muted">計算中...</div>';

  try{
    const res=await runSingleMarketFcnCheck(input);
   box.innerHTML=window.renderM8SingleMirrorResult
  ? window.renderM8SingleMirrorResult(res,input,{stockCapacityRowsData})
  : renderSingleResult(res,input);
  }catch(err){
    console.error(err);
    box.innerHTML=`<div class="decision-note bad"><b>Single M8 計算失敗</b><br>${err.message}</div>`;
  }
}

function bindMarketSubnav(){
  ensureMarketSelectorButton();
  const nav=document.getElementById('m2MarketFcnSubnav');
  if(!nav||nav.dataset.bound==='1')return;
  nav.dataset.bound='1';
  nav.addEventListener('click',ev=>{
    const btn=ev.target.closest('[data-market-tab]');
    if(!btn)return;
    ev.preventDefault();
    setModule('market');
    setTimeout(()=>setMarketTab(btn.dataset.marketTab||'single'),80);
  });
}

function setMarketTab(tab){marketTab=tab;ensureMarketSelectorButton();document.querySelectorAll('[data-market-tab]').forEach(b=>b.classList.toggle('action',b.dataset.marketTab===tab));const box=document.getElementById('marketWorkspaceContent');if(!box)return;if(tab==='single'){box.innerHTML=renderSingleMarketPanel();document.getElementById('inqRun')?.addEventListener('click',runSingleCheck);return}if(tab==='b1'||tab==='b2'){renderBatchWorkspacePanel(tab);return}if(tab==='selector'){box.innerHTML=renderFcnSelectorWorkspace();bindFcnSelectorEvents();return}box.innerHTML=renderRecommendationPanel()}

function moneyWan(v){return `${fmt(n(v,0)/10000,0)}萬`}
function cMiniCard(title,value,sub,color='#2563eb'){return `<div class="flow-card" style="--accent:${color}"><div class="flow-label">${title}</div><div class="flow-value">${value}</div><div class="flow-sub">${sub}</div></div>`}
function buildCPlannerV066(){
  const g=getGroups();
  const ready=sum(g.ready), maturity=sum(g.maturity), candidate=sum(g.candidate), total=ready+maturity+candidate;
  const baseTotal=sum(g.base)||1;
  const categories=['短期投機單','積極單','合理投資型','長期穩定現金流'];
  const categoryTargetPct={'長期穩定現金流':40,'合理投資型':30,'積極單':20,'短期投機單':10};
  const categoryRows=categories.map(k=>{const amt=sum(g.base.filter(x=>bucket(x)===k));const tp=categoryTargetPct[k]||0;const target=baseTotal*tp/100;const gap=Math.max(0,target-amt);return{k,targetPct:tp,amt,target,gap,needRatio:target?gap/target:0}}).sort((a,b)=>b.needRatio-a.needRatio||b.gap-a.gap);
  const bankRows=Object.keys(TARGET_BANK).map(b=>{const base=sum(g.base.filter(x=>(x.tw_bank||'').includes(b)));const exit=sum(g.cash.filter(x=>(x.tw_bank||'').includes(b)));const target=TARGET_BANK[b];const gap=Math.max(0,target-base);return{bank:b,target,base,exit,gap,needRatio:target?gap/target:0}}).sort((a,b)=>b.needRatio-a.needRatio||(a.bank==='永豐'?-1:1));
  return{ready,maturity,candidate,total,categoryRows,bankRows};
}
function renderRecommendationPanel(){
  const p=buildCPlannerV066();
  const marketSteps=[
    {step:1,bank:'永豐',cat:'短期投機單',amt:30000,why:'永豐優先 + 投機 need ratio 最高 + 符合永豐市場跟單 min 3萬'},
    {step:2,bank:'永豐',cat:'積極單',amt:30000,why:'Step 1 後重新計算，積極缺口比例最高'},
    {step:3,bank:'永豐',cat:'積極單',amt:30000,why:'Step 2 後重新計算，積極仍需補足；完成積極 6萬'},
    {step:4,bank:'富邦',cat:'短期投機單',amt:10000,why:'投機剩 1萬 < 永豐 min 3萬，切換富邦 min 1萬；完成投機 4萬'},
    {step:5,bank:'待分配',cat:'待分配',amt:30000,why:'剩餘 3萬暫不硬配，等待下一批市場單或更合適 basket'}
  ];
  const stepRows=marketSteps.map(s=>`<div class="list-card"><b>Step ${s.step}｜${s.bank}｜${s.cat}｜${moneyWan(s.amt)}</b><br>${s.why}<br><span class="muted">每一步後重新計算 category / bank need ratio，不用初始比例一路分配到底。</span></div>`).join('');
  const catTable=p.categoryRows.map(r=>`<tr><td><b>${r.k}</b></td><td>${fmt(r.targetPct||0,0)}%</td><td>${moneyWan(r.amt)}</td><td>${moneyWan(r.target)}</td><td>${moneyWan(r.gap)}</td><td>${fmt(r.needRatio*100,1)}%</td></tr>`).join('');
  const bankTable=p.bankRows.map((r,i)=>`<tr><td><b>${r.bank}</b>${i===0?' <span class="pill pill-good">Priority</span>':''}</td><td>${moneyWan(r.target)}</td><td>${moneyWan(r.base)}</td><td>${moneyWan(r.exit)}</td><td>${moneyWan(r.gap)}</td><td>${fmt(r.needRatio*100,1)}%</td></tr>`).join('');
  return `<div class="panel"><h3>C. Recommendation / Allocation Planner｜v066 Result-first</h3>
    <div class="decision-note"><b>本月結論：</b>以市場跟單為主；優先補永豐，執行順序為「永豐投機 3萬 → 永豐積極 6萬 → 富邦投機 1萬 → 待分配 3萬」。每一次分配後都重新計算缺口比例。</div>
    <div class="flow-panel">
      ${cMiniCard('Available Capital',`13萬`,`來源：Ready 2萬 + Maturity 4萬 + Candidate 7萬｜動態值 ${moneyWan(p.total)}`,'#2563eb')}
      ${cMiniCard('Bank Allocation','永豐 13萬 / 富邦 0萬','銀行需求比例優先；同分時永豐優先','#0f766e')}
      ${cMiniCard('Category Need','投機 4萬 / 積極 6萬','待分配 3萬，不硬配','#7c3aed')}
      ${cMiniCard('Final Mode','市場跟單為主','自行起單：本月不建議','#f97316')}
    </div>
    <div class="grid-2" style="margin-top:12px">
      <div class="panel"><h3>Final Recommendation Queue｜市場跟單</h3>${stepRows}</div>
      <div class="panel"><h3>Market-follow vs Self-originated</h3>
        <div class="list-card"><b>市場跟單模式</b><br>永豐 min 3萬，富邦 min 1萬。適合本月投機 / 積極缺口，用小 lot 逐步補。</div>
        <div class="list-card"><b>自行起單模式</b><br>永豐 min 10萬，富邦 min 3萬。投機與積極單以跟單為主，本月不建議自行起單。</div>
        <div class="decision-note">分配規則：allocate one executable lot → recompute need ratio → next priority → 若低於銀行 min 或類型已滿足，停止或切換銀行。</div>
      </div>
    </div>
    <details class="collapsible-section" style="margin-top:12px"><summary>Raw Detail｜Category / Bank Gap Tables</summary><div class="collapsible-body">
      <div class="grid-2"><div class="panel"><h3>Category Gap after exit</h3><div class="table-wrap"><table><thead><tr><th>Category</th><th>Target</th><th>Base</th><th>Target Amt</th><th>Gap</th><th>Need Ratio</th></tr></thead><tbody>${catTable}</tbody></table></div></div>
      <div class="panel"><h3>Bank Gap after exit</h3><div class="table-wrap"><table><thead><tr><th>Bank</th><th>Target</th><th>Planning Base</th><th>Expected Exit</th><th>Gap</th><th>Need Ratio</th></tr></thead><tbody>${bankTable}</tbody></table></div></div></div>
    </div></details>
  </div>`
}


function ensureMarketSelectorButton(){
  const nav=document.getElementById('m2MarketFcnSubnav');
  if(!nav||nav.querySelector('[data-market-tab="selector"]'))return;
  const btn=document.createElement('button');
  btn.className='m2-hz-subnav-btn';
  btn.dataset.marketTab='selector';
  btn.type='button';
  btn.textContent='D. FCN遴選系統';
  nav.appendChild(btn);
}
function dWan(v){return `${fmt(n(v,0),0)}萬`}
function dSelectorSlots(){return[
  {id:'sinopac-spec',bank:'永豐',category:'短期投機單',need:4,min:3,strategy:'建議 1 張 × 3萬｜投機單以 min lot 控風險'},
  {id:'sinopac-aggr',bank:'永豐',category:'積極單',need:6,min:3,strategy:'可 1張6萬 or 2張3萬｜依候選品質選擇'},
  {id:'fubon-spec',bank:'富邦',category:'短期投機單',need:1,min:1,strategy:'可 1 張 × 1萬｜補足投機缺口尾數'}
]}
function dSelectorCandidates(){return{
  'sinopac-spec':[
    {id:'FCN982K',grade:'A',bank:'永豐',category:'短期投機單',basket:['MU','ARM','MRVL'],coupon:24,tenor:'6M',type:'AKI Daily',strike:70,ki:60,m8:20,final:21,gap:'+3%',template:'Promote',capacity:'PASS',amount:3,reason:'符合永豐投機 slot，市場甜度高，投機以 min lot 控風險。'},
    {id:'FCN975M',grade:'B',bank:'永豐',category:'短期投機單',basket:['TSLA','PLTR'],coupon:23,tenor:'6M',type:'AKI Daily',strike:72,ki:62,m8:21.5,final:22.3,gap:'+0.7%',template:'Watch',capacity:'HOT',amount:3,reason:'票息尚可，但 TSLA/PLTR 波動較高，僅可小額控量。'},
    {id:'FCN971S',grade:'C',bank:'永豐',category:'短期投機單',basket:['COIN','SOFI'],coupon:25,tenor:'4M',type:'AKI Daily',strike:75,ki:65,m8:23,final:24,gap:'+1%',template:'Watch',capacity:'CAUTION',amount:3,reason:'投機屬性過強，除非今日市場非常甜，否則列候補。'}
  ],
  'sinopac-aggr':[
    {id:'FCN990A',grade:'A',bank:'永豐',category:'積極單',basket:['NVDA','TSM','AVGO'],coupon:22,tenor:'12M',type:'AKI Daily',strike:65,ki:55,m8:19.5,final:20.2,gap:'+1.8%',template:'Stable',capacity:'PASS',amount:3,reason:'符合永豐積極 slot，AI Core 模板穩定，capacity 可承接。'},
    {id:'FCN988B',grade:'A',bank:'永豐',category:'積極單',basket:['MU','ARM','MRVL'],coupon:23.5,tenor:'9M',type:'AKI Daily',strike:68,ki:58,m8:20.8,final:21.4,gap:'+2.1%',template:'Promote',capacity:'PASS',amount:3,reason:'記憶體 / 半導體 tactical 模板市場甜度較高，可作第二張 3萬。'},
    {id:'FCN981C',grade:'B',bank:'永豐',category:'積極單',basket:['AMD','INTC','SNDK'],coupon:22.8,tenor:'9M',type:'AKI Daily',strike:70,ki:60,m8:21.2,final:21.9,gap:'+0.9%',template:'Update',capacity:'HOT',amount:3,reason:'可補積極缺口，但 basket 較熱，建議控量。'},
    {id:'FCN976D',grade:'C',bank:'永豐',category:'積極單',basket:['TSLA','NVDA'],coupon:21.5,tenor:'12M',type:'AKI Monthly',strike:70,ki:60,m8:21,final:21.3,gap:'+0.2%',template:'Watch',capacity:'HOT',amount:3,reason:'接近 fair，沒有明顯甜度；只列觀察。'}
  ],
  'fubon-spec':[
    {id:'FCN955F',grade:'B',bank:'富邦',category:'短期投機單',basket:['MU','MRVL'],coupon:23,tenor:'6M',type:'AKI Daily',strike:70,ki:60,m8:21,final:21.8,gap:'+1.2%',template:'Stable',capacity:'PASS',amount:1,reason:'符合富邦 min 1萬，可補投機剩餘缺口，但優先度低於永豐。'},
    {id:'FCN951G',grade:'C',bank:'富邦',category:'短期投機單',basket:['COIN','TSLA'],coupon:25,tenor:'4M',type:'AKI Daily',strike:75,ki:65,m8:24,final:24.5,gap:'+0.5%',template:'Watch',capacity:'CAUTION',amount:1,reason:'高波動但 edge 不夠明顯，列候補。'}
  ]}}
function dSelectorCss(){return `<style>
.dsel{display:grid;gap:14px}.dsel-banner{border:1px solid #dbeafe;background:#f8fbff;border-radius:16px;padding:14px;line-height:1.65}.dslot{border:1px solid #e5e7eb;border-radius:18px;padding:14px;background:#fff;box-shadow:0 2px 8px rgba(15,23,42,.04)}.dslot-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:10px}.dslot-title{font-size:17px;font-weight:950}.dslot-sub{font-size:13px;color:#64748b;margin-top:4px}.dslot-status{font-weight:950;color:#0f766e;background:#ecfdf5;border:1px solid #bbf7d0;border-radius:999px;padding:6px 10px;white-space:nowrap}.dcards{display:flex;gap:12px;overflow-x:auto;padding:4px 2px 8px}.dcard{flex:0 0 292px;border:1px solid #e5e7eb;border-radius:18px;background:#fff;padding:12px;box-shadow:0 2px 8px rgba(15,23,42,.05)}.dcard.selected{outline:3px solid #bbf7d0;border-color:#22c55e}.dcard-a{border-left:6px solid #16a34a}.dcard-b{border-left:6px solid #2563eb}.dcard-c{border-left:6px solid #f59e0b}.dcard-top{display:flex;justify-content:space-between;gap:8px;align-items:center}.dcard-title{font-weight:950}.dcard-amt{display:flex;align-items:center;gap:4px;font-size:12px;color:#334155}.dcard-amt input{width:52px;border:1px solid #cbd5e1;border-radius:8px;padding:5px;text-align:right;font-weight:900}.chips{display:flex;gap:5px;flex-wrap:wrap;margin:8px 0}.chip{display:inline-block;border-radius:999px;background:#f1f5f9;color:#334155;padding:3px 7px;font-size:11px;font-weight:900}.chip.good{background:#dcfce7;color:#166534}.chip.warn{background:#fef3c7;color:#92400e}.chip.bad{background:#fee2e2;color:#991b1b}.dterms,.dfair,.dwhy{font-size:13px;line-height:1.55;color:#334155;margin-top:7px}.dwhy{background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px;padding:8px}.blueprint{border:1px solid #d8dde6;border-radius:18px;background:linear-gradient(135deg,#fff,#f8fafc);padding:14px}.bp-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:10px}.bp-card{border:1px solid #e5e7eb;border-radius:14px;background:#fff;padding:10px}.bp-card label{display:block;font-size:12px;color:#64748b;font-weight:900}.bp-card b{font-size:20px}.bp-list{margin-top:10px;display:grid;gap:8px}.bp-row{border:1px solid #e5e7eb;background:#fff;border-radius:12px;padding:9px;font-size:13px}.dsel details{border:1px solid #e5e7eb;border-radius:16px;background:#fff;padding:12px}.dsel summary{font-weight:950;cursor:pointer}@media(max-width:900px){.bp-grid{grid-template-columns:1fr}.dslot-head{display:block}.dslot-status{display:inline-block;margin-top:8px}}
</style>`}
function dCandidateCard(slot,c){return `<div class="dcard dcard-${String(c.grade||'c').toLowerCase()}" data-dslot="${slot.id}" data-candidate="${c.id}">
  <div class="dcard-top"><label class="dcard-title"><input type="checkbox" class="dsel-check" data-dslot="${slot.id}" data-candidate="${c.id}"> ${c.grade}級｜${c.id}</label><div class="dcard-amt">建議 <input class="dsel-amt" data-dslot="${slot.id}" data-candidate="${c.id}" type="number" min="0" step="1" value="${c.amount}"> 萬</div></div>
  <div class="chips">${c.basket.map(s=>`<span class="chip">${s}</span>`).join('')}</div>
  <div class="dterms"><b>${c.coupon}%</b>｜${c.tenor}｜${c.type}｜${c.strike}/${c.ki}</div>
  <div class="dfair">M8 ${c.m8}%｜Final ${c.final}%｜Gap ${c.gap}</div>
  <div class="chips"><span class="chip ${c.template==='Promote'?'good':c.template==='Watch'?'warn':''}">${c.template}</span><span class="chip ${c.capacity==='PASS'?'good':c.capacity==='HOT'||c.capacity==='CAUTION'?'warn':'bad'}">Capacity ${c.capacity}</span></div>
  <div class="dwhy">${c.reason}</div>
</div>`}
function renderFcnSelectorWorkspace(){
  const slots=dSelectorSlots(), candidates=dSelectorCandidates();
  return `${dSelectorCss()}<div class="dsel"><div class="dsel-banner"><b>D. FCN遴選系統｜v067A Prototype</b><br>推薦候選區勾選 → 修改金額 → OUTPUT 今日投資藍圖。此版先確認 workflow，不寫回、不下單、不導入 M4。</div>${slots.map(slot=>`<section class="dslot"><div class="dslot-head"><div><div class="dslot-title">${slot.bank}｜${slot.category}｜需求 ${dWan(slot.need)}</div><div class="dslot-sub">min ${dWan(slot.min)}｜${slot.strategy}</div></div><div class="dslot-status" id="dstatus-${slot.id}">未勾選</div></div><div class="dcards">${(candidates[slot.id]||[]).slice(0,5).map(c=>dCandidateCard(slot,c)).join('')}</div></section>`).join('')}<div id="dselBlueprint"></div><details><summary>分析過程｜M8 / B1 / B2 / Capacity / Raw</summary><div class="muted" style="line-height:1.7;margin-top:8px">v067A 先確認 UX：slot row、橫式候選卡、勾選、可改金額、今日投資藍圖。v067B 再接真實 market rows 與 C execution slots；v067C 再導入 M4+M8 scoring。</div></details></div>`;
}
function bindFcnSelectorEvents(){
  const box=document.getElementById('marketWorkspaceContent');
  if(!box)return;
  const update=()=>{
    const slots=dSelectorSlots();
    const selected=[];
    box.querySelectorAll('.dsel-check:checked').forEach(ch=>{
      const slot=slots.find(s=>s.id===ch.dataset.dslot);
      const cand=(dSelectorCandidates()[ch.dataset.dslot]||[]).find(x=>x.id===ch.dataset.candidate);
      const amt=n(box.querySelector(`.dsel-amt[data-dslot="${ch.dataset.dslot}"][data-candidate="${ch.dataset.candidate}"]`)?.value,0);
      if(slot&&cand)selected.push({slot,cand,amt});
    });
    const total=selected.reduce((s,x)=>s+x.amt,0);
    const bankTotal=b=>selected.filter(x=>x.cand.bank===b).reduce((s,x)=>s+x.amt,0);
    const catTotal=c=>selected.filter(x=>x.cand.category===c).reduce((s,x)=>s+x.amt,0);
    const rows=selected.map(x=>`<div class="bp-row"><b>${x.cand.bank}｜${x.cand.category}｜${x.cand.id}</b>｜${x.cand.basket.join('/')}｜${dWan(x.amt)}<br><span class="muted">${x.cand.coupon}%｜${x.cand.tenor}｜${x.cand.type}｜${x.cand.strike}/${x.cand.ki}｜${x.cand.gap}</span></div>`).join('')||'<div class="bp-row muted">尚未勾選 FCN，今日投資藍圖暫為待分配。</div>';
    const unfilled=slots.map(s=>({slot:s,used:selected.filter(x=>x.slot.id===s.id).reduce((a,b)=>a+b.amt,0)})).map(x=>({slot:x.slot,remain:Math.max(0,x.slot.need-x.used)})).filter(x=>x.remain>0);
    const bp=box.querySelector('#dselBlueprint');
    if(bp)bp.innerHTML=`<div class="blueprint"><h3>OUTPUT｜今日投資藍圖</h3><div class="decision-note"><b>一句話：</b>${selected.length?'今日可依勾選候選建立市場跟單；未滿 slot 的部分先列待分配。':'目前尚未勾選候選，先保留現金等待市場單。'}</div><div class="bp-grid"><div class="bp-card"><label>總投入</label><b>${dWan(total)}</b></div><div class="bp-card"><label>永豐</label><b>${dWan(bankTotal('永豐'))}</b></div><div class="bp-card"><label>富邦</label><b>${dWan(bankTotal('富邦'))}</b></div><div class="bp-card"><label>積極 / 投機</label><b>${dWan(catTotal('積極單'))} / ${dWan(catTotal('短期投機單'))}</b></div></div><div class="bp-list">${rows}</div><div class="bp-list"><div class="bp-row"><b>待分配 / 未完成 slot</b><br>${unfilled.map(x=>`${x.slot.bank} ${x.slot.category} 剩餘 ${dWan(x.remain)}`).join('｜')||'全部完成'}</div></div></div>`;
    box.querySelectorAll('.dcard').forEach(card=>{
      const checked=box.querySelector(`.dsel-check[data-dslot="${card.dataset.dslot}"][data-candidate="${card.dataset.candidate}"]`)?.checked;
      card.classList.toggle('selected',!!checked);
    });
    slots.forEach(slot=>{
      const used=selected.filter(x=>x.slot.id===slot.id).reduce((s,x)=>s+x.amt,0);
      const el=box.querySelector(`#dstatus-${slot.id}`);
      if(el)el.textContent=used>0?`已選 ${dWan(used)}｜剩餘 ${dWan(Math.max(0,slot.need-used))}`:'未勾選';
    });
  };
  box.querySelectorAll('.dsel-check,.dsel-amt').forEach(el=>{el.addEventListener('input',update);el.addEventListener('change',update)});
  update();
}

function renderSingleMarketPanel(){
  return `<div class="panel">
    <h3>A. Single FCN Check｜單筆輸入 / 單筆輸出</h3>
    <div class="decision-note">這區搬 m8_batch 單筆即時計算邏輯。這裡的 Final Fair 是 Single FCN Final Fair，不是模板平均。</div>
    <div class="table-tools">
      <input id="inqBasket" placeholder="Basket: ORCL,TSLA,TSM">
      <input id="inqCoupon" type="number" step="0.01" placeholder="Market Coupon %">
      <input id="inqTenor" type="number" step="1" placeholder="Tenor 月">
      <input id="inqStrike" type="number" step="0.01" placeholder="Strike %">
      <input id="inqKI" type="number" step="0.01" placeholder="KI %">
      <input id="inqAmount" type="number" step="1000" placeholder="Amount USD">
      <select id="inqType"><option>AKI</option><option>EKI</option><option>NA</option><option>DACN</option></select>
      <select id="inqMemory"><option>daily</option><option>monthly</option></select>
      <select id="inqBank"><option>富邦</option><option>永豐</option></select>
      <button id="inqRun" type="button">Run Single M8</button>
    </div>
    <div id="singleResult" class="muted">輸入市場單後按 Run Single M8。</div>
  </div>`;
}
function renderMarket(){ensureMarketSelectorButton();rightDetail.innerHTML=`<div class="flow-panel">${flowCard('A. Single','單筆 M8','市場單即時計算','#2563eb')}${flowCard('B1. Template List','六大模板','市場結構理解','#0f766e')}${flowCard('B2. Radar','Action','Surface 更新 / 校正','#7c3aed')}${flowCard('C. Planner','Recommendation','配置建議','#f97316')}${flowCard('D. Selector','FCN遴選','候選勾選 / 今日投資藍圖','#dc2626')}</div>`;rightInsight.innerHTML=`<div class="decision-note">4. Market FCN Analysis 採左側主選單 subnav：A / B1 / B2 / C / D。D 是 FCN 遴選工作區：推薦候選 → 勾選 → 改金額 → 今日投資藍圖。</div>`;bottomQuery.innerHTML=`<main id="marketWorkspaceContent"></main>`;bindMarketSubnav();setMarketTab(marketTab||'single')}
function renderManagement(){rightDetail.innerHTML=`<div class="flow-panel">${flowCard('FCN Rows',plannerRows.length,'完整 FCN 查詢母體','#2563eb')}${flowCard('Stock Rows',stockCapacityRowsData.length,'股票風險 + 容量','#0f766e')}${flowCard('Danger Stocks',stockCapacityRowsData.filter(x=>x.light==='RED').length,'需優先看','#dc2626')}${flowCard('Watch Stocks',stockCapacityRowsData.filter(x=>x.light==='YELLOW').length,'接近滿載或 watch','#f97316')}</div>`;rightInsight.innerHTML=`<div class="decision-note">第5區合併 m2_planner E 與 m2 的股票風險分析。這裡是查詢與風險管理，不是手動新增修改。</div>`;bottomQuery.innerHTML=`<div class="table-tools"><input id="fcnSearch" placeholder="搜尋 FCN / Stock / Bank"><select id="fcnTagFilter"><option value="all">Planner Tag: All</option><option>Planning Base</option><option>30D Maturity</option><option>Early Exit Ready</option><option>Early Exit Candidate</option></select><select id="stockLightFilter"><option value="all">Stock Light: All</option><option>GREEN</option><option>YELLOW</option><option>RED</option></select></div><div id="managementTables"></div>`;renderManagementTables()}
function renderManagementTables(){const q=(document.getElementById('fcnSearch')?.value||'').toUpperCase(),tag=document.getElementById('fcnTagFilter')?.value||'all',light=document.getElementById('stockLightFilter')?.value||'all';const stocks=stockCapacityRowsData.filter(x=>(light==='all'||x.light===light)&&(x.symbol.includes(q)||x.category.toUpperCase().includes(q)));const fcns=plannerRows.filter(x=>(tag==='all'||x.planner_tag===tag)&&(`${x.fcn_id} ${x.tw_bank} ${(x.basket||[]).join(' ')}`.toUpperCase().includes(q)));managementTables.innerHTML=`<div class="table-wrap"><table><thead><tr><th>Stock</th><th>Category</th><th>Max</th><th>Active</th><th>Exit Release</th><th>Planning Base</th><th>Static Rem.</th><th>Dynamic</th><th>Light</th><th>Comment</th></tr></thead><tbody>${stocks.map(x=>`<tr class="${x.light==='RED'?'row-bad':x.light==='YELLOW'?'row-warn':'row-good'}"><td><b>${x.symbol}</b></td><td>${x.category}</td><td>USD ${fmt(x.max)}</td><td>USD ${fmt(x.active)}</td><td>USD ${fmt(x.release)}</td><td>USD ${fmt(x.base)}</td><td>USD ${fmt(x.staticRemain)}</td><td>USD ${fmt(x.dynamic)}</td><td><span class="pill ${x.light==='GREEN'?'pill-good':x.light==='YELLOW'?'pill-warn':'pill-bad'}">${x.light}</span></td><td>${x.comment}</td></tr>`).join('')}</tbody></table></div><div style="height:12px"></div>${renderFCNTable(fcns)}`}
function renderFCNTable(rows=plannerRows){return `<div class="table-wrap"><table><thead><tr><th>FCN ID</th><th>Bank</th><th>Amount</th><th>Rate</th><th>Tenor</th><th>Basket</th><th>Worst-of</th><th>Health</th><th>Planner Tag</th><th>Days to Maturity</th></tr></thead><tbody>${rows.map(x=>`<tr class="${x.fcn_health==='danger'?'row-bad':x.fcn_health==='watch'?'row-warn':'row-good'}"><td><b>${x.fcn_id}</b></td><td>${x.tw_bank||''}</td><td>USD ${fmt(x.amt)}</td><td>${fmt(x.rate,2)}%</td><td>${x.tenor||''}M</td><td>${(x.basket||[]).join(' / ')}</td><td>${x.worst_of||''}</td><td>${x.maturity_state||x.decision_label||''}</td><td>${x.planner_tag}</td><td>${x.maturity?.days_to_maturity??'-'}</td></tr>`).join('')}</tbody></table></div>`}
function renderPool(){rightDetail.innerHTML=`<div class="note">第6區來源是舊 m2 / 6. FCN Pool 管理。此區未來放手動建新單、編輯、複製、Soft Delete、匯出。</div>`;rightInsight.innerHTML=`<div class="decision-note">這是後台作業區，不應混在 Summary 或 Planner。新版會先把手動鍵新單流程整理乾淨，再考慮寫回。</div>`;bottomQuery.innerHTML=`<div class="grid-3"><div class="panel"><h3>手動建新單</h3><div class="table-tools"><input placeholder="fcn_id"><input placeholder="basket"><input placeholder="amount"><input placeholder="coupon"><select><option>active</option><option>draft</option></select></div><div class="muted">待搬 m2 6.2 表單。</div></div><div class="panel"><h3>FCN 清單</h3><div class="muted">待搬 m2 6.1 清單 / 搜尋 / filter</div></div><div class="panel"><h3>匯出 / Soft Delete</h3><button class="light">匯出 JSON</button> <button class="light">Soft Delete</button><div class="muted" style="margin-top:8px">保留舊 M2 作業邏輯，暫不寫回。</div></div></div>`}
function runHoldingZonesAction(action,key){
  setModule('zones');
  setTimeout(()=>{
    if(action==='nav'){
      const el=document.getElementById(`hz-zone-${key}`)||(key==='healthy'?document.querySelector('.hz-healthy-wrap'):null);
      if(key==='healthy')document.querySelector('.hz-healthy-wrap')?.setAttribute('open','open');
      (el||document.getElementById('bottomQuery'))?.scrollIntoView({behavior:'smooth',block:'start'});
      return;
    }
    if(action==='expand-all')document.querySelectorAll('.hz-card').forEach(c=>c.classList.add('open'));
    if(action==='collapse-all')document.querySelectorAll('.hz-card').forEach(c=>c.classList.remove('open'));
    if(action==='risk-only')document.querySelectorAll('.hz-card').forEach(c=>{
      c.classList.toggle('open',c.classList.contains('hz-card-danger')||c.classList.contains('hz-card-watch')||c.classList.contains('hz-card-exit'));
    });
    document.getElementById('bottomQuery')?.scrollIntoView({behavior:'smooth',block:'start'});
  },240);
}
window.runM2HoldingZonesAction=runHoldingZonesAction;

function bindMenu(){document.querySelectorAll('.menu-btn').forEach(btn=>btn.addEventListener('click',()=>setModule(btn.dataset.module)))}
function bindFilters(){['fcnSearch','fcnTagFilter','stockLightFilter'].forEach(id=>{const el=document.getElementById(id);if(el)el.oninput=renderManagementTables;if(el)el.onchange=renderManagementTables})}
async function loadData(){try{runtimeMeta.textContent='載入資料中...';const [poolRes,marketRes,pool30Res,marketFuturesRes,m8SurfaceRes]=await Promise.all([fetch('../../data/fcn_pool.json'),fetch('../../data/market_runtime.json'),fetch('../../data/pool30.json'),fetch('../../data/mm/market_fcn_history.json').catch(()=>null),fetch('../../data/mm/m8_template_surface.json').catch(()=>null)]);const fcnPool=await poolRes.json(),marketRuntime=await marketRes.json(),pool30=await pool30Res.json();marketHistory=marketFuturesRes&&marketFuturesRes.ok?await marketFuturesRes.json():[];m8Surface=m8SurfaceRes&&m8SurfaceRes.ok?await m8SurfaceRes.json():null;poolMap={};pool30.forEach(p=>poolMap[p.symbol]=p);runtime=runM2HealthEngine({fcnPool,marketRuntime:marketRuntime.rows||marketRuntime,pool30});buildPlannerRows(runtime.fcns);buildStockCapacityRows();renderTopDashboard();renderCurrentModule();runtimeMeta.innerHTML=`最後更新：${marketRuntime.generated_at||'unknown'}｜Active FCN ${runtime.total} 檔｜Stock Exposure ${runtime.stockMap.length} 檔`;}catch(err){console.error(err);runtimeMeta.innerHTML=`<span class="bad">載入失敗：${err.message}</span>`}}
runBtn.addEventListener('click',loadData);reloadBtn.addEventListener('click',loadData);bindMenu();bindMaturitySubnav();bindMarketSubnav();loadData();

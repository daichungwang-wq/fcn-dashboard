// ============================================================
// 0. 模組說明：MM/M2 新作戰中心
// ============================================================
// 第一階段：
// - read-only shell
// - M2 Health summary
// - Planner Preview
// - 不修改 m2.html / m2_planner.html
// ============================================================

// ============================================================
// 1. 外部核心引擎匯入區
// ============================================================
import { runM2HealthEngine } from '../../core/m2_health_engine_v1.js';

// ============================================================
// 2. 全域參數與狀態區
// ============================================================
const TARGET_BANK = { 富邦: 900000, 永豐: 500000 };
const STOCK_CAP = {
  core: 500000,
  growth: 300000,
  defensive: 300000,
  income: 200000,
  speculative: 30000
};

const CAP_EXCEPTION = {
  NVDA:700000,
  TSM:700000,
  SMH:700000,
  GOOG:700000
};

const BUCKET_COLOR = {
  '長期穩定現金流':'#2563eb',
  '合理投資型':'#0f766e',
  '積極單':'#f97316',
  '短期投機單':'#7c3aed',
  '其他':'#94a3b8'
};

let runtime = null;
let plannerRows = [];
let poolMap = {};

// ============================================================
// 3. 共用工具：數字 / 日期 / 格式化
// ============================================================
const n=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const fmt=(v,d=0)=>n(v).toLocaleString('en-US',{maximumFractionDigits:d});
const pct=(v,b,d=1)=>b?fmt(v/b*100,d):'0';

function toDate(v){
  const d=new Date(v);
  return isNaN(d)?null:d;
}

function days(a,b){
  const da=toDate(a),db=toDate(b);
  if(!da||!db)return null;
  return Math.floor((db-da)/86400000);
}

function entry(f){
  return f.entry_time||f.created_time||f.date||'';
}

function mat(f){
  return f.maturity_time||f.exit_time||'';
}

function flowCard(k,v,d,a){
  return `<div class="flow-card" style="--accent:${a}">
    <div class="flow-label">${k}</div>
    <div class="flow-value">${v}</div>
    <div class="flow-sub">${d}</div>
  </div>`;
}

function metricBlock(t,m,s,a){
  return `<div class="mini-metric" style="--accent:${a}">
    <div class="metric-title">${t}</div>
    <div class="metric-main">${m}</div>
    <div class="metric-sub">${s}</div>
  </div>`;
}

function bucket(x){
  const r=n(x.rate),t=n(x.tenor);
  if(t<=6&&r>20.99)return'短期投機單';
  if(r>=21&&r<=25)return'積極單';
  if(r>=18&&r<=20.99)return'合理投資型';
  if(r>=12&&r<=17.99)return'長期穩定現金流';
  return'其他';
}

function sum(list){
  return list.reduce((s,x)=>s+n(x.amt),0);
}

function conic(parts,total){
  let cur=0;
  return parts.map(p=>{
    const deg=total?p.amt/total*360:0;
    const s=`${BUCKET_COLOR[p.k]||'#ddd'} ${cur}deg ${cur+deg}deg`;
    cur+=deg;
    return s;
  }).join(',');
}

// ============================================================
// 4. M2 Health 模組：現在持倉健康狀態
// ============================================================
function renderHealthSummary(){
  const r = runtime;

  healthSummaryGrid.innerHTML = [
    flowCard('Active FCN', `${r.total} 檔`, `USD ${fmt(r.total_amt)}`, '#2563eb'),
    flowCard('Maturity Zone', `${r.maturity_zone.length} 檔`, `提早出場 / 到期前10天`, '#0f766e'),
    flowCard('Danger + Watch', `${r.danger.length+r.watch.length} 檔`, `Danger ${r.danger.length}｜Watch ${r.watch.length}`, '#f97316'),
    flowCard('Healthy', `${r.healthy.length} 檔`, '健康持倉母體', '#7c3aed')
  ].join('');

  healthDecisionNote.innerHTML = `目前 Active FCN 共 <b>${r.total}</b> 檔、USD <b>${fmt(r.total_amt)}</b>。到期專區 <b>${r.maturity_zone.length}</b> 檔，Danger/Watch 共 <b>${r.danger.length+r.watch.length}</b> 檔。MM/M2 cockpit 第一階段只做 read-only summary，下一步再接 allocation / manager / inquiry。`;

  maturityList.innerHTML = r.maturity_zone.slice(0,8).map(f=>`
    <div class="list-card">
      <b>${f.fcn_id}</b><br>
      ${f.maturity?.maturity_label || f.early_exit_label || 'Maturity'}<br>
      ${f.tw_bank}｜USD ${fmt(f.amt)}
    </div>
  `).join('') || '<div class="muted">目前無資料</div>';

  riskList.innerHTML = [...r.danger,...r.watch].slice(0,8).map(f=>`
    <div class="list-card">
      <b>${f.fcn_id}</b><br>
      Worst-of: ${f.worst_of}<br>
      ${f.decision_label}
    </div>
  `).join('') || '<div class="muted">目前無資料</div>';

  stockExposureList.innerHTML = r.stockMap.slice(0,10).map(s=>`
    <div class="list-card">
      <b>${s.symbol}</b>｜USD ${fmt(s.amt)}<br>
      FCN ${s.count}｜Danger ${s.danger}｜Watch ${s.watch}
    </div>
  `).join('');
}

// ============================================================
// 5. Planner 模組：未來一個月資金重建
// ============================================================
function buildPlannerRows(fcns){
  plannerRows = fcns.map(f=>{
    const daysToMat = f.maturity?.days_to_maturity ?? 9999;

    let tag='Planning Base';
    if(f.early_exit_ready) tag='Early Exit Ready';
    else if(daysToMat<=30) tag='30D Maturity';
    else if(f.early_exit_eligible && f.early_exit_remark_count>0) tag='Early Exit Candidate';

    return {
      ...f,
      planner_tag: tag,
      excluded: tag !== 'Planning Base'
    };
  });
}

function renderPlannerSummary(){
  const active=plannerRows;
  const base=plannerRows.filter(x=>x.planner_tag==='Planning Base');
  const hard=plannerRows.filter(x=>x.planner_tag==='Early Exit Ready'||x.planner_tag==='30D Maturity');
  const soft=plannerRows.filter(x=>x.planner_tag==='Early Exit Candidate');
  const cash=[...hard,...soft];

  plannerSummaryGrid.innerHTML = [
    flowCard('Active FCN Total',`${active.length} / USD ${fmt(sum(active))}`,'目前正式持倉','#2563eb'),
    flowCard('Cash-in 30D',`${cash.length} / USD ${fmt(sum(cash))}`,`Hard ${hard.length}｜Soft ${soft.length}`,'#f97316'),
    flowCard('Planning Base',`${base.length} / USD ${fmt(sum(base))}`,'扣除出場後真正母體','#0f766e'),
    flowCard('Planner Mode','Read-only Preview','第一階段不做修改','#7c3aed')
  ].join('');

  plannerNote.innerHTML = `目前 Active FCN 為 <b>${active.length}</b> 檔、USD <b>${fmt(sum(active))}</b>。未來一個月預估出場 / 可能出場 <b>${cash.length}</b> 檔、USD <b>${fmt(sum(cash))}</b>；扣除後 Planning Base 為 <b>${base.length}</b> 檔、USD <b>${fmt(sum(base))}</b>。`;
}

// ============================================================
// 6. Broker Capacity 模組：富邦 / 永豐未來可用額度
// ============================================================
function renderBroker(){
  const cash=plannerRows.filter(x=>x.excluded);

  brokerGrid.innerHTML=Object.keys(TARGET_BANK).map(b=>{
    const target=TARGET_BANK[b];
    const cur=plannerRows.filter(x=>(x.tw_bank||'').includes(b));
    const base=plannerRows.filter(x=>x.planner_tag==='Planning Base'&&(x.tw_bank||'').includes(b));
    const exit=cash.filter(x=>(x.tw_bank||'').includes(b));

    const activeAmt=sum(cur);
    const baseAmt=sum(base);
    const exitAmt=sum(exit);
    const future=Math.max(0,target-baseAmt);

    return `<div class="broker-card">
      <div class="broker-head">
        <div>
          <b>${b}</b>
          <div class="muted">Future Available</div>
        </div>
        <div class="broker-avail">USD ${fmt(future)}</div>
      </div>

      <div class="broker-metrics">
        ${metricBlock('出場',`${exit.length} / USD ${fmt(exitAmt)}`,`${pct(exitAmt,activeAmt)}% of Active`,'#f97316')}
        ${metricBlock('剩餘母體',`${base.length} / USD ${fmt(baseAmt)}`,`${pct(baseAmt,activeAmt)}% of Active`,'#0f766e')}
        ${metricBlock('原母體',`${cur.length} / USD ${fmt(activeAmt)}`,`${pct(activeAmt,target)}% of Target`,'#2563eb')}
        ${metricBlock('Future Available',`USD ${fmt(future)}`,`${pct(future,target)}% open`,'#7c3aed')}
      </div>
    </div>`;
  }).join('');

  brokerPlanBox.innerHTML = 'Broker Capacity 重點：不是看現在 active exposure，而是看一個月後剩下多少，以及每家銀行還能補多少。';
}

// ============================================================
// 7. Allocation 模組：配置類別與漂移
// ============================================================
function renderAlloc(){
  const base=plannerRows.filter(x=>x.planner_tag==='Planning Base');
  const exit=plannerRows.filter(x=>x.excluded);

  const total=sum(base)||1;
  const exitTotal=sum(exit)||0;

  const targets={
    '長期穩定現金流':40,
    '合理投資型':30,
    '積極單':20,
    '短期投機單':10,
    '其他':0
  };

  const parts=Object.keys(targets).map(k=>({
    k,
    amt:sum(base.filter(x=>bucket(x)===k)),
    exitAmt:sum(exit.filter(x=>bucket(x)===k))
  }));

  allocGrid.innerHTML = `
    <div class="alloc-layout">
      <div class="panel">
        <b>Planning Base 結構</b>
        <div class="muted">剩餘 USD ${fmt(total)}｜出場 USD ${fmt(exitTotal)}</div>
        <div class="pie" style="background:conic-gradient(${conic(parts,total)})"></div>

        ${parts.map(p=>`
          <div class="legend-row">
            <span><i class="legend-dot" style="background:${BUCKET_COLOR[p.k]}"></i>${p.k}</span>
            <b>${fmt(p.amt/total*100,1)}%</b>
          </div>
        `).join('')}
      </div>

      <div class="panel">
        <b>Real vs Target</b>

        ${parts.map(p=>{
          const bp=p.amt/total*100;
          const gap=bp-targets[p.k];

          return `
            <div class="alloc-row">
              <div>
                <b>${p.k}</b>
                <div class="muted">USD ${fmt(p.amt)} / ${fmt(bp,1)}%</div>
                <div class="bar"><span style="--bar:${BUCKET_COLOR[p.k]};width:${Math.min(100,bp)}%"></span></div>
              </div>
              <div>
                <b>Target ${targets[p.k]}%</b>
                <div class="muted">Gap ${fmt(gap,1)}%</div>
              </div>
            </div>`;
        }).join('')}
      </div>

      <div class="panel">
        <div class="interpret-box">
          <div class="interpret-title">1. 判讀現況</div>
          積極單可能因市場上漲而提早出場，因此剩餘母體自然偏保守。
        </div>

        <div class="interpret-box">
          <div class="interpret-title">2. 下一階段</div>
          下一版會接 M8 / Market Coupon / FCN 詢價分析。
        </div>

        <div class="interpret-box">
          <div class="interpret-title">3. 目前模式</div>
          現階段只做 read-only cockpit，不提供寫回與 manager 功能。
        </div>
      </div>
    </div>`;

  allocNote.innerHTML = 'Allocation Preview 重點：不是單純補 target gap，而是看 Active 原母體如何變成 Planning Base。';
}

// ============================================================
// 8. Stock Capacity 模組：單股額度與燈號
// ============================================================
// Phase 1：暫不獨立 render，保留接口

// ============================================================
// 9. FCN Inquiry / Manager 模組
// ============================================================
// Phase 1：read-only table only
function renderTable(){
  tableMeta.innerHTML = `Active ${plannerRows.length} 檔｜Read-only mode`;

  fcnRows.innerHTML = plannerRows.map(x=>`
    <tr class="${x.fcn_health==='danger'?'row-bad':x.fcn_health==='watch'?'row-warn':'row-good'}">
      <td><b>${x.fcn_id}</b></td>
      <td>${x.tw_bank||''}</td>
      <td>USD ${fmt(x.amt)}</td>
      <td>${fmt(x.rate,2)}%</td>
      <td>${x.tenor||''}M</td>
      <td>${(x.basket||[]).join(' / ')}</td>
      <td>${x.worst_of||''}</td>
      <td>${x.decision_label||''}</td>
      <td>${x.planner_tag}</td>
      <td>${x.maturity?.days_to_maturity ?? '-'}</td>
    </tr>
  `).join('');
}

// ============================================================
// 10. Render 模組
// ============================================================
function bindSections(){
  document.querySelectorAll('.section-toggle').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const card=btn.closest('.card');
      card.classList.toggle('open');
      btn.textContent=card.classList.contains('open')?'收合':'展開';
    });
  });

  expandAllBtn.addEventListener('click',()=>{
    document.querySelectorAll('.section').forEach(c=>{
      c.classList.add('open');
      const btn=c.querySelector('.section-toggle');
      if(btn)btn.textContent='收合';
    });
  });

  collapseAllBtn.addEventListener('click',()=>{
    document.querySelectorAll('.section').forEach(c=>{
      c.classList.remove('open');
      const btn=c.querySelector('.section-toggle');
      if(btn)btn.textContent='展開';
    });
  });
}

// ============================================================
// 11. 初始化與事件綁定
// ============================================================
async function loadData(){
  runtimeMeta.textContent='載入資料中...';

  const [poolRes,marketRes,pool30Res] = await Promise.all([
    fetch('../../data/fcn_pool.json'),
    fetch('../../data/market_runtime.json'),
    fetch('../../data/pool30.json')
  ]);

  const fcnPool = await poolRes.json();
  const marketRuntime = await marketRes.json();
  const pool30 = await pool30Res.json();

  poolMap = {};
  pool30.forEach(p=>poolMap[p.symbol]=p);

  runtime = runM2HealthEngine({
    fcnPool,
    marketRuntime: marketRuntime.rows || marketRuntime,
    pool30
  });

  buildPlannerRows(runtime.fcns);

  renderHealthSummary();
  renderPlannerSummary();
  renderBroker();
  renderAlloc();
  renderTable();

  runtimeMeta.innerHTML = `最後更新：${marketRuntime.generated_at || 'unknown'}｜Active FCN ${runtime.total} 檔｜Stock Exposure ${runtime.stockMap.length} 檔`;
}

runBtn.addEventListener('click',loadData);
reloadBtn.addEventListener('click',loadData);

bindSections();
loadData();

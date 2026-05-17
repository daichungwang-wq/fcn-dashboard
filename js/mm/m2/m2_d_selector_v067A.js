(function(){
  const D_TAB='d_selector';
  const qs=(s,root=document)=>root.querySelector(s);
  const qsa=(s,root=document)=>Array.from(root.querySelectorAll(s));
  const fmt=v=>Number.isFinite(Number(v))?Number(v).toLocaleString('zh-TW',{maximumFractionDigits:0}):'-';
  const wan=v=>`${fmt(v)}萬`;

  const slots=[
    {id:'sinopac-spec',bank:'永豐',category:'短期投機單',need:4,min:3,strategy:'建議 1 張 × 3萬｜投機單以 min lot 控風險',status:'未勾選'},
    {id:'sinopac-aggr',bank:'永豐',category:'積極單',need:6,min:3,strategy:'可 1張6萬 or 2張3萬｜依候選品質選擇',status:'未勾選'},
    {id:'fubon-spec',bank:'富邦',category:'短期投機單',need:1,min:1,strategy:'可 1 張 × 1萬｜只在市場甜度足夠時補',status:'未勾選'}
  ];

  const candidates={
    'sinopac-spec':[
      {id:'FCN982K',grade:'A',bank:'永豐',category:'短期投機單',basket:['MU','ARM','MRVL'],coupon:24,tenor:'6M',type:'AKI Daily',strike:70,ki:60,m8:20,final:21,gap:'+3%',template:'Promote',capacity:'PASS',amount:3,reason:'符合永豐投機 slot，市場甜度高，投機以 min lot 控風險。'},
      {id:'FCN975M',grade:'B',bank:'永豐',category:'短期投機單',basket:['TSLA','PLTR'],coupon:23,tenor:'6M',type:'AKI Daily',strike:72,ki:62,m8:21.5,final:22.3,gap:'+0.7%',template:'Watch',capacity:'HOT',amount:3,reason:'票息尚可，但 TSLA/PLTR 波動較高，僅可小額控量。'},
      {id:'FCN971S',grade:'C',bank:'永豐',category:'短期投機單',basket:['COIN','SOFI'],coupon:25,tenor:'4M',type:'AKI Daily',strike:75,ki:65,m8:23,final:24,gap:'+1%',template:'Watch',capacity:'CAUTION',amount:3,reason:'投機屬性過強，除非今日市場非常甜，否則列候補。'}
    ],
    'sinopac-aggr':[
      {id:'FCN990A',grade:'A',bank:'永豐',category:'積極單',basket:['NVDA','TSM','AVGO'],coupon:22,tenor:'12M',type:'AKI Daily',strike:65,ki:55,m8:19.5,final:20.2,gap:'+1.8%',template:'Stable',capacity:'PASS',amount:3,reason:'符合永豐積極 slot，AI Core 模板穩定，capacity 可承接。'},
      {id:'FCN988B',grade:'A',bank:'永豐',category:'積極單',basket:['MU','ARM','MRVL'],coupon:23.5,tenor:'9M',type:'AKI Daily',strike:68,ki:58,m8:20.8,final:21.4,gap:'+2.1%',template:'Promote',capacity:'PASS',amount:3,reason:'記憶體/半導體 tactical 模板市場甜度較高，可作第二張 3萬。'},
      {id:'FCN981C',grade:'B',bank:'永豐',category:'積極單',basket:['AMD','INTC','SNDK'],coupon:22.8,tenor:'9M',type:'AKI Daily',strike:70,ki:60,m8:21.2,final:21.9,gap:'+0.9%',template:'Update',capacity:'HOT',amount:3,reason:'可補積極缺口，但 basket 較熱，建議控量。'},
      {id:'FCN976D',grade:'C',bank:'永豐',category:'積極單',basket:['TSLA','NVDA'],coupon:21.5,tenor:'12M',type:'AKI Monthly',strike:70,ki:60,m8:21,final:21.3,gap:'+0.2%',template:'Watch',capacity:'HOT',amount:3,reason:'接近 fair，沒有明顯甜度；只列觀察。'}
    ],
    'fubon-spec':[
      {id:'FCN955F',grade:'B',bank:'富邦',category:'短期投機單',basket:['MU','MRVL'],coupon:23,tenor:'6M',type:'AKI Daily',strike:70,ki:60,m8:21,final:21.8,gap:'+1.2%',template:'Stable',capacity:'PASS',amount:1,reason:'符合富邦 min 1萬，可補投機剩餘缺口，但優先度低於永豐。'},
      {id:'FCN951G',grade:'C',bank:'富邦',category:'短期投機單',basket:['COIN','TSLA'],coupon:25,tenor:'4M',type:'AKI Daily',strike:75,ki:65,m8:24,final:24.5,gap:'+0.5%',template:'Watch',capacity:'CAUTION',amount:1,reason:'高波動但 edge 不夠明顯，列候補。'}
    ]
  };

  function injectButton(){
    const nav=qs('#m2MarketFcnSubnav');
    if(!nav||qs('[data-market-tab="'+D_TAB+'"]',nav))return;
    const btn=document.createElement('button');
    btn.className='m2-hz-subnav-btn';
    btn.type='button';
    btn.dataset.marketTab=D_TAB;
    btn.textContent='D. FCN遴選系統';
    nav.appendChild(btn);
  }

  function css(){return `<style>
    .dsel{display:grid;gap:14px}.dsel-banner{border:1px solid #dbeafe;background:#f8fbff;border-radius:16px;padding:14px;line-height:1.65}.dsel-banner b{font-size:18px}.dslot{border:1px solid #e5e7eb;border-radius:18px;padding:14px;background:#fff;box-shadow:0 2px 8px rgba(15,23,42,.04)}.dslot-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:10px}.dslot-title{font-size:17px;font-weight:950}.dslot-sub{font-size:13px;color:#64748b;margin-top:4px}.dslot-status{font-weight:950;color:#0f766e;background:#ecfdf5;border:1px solid #bbf7d0;border-radius:999px;padding:6px 10px;white-space:nowrap}.dcards{display:flex;gap:12px;overflow-x:auto;padding:4px 2px 8px}.dcard{flex:0 0 292px;border:1px solid #e5e7eb;border-radius:18px;background:#fff;padding:12px;box-shadow:0 2px 8px rgba(15,23,42,.05)}.dcard.selected{outline:3px solid #bbf7d0;border-color:#22c55e}.dcard-a{border-left:6px solid #16a34a}.dcard-b{border-left:6px solid #2563eb}.dcard-c{border-left:6px solid #f59e0b}.dcard-top{display:flex;justify-content:space-between;gap:8px;align-items:center}.dcard-title{font-weight:950}.dcard-amt{display:flex;align-items:center;gap:4px;font-size:12px;color:#334155}.dcard-amt input{width:52px;border:1px solid #cbd5e1;border-radius:8px;padding:5px;text-align:right;font-weight:900}.chips{display:flex;gap:5px;flex-wrap:wrap;margin:8px 0}.chip{display:inline-block;border-radius:999px;background:#f1f5f9;color:#334155;padding:3px 7px;font-size:11px;font-weight:900}.chip.good{background:#dcfce7;color:#166534}.chip.warn{background:#fef3c7;color:#92400e}.chip.bad{background:#fee2e2;color:#991b1b}.dterms,.dfair,.dwhy{font-size:13px;line-height:1.55;color:#334155;margin-top:7px}.dwhy{background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px;padding:8px}.blueprint{border:1px solid #d8dde6;border-radius:18px;background:linear-gradient(135deg,#fff,#f8fafc);padding:14px}.bp-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:10px}.bp-card{border:1px solid #e5e7eb;border-radius:14px;background:#fff;padding:10px}.bp-card label{display:block;font-size:12px;color:#64748b;font-weight:900}.bp-card b{font-size:20px}.bp-list{margin-top:10px;display:grid;gap:8px}.bp-row{border:1px solid #e5e7eb;background:#fff;border-radius:12px;padding:9px;font-size:13px}.dsel details{border:1px solid #e5e7eb;border-radius:16px;background:#fff;padding:12px}.dsel summary{font-weight:950;cursor:pointer}@media(max-width:900px){.bp-grid{grid-template-columns:1fr}.dslot-head{display:block}.dslot-status{display:inline-block;margin-top:8px}}
  </style>`}

  function cardHtml(slot,c,i){
    const cls='dcard-'+String(c.grade||'c').toLowerCase();
    return `<div class="dcard ${cls}" data-dslot="${slot.id}" data-candidate="${c.id}">
      <div class="dcard-top"><label class="dcard-title"><input type="checkbox" class="dsel-check" data-dslot="${slot.id}" data-candidate="${c.id}"> ${c.grade}級｜${c.id}</label><div class="dcard-amt">建議 <input class="dsel-amt" data-dslot="${slot.id}" data-candidate="${c.id}" type="number" min="0" step="1" value="${c.amount}"> 萬</div></div>
      <div class="chips">${c.basket.map(s=>`<span class="chip">${s}</span>`).join('')}</div>
      <div class="dterms"><b>${c.coupon}%</b>｜${c.tenor}｜${c.type}｜${c.strike}/${c.ki}</div>
      <div class="dfair">M8 ${c.m8}%｜Final ${c.final}%｜Gap ${c.gap}</div>
      <div class="chips"><span class="chip ${c.template==='Promote'?'good':c.template==='Watch'?'warn':''}">${c.template}</span><span class="chip ${c.capacity==='PASS'?'good':c.capacity==='HOT'||c.capacity==='CAUTION'?'warn':'bad'}">Capacity ${c.capacity}</span></div>
      <div class="dwhy">${c.reason}</div>
    </div>`;
  }

  function renderBlueprint(){
    const selected=[];
    qsa('.dsel-check:checked').forEach(ch=>{
      const slot=slots.find(s=>s.id===ch.dataset.dslot);
      const c=(candidates[ch.dataset.dslot]||[]).find(x=>x.id===ch.dataset.candidate);
      const amt=Number(qs(`.dsel-amt[data-dslot="${ch.dataset.dslot}"][data-candidate="${ch.dataset.candidate}"]`)?.value||0);
      if(slot&&c)selected.push({slot,c,amt});
    });
    const total=selected.reduce((s,x)=>s+x.amt,0);
    const sinopac=selected.filter(x=>x.c.bank==='永豐').reduce((s,x)=>s+x.amt,0);
    const fubon=selected.filter(x=>x.c.bank==='富邦').reduce((s,x)=>s+x.amt,0);
    const aggr=selected.filter(x=>x.c.category==='積極單').reduce((s,x)=>s+x.amt,0);
    const spec=selected.filter(x=>x.c.category==='短期投機單').reduce((s,x)=>s+x.amt,0);
    const rows=selected.map(x=>`<div class="bp-row"><b>${x.c.bank}｜${x.c.category}｜${x.c.id}</b>｜${x.c.basket.join('/')}｜${wan(x.amt)}<br><span class="muted">${x.c.coupon}%｜${x.c.tenor}｜${x.c.type}｜${x.c.strike}/${x.c.ki}｜${x.c.gap}</span></div>`).join('')||'<div class="bp-row muted">尚未勾選 FCN，今日投資藍圖暫為待分配。</div>';
    const unfilled=slots.map(s=>{const used=selected.filter(x=>x.slot.id===s.id).reduce((a,b)=>a+b.amt,0);return {slot:s,remain:Math.max(0,s.need-used)}}).filter(x=>x.remain>0);
    qs('#dselBlueprint').innerHTML=`<div class="blueprint"><h3>OUTPUT｜今日投資藍圖</h3><div class="decision-note"><b>一句話：</b>${selected.length?'今日可依勾選候選建立市場跟單；未滿 slot 的部分先列待分配。':'目前尚未勾選候選，先保留現金等待市場單。'}</div><div class="bp-grid"><div class="bp-card"><label>總投入</label><b>${wan(total)}</b></div><div class="bp-card"><label>永豐</label><b>${wan(sinopac)}</b></div><div class="bp-card"><label>富邦</label><b>${wan(fubon)}</b></div><div class="bp-card"><label>積極 / 投機</label><b>${wan(aggr)} / ${wan(spec)}</b></div></div><div class="bp-list">${rows}</div><div class="bp-list"><div class="bp-row"><b>待分配 / 未完成 slot</b><br>${unfilled.map(x=>`${x.slot.bank} ${x.slot.category} 剩餘 ${wan(x.remain)}`).join('｜')||'全部完成'}</div></div></div>`;
    qsa('.dcard').forEach(card=>{
      const checked=qs(`.dsel-check[data-dslot="${card.dataset.dslot}"][data-candidate="${card.dataset.candidate}"]`)?.checked;
      card.classList.toggle('selected',!!checked);
    });
  }

  function renderD(){
    const box=qs('#marketWorkspaceContent');
    if(!box)return;
    box.innerHTML=`${css()}<div class="dsel"><div class="dsel-banner"><b>D. FCN遴選系統｜v067A Prototype</b><br>推薦候選區勾選 → 修改金額 → OUTPUT 今日投資藍圖。此版為 workflow prototype，不寫回、不下單、不導入 M4。</div>${slots.map(slot=>`<section class="dslot"><div class="dslot-head"><div><div class="dslot-title">${slot.bank}｜${slot.category}｜需求 ${wan(slot.need)}</div><div class="dslot-sub">min ${wan(slot.min)}｜${slot.strategy}</div></div><div class="dslot-status" id="dstatus-${slot.id}">${slot.status}</div></div><div class="dcards">${(candidates[slot.id]||[]).slice(0,5).map((c,i)=>cardHtml(slot,c,i)).join('')}</div></section>`).join('')}<div id="dselBlueprint"></div><details><summary>分析過程｜M8 / B1 / B2 / Capacity / Raw</summary><div class="muted" style="line-height:1.7;margin-top:8px">v067A 先確認 UX：slot row、橫式候選卡、勾選、可改金額、今日投資藍圖。v067B 再接真實 market rows 與 C execution slots；v067C 再導入 M4+M8 scoring。</div></details></div>`;
    qsa('.dsel-check,.dsel-amt',box).forEach(el=>el.addEventListener('input',renderBlueprint));
    qsa('.dsel-check',box).forEach(el=>el.addEventListener('change',renderBlueprint));
    renderBlueprint();
  }

  function activateD(ev){
    const btn=ev.target.closest('[data-market-tab="'+D_TAB+'"]');
    if(!btn)return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    qsa('#m2MarketFcnSubnav [data-market-tab]').forEach(b=>b.classList.toggle('action',b===btn));
    const content=qs('#marketWorkspaceContent')||qs('#bottomQuery');
    if(!qs('#marketWorkspaceContent')&&content)content.innerHTML='<main id="marketWorkspaceContent"></main>';
    setTimeout(renderD,0);
  }

  function init(){injectButton();document.addEventListener('click',activateD,true);setInterval(injectButton,1200);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

(() => {
  const FCN_URL = '../data/fcn_pool.json';
  const MARKET_URL = '../data/market_runtime.json';
  const POOL30_URL = '../data/pool30.json';
  const SCALE = 0.1;
  const TODAY = new Date('2026-05-13T00:00:00+08:00');
  const WINDOW_DAYS = 30;
  const PLANNER_EARLY_EXIT_DAYS = 27;
  const MATURITY_ZONE_DAYS = 10;
  const BANK_ALIAS = {
    '永豐': 'Bank-w', 'sinopac': 'Bank-w', 'Sinopac': 'Bank-w', 'SinoPac': 'Bank-w',
    '富邦': 'Bank-t', 'fubon': 'Bank-t', 'Fubon': 'Bank-t'
  };

  const $ = (id) => document.getElementById(id);
  const fmt = (n, d = 0) => Number.isFinite(Number(n)) ? Number(n).toLocaleString('en-US', { maximumFractionDigits: d }) : '--';
  const pct = (n, d = 1) => Number.isFinite(Number(n)) ? `${Number(n).toFixed(d)}%` : '--';
  const num = (v, fb = 0) => {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
      const s = v.replace(/[,%\s]/g, '');
      if (!s) return fb;
      const x = Number(s);
      return Number.isFinite(x) ? x : fb;
    }
    return fb;
  };
  const dateOf = (v) => {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    if (!s) return null;
    const d = new Date(s.replace(/\//g, '-'));
    return Number.isFinite(d.getTime()) ? d : null;
  };
  const isoDay = (d) => d ? d.toISOString().slice(0, 10) : '--';
  const daysBetween = (a, b) => Math.floor((b.getTime() - a.getTime()) / 86400000);
  const safeArr = (x) => Array.isArray(x) ? x : (x && typeof x === 'object' ? Object.values(x) : []);

  async function loadJson(url, fallback) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return await res.json();
    } catch (err) {
      console.warn('[Planner 1D] load failed:', url, err.message);
      return fallback;
    }
  }

  function aliasBank(v) {
    const raw = String(v ?? '').trim();
    return BANK_ALIAS[raw] || raw || 'Unknown';
  }

  function extractSymbols(row) {
    const raw = row.basket || row.symbols || row.underlyings || row.stocks || row.stock_list || row.tickers || row.symbol;
    if (Array.isArray(raw)) return raw.map(String).map(s => s.trim().toUpperCase()).filter(Boolean);
    if (typeof raw === 'string') return raw.split(/[+,/|;\s]+/).map(s => s.trim().toUpperCase()).filter(Boolean);
    return [];
  }

  function normalizeMarket(raw) {
    const data = raw?.data || raw || {};
    const out = {};
    Object.entries(data).forEach(([sym, v]) => {
      const s = String(sym).toUpperCase();
      out[s] = num(v?.price_now ?? v?.spot ?? v?.last ?? v?.close ?? v?.regularMarketPrice ?? v, 0);
    });
    return out;
  }

  function normalizeRows(rawPool) {
    const rows = safeArr(rawPool && rawPool.data ? rawPool.data : rawPool);
    return rows.map((r, idx) => {
      const symbols = extractSymbols(r);
      const amount = num(r.amt ?? r.amount ?? r.principal ?? r.notional ?? r.invest_amount ?? r.money ?? r.display_amount, 0);
      return {
        raw: r,
        id: r.fcn_id || r.id || r.no || r.product_id || `FCN-${idx + 1}`,
        bank: aliasBank(r.tw_bank ?? r.bank ?? r.broker ?? r.source_bank ?? r.platform),
        twBank: String(r.tw_bank ?? r.bank ?? '').trim(),
        amount,
        displayAmount: amount * SCALE,
        coupon: num(r.coupon_rate ?? r.rate ?? r.coupon ?? r.annual_coupon ?? r.apr, 0),
        tenor: num(r.tenor_months ?? r.tenor ?? r.period_months ?? r.months, 0),
        autocall: num(r.autocall ?? r.autocall_pct ?? r.autocall_price ?? 100, 100),
        strike: num(r.strike ?? r.strike_pct ?? r.strike_price, 0),
        ki: num(r.ki ?? r.ki_pct ?? r.knock_in ?? r.knock_in_pct, 0),
        eki: r.eki === true || String(r.eki ?? '').toLowerCase().includes('eki'),
        status: String(r.status ?? r.state ?? '').trim().toLowerCase(),
        hasPosition: r.has_position !== false,
        hasKiBreach: r.has_ki_breach === true,
        created: dateOf(r.created_time ?? r.create_time ?? r.date),
        entry: dateOf(r.entry_time ?? r.entry_date ?? r.trade_date ?? r.start_date ?? r.created_time),
        exit: dateOf(r.exit_time ?? r.exit_date),
        maturity: dateOf(r.maturity_time ?? r.maturity_date ?? r.expiry_date ?? r.end_date ?? r.mature_date),
        symbols,
        entryPrices: r.entry_prices && typeof r.entry_prices === 'object' ? r.entry_prices : {},
        currentPrices: r.current_prices && typeof r.current_prices === 'object' ? r.current_prices : (r.market_prices && typeof r.market_prices === 'object' ? r.market_prices : {}),
        earlyExitRecord: r.early_exit_record && typeof r.early_exit_record === 'object' ? r.early_exit_record : {},
        worstOf: String(r.worst_of ?? r.worstOf ?? r.worst_symbol ?? symbols[0] ?? '').toUpperCase(),
        note: String(r.note ?? r.memo ?? r.remark ?? '').trim()
      };
    }).filter(r => r.amount > 0 || r.symbols.length || r.coupon > 0);
  }

  function priceNow(row, symbol, market) {
    const s = String(symbol).toUpperCase();
    return num(row.currentPrices?.[s] ?? row.raw?.price_now?.[s] ?? market[s], 0);
  }
  function entryPrice(row, symbol) {
    const s = String(symbol).toUpperCase();
    return num(row.entryPrices?.[s] ?? row.raw?.entry_price?.[s] ?? 0, 0);
  }
  function ratio(now, entry) { return entry > 0 && now > 0 ? now / entry * 100 : null; }
  function distToBarrier(now, entry, barrierPct) {
    if (!entry || !now || !barrierPct) return null;
    const barrierPx = entry * barrierPct / 100;
    return barrierPx ? (now / barrierPx - 1) * 100 : null;
  }

  function m2MirrorClassify(row, market) {
    const daysHeld = row.entry ? daysBetween(row.entry, TODAY) : null;
    const daysToMat = row.maturity ? daysBetween(TODAY, row.maturity) : null;
    const closed = Boolean(row.exit) || row.status === 'closed' || row.status === 'deleted';
    const active = !closed && row.status !== 'draft';
    const symbols = row.symbols.length ? row.symbols : [row.worstOf].filter(Boolean);
    const per = symbols.map(sym => {
      const now = priceNow(row, sym, market);
      const ent = entryPrice(row, sym);
      const basketRatio = ratio(now, ent);
      const distStrike = distToBarrier(now, ent, row.strike);
      const distKi = distToBarrier(now, ent, row.ki);
      const persisted = row.earlyExitRecord?.[sym]?.hit === true || row.earlyExitRecord?.[sym] === true;
      const runtime = active && daysHeld !== null && daysHeld >= PLANNER_EARLY_EXIT_DAYS && now > 0 && ent > 0 && now > ent;
      return { sym, now, entry: ent, basketRatio, distStrike, distKi, persistedRemark: persisted, runtimeRemark: runtime, plannerRemark: persisted || runtime };
    });
    const worst = per.slice().sort((a, b) => (a.basketRatio ?? 9999) - (b.basketRatio ?? 9999))[0];
    const allRemarked = per.length > 0 && per.every(x => x.plannerRemark);
    const persistedAllRemarked = per.length > 0 && per.every(x => x.persistedRemark);
    const hasRuntimeOnlyRemark = per.some(x => x.runtimeRemark && !x.persistedRemark);
    const inMaturityZone = active && daysToMat !== null && daysToMat >= 0 && daysToMat <= MATURITY_ZONE_DAYS;
    const within30 = active && daysToMat !== null && daysToMat >= 0 && daysToMat <= WINDOW_DAYS;
    const explicitDelivery = row.raw.stock_delivery_risk === true || row.raw.expected_stock_delivery === true || row.raw.must_take_stock === true || /接股|入股|破下限|ki breach|barrier breach|delivery/i.test(row.status + ' ' + row.note);
    const belowKi = active && per.some(x => x.distKi !== null && x.distKi < 0);
    const belowStrike = active && per.some(x => x.distStrike !== null && x.distStrike < 0);
    const possibleDelivery = active && (explicitDelivery || row.hasKiBreach || belowKi || (!row.eki && belowStrike && inMaturityZone));
    let m2Bucket = 'healthy';
    let m2Label = '健康';
    let reason = 'M2 mirror: active and no danger/watch signal';
    if (closed) { m2Bucket = 'closed'; m2Label = '已出場'; reason = row.exit ? 'exit_time has value' : `status=${row.status}`; }
    else if (possibleDelivery) { m2Bucket = 'delivery_possible'; m2Label = '接股可能'; reason = explicitDelivery ? 'explicit delivery/status/note signal' : row.hasKiBreach ? 'has_ki_breach=true' : belowKi ? 'current below KI barrier' : 'AKI/DACN near maturity and below Strike'; }
    else if (allRemarked) { m2Bucket = 'early_exit'; m2Label = persistedAllRemarked ? '提早出場' : '預計提早出場'; reason = persistedAllRemarked ? 'all basket persisted remark' : 'planner +27d: all basket persisted/runtime remark'; }
    else if (inMaturityZone) { m2Bucket = 'maturity_safe'; m2Label = '滿期安全'; reason = 'within maturity zone and no delivery risk'; }
    else if (belowStrike || belowKi) { m2Bucket = 'tracking'; m2Label = '持續追蹤'; reason = belowKi ? 'below KI/near barrier tracking' : 'below Strike tracking'; }

    return { daysHeld, daysToMat, closed, active, per, worst: worst?.sym || row.worstOf || '--', allRemarked, persistedAllRemarked, hasRuntimeOnlyRemark, inMaturityZone, within30, possibleDelivery, m2Bucket, m2Label, reason };
  }

  function plannerClassify(row, market) {
    const m2 = m2MirrorClassify(row, market);
    Object.assign(row, m2);
    row.lifecycle = m2.closed ? 'closed' : 'active';
    row.isNew30d = row.created ? daysBetween(row.created, TODAY) >= 0 && daysBetween(row.created, TODAY) <= 30 : (row.daysHeld !== null && row.daysHeld <= 30);

    if (row.lifecycle === 'closed') row.planBucket = 'closed';
    else if (row.possibleDelivery) row.planBucket = 'delivery_hold';
    else if (row.within30 && row.m2Bucket === 'maturity_safe') row.planBucket = 'maturity_available';
    else if (row.m2Bucket === 'early_exit') row.planBucket = 'expected_available';
    else row.planBucket = 'active_retained';

    row.planLabel = {
      closed: 'Closed', delivery_hold: '接股/額度占用', maturity_available: '到期可用', expected_available: '預計可用', active_retained: 'Active 留存'
    }[row.planBucket] || row.planBucket;
    return row;
  }

  const sum = rows => rows.reduce((s, r) => s + r.displayAmount, 0);
  const byBank = (rows, bank) => rows.filter(r => r.bank === bank);
  const stat = rows => ({ amount: sum(rows), count: rows.length });

  function analyze(rows, market) {
    rows.forEach(r => plannerClassify(r, market));
    const active = rows.filter(r => r.lifecycle === 'active');
    const closed = rows.filter(r => r.lifecycle === 'closed');
    const dangerTracking = active.filter(r => ['delivery_possible','tracking'].includes(r.m2Bucket));
    const healthy = active.filter(r => r.m2Bucket === 'healthy' || r.m2Bucket === 'maturity_safe' || r.m2Bucket === 'early_exit');
    const maturity = active.filter(r => r.planBucket === 'maturity_available');
    const expected = active.filter(r => r.planBucket === 'expected_available');
    const delivery = active.filter(r => r.planBucket === 'delivery_hold');
    const available30 = maturity.concat(expected);
    const analysisBody = active.filter(r => !available30.includes(r) && !delivery.includes(r));
    return { rows, active, closed, dangerTracking, healthy, maturity, expected, delivery, available30, analysisBody };
  }

  function metric(label, rows) { return `<div class="metric"><span>${label}</span><b>${fmt(sum(rows))} <small>(${rows.length}檔)</small></b></div>`; }
  function block(title, rows, sub = [], note = '') {
    return `<div class="kpi"><div class="k">${title}</div><div class="v">${fmt(sum(rows))}</div><div class="d">${rows.length} 檔${note ? '｜' + note : ''}</div><div style="margin-top:10px">${sub.join('')}</div></div>`;
  }
  function bar(label, value, max, cls='') {
    const w = max ? Math.max(2, Math.min(100, value / max * 100)) : 0;
    return `<div class="bar-row"><span>${label}</span><div class="bar-bg"><div class="bar-fill ${cls}" style="width:${w}%"></div></div><b>${fmt(value)}</b></div>`;
  }

  function renderKpis(a) {
    const bankT = byBank(a.active, 'Bank-t'), bankW = byBank(a.active, 'Bank-w');
    $('kpiGrid').innerHTML = [
      block('30天可用現金', a.available30, [metric('到期可用', a.maturity), metric('預計可用', a.expected), metric('接股 / 額度占用', a.delivery)], 'Planner'),
      block('富邦', bankT, [metric('到期可用', byBank(a.maturity,'Bank-t')), metric('預計可用', byBank(a.expected,'Bank-t')), metric('接股 / 額度占用', byBank(a.delivery,'Bank-t'))], 'Planner'),
      block('永豐', bankW, [metric('到期可用', byBank(a.maturity,'Bank-w')), metric('預計可用', byBank(a.expected,'Bank-w')), metric('接股 / 額度占用', byBank(a.delivery,'Bank-w'))], 'Planner'),
      block('Danger / Tracking', a.dangerTracking, [metric('富邦', byBank(a.dangerTracking,'Bank-t')), metric('永豐', byBank(a.dangerTracking,'Bank-w'))], 'M2 mirror'),
      block('健康', a.healthy, [metric('富邦', byBank(a.healthy,'Bank-t')), metric('永豐', byBank(a.healthy,'Bank-w'))], 'M2 mirror'),
      block('實際持倉總額', a.active, [metric('富邦', bankT), metric('永豐', bankW)], 'M2 active'),
      block('分析母體', a.analysisBody, [metric('Closed 排除', a.closed), metric('Active 留存', a.analysisBody)], 'Planner')
    ].join('');
  }

  function renderCash(a) {
    $('cashSummary').innerHTML = `<h3>資金回收摘要</h3>` + metric('30天可用現金', a.available30) + metric('到期可用', a.maturity) + metric('預計可用', a.expected) + metric('接股 / 額度占用', a.delivery) + `<p class="note">Phase 1D：M2 reality mirror + Planner 27天預計提早出場。runtime remark 會顯示，但未寫回 fcn_pool 前不宣稱永久。</p>`;
    const maxBank = Math.max(sum(a.available30), 1);
    $('cashBankBars').innerHTML = ['Bank-t','Bank-w'].map(b => bar(`${b} 30天可用`, sum(byBank(a.available30,b)), maxBank)).join('');
    const timelineRows = a.available30.concat(a.delivery).slice(0, 14);
    const max = Math.max(...timelineRows.map(r=>r.displayAmount), 1);
    $('cashTimeline').innerHTML = timelineRows.map(r => bar(`${r.id}｜${r.planLabel}｜${r.reason}`, r.displayAmount, max, r.planBucket==='delivery_hold'?'bad':'warn')).join('') || '<p class="note">目前沒有 30天可用或接股占用資料。</p>';
  }

  function renderBase(a) {
    $('baseSummary').innerHTML = `<h3>分析母體</h3>` + metric('實際持倉總額', a.active) + metric('30天可用扣除', a.available30) + metric('接股占用扣除', a.delivery) + metric('分析母體', a.analysisBody) + `<p class="note">分析母體 = active - 30天可用 - 接股/額度占用。Danger/Tracking 本身不一定扣除，除非進入接股占用。</p>`;
    const p = sum(a.active) ? sum(a.analysisBody) / sum(a.active) * 100 : 0;
    $('baseDonut').style.background = `conic-gradient(#2f80ed 0 ${p}%, #f4a261 ${p}% 100%)`;
    $('baseDonutText').innerHTML = `分析母體 ${fmt(sum(a.analysisBody))} / 實際持倉 ${fmt(sum(a.active))}`;
    const worst = Object.entries(a.active.reduce((acc,r)=>{ acc[r.worst]=(acc[r.worst]||0)+r.displayAmount; return acc; },{})).sort((x,y)=>y[1]-x[1]).slice(0,8);
    const max = Math.max(...worst.map(x=>x[1]),1);
    $('worstOfBars').innerHTML = worst.map(([k,v])=>bar(k,v,max)).join('') || '<p class="note">尚無 worst-of 資料。</p>';
  }

  function renderMix(a) {
    $('mixSummary').innerHTML = `<h3>規劃分層</h3>` + metric('M2 Reality：Danger/Tracking', a.dangerTracking) + metric('M2 Reality：健康', a.healthy) + metric('Planner：30天可用', a.available30) + `<p class="note">富邦/永豐、30天可用、分析母體屬於 Planner future layer；健康與 Danger/Tracking mirror M2。</p>`;
    const max = Math.max(sum(a.active),1);
    $('mixBars').innerHTML = ['Bank-t','Bank-w'].map(b => bar(b, sum(byBank(a.active,b)), max)).join('');
  }

  function renderHealth(a) {
    const groups = { '接股可能': a.active.filter(r=>r.m2Bucket==='delivery_possible'), '持續追蹤': a.active.filter(r=>r.m2Bucket==='tracking'), '健康': a.healthy };
    const max = Math.max(...Object.values(groups).map(sum),1);
    $('scoreBars').innerHTML = Object.entries(groups).map(([k,rows])=>bar(k, sum(rows), max, k==='接股可能'?'bad':k==='持續追蹤'?'warn':'')).join('');
    $('flagBars').innerHTML = '<p class="note">此區 follow M2 mirror；Planner 不新增自己的健康分數。</p>';
    $('healthRows').innerHTML = a.active.map(r => `<tr><td>${r.id}</td><td>${r.bank}</td><td>${r.symbols.join('+') || '--'}</td><td><b>${r.worst}</b></td><td>${r.worst ? pct(r.per.find(x=>x.sym===r.worst)?.basketRatio,1) : '--'}</td><td><span class="pill ${r.m2Bucket==='delivery_possible'?'bad':r.m2Bucket==='tracking'?'warn':'ok'}">${r.m2Label}</span></td><td>${r.hasRuntimeOnlyRemark ? 'runtime remark not persisted' : r.persistedAllRemarked ? 'persisted remark' : '--'}</td><td>${r.reason}</td></tr>`).join('') || '<tr><td colspan="8">No active rows</td></tr>';
  }

  function renderPlan(a) {
    $('recommendCards').innerHTML = [
      ['本版重點', 'Phase 1D v1', '保留 dashboard 外框，重建 M2 reality + Planner future 分層。'],
      ['Planner early exit', '+27 days', '比 M2 正式 +37 天更早，供配置規劃。'],
      ['Persistence', 'runtime vs persisted', '若 remark 未寫回 fcn_pool，底表會標示 runtime-only。']
    ].map(([h,v,d])=>`<div class="rec-card"><h4>${h}</h4><div class="kpi"><div class="v">${v}</div><div class="d">${d}</div></div></div>`).join('');
    $('bankPlanBars').innerHTML = ['Bank-t','Bank-w'].map(b => bar(`${b} 可用`, sum(byBank(a.available30,b)), Math.max(sum(a.available30),1))).join('');
  }

  function ensureDetailSection() {
    if ($('allFcnDetail')) return;
    const main = document.querySelector('main') || document.body;
    const wrap = document.createElement('details');
    wrap.id = 'allFcnDetail';
    wrap.className = 'planner-section';
    wrap.open = true;
    wrap.innerHTML = `<summary><span>所有 FCN 分析明細 / All FCN Management Filter</span><em>Validation</em></summary><div class="section-body"><div id="fcnFilterChips" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"></div><div style="overflow:auto"><table><thead><tr><th>FCN</th><th>Bank</th><th>Amt</th><th>Lifecycle</th><th>M2</th><th>Plan</th><th>Entry</th><th>Exit</th><th>Maturity</th><th>Days</th><th>Basket</th><th>Worst</th><th>Remark</th><th>Reason</th></tr></thead><tbody id="allFcnRows"></tbody></table></div></div>`;
    main.appendChild(wrap);
  }
  function renderAllFcnTable(a) {
    ensureDetailSection();
    const filters = [
      ['all','All'], ['active','Active'], ['closed','Closed'], ['maturity','到期可用'], ['expected','預計可投入資金'], ['delivery','接股/額度占用'], ['danger','Danger'], ['tracking','Tracking'], ['healthy','健康'], ['bankt','富邦'], ['bankw','永豐'], ['new30','新增FCN']
    ];
    const pick = (k) => ({
      all:a.rows, active:a.active, closed:a.closed, maturity:a.maturity, expected:a.expected, delivery:a.delivery,
      danger:a.active.filter(r=>r.m2Bucket==='delivery_possible'), tracking:a.active.filter(r=>r.m2Bucket==='tracking'), healthy:a.healthy,
      bankt:byBank(a.active,'Bank-t'), bankw:byBank(a.active,'Bank-w'), new30:a.rows.filter(r=>r.isNew30d)
    }[k] || a.rows);
    const draw = (k) => {
      const rows = pick(k);
      $('allFcnRows').innerHTML = rows.map(r => `<tr><td>${r.id}</td><td>${r.bank}</td><td>${fmt(r.displayAmount)}</td><td>${r.lifecycle}</td><td>${r.m2Label}</td><td>${r.planLabel}</td><td>${isoDay(r.entry)}</td><td>${isoDay(r.exit)}</td><td>${isoDay(r.maturity)}</td><td>${r.daysHeld ?? '--'} / ${r.daysToMat ?? '--'}</td><td>${r.symbols.join('+')}</td><td>${r.worst}</td><td>${r.hasRuntimeOnlyRemark ? 'runtime-only' : r.persistedAllRemarked ? 'persisted' : '--'}</td><td>${r.reason}</td></tr>`).join('') || '<tr><td colspan="14">No rows</td></tr>';
    };
    $('fcnFilterChips').innerHTML = filters.map(([k,l])=>`<button class="nav-item" data-filter="${k}" type="button">${l}</button>`).join('');
    $('fcnFilterChips').querySelectorAll('[data-filter]').forEach(btn => btn.onclick = () => draw(btn.dataset.filter));
    draw('all');
  }

  function renderNotes(rows, market) {
    const el = $('dataNotes');
    if (!el) return;
    el.innerHTML = `Phase 1D v1<br>資料源：fcn_pool.json + market_runtime.json。<br>M2 untouched；Planner local mirror。<br>早出規劃：entry_time + ${PLANNER_EARLY_EXIT_DAYS} 天。<br>載入 FCN：${rows.length}，market price symbols：${Object.keys(market).length}`;
  }
  function wireButtons() {
    const safe = (id, fn) => { const el = $(id); if (el) el.onclick = fn; };
    safe('expandAll', () => document.querySelectorAll('.planner-section').forEach(d => d.open = true));
    safe('collapseAll', () => document.querySelectorAll('.planner-section').forEach(d => d.open = false));
    safe('showRiskOnly', () => document.querySelectorAll('.planner-section').forEach(d => d.open = d.classList.contains('risk-section')));
    safe('resetView', () => document.querySelectorAll('.planner-section').forEach(d => d.open = ['cash','base','mix','health','plan','allFcnDetail'].includes(d.id)));
    document.querySelectorAll('.nav-item').forEach(n => { if (n.dataset.target) n.onclick = () => $(n.dataset.target)?.scrollIntoView({ behavior:'smooth', block:'start' }); });
  }

  async function init() {
    wireButtons();
    const [pool, marketRaw] = await Promise.all([loadJson(FCN_URL, []), loadJson(MARKET_URL, {})]);
    const market = normalizeMarket(marketRaw);
    const rows = normalizeRows(pool);
    const a = analyze(rows, market);
    renderKpis(a); renderCash(a); renderBase(a); renderMix(a); renderHealth(a); renderPlan(a); renderAllFcnTable(a); renderNotes(rows, market);
  }
  document.addEventListener('DOMContentLoaded', init);
})();



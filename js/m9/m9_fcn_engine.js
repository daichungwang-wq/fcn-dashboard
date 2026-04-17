// ==========================================
// M9 FCN ENGINE (STABLE)
// ==========================================

// ---------- 工具 ----------
function parseDate(v){
  if(!v) return null;
  const d = new Date(v);
  return isNaN(d) ? null : d;
}

function addDays(d, days){
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function getBank(item){
  if(item.tw_bank) return item.tw_bank;
  if(item.fcn_id?.includes("富邦")) return "富邦";
  if(item.fcn_id?.includes("永豐")) return "永豐";
  return "其他";
}

function allHit(record){
  if(!record) return false;
  const arr = Object.values(record);
  if(!arr.length) return false;
  return arr.every(x => x.hit === true);
}

// ---------- 月數 ----------
function getMonthIndex(entry, now){
  const e = parseDate(entry);
  if(!e) return 0;

  const first = addDays(e, 49);
  if(now < first) return 0;

  const diff = (now - first) / (1000*60*60*24);
  return 1 + Math.floor(diff / 30);
}

// ---------- 折扣 ----------
function getMultiplier(idx){
  if(idx <= 1) return 1;
  if(idx === 2) return 0.88;
  return 0.64;
}

// ---------- 單筆 ----------
function calcCoupon(item, offset=0, usd=33){
  const now = new Date();
  const target = new Date(now);
  target.setMonth(target.getMonth() + offset);

  const entry = parseDate(item.entry_time);
  const maturity = parseDate(item.maturity_time);

  if(!entry || !maturity) return 0;
  if(item.status !== "active") return 0;
  if(target >= maturity) return 0;
  if(allHit(item.early_exit_record)) return 0;

  const idx = getMonthIndex(item.entry_time, target);
  if(idx <= 0) return 0;

  const amt = Number(item.amt || 0);
  const rate = Number(item.rate || 0);
  const fx = item.currency === "USD" ? usd : 1;

  const base = amt * (rate/100) / 12;

  return base * getMultiplier(idx) * fx;
}

// ---------- 載入 ----------
async function loadFcnPool(){
  try{
    const res = await fetch("./data/fcn_pool.json");
    return await res.json();
  }catch(e){
    console.error("load fcn_pool failed", e);
    return [];
  }
}

// ---------- Summary ----------
function buildFcnSummary(pool, usd=33){
  const active = pool.filter(x=>x.status==="active");

  let t1=0, t2=0, t3=0;
  const bankMap = {};

  active.forEach(item=>{
    const bank = getBank(item);

    const c1 = calcCoupon(item,0,usd);
    const c2 = calcCoupon(item,1,usd);
    const c3 = calcCoupon(item,2,usd);

    t1+=c1; t2+=c2; t3+=c3;

    if(!bankMap[bank]){
      bankMap[bank]={thisMonth:0,nextMonth:0,thirdMonth:0,count:0};
    }

    bankMap[bank].thisMonth+=c1;
    bankMap[bank].nextMonth+=c2;
    bankMap[bank].thirdMonth+=c3;
    bankMap[bank].count+=1;
  });

  return {
    total:{thisMonth:t1,nextMonth:t2,thirdMonth:t3},
    byBank:bankMap,
    count:active.length
  };
}

// ---------- Table ----------
function buildFcnTable(pool, usd=33){
  return pool
    .filter(x=>x.status==="active")
    .map(item=>({
      id:item.fcn_id,
      bank:getBank(item),
      thisMonth:calcCoupon(item,0,usd),
      nextMonth:calcCoupon(item,1,usd),
      thirdMonth:calcCoupon(item,2,usd),
      earlyExit:allHit(item.early_exit_record)
    }));
}

// ---------- 12個月 ----------
function buildCashflow12M(pool, usd=33){
  const active = pool.filter(x=>x.status==="active");
  const arr=[];

  for(let i=0;i<12;i++){
    let total=0;
    active.forEach(item=>{
      total += calcCoupon(item,i,usd);
    });

    const d=new Date();
    d.setMonth(d.getMonth()+i);

    arr.push({
      label:`${d.getFullYear()}/${d.getMonth()+1}`,
      value:total
    });
  }

  return arr;
}

// 掛到 window（讓 m9.html 能用）
window.M9_FCN = {
  loadFcnPool,
  buildFcnSummary,
  buildFcnTable,
  buildCashflow12M
};

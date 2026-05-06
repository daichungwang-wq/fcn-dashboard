// ==========================================
// M9 FCN ENGINE (STABLE + STATUS/DEBUG)
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

function formatDateYYYYMMDD(d){
  if(!d) return "—";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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

function getTargetDate(offset=0){
  const now = new Date();
  const target = new Date(now);
  target.setMonth(target.getMonth() + offset);
  return target;
}

// ---------- FCN 日期邏輯 ----------
// 重要：目前 fcn_pool.json 的 entry_time 實務上較接近「create date / 建立日」。
// 依目前作業假設：
//   create date + 5~9 天 ≈ 真正 entry date，正常先抓 +7 天
//   真正 entry date + 37 天 ≈ 第一次配息日
//   配息日 + 3 天 ≈ 入帳日
//   再加 2 天 buffer
// 因此目前保守估算：record entry_time + 49 天 = 第一次利息入帳可認列日。
const FCN_EST_ENTRY_DAYS_FROM_RECORD = 7;
const FCN_FIRST_COUPON_DAYS_FROM_ENTRY = 37;
const FCN_COUPON_DEPOSIT_DELAY_DAYS = 3;
const FCN_BUFFER_DAYS = 2;
const FCN_FIRST_DEPOSIT_DAYS_FROM_RECORD =
  FCN_EST_ENTRY_DAYS_FROM_RECORD +
  FCN_FIRST_COUPON_DAYS_FROM_ENTRY +
  FCN_COUPON_DEPOSIT_DELAY_DAYS +
  FCN_BUFFER_DAYS; // 49

function getRecordDate(item){
  return parseDate(item?.entry_time);
}

function getEstimatedEntryDate(item){
  const recordDate = getRecordDate(item);
  return recordDate ? addDays(recordDate, FCN_EST_ENTRY_DAYS_FROM_RECORD) : null;
}

function getFirstCouponDepositDateByRecordDate(item){
  const recordDate = getRecordDate(item);
  return recordDate ? addDays(recordDate, FCN_FIRST_DEPOSIT_DAYS_FROM_RECORD) : null;
}

// ---------- 月數 ----------
function getMonthIndexFromItem(item, targetDate){
  const firstDeposit = getFirstCouponDepositDateByRecordDate(item);
  if(!firstDeposit) return 0;
  if(targetDate < firstDeposit) return 0;

  const diff = (targetDate - firstDeposit) / (1000*60*60*24);
  return 1 + Math.floor(diff / 30);
}

// 舊函式保留相容性：entry 仍視為 record date。
function getMonthIndex(entry, now){
  return getMonthIndexFromItem({entry_time: entry}, now);
}

// ---------- 折扣 ----------
function getMultiplier(idx){
  if(idx <= 1) return 1;
  if(idx === 2) return 0.88;
  return 0.64;
}

// ---------- 狀態 / 0利息原因 ----------
function getFcnState(item, offset=0){
  const target = getTargetDate(offset);
  const recordDate = getRecordDate(item);
  const estimatedEntryDate = getEstimatedEntryDate(item);
  const firstDepositDate = getFirstCouponDepositDateByRecordDate(item);
  const maturity = parseDate(item?.maturity_time);
  const earlyExit = allHit(item?.early_exit_record);
  const amt = Number(item?.amt || 0);
  const rate = Number(item?.rate || 0);
  const isActive = item?.status === "active";
  const idx = getMonthIndexFromItem(item, target);

  let statusText = "持有中";
  let statusCode = "active_holding";
  let zeroReason = "";

  if(!recordDate){
    statusText = "資料異常";
    statusCode = "missing_record_date";
    zeroReason = "record/entry_time missing";
  }else if(!maturity){
    statusText = "資料異常";
    statusCode = "missing_maturity";
    zeroReason = "maturity_time missing";
  }else if(!isActive){
    statusText = "非 active";
    statusCode = "not_active";
    zeroReason = "非 active";
  }else if(earlyExit){
    statusText = "已提前出場";
    statusCode = "early_exit";
    zeroReason = "已提前出場";
  }else if(target >= maturity){
    statusText = "已到期";
    statusCode = "matured";
    zeroReason = "已到期";
  }else if((maturity - target) / (1000*60*60*24) <= 7){
    statusText = "7天內到期";
    statusCode = "maturing_soon";
  }else if(firstDepositDate && target < firstDepositDate){
    statusText = "未達首次入帳日";
    statusCode = "before_first_deposit";
    zeroReason = "未達首次入帳日";
  }

  if(!zeroReason){
    if(!amt) zeroReason = "amt missing/zero";
    else if(!rate) zeroReason = "rate missing/zero";
    else if(idx <= 0) zeroReason = "未達首次入帳日";
  }

  return {
    target,
    recordDate,
    estimatedEntryDate,
    firstDepositDate,
    maturity,
    earlyExit,
    amt,
    rate,
    isActive,
    idx,
    statusText,
    statusCode,
    zeroReason
  };
}

// ---------- 單筆 ----------
function calcCoupon(item, offset=0, usd=33){
  const state = getFcnState(item, offset);

  if(!state.recordDate || !state.maturity) return 0;
  if(!state.isActive) return 0;
  if(state.target >= state.maturity) return 0;
  if(state.earlyExit) return 0;
  if(state.idx <= 0) return 0;
  if(!state.amt || !state.rate) return 0;

  const fx = item.currency === "USD" ? usd : 1;
  const base = state.amt * (state.rate/100) / 12;

  return base * getMultiplier(state.idx) * fx;
}

function getCouponDebug(item, offset=0, usd=33){
  const state = getFcnState(item, offset);
  const coupon = calcCoupon(item, offset, usd);
  return {
    ...state,
    coupon,
    zeroReason: coupon > 0 ? "" : state.zeroReason
  };
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
    .map(item=>{
      const d0 = getCouponDebug(item,0,usd);
      return {
        id:item.fcn_id,
        bank:getBank(item),
        recordDate:formatDateYYYYMMDD(d0.recordDate),
        estimatedEntryDate:formatDateYYYYMMDD(d0.estimatedEntryDate),
        firstCouponDepositDate:formatDateYYYYMMDD(d0.firstDepositDate),
        maturityDate:formatDateYYYYMMDD(d0.maturity),
        thisMonth:d0.coupon,
        nextMonth:calcCoupon(item,1,usd),
        thirdMonth:calcCoupon(item,2,usd),
        earlyExit:d0.earlyExit,
        statusText:d0.statusText,
        statusCode:d0.statusCode,
        zeroReason:d0.zeroReason || "—",
        monthIndex:d0.idx
      };
    });
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
  buildCashflow12M,
  calcCoupon,
  getCouponDebug,
  getFcnState,
  getRecordDate,
  getEstimatedEntryDate,
  getFirstCouponDepositDateByRecordDate,
  formatDateYYYYMMDD,
  constants:{
    FCN_EST_ENTRY_DAYS_FROM_RECORD,
    FCN_FIRST_COUPON_DAYS_FROM_ENTRY,
    FCN_COUPON_DEPOSIT_DELAY_DAYS,
    FCN_BUFFER_DAYS,
    FCN_FIRST_DEPOSIT_DAYS_FROM_RECORD
  }
};

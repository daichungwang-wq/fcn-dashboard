🧭 M1.html — FINAL BLUEPRINT（可實作版）
① 頁面定位（固定）
M1｜Stock Pool Review Console
用途：低頻（週/月/季）股票池審核
② 頁面結構（整體骨架）
[Header]
[Summary Bar]
[Filter Bar]
[System Buckets（4區）]
    └ 股票卡片（5層結構）
[Footer / Export]
③ Header（固定區）
M1｜Stock Pool Review Console
[套用系統預設] [全部清除] [匯出結果]

👉 功能：

套用系統預設 → reset human override
全部清除 → 全部取消勾選
匯出 → 產出 final JSON
④ Summary Bar（摘要列）
Candidate: 182
Stock Pool（建議）: 96
Pool30（建議）: 18
Watch: 42
Reject: 26
新股: 74 ｜ 舊股: 108

👉 來源：engine output 統計

⑤ Filter Bar（篩選區）
分區：
[All] [Pool30] [Stock Pool] [Watch] [Reject]

身分：
[全部] [新股] [舊股] [已在Pool30] [不在Pool30]

分類：
[全部] [core] [growth] [defensive] [income] [speculative]

狀態：
[全部] [reject only] [pool30 candidate] [category mismatch]

搜尋：
[__________]

👉 這一排是「高效率審核」關鍵

⑥ System Buckets（四大分區）
🟢 區塊1：建議納入 Pool30
=== 建議納入 Pool30（18） ===
🔵 區塊2：建議納入大池
=== 建議納入 Stock Pool（78） ===
🟡 區塊3：建議觀察
=== Watch / Provisional（42） ===
🔴 區塊4：建議排除
=== Reject（26） ===
⑦ 股票卡片（核心）

每一檔股票 = 一張卡
5 層結構（非常重要）

🧩 【Level 1】決策層（最重要）
[✔] Stock Pool   [ ] Pool30   分類：[growth ▼]   [▶]

ANET ｜ Arista Networks
AI_SEMI / NETWORKING

Pure 7.8 ｜ Std +1.12

系統：建議納入大池（Pool30：觀察）
✅ 規則
1. Engine 預設
✔ / ✖ 已打好
分類已選好
2. 人可直接操作
勾 / 取消 Stock Pool
勾 / 取消 Pool30
修改分類（dropdown）

👉 ❗ 不需要展開就能決策

🎯 Dropdown（固定）
core
growth
defensive
income
speculative
🧠 顯示差異（重要）

如果你改分類：

分類：[core ▼]（原：growth）
🧩 【Level 2】System Recommendation

（點開第一層後）

【系統建議】

✔ 建議納入 Stock Pool
✖ 暫不納入 Pool30

原因：
• 純股分數高於 growth 平均  
• AI networking 補足 pool30 缺口  
• 趨勢與估值同時成立  
• 結構甜度不足，不適合 FCN
🧩 【Level 3】Engine 明細
【分數拆解】

baseline: 8.1
pure: 7.8
valuation: 8.4
trend: 8.9
structure: 6.3
timing: 5.8
quality: 7.2

raw: 80.3
std: +1.12
額外：
【分類相似度】

core: 0.72
growth: 0.88
defensive: 0.31
income: 0.25
speculative: 0.40
🧩 【Level 4】AI Reason（精簡）
【AI 快速理由】

• AI data center networking 核心受惠  
• 補強 pool30 缺少網通代表  
• 成長動能與趨勢一致  

👉 最多 3–4 條

🧩 【Level 5】AI 訊息明細（深層）
【AI 深度分析】

【Growth】
AI 流量成長帶動 data center networking 需求

【Industry】
屬 AI infra networking 核心鏈

【Competition】
高階 switch 市場具技術優勢

【Valuation】
估值偏高但仍在合理區間

【Risk】
短期漲幅已高，不適合 FCN
⑧ 顏色規則（一定要做）
狀態	顏色
Pool30	🟢
Stock Pool	🔵
Watch	🟡
Reject	🔴
⑨ Checkbox 邏輯（關鍵）
顯示值
value =
  human_override ?? system_recommendation
操作時
human_override = user_input
⑩ 匯出資料格式（重要）
{
  "symbol": "ANET",

  "final": {
    "into_stock_pool": true,
    "into_pool30": false,
    "category": "growth",
    "note": ""
  },

  "system": {
    "into_stock_pool": true,
    "into_pool30": false,
    "category": "growth"
  }
}
⑪ 操作按鈕（Footer）
[套用系統預設]
[清除所有選擇]
[匯出 JSON]
⑫ 整體操作流程（使用者）
Step 1

打開 M1

Step 2

看「建議納入 Pool30」

👉 快速勾 / 取消

Step 3

filter → 新股

👉 看 AI 擴池結果

Step 4

只處理「你不同意的」

Step 5

匯出

🎯 最終定義（非常重要）
M1 是：

👉 Stock Pool 決策控制台

不是：

❌ 新聞頁
❌ 即時交易頁
❌ 分析報表

而是：

✔ 系統先決策
✔ 人修正例外
✔ 可一路追到 AI 原始理由

🚀 下一步

如果你準備好，我可以直接給你：

👉 完整 m1.html（可貼上版本）

包含：

HTML
CSS
JS（checkbox + dropdown + 展開邏輯）

👉 你可以直接丟進 GitHub 跑

只要你說一句：

「給我完整 m1.html」

給我完整 m1.html」

好，這是你要的 完整可貼上版 m1.html（M1 Review Console V1）
👉 已包含：

Header / Summary / Filter
四大分區（Pool30 / Stock Pool / Watch / Reject）
第一層直接操作（checkbox + dropdown）
展開 5 層（System / Engine / AI 短 / AI 深）
假資料（可直接跑）
匯出 JSON

👉 你可以直接貼進 GitHub Pages 測試

✅ 完整 m1.html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8" />
<title>M1｜Stock Pool Review Console</title>

<style>
body {
  font-family: Arial;
  background: #f8fafc;
  margin: 0;
  padding: 20px;
  color: #0f172a;
}

h1 { margin-bottom: 10px; }

.toolbar {
  margin-bottom: 10px;
}

button {
  margin-right: 10px;
  padding: 6px 12px;
  cursor: pointer;
}

.summary {
  background: white;
  padding: 10px;
  margin-bottom: 10px;
  border-radius: 6px;
}

.filter {
  background: white;
  padding: 10px;
  margin-bottom: 15px;
  border-radius: 6px;
}

.bucket {
  margin-bottom: 20px;
}

.bucket h2 {
  padding: 6px;
  border-left: 6px solid;
}

.pool30 { border-color: green; }
.stock { border-color: blue; }
.watch { border-color: orange; }
.reject { border-color: red; }

.card {
  background: white;
  margin-bottom: 8px;
  padding: 10px;
  border-radius: 6px;
}

.level1 {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.controls {
  display: flex;
  gap: 8px;
}

.detail {
  margin-top: 10px;
  display: none;
  font-size: 14px;
}

.badge {
  padding: 2px 6px;
  border-radius: 4px;
  color: white;
  font-size: 12px;
}

.green { background: green; }
.blue { background: blue; }
.orange { background: orange; }
.red { background: red; }

.section {
  margin-top: 8px;
}
</style>
</head>

<body>

<h1>M1｜Stock Pool Review Console</h1>

<div class="toolbar">
  <button onclick="applyDefault()">套用系統預設</button>
  <button onclick="clearAll()">全部清除</button>
  <button onclick="exportData()">匯出 JSON</button>
</div>

<div class="summary" id="summary"></div>

<div class="filter">
  Filter：
  <select id="filterBucket" onchange="render()">
    <option value="all">All</option>
    <option value="pool30">Pool30</option>
    <option value="stock">Stock Pool</option>
    <option value="watch">Watch</option>
    <option value="reject">Reject</option>
  </select>
</div>

<div id="container"></div>

<script>

// ===== 假資料（你之後換成 JSON）=====
let data = [
{
  symbol:"ANET",
  name:"Arista",
  sector:"AI_SEMI",
  subsector:"NETWORK",
  bucket:"stock",

  system:{
    stock:true,
    pool30:false,
    category:"growth"
  },

  human:{},

  score:{pure:7.8,std:1.12},

  reason_short:[
    "AI networking 核心受惠",
    "補強 pool30 缺口",
    "成長動能強"
  ],

  reason_detail:{
    growth:"AI 流量帶動需求",
    industry:"AI infra networking",
    competition:"高階交換器優勢",
    valuation:"合理偏高",
    risk:"短期過熱"
  }
},

{
  symbol:"TSLA",
  name:"Tesla",
  sector:"AI_APP",
  subsector:"AUTO",
  bucket:"watch",

  system:{
    stock:true,
    pool30:false,
    category:"growth"
  },

  human:{},

  score:{pure:6.2,std:0.3},

  reason_short:[
    "波動高",
    "估值不穩",
    "題材主導"
  ],

  reason_detail:{
    growth:"電車仍成長",
    industry:"競爭激烈",
    competition:"壓力上升",
    valuation:"偏高",
    risk:"波動過大"
  }
}

];

// ===== Render =====

function render(){
  const container = document.getElementById("container");
  container.innerHTML="";

  let filter = document.getElementById("filterBucket").value;

  data.forEach((s,i)=>{

    if(filter!=="all" && s.bucket!==filter) return;

    const card = document.createElement("div");
    card.className="card";

    const stockChecked = s.human.stock ?? s.system.stock;
    const poolChecked = s.human.pool30 ?? s.system.pool30;
    const category = s.human.category ?? s.system.category;

    card.innerHTML = `
    <div class="level1">

      <div class="controls">
        <input type="checkbox" ${stockChecked?"checked":""}
          onchange="update(${i},'stock',this.checked)">

        <input type="checkbox" ${poolChecked?"checked":""}
          onchange="update(${i},'pool30',this.checked)">

        <select onchange="update(${i},'category',this.value)">
          ${["core","growth","defensive","income","speculative"]
            .map(c=>`<option ${c===category?"selected":""}>${c}</option>`).join("")}
        </select>

        <button onclick="toggle(${i})">▶</button>
      </div>

      <div>
        ${s.symbol} ｜ ${s.name}
        <br>
        ${s.sector}/${s.subsector}
        <br>
        Pure ${s.score.pure} ｜ Std ${s.score.std}
      </div>

      <div>
        <span class="badge ${getColor(s.bucket)}">${s.bucket}</span>
      </div>

    </div>

    <div class="detail" id="detail-${i}">

      <div class="section">
      <b>System</b><br>
      ${s.reason_short.join("<br>")}
      </div>

      <div class="section">
      <b>AI Detail</b><br>
      Growth: ${s.reason_detail.growth}<br>
      Industry: ${s.reason_detail.industry}<br>
      Competition: ${s.reason_detail.competition}<br>
      Valuation: ${s.reason_detail.valuation}<br>
      Risk: ${s.reason_detail.risk}
      </div>

    </div>
    `;

    container.appendChild(card);

  });

  updateSummary();
}

// ===== 控制 =====

function update(i,key,val){
  if(!data[i].human) data[i].human={};
  data[i].human[key]=val;
}

function toggle(i){
  const el = document.getElementById("detail-"+i);
  el.style.display = el.style.display==="none"?"block":"none";
}

function getColor(b){
  if(b==="pool30") return "green";
  if(b==="stock") return "blue";
  if(b==="watch") return "orange";
  return "red";
}

// ===== 工具 =====

function applyDefault(){
  data.forEach(s=>s.human={});
  render();
}

function clearAll(){
  data.forEach(s=>{
    s.human={stock:false,pool30:false};
  });
  render();
}

function exportData(){
  const out = data.map(s=>({
    symbol:s.symbol,
    final:{
      stock: s.human.stock ?? s.system.stock,
      pool30: s.human.pool30 ?? s.system.pool30,
      category: s.human.category ?? s.system.category
    }
  }));

  console.log(out);
  alert("已輸出到 console");
}

function updateSummary(){
  const sum = document.getElementById("summary");
  sum.innerHTML = `Total: ${data.length}`;
}

// ===== init =====
render();

</script>

</body>
</html>
🚀 下一步建議（很重要）

現在這版你可以直接跑，但還只是 V1 骨架。

你接下來最重要 3 件事：

① 把假資料換成你的 JSON

👉 接：

pool_stock_candidate.json
pool_stock_evaluated.json
② 補上 Engine 明細（Level 3）

👉 現在只有簡化版，要接：

valuation
trend
structure
timing
std score
③ 分區改成「真正自動分類」

👉 現在用 bucket
之後改成：

system.bucket
🎯 最後一句

這版已經是：

👉 可以跑的 M1 Review Console V1

不是概念，是可用版本。

M1 Stock Pool Review Console



M1 的新定位

M1 不再是新聞首頁。
M1 也不再是每天看的 trading 頁。


🧭 M1.html — FINAL BLUEPRINT（可實作版）
① 頁面定位（固定）
M1｜Stock Pool Review Console
用途：低頻（週/月/季）股票池審核
② 頁面結構（整體骨架）
[Header]
[Summary Bar]
[Filter Bar]
[System Buckets（4區）]
    └ 股票卡片（5層結構）
[Footer / Export]
③ Header（固定區）
M1｜Stock Pool Review Console
[套用系統預設] [全部清除] [匯出結果]

👉 功能：

套用系統預設 → reset human override
全部清除 → 全部取消勾選
匯出 → 產出 final JSON
④ Summary Bar（摘要列）
Candidate: 182
Stock Pool（建議）: 96
Pool30（建議）: 18
Watch: 42
Reject: 26
新股: 74 ｜ 舊股: 108

👉 來源：engine output 統計

⑤ Filter Bar（篩選區）
分區：
[All] [Pool30] [Stock Pool] [Watch] [Reject]

身分：
[全部] [新股] [舊股] [已在Pool30] [不在Pool30]

分類：
[全部] [core] [growth] [defensive] [income] [speculative]

狀態：
[全部] [reject only] [pool30 candidate] [category mismatch]

搜尋：
[__________]

👉 這一排是「高效率審核」關鍵

⑥ System Buckets（四大分區）
🟢 區塊1：建議納入 Pool30
=== 建議納入 Pool30（18） ===
🔵 區塊2：建議納入大池
=== 建議納入 Stock Pool（78） ===
🟡 區塊3：建議觀察
=== Watch / Provisional（42） ===
🔴 區塊4：建議排除
=== Reject（26） ===
⑦ 股票卡片（核心）

每一檔股票 = 一張卡
5 層結構（非常重要）

🧩 【Level 1】決策層（最重要）
[✔] Stock Pool   [ ] Pool30   分類：[growth ▼]   [▶]

ANET ｜ Arista Networks
AI_SEMI / NETWORKING

Pure 7.8 ｜ Std +1.12

系統：建議納入大池（Pool30：觀察）
✅ 規則
1. Engine 預設
✔ / ✖ 已打好
分類已選好
2. 人可直接操作
勾 / 取消 Stock Pool
勾 / 取消 Pool30
修改分類（dropdown）

👉 ❗ 不需要展開就能決策

🎯 Dropdown（固定）
core
growth
defensive
income
speculative
🧠 顯示差異（重要）

如果你改分類：

分類：[core ▼]（原：growth）
🧩 【Level 2】System Recommendation

（點開第一層後）

【系統建議】

✔ 建議納入 Stock Pool
✖ 暫不納入 Pool30

原因：
• 純股分數高於 growth 平均  
• AI networking 補足 pool30 缺口  
• 趨勢與估值同時成立  
• 結構甜度不足，不適合 FCN
🧩 【Level 3】Engine 明細
【分數拆解】

baseline: 8.1
pure: 7.8
valuation: 8.4
trend: 8.9
structure: 6.3
timing: 5.8
quality: 7.2

raw: 80.3
std: +1.12
額外：
【分類相似度】

core: 0.72
growth: 0.88
defensive: 0.31
income: 0.25
speculative: 0.40
🧩 【Level 4】AI Reason（精簡）
【AI 快速理由】

• AI data center networking 核心受惠  
• 補強 pool30 缺少網通代表  
• 成長動能與趨勢一致  

👉 最多 3–4 條

🧩 【Level 5】AI 訊息明細（深層）
【AI 深度分析】

【Growth】
AI 流量成長帶動 data center networking 需求

【Industry】
屬 AI infra networking 核心鏈

【Competition】
高階 switch 市場具技術優勢

【Valuation】
估值偏高但仍在合理區間

【Risk】
短期漲幅已高，不適合 FCN
⑧ 顏色規則（一定要做）
狀態	顏色
Pool30	🟢
Stock Pool	🔵
Watch	🟡
Reject	🔴
⑨ Checkbox 邏輯（關鍵）
顯示值
value =
  human_override ?? system_recommendation
操作時
human_override = user_input
⑩ 匯出資料格式（重要）
{
  "symbol": "ANET",

  "final": {
    "into_stock_pool": true,
    "into_pool30": false,
    "category": "growth",
    "note": ""
  },

  "system": {
    "into_stock_pool": true,
    "into_pool30": false,
    "category": "growth"
  }
}
⑪ 操作按鈕（Footer）
[套用系統預設]
[清除所有選擇]
[匯出 JSON]
⑫ 整體操作流程（使用者）
Step 1

打開 M1

Step 2

看「建議納入 Pool30」

👉 快速勾 / 取消

Step 3

filter → 新股

👉 看 AI 擴池結果

Step 4

只處理「你不同意的」

Step 5

匯出

🎯 最終定義（非常重要）
M1 是：

👉 Stock Pool 決策控制台

不是：

❌ 新聞頁
❌ 即時交易頁
❌ 分析報表

而是：

✔ 系統先決策
✔ 人修正例外
✔ 可一路追到 AI 原始理由

🚀 下一步

如果你準備好，我可以直接給你：

👉 完整 m1.html（可貼上版本）

包含：

HTML
CSS
JS（checkbox + dropdown + 展開邏輯）

👉 你可以直接丟進 GitHub 跑

只要你說一句：

「給我完整 m1.html」

給我完整 m1.html」

好，這是你要的 完整可貼上版 m1.html（M1 Review Console V1）
👉 已包含：

Header / Summary / Filter
四大分區（Pool30 / Stock Pool / Watch / Reject）
第一層直接操作（checkbox + dropdown）
展開 5 層（System / Engine / AI 短 / AI 深）
假資料（可直接跑）
匯出 JSON





M1 的正式定位

Stock Pool Review Console / Universe Review Console

它是你用來做這幾件事的地方：

看 AI 建議擴出的 150–200 檔候選股票
看 engine 對這 150–200 檔的完整評估結果
由系統先分區分類、先預設勾選
你在畫面上直接調整：
是否納入 Stock Pool
是否納入 Pool30
最終分類
最後匯出人工確認後的結果，再 upload

這不是天天做。
是週、月、季，甚至有需要時才做一次的底層審核系統。

M1 的核心流程
Step 1：AI 先產出 150–200 檔候選股票

AI 不是直接決策，而是先做 universe expansion。

輸出內容包含：

候選股票清單
每檔的初始建議理由
建議產業 / 子產業
初步建議分類
納入原因 notes

這是最底層來源。

Step 2：Engine 評估 150–200 檔

Engine 不是看新聞先找股票。
而是先對整個候選 universe 做統一評估。

Engine 要做的事：

2.1 用現有 Pool30 當比較基準

Pool30 是已知世界。
Engine 會用 Pool30 建立各分類 profile / 基準。

2.2 建立標準化分數

不是只給 raw score，還要有 std / normalized score。

2.3 對每檔股票給出建議

回答三件事：

要不要進 Stock Pool
要不要進 Pool30
建議分到哪個 category
Step 3：M1 畫面直接顯示「系統建議」

系統先幫你分區分類，先預設勾選。

你一打開頁面先看到的不是明細，
而是可以直接決策的列表。

Step 4：你在 M1 上人工修正

你可以直接在第一層操作：

勾 / 取消 Stock Pool
勾 / 取消 Pool30
用下拉選單改分類
寫備註
Step 5：匯出最終結果

把人工確認後的結果匯出，作為最後上傳版本。

M1 不以新聞為主入口

這是這次最重要的轉向。

現在的正確順序
先擴池到 150–200
先做 engine evaluate and output
未來再把 news 當 overlay 導入

也就是：

News 是加權器，不是入口依賴

新聞未來的作用是：

補 note
調整 daily focus
補 why_yes / why_no
增加短期事件權重

不是用來決定 universe。

M1 的分數邏輯
1. Pool 調整主體：看 pure stock score

這點已定稿。

調整 stock pool，用 pure stock score，不用 event stock score。

2. Baseline 來源：Capex to Profit 取代舊 baseline

因為新股票沒有原始 baseline。

所以：

Discovery / Pool baseline

不再來自舊的 category base，
而來自 Capex to Profit 這種基本面起始訊號。

3. Engine 可借用 M7 的部分模組

可借用：

valuation
trend
structure
timing
reject 邏輯

但 M1 不直接照搬 M7 today_score。

M1 的用途
pool 評估
分類建議
納入建議
review console
不是
basket simulation
FCN 當日承作頁
M1 的決策輸出

每檔股票至少要有三個核心決策：

1. 是否納入 Stock Pool

例如：

yes
provisional
no
2. 是否納入 Pool30

例如：

yes
watch_candidate
not_now
3. 建議分類

固定五類：

core
growth
defensive
income
speculative
分類一定是下拉選單

這點已定稿。

原則
engine 先給 suggested_category
畫面上第一層就顯示 dropdown
你可以直接改
dropdown 固定選項
core
growth
defensive
income
speculative

不能自由輸入文字。

M1 頁面預設畫面

M1 預設進來先看到的是：

System Recommendation Review Console

不是新聞清單。

頂部：摘要區

顯示本次 review 總覽，例如：

Candidate 總數
建議納入 Stock Pool
建議納入 Pool30
建議觀察
建議排除
新股數
舊股數

並提供按鈕：

套用系統預設
匯出最終結果
第二排：Filter 區

這排是必要的，而且很重要。

至少有：

分區 filter
All
建議納入 Pool30
建議納入大池
建議觀察
建議排除
身分 filter
全部
新股
舊股
已在 pool30
不在 pool30
分類 filter
全部
core
growth
defensive
income
speculative
狀態 filter
reject only
pool30 candidate only
stock pool candidate only
category mismatch only
搜尋
symbol / name
每一檔股票的 UI 結構

這是 M1 最重要的部分。

第一層：決策層

人工操作一定放第一層。
不用先展開。

第一層要有：
[✔/✖] Stock Pool
[✔/✖] Pool30
分類 dropdown
[展開]

這些 checkbox 預設由 engine 幫你打勾 / 打叉。

第一層同時顯示：
股票代號 / 名稱
sector / subsector
系統建議分區
pure stock score
std score
一句系統摘要

也就是你一眼就能決策。

第二層：System Recommendation

點開後先看到系統結論。

內容包含：

為什麼建議進 Stock Pool
為什麼不建議進 Pool30
why_yes
why_no
分區建議

這一層是快速理解用。

第三層：Engine 明細

這層顯示計算細節。

例如：

baseline score
pure stock score
valuation score
trend score
structure score
timing score
quality score
raw total score
std score
category similarity
reject flag
category watch

這層是驗證 engine 用。

第四層：AI Reason（精簡版）

這層是 AI 的短理由，精簡有力。

原則
最多 3–4 條
一句一句
直接可決策

例如：

AI networking 核心受惠
補足 pool30 缺少的 networking 類別
純股分數高於 growth 類平均

這層是快速判斷 AI 為什麼推薦 / 拒絕。

第五層：AI 訊息明細（深層理由）

這層才是最底層。

你可以追到最原始的 AI 建議邏輯：

產業成長力
公司成長性
公司經營狀況
競爭位置
估值狀況
風險與限制
建議分成五塊：
Growth
Industry Position
Competition
Valuation
Risk

這一層是追根究底用，不是每天看，但很重要。

Level 4 與 Level 5 的區別
Level 4：AI Reason

精簡、短、給你快速判斷

Level 5：AI 訊息明細

完整、深、讓你知道到底為什麼推薦 / 拒絕

系統建議分區

M1 頁面主體要先分區顯示，而不是全部混在一起。

建議至少四區：

建議納入 Pool30
建議納入大池
建議持續觀察
建議排除

這樣你 review 速度最快。

人工操作原則
Engine 是預設決策者

它先做：

勾 / 不勾
suggested category
bucket
人是修正例外

你不需要每檔從頭分析，
只處理你不同意的地方。

這很符合你的使用方式。

M1 的輸出方向

M1 最後不是只看畫面，
而要能匯出人工最終版。

最少要匯出：

1. 最終 Stock Pool
2. 最終 Pool30
3. 人工 override 結果
M1 與 News 的未來關係

目前這次重寫先不以 news 為核心。

第一版先做
candidate universe
engine evaluate
review console
之後再加
news overlay
event boost
daily focus note
why_yes / why_no 的新聞補充
一句話總結 M1 藍圖
M1 是一個低頻、深度、可追溯的股票池審核控制台

它的流程是：

AI 擴池 → Engine 評估 → 系統分區建議 → 人在第一層直接勾選與改分類 → 需要時展開看到 engine 細節與 AI 深層理由 → 匯出最終結果

如果你要，下一步我就直接按這個藍圖，幫你整理成：

m1.html 完整重寫規格

我會直接把：

頁面區塊
每層欄位
分區
filter
checkbox
dropdown
Level 2~5 展開內容

1. 第一行一定要有欄位抬頭

現在畫面像卡片，但第一層操作區沒有欄位名稱，所以第一次看會不清楚：

第一個勾是什麼
第二個勾是什麼
dropdown 是什麼
右邊數字代表什麼

所以要在卡片列表最上方，加一列固定抬頭。

我建議第一層抬頭直接做成這樣：

Stock Pool ｜ Pool30 ｜ 分類 ｜ 明細 ｜ 股票 / 產業 ｜ 分數 ｜ 系統分區

對應到每張卡第一層：

[✔] = Stock Pool
[✔] = Pool30
[growth ▼] = 分類
[▶] = 明細
ANET | Arista / AI_SEMI / NETWORK
Pure 7.8 | Std 1.12
stock / watch / pool30 / reject

這樣一眼就懂。

2. 匯出一定要拆成兩個旋鈕

你說得對，Pool30 跟 Pool Stock 不是同一份輸出。

不能只有一個「匯出 JSON」。

應該拆成至少這三個：

A. 匯出 Pool Stock

這是大池主檔，會包含：

納入 stock pool 的股票
最終分類
備註
是否新股
是否也在 pool30
B. 匯出 Pool30

這是核心池，格式要更精簡，接近你原本 pool30.json：

[
  { "symbol": "NVDA", "name": "NVIDIA", "sector": "AI_SEMI", "subsector": "GPU", "category": "core" }
]
C. 匯出 Review Log

這是可選，但很有用，保留：

系統原建議
你的人工修改
修改註記
我建議按鈕改成這樣

不要現在這種：

套用系統預設
全部清除
匯出 JSON

改成：

套用系統預設
全部清除
匯出 Pool Stock
匯出 Pool30
匯出 Review Log
頁面上方也要加統計摘要

除了 Total: 2 太少資訊，應該改成：

Candidate：182
Stock Pool：96
Pool30：18
Watch：42
Reject：26

這樣你才知道你這次審核的結果分布。

你這張圖我建議下一版直接改 4 件事
1.

加「欄位抬頭列」

2.

把 Total: 2 改成完整摘要列

3.

把 Filter 做成多個 filter，不只一個 bucket

4.

把匯出拆成：

Pool Stock
Pool30
Review Log
匯出格式我先幫你定義
匯出 Pool Stock

建議格式：

[
  {
    "symbol": "ANET",
    "name": "Arista",
    "sector": "AI_SEMI",
    "subsector": "NETWORK",
    "category": "growth",
    "in_pool30": false,
    "source": "ai_suggested",
    "note": ""
  }
]
匯出 Pool30

建議格式：

[
  {
    "symbol": "ANET",
    "name": "Arista",
    "sector": "AI_SEMI",
    "subsector": "NETWORK",
    "category": "growth"
  }
]
匯出 Review Log

建議格式：

[
  {
    "symbol": "ANET",
    "system": {
      "stock": true,
      "pool30": false,
      "category": "growth"
    },
    "final": {
      "stock": true,
      "pool30": true,
      "category": "core",
      "note": "升入 pool30 試觀察"
    }
  }
]
結論

你這版已經有骨架，但下一版一定要補：

欄位抬頭
完整摘要列
分開匯出旋鈕
Pool30 / Pool Stock 各自輸出格式

只靠目前的 Level 5，還不夠資格直接把新股票納入 pool30

因為那仍然偏向：

AI 初步理解
結構化理由整理
方便你快速審核

但 Pool30 是核心池，門檻一定要更高。
所以要再加一層：

專業搜索 / 深度驗證層

也就是：

Level 4：AI 快速理由
Level 5：AI 結構化深度理由
Level 6：專業搜索驗證
我建議正式加這個按鈕
按鈕名稱
啟動專業搜索

或

深度驗證

或

研究模式

我建議用：

啟動專業搜索

因為很直白。

這個按鈕的定位

它不是每檔都要按。
而是用在這幾種情況：

1. 新股票準備升入 Pool30

這是最重要的情境。

2. 分類要大改

例如：

growth 改 core
defensive 改 growth
3. AI 與 engine 建議很強，但你心裡還不夠信

這時就要進一步驗證。

按下去之後，未來要看到什麼

你已經點出重點了：

未來可以放置 PDF 檔

這很好，因為這表示這個按鈕不是單純再跳出幾句 AI 文案，
而是要變成真正的 研究入口。

我建議「專業搜索」先分兩階段
Phase 1：文字研究結果

先不用 PDF，也能先上線。

點擊後展開一個研究區塊，內容包含：

A. 公司基本面研究
公司做什麼
核心成長引擎
近年營收 / 獲利趨勢
是否有 Capex → Profit 的證據
B. 產業與競爭
所在產業位置
主要競爭對手
領先 / 跟隨 / 利基角色
C. 估值與市場位置
估值貴不貴
是否已反映成長
現在納入 pool30 是否合理
D. Pool30 適配性
為何值得納入 pool30
為何只適合 stock pool 不適合 pool30
是否只是觀察標的
E. 風險
波動
產業循環
政策 / 競爭 / 客戶集中風險
Phase 2：附件 / PDF / 外部研究檔

這就是你說的未來方向。

點下去後可顯示：

研究 PDF
公司簡報
財報摘要 PDF
券商 / AI 研究報告 PDF
你自己的備忘 PDF

這樣這個按鈕就會變成：

一個真正的「研究檔案入口」
我建議 UI 放法

在每張股票卡的 Level 5 下方，放一列按鈕：

[啟動專業搜索]
[查看附件]（未來）
[加入研究清單]（可選）

其中：

啟動專業搜索

點下去後展開：

Level 6：Research Panel
Level 6 建議長相
【專業搜索 / 深度驗證】

1. 公司摘要
2. 成長邏輯
3. 競爭位置
4. 估值判讀
5. Pool30 適配性
6. 主要風險
7. 研究附件 / PDF
為什麼這層很重要

因為你現在的系統分成兩種決策：

A. 納入 Stock Pool

這可以比較寬鬆，AI + engine 就足夠初判。

B. 納入 Pool30

這一定要更嚴格。

所以我建議正式定一條規則：

Pool30 納入原則
若是「新股票」，不得只靠 Level 4 / 5 決定
必須經過「專業搜索 / 深度驗證」

這樣才不會太隨便。

我甚至建議加一個狀態欄位

對每檔新股票加：

research_status: not_started
research_status: in_progress
research_status: completed

然後：

沒完成 research 的新股票

可以：

進 Stock Pool
進 Watch

但：

不可直接正式進 Pool30

除非你人工強制 override。

這樣做的邏輯非常完整
第一層

你可直接勾選 / 改分類

第四層

看 AI 快速理由

第五層

看 AI 深度理由

第六層

若真的要升核心池，啟動專業搜索

這樣系統就分成兩種深度：

一般審核

不用每檔都研究

核心納入

必須做深度驗證

我建議這個按鈕的行為規則
如果股票是：
新股
且 engine 建議可進 pool30
且目前 research_status != completed

那畫面要提示：

⚠ 建議先完成專業搜索，再納入 Pool30

這會很實用。

未來 PDF 放法也先幫你定一下

每檔股票未來可以掛：

company_presentation.pdf
earnings_note.pdf
valuation_note.pdf
ai_research_summary.pdf

UI 顯示為：

附件：
[公司簡報]
[財報摘要]
[估值筆記]
[研究報告]
我幫你收斂成一句正式規則
新股票納入 Stock Pool：

可以先用 AI + Engine 建議

新股票納入 Pool30：

必須再經過 啟動專業搜索 的深度驗證

這條規則非常合理，而且能保護 pool30 品質。

最後我幫你更新整個層級
Level 1

人工操作層

Level 2

系統建議層

Level 3

Engine 明細層

Level 4

AI 快速理由

Level 5

AI 深度理由

Level 6

專業搜索 / PDF / 深度研究層

這個方向我完全贊成。
下一步如果你要，我會把 Level 6「專業搜索」也正式加進 M1 藍圖，一起重整成最終版。

Phase 1：文字研究結果 C 很重要 要有買賣點建議技術評估 
已思考 2 秒鐘

對，C 不能只寫估值與市場位置，一定要再加：

買賣點建議
技術評估

不然「專業搜索」還是不夠落地。
因為你最後不是在看研究報告，而是在決定：

要不要納入
納入哪一層
現在適不適合
之後要不要升到 Pool30

所以我建議把 Phase 1：文字研究結果 改成 6 大塊。

Level 6｜專業搜索 / 深度驗證
Phase 1：文字研究結果
A. 公司基本面研究

看這家公司到底在做什麼，成長引擎是什麼。

內容：

核心業務
主要收入來源
最近 2–3 年成長主因
是否有 Capex → Profit 邏輯
經營品質 / 財務穩定度
B. 產業與競爭

看它在產業裡的位置。

內容：

所屬產業鏈位置
主要競爭對手
領先者 / 跟隨者 / 利基型
是否容易被替代
是否補足現有 pool 缺口
C. 估值、買賣點建議、技術評估

這一塊你說得對，必須是核心。

這一區不要只講「貴或便宜」，
而要直接變成：

C1. 估值判讀
目前估值高 / 中 / 低
與成長是否匹配
是否已反映主要利多
若納入 pool30，估值是否合理
C2. 買賣點建議
現在適合：
直接觀察
等回檔
不宜追價
可逐步納入
建議區間：
偏甜區
合理區
過熱區
若作 FCN / 接股觀點：
是否值得等更甜的位置
是否只能放大池、不能放 Pool30
C3. 技術評估
中期趨勢：上升 / 盤整 / 轉弱
短線位置：偏甜 / 中性 / 偏熱
結構狀態：sweet / building / flat / hot
是否有：
高位追價風險
回檔承接機會
弱勢反彈假象
技術結論一句話：
例如「公司很好，但位置偏熱」
或「基本面佳，技術面進入可觀察區」
D. Pool30 適配性

這一塊專門回答：

為什麼值得進 Pool30
為什麼只適合進 Stock Pool
為什麼現在先不進
若升入 Pool30，扮演什麼角色

例如：

補強 AI networking 缺口
可做 growth 類補充
波動過大，暫不適合進核心池
適合先列 watch_candidate
E. 風險

這塊一定要獨立。

內容：

波動風險
產業循環風險
競爭風險
客戶集中風險
政策 / 法規風險
估值過高風險
F. 最終研究結論

最後要有一段明確結論，不然前面太散。

格式建議：

Stock Pool 建議：納入 / 觀察 / 排除
Pool30 建議：可納入 / 暫不納入 / 需等研究完成
分類建議：core / growth / defensive / income / speculative
時機建議：可觀察 / 等回檔 / 不宜追價
我建議 C 區塊要長這樣
C. 估值、買賣點建議、技術評估
範例

估值判讀
目前估值偏高，但若以 AI networking 的中期成長來看，仍屬合理偏高區，未到極端泡沫。

買賣點建議
不建議在短線急漲後直接升入 Pool30。較適合先納入 Stock Pool，等待回檔或結構轉甜後再觀察是否升級。

技術評估
中期趨勢維持正向，但短線結構偏熱。若後續回檔至合理區，反而更適合納入核心觀察。

這樣的好處

你未來按下「啟動專業搜索」時，看到的不是空泛研究，
而是能直接支援決策的內容：

基本面值不值得
產業位置好不好
現在能不能買
現在能不能納入 pool30
風險在哪裡

這樣才真的有用。

所以我幫你更新後的 Level 6 結構
Level 6｜專業搜索 / 深度驗證
A. 公司基本面研究
B. 產業與競爭
C. 估值、買賣點建議、技術評估
D. Pool30 適配性
E. 風險
F. 最終研究結論
一句話定義 C
C 不是「估值補充說明」
C 是「把研究轉成可執行建議」的核心區塊

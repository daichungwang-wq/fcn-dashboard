請用「M1 L5-A Pro+ 研究卡格式」分析以下公司：

【核心目標】
這是一張「可進系統」的決策卡，不是報告
→ 必須支援：

1. pool30 篩選
2. FCN 可行性
3. timing 判斷

---

# 【🚨硬性規則（違反直接失敗）】

1. 每一段 **至少 1 個具體數值或事實**
   （營收%、客戶占比、PE、成長率、合約年限、毛利率）

2. 禁止空話（例如：強、好、領先）

3. 每一段都要能支持投資決策（不是描述）

4. 不可重複觀點（AI / 成長不能一直講）

5. 必須揭露「負面數據」
   （例如：客戶集中度、估值偏高）

6. 必須用投資人語氣（人話）

7. 輸出必須為 JSON（不能有任何說明文字）

---

# 【📊數值強制規則（這是核心升級）】

## 1️⃣ 每段至少包含一種數據：

* %（例如：AI revenue +40%）
* 金額（例如：營收 500 億）
* 比例（例如：前五大客戶占 40%）
* 時間（例如：合約到 2031）
* 成長率（YoY / QoQ）

👉 沒有數據 = 該段失敗

---

## 2️⃣ financial_summary（強制完整）

必須包含：

* revenue（最新年度或TTM）
* growth（YoY %）
* net margin %
* FCF margin %
* PE（forward or TTM）
* 必須至少 2 個「成長 or 獲利結構數據」

---

## 3️⃣ business_model（數據化）

每個 segment 必須包含：

* 收入占比 % 或
* 成長率 或
* 客戶類型

---

## 4️⃣ customer_analysis（數據化）

必須包含：

* 客戶集中度（%）
* 至少 3 個具名客戶
* 至少 1 個數據（例如訂單規模 / 合約年限）

---

## 5️⃣ competition（數據化比較）

至少 1 個比較數據：

* PE 差異
* 毛利率差
* 市占

---

## 6️⃣ market_view（數據支撐）

必須包含：

* 市場在 pricing（例如：AI 成長 >30%）
* 市場在擔心（例如：capex 成長放緩）

---

## 7️⃣ valuation_and_timing（數值決策）

必須包含：

* 當前 PE / EV
* 歷史區間比較（高 / 低）
* sweet zone（明確數字或條件）

---

## 8️⃣ risk_opportunity（數據化）

每個 risk / opportunity 至少包含：

* 數值 或
* 可量化事件

---

# 【📦輸出格式（不可更動）】

{
"XXX": {
"symbol": "XXX",
"name": "公司名稱",
"type": "research_raw",

```
"company_overview": "...",

"basic_info": {
  "founded": "...",
  "headquarters": "...",
  "industry": "...",
  "market_cap": "..."
},

"business_model": {
  "summary": "...",
  "segments": [
    "...（含數據）",
    "...",
    "..."
  ]
},

"customer_analysis": {
  "summary": "...（含集中度數據）",
  "key_customers": [
    {
      "name": "...",
      "role": "...",
      "importance": "...（含數據）"
    }
  ],
  "conclusion": "..."
},

"why_this_company": [
  "...（含數據）",
  "...",
  "..."
],

"market_view": "...（必須有數據）",

"financial_summary": {
  "revenue": "...",
  "growth": "...",
  "net_margin": "...",
  "fcf_margin": "...",
  "eps": "...",
  "pe": "...",
  "dividend_yield": "...",
  "beta": "..."
},

"competition": {
  "summary": "...",
  "peers": [
    {
      "name": "...",
      "position": "...",
      "comparison": "...（含數據）"
    }
  ],
  "conclusion": "..."
},

"valuation_and_timing": {
  "valuation_view": "...（含PE/區間）",
  "buy_strategy": "...",
  "sweet_zone": "...（明確數值）",
  "technical_view": {
    "mid_trend": "...",
    "short_term": "...",
    "structure": "...",
    "conclusion": "..."
  }
},

"pool30_fit": {
  "stock_pool": true,
  "pool30": false,
  "category": "core",
  "reason": "...",
  "upgrade_condition": [
    "...",
    "..."
  ]
},

"risk_opportunity": {
  "risk": [
    "...（含數據）",
    "..."
  ],
  "opportunity": [
    "...（含數據）",
    "..."
  ]
},

"final_view": "..."
```

}
}

---

# 【📊Quality Check（強制升級）】

{
"quality_check": {
"completeness": 0-10,
"specificity": 0-10,
"data_support": 0-10,
"decision_usefulness": 0-10,
"fcn_alignment": 0-10,
"total_score": 0-10,
"fail_reasons": []
}
}

---

# 【🚨AI內部檢查（必須執行）】

如果出現以下情況 → 自動重寫：

* 任一段沒有數據 ❌
* 出現「強 / 成長 / 領先」但沒有證據 ❌
* valuation 沒有明確行動 ❌
* risk 太抽象 ❌

---

# 【核心原則（最重要一句）】

👉 沒有數據的觀點 = 無效觀點
👉 沒有風險的公司 = 沒分析

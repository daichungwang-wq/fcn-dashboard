# 振宇 FCN 系統｜M1 News Runtime 輸出格式規格 V1

一、目的  
M1 負責將新聞轉為可量化事件資料，提供 M2 / M3 使用。

M1 功能：
1. 收集新聞  
2. 分類（Macro / Industry / Market）  
3. 設定 SID score  
4. 做 mapping  
5. 產生 impact_map  
6. 彙總 stock_event_map  

---

二、輸出檔案  
data/news_runtime.json  

---

三、整體結構  

{
  "date": "2026-03-25",
  "news_items": [],
  "stock_event_map": {}
}

---

四、單則新聞格式  

{
  "id": "N001",
  "title": "Fed signals rate cuts",
  "summary": "聯準會釋出降息訊號",
  "source": "Reuters",
  "published_at": "2026-03-25T08:00:00Z",

  "type": "macro",
  "subtype": "利率下降",

  "sid_label": "利多",
  "sid_score": 2,

  "target_mode": "sector",
  "affected_sectors": ["AI_SEMI", "CLOUD_SOFTWARE"],
  "affected_subsectors": [],
  "affected_categories": [],

  "impact_map": {
    "TSM": 1.0,
    "NVDA": 1.5,
    "MSFT": 2.0
  },

  "duration": 7,
  "confidence": 0.8,
  "is_active": true
}

---

五、type 定義  

macro = 總經  
industry = 產業  
market = 市場  

---

六、SID 分數  

強利多 = +3  
利多 = +2  
微利多 = +1  
中性 = 0  
微利空 = -1  
利空 = -2  
強利空 = -3  

---

七、傳導方式  

Macro：
macro_score = SID × sector_weight × 0.5  

Industry：
industry_score = SID  

Market：
market_score = SID × category_rule  

---

八、stock_event_map  

{
  "TSM": {
    "macro_scores": [1.0, -0.5],
    "industry_scores": [2.0],
    "market_scores": [0.5],

    "macro_avg": 0.25,
    "industry_avg": 2.0,
    "market_avg": 0.5,

    "event_raw": 2.75,
    "event_score": 1.1,

    "news_count": 4,
    "active_news_ids": ["N001","N004"]
  }
}

---

九、平均規則  

macro_avg = sum / n  
industry_avg = sum / n  
market_avg = sum / n  

---

十、最終公式  

event_raw = macro_avg + industry_avg + market_avg  

建議版：

event_score =  
0.4 × macro_avg +  
0.3 × industry_avg +  
0.3 × market_avg  

---

十一、核心原則  

1. 所有新聞先轉 SID  
2. 每則新聞必須有 impact_map  
3. M2 / M3 只讀 stock_event_map  
4. 同類新聞先平均  
5. 最後三類再合併  

---

結論  

News → SID → Mapping → impact_map → stock_event_map → M2/M3
## License / 使用限制

This project is proprietary and for personal use only.

You may NOT:
- Copy or redistribute this project
- Use for commercial purposes
- Reproduce the system logic

All rights reserved by Gaya.Wang

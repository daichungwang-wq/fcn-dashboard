Core Philosophy MM (Control Center)
Powerful Engines
Display by Modules
說明：

MM = parameter governance / simulation / blueprint / ops memory Engine = calculation core Display = execution layer 2. Engine Responsibility M1

股票 universe / pool30

M2

FCN 持倉管理

M3

basket simulation

M6

stock execution dashboard

M7

market scoring engine

M8

FCN recommendation engine

MM Dashboard Architecture
A Top Dashboard

B Parameter Brain

C Output Preview

D1 Stocks Display

D2 Blueprint

D3 Ops Memory

Parameter Governance Rules
主參數

次參數

score curve

raw data layer

now/new/delta

Future Roadmap
Phase 1：

what-if simulation

Phase 2：

write-back config

Phase 3：

trigger engine

Phase 4：

regime presets

Phase 5：

auto trading / execution

最終定稿版（MM Portfolio Operating System v1.7 Final）。 這版以你最後修正為準，可直接進 UI implementation。

A. Top Dashboard（上方）

目的：

模組入口 + 各模組統計總覽 A1 模組入口卡

順序：

M1 / M7 / M3 / M6 / M8

每張卡上方：

Go M1 Go M7 Go M3 Go M6 Go M8 A2 該模組統計資料（卡內容） M1 candidate count pool30 count research coverage M7 m7 score mean std cv

valuation mean/std trend mean/std structure mean/std money mean/std coverage warning M3 scenario count qualified count pass rate M6 holding count watch trim add candidate M8 recommended baskets fair rate gap qualified baskets B. Parameter Brain（左側核心）

目的：

調參數

依模組切換：

M1 M7 M3 M6 M8 以 M7 為例 B1 主參數區（預設展開）

標準公式 weight：

項目 weight now weight new valuation trend structure timing money B2 次參數區（預設收合）

依主項目展開：

trend

linear ma200 acceleration

valuation

market multiplier industry multiplier archetype multiplier

future：

structure money B3 Score Curve 區（預設收合） raw value → score

例如：

valuation curve trend curve acceleration curve B4 Raw Data 區（預設收合）

顯示：

資料來源 抓取期間 公式邏輯

例如 trend：

10Y weekly prices MA200 source regression formula annualized formula data source C. Output Preview（右側核心）
B2：Business Assumption Layer

B2 放「可調假設」，也就是 MM brain 要能控制的商業判斷。

Factor	B2 參數
Valuation	base anchor、market multiplier、industry multiplier、archetype multiplier
Trend	linear weight、MA weight、acceleration weight
Structure	allowed models：linear / quadratic / logarithmic on-off
Money	liquidity weight、flow weight、module preset：M1/M7 = 70/30，M6 = 20/80
Timing	timing blend weight：1D / 1W / 1M，或 active scenario 用 d1~d5 short swing
B3：Score Curve Layer

B3 放「raw value 轉分數」的 curve。

Factor	B3 curve
Valuation	valuation gap → score curve
Trend	linear annualized → score、MA annualized → score、acceleration delta → score
Structure	best R² → score curve
Money	liquidity value → score curve、volume ratio / flow position → score curve
Timing	short-term return / swing → timing score curve
各 factor 定稿
1. Valuation

B2：

final_anchor =
base_anchor
× market_multiplier
× industry_multiplier
× archetype_multiplier

B3：

valuation_gap =
forward_pe / final_anchor - 1
valuation_gap → valuation_score

用途：

現在貴不貴
2. Trend

B2：

trend =
linear_weight × linear_score
+ ma_weight × ma_score
+ acceleration_weight × acceleration_score

目前：

linear 0.35
MA 0.50
acceleration 0.15

B3：

linear annualized % → score
MA annualized % → score
acceleration delta % → score

用途：

成長方向與速度
3. Structure

B2：

allowed models:
linear on/off
quadratic on/off
logarithmic on/off

Engine：

best_r2 =
max(allowed model r²)

B3 定稿：

r² < 0.2 → 0
r² = 0.2 → 1
r² = 0.4 → 2
r² = 0.8 → 8
r² = 1.0 → 10

用途：

成長有沒有可辨識軌跡
4. Money

B2：

money =
liquidity_weight × liquidity_score
+ flow_weight × flow_score

Module preset：

M1/M7:
liquidity 70%
flow 30%

M6:
liquidity 20%
flow 80%

Liquidity：

看接股後能不能出手

Flow：

看市場現在重不重視 / 有沒有追逐

B3：

Liquidity curve：

value = avg_dollar_volume

Universe version：

value <= p25 → 3
mean ×0.95 ~ mean ×1.05 → 7
value >= p75 → 10

Pool30 version：

value <= p25 → 5
mean ×0.95 ~ mean ×1.05 → 8
value >= p75 → 10

中間用線性插值。

Flow curve：

volume_ratio / money position → flow_score

用途：

能不能出手 + 市場是否重視
5. Timing

B2：

timing blend weights

正式 M7：

0.45 × 1D
+0.35 × 1W
+0.20 × 1M

Active / M6 可用：

ShortSwing:
d1~d5 weighted

B3：

timing raw return → timing score curve

用途：

現在位置甜不甜 / 是否過熱
最終分層
B2 = 我相信什麼假設
B3 = raw value 怎麼變分數
Engine = 怎麼算 raw value

這樣就定稿。

目的：

即時查看參數變動結果

與左側模組連動。

C1 股票查詢區（右上）

預設： NVDA standard stock

但可搜尋：

NVDA AVGO TSM META ...

所有資訊：

now / new / delta

例如：

score rank valuation trend structure money (data/m7 score 重要value)

C2 Ranking Impact（右中）

顯示：

誰上升 誰下降

包含：

rank now/new score now/new delta D1 Stocks Display（下方最大區）

目的：

完整股票總表

主表：

rank now rank new name price delta % m1 score now m1 score new m7 score now m7 score new category subcategory pool30 推薦 候選 觀察 單一股票展開（全部可收合） L1

M1 資訊

L2

M2 資訊

L3

M7 資訊

L4

M8 資訊

L5

M6 資訊

所有層：

now / new / delta D2 Blueprint

目的：

公式治理

內容：

formula registry parameter blueprint score architecture D3 Ops Memory

目的：

作業記憶

內容：

daily update handoff memory known risks next tasks 全域 UI 規則（最終） 所有大區塊預設收合 所有子區塊可展開/收合 所有 simulation output 統一顯示： now / new / delta

這版正式定稿。

你現在做的已經不是 dashboard：

MM Portfolio Operating System

Current Status M7 parameter simulation = active M1/M3/M6/M8 integration = pending

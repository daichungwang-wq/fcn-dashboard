# FCN Dashboard / MM 系統日常作業流程地圖

更新日期：2026-05-24

這份文件用「日常營運」角度整理 FCN Dashboard / MM 系統，不以工程細節為主。重點是回答：每天或每週要跑哪些程式、哪些 JSON 要維護、資料是誰產生、哪些畫面會使用，以及 MM C1 要如何接 M7 未來價格。

## 一句話總覽

| 資料線 | 主要目的 | 目前自動化狀態 |
| --- | --- | --- |
| 市場行情 runtime | 更新股價、報酬、52W、成交量等每日狀態 | 已有 GitHub Actions 每日自動執行 |
| M1 股票池與候選名單 | 建立 universe、candidate、Pool30 相關資料 | 部分已有 GitHub Actions 每週自動執行 |
| M7 / M8 模型輸出 | 產生 M7 評分、M8 結構模板與批次結果 | 舊 M7/M8 JS 流程已有 Actions；新版 M7 v2 Python 尚未完整接入 |
| AI 研究卡 / Profile | 建立 EPS、公司 profile、競爭卡 | 多數仍是人工或半自動 |
| MM 決策頁 | 整合 M1、M6、M7、M8、FCN pool 到單一操作畫面 | 建置中，C1 應優先接 M7 未來價格 |

## 1. 需要執行的 Python 程式

| 檔名 | 功能 | 會產生哪些 JSON | 建議頻率 | GitHub 是否已自動執行 | 是否適合 GitHub Actions |
| --- | --- | --- | --- | --- | --- |
| `scripts/update_market_runtime.py` | 抓市場行情與價格 runtime | `data/market_runtime.json` | 每日 | 已自動：`daily-runtime-refresh.yml` | 適合，已接 |
| `scripts/update_data.py` | 更新主 dashboard 整體資料 | `data.json` | 每日 | 已自動：`daily-runtime-refresh.yml` | 適合，已接 |
| `scripts/update_m1_universe_runtime.py` | 產生 M1 universe 每檔股票 runtime | `data/m1/m1_market_runtime.json` | 每日 | 已自動：`daily-runtime-refresh.yml` | 適合，已接 |
| `scripts/runtime/build_market_runtime_long_horizon.py` | 建立長週期價格與週線歷史 | `data/runtime_staging/market_runtime_long_horizon.json`、`data/runtime_staging/weekly_price_history.json` | 每週或每日 runtime 後 | 尚未自動 | 適合 |
| `scripts/build_m1_candidate_80.py` | 產生 M1 candidate 80 | `data/m1/m1_candidate_80.json` | 每週 | 已自動：`weekly-m1-rebuild.yml` | 適合，已接 |
| `scripts/build_m1_scores.py` | 產生 MM 用 M1 標準化分數 | `data/m1/m1_scores.json` | 每週，M7 v2 後 | 尚未自動 | 適合 |
| `scripts/m1/build_eps_history.py` | 建立 EPS history | 程式目前輸出 `data/m1/eps_history.json`，但系統目標檔多處使用 `data/m1/eps_history_ai.json` | 每月或研究後 | 尚未自動 | 半自動，需人工審核 |
| `scripts/m1/build_eps_history_nemo3.py` | 建立 AI/Nemo3 EPS 研究資料 | `data/m1/eps_history_ai.json` | 每月或研究後 | 尚未自動 | 不建議完全自動 |
| `scripts/test_nemotron.py` | 產生 Nemo3 股票 profile | `data/m1/m1_stock_profile_nemo3.json` | 新股票研究時 | 尚未自動 | 不建議完全自動 |
| `scripts/new/build_m7_v2_scores.py` | 產生 M7 v2 score、EPS price model、regression fair price、未來價格欄位 | `data/m7_sandbox/m7_v2_scores.json`、`m7_v2_scores_v1.json`、`m7_v2_ab_compare.json`、`m7_v2_run_manifest.json` | 每週或 EPS/runtime 更新後 | 尚未自動 | 適合 |
| `scripts/new/build_m7_formula_input_audit.py` | 檢查 M7 輸入資料完整性 | `data/m7_sandbox/m7_formula_input_audit.json`、`m7_formula_blockers.json` | M7 v2 後 | 尚未自動 | 適合 |
| `scripts/m6/build_price_forecast_debug.py` | 建立 M6 1D / 1W / 1M 短線價格預測 | `data/m6/price_forecast_debug.json` | 每日或每週 | 尚未自動 | 適合 |
| `scripts/update_option_runtime.py` | 抓 option IV、skew、需求、rate pressure | `data/options/option_runtime.json` | 每日或交易日前 | 尚未自動 | 適合，但需監控資料源 |

## 目前 GitHub Actions 狀態

| Workflow | 觸發方式 | 已執行內容 | 目前狀態 | 缺口 |
| --- | --- | --- | --- | --- |
| `.github/workflows/daily-runtime-refresh.yml` | 每日 07:30 台北時間，也可手動 | `update_market_runtime.py`、`update_data.py`、`update_m1_universe_runtime.py` | 已自動 | 沒有跑 long horizon、M6、option runtime |
| `.github/workflows/weekly-m1-rebuild.yml` | 每週日 08:00 台北時間，也可手動 | `build_m1_candidate_80.py`、`scripts/build_m1_pool_output.js`、`js/m1/generate_fundamental.js` | 已自動 | 沒有跑 `build_m1_scores.py` |
| `.github/workflows/m7.yml` | 舊 M7 資料或 JS 變更時，也可手動 | `js/m7/m7_pool_converter.js`、`js/m7/m7_runtime_engine.js` | 已自動，但屬舊 M7 JS 流程 | 沒有跑 `scripts/new/build_m7_v2_scores.py` |
| `.github/workflows/m8.yml` | `data/m7/m7_new_stock_today.json` 或 M8 engine 變更時，也可手動 | `js/m8/m8_engine.js` | 已自動 | 目前只產生 `data/m8/m8_today.json`，尚未涵蓋 MM calibration surface |

## 2. 需要建立或維護的資料檔

| 資料檔 | 用途 | 誰產生 / 維護 | 目前狀態 | 建議維護方式 |
| --- | --- | --- | --- | --- |
| `data/m1/eps_history_ai.json` | EPS history、forward EPS、EPS price model 底稿 | AI 研究卡 / Python / 人工審核 | 需要維護 | 人工研究後更新，不建議無審核自動化 |
| `data/market_runtime.json` | 全系統每日市場價格、報酬、52W、量能 | Python 市場資料抓取 | 已自動 | 每日自動 |
| `data/runtime_staging/market_runtime_long_horizon.json` | 長週期價格參考，支援 M7/M6 regression | Python | 需要補自動化 | 每週或每日自動 |
| `data/runtime_staging/weekly_price_history.json` | 週線價格歷史 | Python / 市場資料抓取 | 需要補自動化 | 每週自動 |
| `data/m7_sandbox/m7_v2_scores.json` | M7 v2 主輸出，含 M7 score、fair price、EPS model price、regression price | Python | 有檔案，但新版 Python 尚未接 Actions | 建議建立 M7 v2 workflow |
| `data/m7_sandbox/m7_v2_scores_v1.json` | M7 v2 debug full 版本 | Python | 有檔案 | 只給檢查用 |
| `data/m7_sandbox/m7_v2_run_manifest.json` | M7 v2 執行紀錄 | Python | 有檔案 | 每次 M7 v2 產生 |
| `data/m7_sandbox/m7_v2_ab_compare.json` | M7 A/B 比較 | Python | 有檔案 | 每次 M7 v2 產生 |
| `data/m1/m1_scores.json` | MM 用 M1 normalized score | Python | 有檔案，尚未自動 | 加入 weekly M1 workflow |
| `data/m1/m1_stock_profile_all.json` | 泛用股票 profile | AI 研究卡 / 人工整理 | 需要人工維護 | 新股票研究完成後更新 |
| `data/m1/m1_stock_profile_nemo3.json` | Nemo3 研究 profile | AI 研究卡 / Python | 需要人工維護 | AI 產生後人工審核 |
| `data/m1/m1_stock_profile.json` | 深度版股票 profile | 人工 / AI 研究卡 | 需要人工維護 | 重點股票才補深度卡 |
| `data/m1/competitive_cards.json` | 競爭力卡片與 competitive score 顯示資料 | 人工 / AI / 腳本 | 需要維護 | 建議統一產生流程 |
| `data/m1/m1_candidate_80.json` | M1 候選 80 檔 | Python | 已自動 | 每週自動 |
| `data/m1/m1_market_runtime.json` | M1 專用行情 runtime | Python 市場資料抓取 | 已自動 | 每日自動 |
| `data/pool30.json` | 核心觀察股票池 | 人工維護 / pipeline 參照 | 需要人工把關 | 人工調整後重新跑 M1/M7 |
| `data/m6/price_forecast_debug.json` | M6 1D / 1W / 1M 短線價格預測 | Python | 尚未自動 | 每日或每週自動 |
| `data/options/option_runtime.json` | option IV、skew、需求、rate pressure | Python 市場資料抓取 | 尚未自動 | 先手動跑穩，再接 Actions |
| `data/fcn_pool.json` | FCN pool 與產品條件 | 人工維護 | 需要人工 | 不建議完全自動 |
| `data/mm/market_fcn_history.json` | 市場 FCN 歷史與情境 | 人工建立 / MM 測試頁輸出 | 需要建立流程 | 先人工維護，再做匯出工具 |
| `data/mm/m8_template_surface.json` | M8 校準頁輸出的 template surface | M8 校準頁輸出 / 人工確認 | 需要建立流程 | 校準頁匯出後人工確認 |
| `data/m8/m8_today.json` | M8 當日輸出 | JS M8 engine / GitHub Actions | 已自動 | 隨舊 M7 流程更新 |
| `data/m8/m8_basket_candidates.json` | M8 basket candidates | M8 / 人工或 pipeline | 需要確認流程 | 納入 M8 workflow 或人工表單 |

## 3. 每個資料檔是誰產生的

| 來源類型 | 代表資料檔 | 說明 |
| --- | --- | --- |
| 人工建立 | `pool30.json`、`fcn_pool.json`、`market_fcn_history.json` | 包含策略、產品條件或市場判斷，不適合完全自動化。 |
| Python 產生 | `m1_candidate_80.json`、`m1_scores.json`、`m7_v2_scores.json`、`price_forecast_debug.json` | 可重複執行，適合接 GitHub Actions。 |
| AI 研究卡產生 | `m1_stock_profile_all.json`、`m1_stock_profile_nemo3.json`、`eps_history_ai.json` | AI 可協助生成，但仍需人工審核。 |
| 市場資料抓取 | `market_runtime.json`、`m1_market_runtime.json`、`weekly_price_history.json`、`option_runtime.json` | 需要每日或每週更新，最適合自動化。 |
| M8 校準頁輸出 | `m8_template_surface.json` | 由校準頁輸出後人工確認再保存。 |

## 4. 哪些畫面使用這些資料

| 畫面 | 用途 | 主要讀取資料 |
| --- | --- | --- |
| `m1.html` | M1 review console、candidate 檢查、EPS coverage、M7n 顯示 | `universe_150.json`、`m1_candidate_80.json`、`pool30.json`、`m1_fundamental_map.json`、`competitive_cards.json`、`m7_v2_scores.json`、`market_runtime.json` |
| `m1_new_stock.html` | 單一股票研究頁 / 決策頁 | `universe_150.json`、`m1_market_runtime.json`、`m1_stock_profile.json`、`m1_stock_profile_all.json`、`m1_stock_profile_nemo3.json`、`m1_candidate_80.json`、`pool30.json`、`m7_v2_scores.json`、`price_forecast_debug.json` |
| `mm/test.html` | MM C1 / 測試 Cockpit | 應讀 `m1_scores.json`、`m7_v2_scores.json`、`price_forecast_debug.json`、`market_runtime.json`、`fcn_pool.json`、profile 相關資料 |
| `mm/engine_progress_dashboard.html` | MM 模組進度與 C1 cockpit 入口 | `data/mm/engine_progress_dashboard.json`，並透過 MM modules 讀其他資料 |
| `m7.html` | 舊 M7 畫面 | `data/m7/m7_new_stock_today.json` |
| `mm/m7.html` | M7 v2 audit / runtime 檢查頁 | `m7_v2_scores.json`、`m7_formula_input_audit.json`、`market_runtime_coverage_report.json`、`market_runtime_long_horizon.json` |
| `m8_batch.html` | M8 batch / FCN template 檢查 | `m8_today.json`、M7/M8/option runtime 相關資料 |
| `mm/formula_test.html` | MM 公式測試頁，測 FCN / M7 / M6 整合 | `market_fcn_history.json`、`fcn_pool.json`、`c1_output.json`、`m7_new_stock_today.json`、`m7_new_stock_pool.json`、`price_forecast_debug.json` |
| `mm/m8_calibration_dashboard_v1.html` | M8 校準頁 | 應輸入或輸出 `m8_template_surface.json` |

## 5. MM 功能建置清單：M7 未來價格放進 C1

MM C1 Single Stock Cockpit 應該讓使用者看到：現在價格、M7 regression fair price、EPS 模型推估的 2026 / 2027 未來價格、M7 score，以及 M6 的 1D / 1W / 1M 短線 forecast。

| 顯示內容 | JSON | 欄位 | fallback |
| --- | --- | --- | --- |
| M7 score | `data/m7_sandbox/m7_v2_scores.json` | `m7_v2_score` | 無值顯示 `N/A` |
| 現在價格 | `data/m7_sandbox/m7_v2_scores.json` | `regression_actual_price_now` | 可 fallback 到 `market_runtime.price_now` |
| M7 回歸合理價 | `data/m7_sandbox/m7_v2_scores.json` | `regression_fair_price_now` | 無值顯示 `N/A` |
| 2026 EPS 模型價格 | `data/m7_sandbox/m7_v2_scores.json` | `eps_price_model_2026` | 無值顯示 `N/A`，前端不要亂算 |
| 2027 EPS 模型價格 | `data/m7_sandbox/m7_v2_scores.json` | `eps_price_model_2027` | 無值顯示 `N/A`，前端不要亂算 |
| M7 fair price 來源 | `data/m7_sandbox/m7_v2_scores.json` | `m7_fair_price_source` 或 `eps_price_model_source` | 無值顯示 `N/A` |
| EPS 模型可信度 | `data/m7_sandbox/m7_v2_scores.json` | `eps_price_model_r2` | 無值顯示 `N/A` |
| M6 1D forecast | `data/m6/price_forecast_debug.json` | `forecast.1d.final.weighted_price_final` | 無值顯示 `N/A` |
| M6 1W forecast | `data/m6/price_forecast_debug.json` | `forecast.1w.final.weighted_price_final` | 無值顯示 `N/A` |
| M6 1M forecast | `data/m6/price_forecast_debug.json` | `forecast.1m.final.weighted_price_final` | 無值顯示 `N/A` |

正式 MM C1 應接在 `js/mm/modules/mm_stock_cockpit.js`。建議新增 `loadM7FuturePriceData()`、`loadM6ForecastData()`、`findBySymbol(raw, symbol)`、`buildFuturePriceView(symbol)`、`warnMissingField(symbol, source, field)`。

畫面建議放在 C1 的「價格 / 估值」區，不放在最上方 L0 price strip，避免即時價格和模型價格混在一起。標題可用 `M7 未來價格 / 回歸合理價`，副標註明 `source: m7_v2_scores.json + price_forecast_debug.json`。

需要新增欄位名稱標準：

| 標準欄位名稱 | 原始來源 |
| --- | --- |
| `current_price` | `market_runtime.price_now`，fallback `m7_v2_scores.regression_actual_price_now` |
| `current_price_source` | `market_runtime.price_source` |
| `m7_score` | `m7_v2_scores.m7_v2_score` |
| `m7_fair_price_now` | `m7_v2_scores.regression_fair_price_now` |
| `m7_actual_price_now` | `m7_v2_scores.regression_actual_price_now` |
| `m7_fair_price_source` | `m7_v2_scores.m7_fair_price_source` |
| `eps_model_price_2026` | `m7_v2_scores.eps_price_model_2026` |
| `eps_model_price_2027` | `m7_v2_scores.eps_price_model_2027` |
| `eps_model_price_source` | `m7_v2_scores.eps_price_model_source` |
| `eps_model_price_r2` | `m7_v2_scores.eps_price_model_r2` |
| `m6_forecast_1d` | `price_forecast_debug.forecast.1d.final.weighted_price_final` |
| `m6_forecast_1w` | `price_forecast_debug.forecast.1w.final.weighted_price_final` |
| `m6_forecast_1m` | `price_forecast_debug.forecast.1m.final.weighted_price_final` |

## 6. 日常作業總表

| 作業名稱 | 執行檔 | 輸出資料 | 使用畫面 | 頻率 | 目前狀態 | 下一步 |
| --- | --- | --- | --- | --- | --- | --- |
| 每日市場行情更新 | `scripts/update_market_runtime.py` | `data/market_runtime.json` | `m1.html`、`m1_new_stock.html`、MM、M7、M8 | 每日 | 已由 GitHub Actions 自動執行 | 持續監控失敗通知 |
| 主 dashboard 資料更新 | `scripts/update_data.py` | `data.json` | 舊 dashboard / 首頁資料 | 每日 | 已由 GitHub Actions 自動執行 | 確認是否仍是必要核心流程 |
| M1 universe runtime 更新 | `scripts/update_m1_universe_runtime.py` | `data/m1/m1_market_runtime.json` | `m1_new_stock.html` | 每日 | 已由 GitHub Actions 自動執行 | 維持 |
| 長週期價格資料更新 | `scripts/runtime/build_market_runtime_long_horizon.py` | `market_runtime_long_horizon.json`、`weekly_price_history.json` | `mm/m7.html`、M7 v2、M6 | 每週或每日 | 尚未自動 | 加入 daily 或 weekly workflow |
| M1 candidate 重建 | `scripts/build_m1_candidate_80.py` | `data/m1/m1_candidate_80.json` | `m1.html`、`m1_new_stock.html` | 每週 | 已由 GitHub Actions 自動執行 | 維持 |
| M1 score 重建 | `scripts/build_m1_scores.py` | `data/m1/m1_scores.json` | MM C1、MM summary | 每週 | 尚未自動 | 加入 weekly M1 workflow |
| EPS history 建立 | `scripts/m1/build_eps_history_nemo3.py` / `scripts/m1/build_eps_history.py` | `eps_history_ai.json` 或 `eps_history.json` | M7 v2、M1 competitive、MM | 每月或研究後 | 半人工 | 統一正式檔名為 `eps_history_ai.json` |
| Nemo3 profile 建立 | `scripts/test_nemotron.py` | `m1_stock_profile_nemo3.json` | `m1_new_stock.html`、MM C1 | 新股票研究時 | 人工 / 半自動 | 建立人工審核流程 |
| M7 v2 score 重建 | `scripts/new/build_m7_v2_scores.py` | `m7_v2_scores.json`、manifest、AB compare | `m1.html`、`m1_new_stock.html`、`mm/m7.html`、MM C1 | 每週或資料更新後 | 尚未自動 | 新增 M7 v2 GitHub Actions |
| M7 input audit | `scripts/new/build_m7_formula_input_audit.py` | `m7_formula_input_audit.json`、`m7_formula_blockers.json` | `mm/m7.html` | 每週或 M7 後 | 尚未自動 | 接在 M7 v2 workflow 後 |
| M6 短線預測 | `scripts/m6/build_price_forecast_debug.py` | `price_forecast_debug.json` | MM C1、`mm/formula_test.html`、`m1_new_stock.html` | 每日或每週 | 尚未自動 | 加入 workflow |
| Option runtime 更新 | `scripts/update_option_runtime.py` | `option_runtime.json` | `m8_batch.html`、M8 / FCN | 每日或交易日前 | 尚未自動 | 先手動跑穩，再接 Actions |
| 舊 M7 JS build | `js/m7/m7_pool_converter.js`、`js/m7/m7_runtime_engine.js` | `m7_new_stock_pool.json`、`m7_new_stock_today.json` | `m7.html`、M8 workflow | 資料變更時 | 已由 GitHub Actions 自動執行 | 判斷是否保留或逐步被 M7 v2 取代 |
| M8 今日輸出 | `js/m8/m8_engine.js` | `m8_today.json` | `m8_batch.html` | M7 舊資料變更時 | 已由 GitHub Actions 自動執行 | 補上 calibration surface 流程 |
| MM C1 接 M7 未來價格 | `js/mm/modules/mm_stock_cockpit.js` | 不直接輸出；讀 `m7_v2_scores.json` 與 `price_forecast_debug.json` | `mm/test.html`、MM C1 | 功能開發 | 建置中 | 建立 `buildFuturePriceView()` 並統一欄位標準 |
| market FCN history 維護 | 人工或未來匯出工具 | `market_fcn_history.json` | `mm/formula_test.html` | 每週或產品檢討後 | 需要建立流程 | 定義欄位格式與匯出方式 |
| M8 template surface 維護 | `mm/m8_calibration_dashboard_v1.html` 匯出 | `m8_template_surface.json` | M8 calibration / M8 batch | 校準後 | 需要建立流程 | 建立匯出、審核、保存規則 |

## 建議下一步

1. 先把 `build_market_runtime_long_horizon.py`、`build_m1_scores.py`、`build_m7_v2_scores.py`、`build_m7_formula_input_audit.py` 接成新的 GitHub Actions 流程。
2. 統一 EPS 檔名：正式流程只使用 `data/m1/eps_history_ai.json`。
3. MM C1 先接 `m7_v2_scores.json` 的 `regression_fair_price_now`、`eps_price_model_2026`、`eps_price_model_2027`，不要在前端自行推算。
4. M6 只顯示 1D / 1W / 1M，不要把它包裝成 2026 / 2027 長期預測。
5. `market_fcn_history.json` 與 `m8_template_surface.json` 需要補欄位規格，之後才能穩定自動化。

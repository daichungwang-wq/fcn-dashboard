# MM Operation Queue Layer v1 設計

建立日期：2026-05-25  
範圍：MM / System Data Pipeline Health / Daily Operation  
階段：detect-only + operation-assist，不自動修復

## 1. 核心目標

System Data Pipeline Health Dashboard v1.1 已經完成：

```text
Detect -> Display
```

MM Operation Queue Layer v1 的下一步是：

```text
Detect -> Prioritize -> Suggest Action -> Human Confirm -> Execute -> Verify
```

目前只做到前四步的輔助：

- 偵測問題
- 排出優先順序
- 建議下一步
- 讓人工確認是否執行

目前不做：

- 不自動修復
- 不自動 rerun scripts
- 不自動 commit / push
- 不自動修改 M1 / M7 / MM engine
- 不修改 `m1_scores.json`
- 不修改 `m7_v2_scores.json`

## 2. 新增檔案

```text
docs/codegraph/mm_operation_queue_design.md
data/mm/mm_operation_queue.json
mm/mm_operation_queue_dashboard.html
```

## 3. Operation Queue 是什麼

Operation Queue 是 MM 的工作派發中心。

它不是修復器，也不是自動化 bot。它的任務是把 health monitor 發現的問題，轉成可以每日執行的人工操作單。

每筆 operation 至少回答：

- 問題是什麼
- 為什麼重要
- 影響哪些檔案或 symbols
- 建議做什麼
- 可能要跑哪個 script
- 修完後要驗證什麼
- 目前狀態是 detected / reviewing / approved / executing / verifying / completed / rejected

## 4. Today Operations

Dashboard 必須顯示：

| 欄位 | 說明 |
| --- | --- |
| `priority` | P0 / P1 / P2 / P3 |
| `issue` | 問題類型 |
| `reason` | 為什麼進 queue |
| `affected_file` | 受影響檔案 |
| `affected_symbols` | 受影響 symbols |
| `suggested_action` | 人工下一步 |
| `suggested_script` | 建議 script，不自動執行 |
| `expected_impact` | 修完預期改善 |
| `verification_target` | 修完後要驗證什麼 |
| `operation_status` | 目前狀態 |

## 5. Priority Levels

### P0

會直接阻斷 daily operation 或正式 judgment 的問題：

- workflow failure
- runtime pipeline broken
- stale runtime causing stale M1 / M7 / MM

### P1

會影響正式 judgment 品質，但未必立刻阻斷系統：

- stale M1 / M7
- missing runtime
- onboarding incomplete

### P2

會造成 coverage 不完整或輔助判斷偏弱：

- missing research card
- missing EPS
- partial coverage
- stale research/profile/competitive cards

### P3

改善可維護性與可追蹤性：

- document updates
- script mapping improvements
- checklist clarification

## 6. Suggested Action Layer

Operation Queue 會把 issue 轉成可以執行的人類語言動作。

範例：

| Issue | Suggested Action |
| --- | --- |
| `workflow_dependency_failure` | fix workflow dependency install |
| `m1_scores_stale` | run `scripts/build_m1_scores.py` |
| `m7_scores_stale` | run `scripts/new/build_m7_v2_scores.py` |
| `new_stock_onboarding_incomplete` | complete M7 + M1 generation |
| `missing_research_card` | update stock profile / research card workflow |
| `missing_script_mapping` | document the producing script or mark manual owner |

## 7. Verification Layer

每筆 operation 必須定義修完後的驗證目標。

範例：

| Operation | Verification Target |
| --- | --- |
| workflow fixed | GitHub Actions success、`market_runtime.json` updated、stale count reduced |
| M1 rerun | symbol appears in `m1_scores.json`、dashboard coverage improved |
| M7 rerun | symbol appears in `m7_v2_scores.json`、M7 freshness no longer stale |
| onboarding completed | universe / candidate / pool / runtime / M1 / M7 coverage aligned |
| mapping documented | `MISSING_SCRIPT_MAPPING` count reduced |

## 8. Human Confirmation

`operation_status` 可用狀態：

| Status | 意義 |
| --- | --- |
| `detected` | 系統發現問題，尚未人工確認 |
| `reviewing` | 人工正在檢查 |
| `approved` | 人工同意執行 |
| `executing` | 人工正在執行 |
| `verifying` | 執行後正在驗證 |
| `completed` | 已完成且驗證通過 |
| `rejected` | 人工判定不處理 |

v1 dashboard 只顯示狀態，不提供自動執行按鈕。

## 9. Queue Ordering

Queue 排序根據：

1. 是否影響正式 judgment
2. 是否影響 runtime freshness
3. 是否影響多模組
4. 是否會造成錯誤 GOOD
5. 是否重複發生

建議 sort score：

```text
priority base
+ formal_judgment_impact
+ runtime_freshness_impact
+ multi_module_impact
+ false_good_risk
+ recurrence_penalty
```

v1 不需要自動重新計算，只要在 JSON 內保留 `sort_score` 與排序理由，讓人工可以觀察。

## 10. Dashboard Summary

Dashboard summary 必須顯示：

- `today_p0_count`
- `today_p1_count`
- `stale_runtime_count`
- `onboarding_incomplete_count`
- `pending_operations`
- `completed_today`

## 11. v1 邊界

MM Operation Queue v1 是工作派發中心，不是自動維修系統。

它的原則是：

```text
先排隊，再確認，再人工執行，再驗證。
```

所有修復動作都必須由人工決定是否執行。系統只負責把下一步講清楚。

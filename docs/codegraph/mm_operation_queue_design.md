# MM System Operations & Evolution Center v1

更新日期：2026-05-25  
範圍：MM system operations / approval lifecycle / execution lifecycle / verification / result feedback  
模式：detect-only + operation-assist + observation-assist + human-in-the-loop lifecycle

## 1. 核心定位

MM System Operations & Evolution Center v1 不是第二個 MM 投資 dashboard，也不是用來直接判斷某張 FCN 單是否要做。

它是：

```text
AI-assisted System Operations Center
```

系統要能從「發現問題」走到「人工核可、執行、驗證、回報」：

```text
Detect -> Analyze -> Recommend -> Human Approve -> Execute -> Verify -> Result Feedback
```

目前仍不做自動修復。v1 只建立 lifecycle、approval flow、execution state、verification state 與 result feedback 的資料結構與 dashboard UI。

## 2. 邊界

目前不做：

- 不做 auto repair。
- 不自動 rerun scripts。
- 不自動 commit / push。
- 不自動修改 M8 / M1 / M7 engine。
- 不修改正式 fair rate。
- 不把 observation 當成正式結論。

目前只做：

- approval lifecycle state
- approval queue UI
- execution status UI
- verification result UI
- result feedback record
- detect-only + operation-assist + observation-assist

## 3. Operation Status

新增完整 operation lifecycle：

| operation_status | 定義 |
| --- | --- |
| `detected` | 系統偵測到問題，尚未人工檢查 |
| `reviewing` | 人工正在檢查是否要處理 |
| `waiting_approval` | 等待人工核可 |
| `approved` | 已核可，尚未執行 |
| `executing` | 人工或未來 automation 正在執行 |
| `verifying` | 執行後正在驗證 |
| `completed` | 完成並通過驗證 |
| `rejected` | 人工拒絕或暫不處理 |
| `observation` | 僅觀察，不進入修復或正式參數修改 |

## 4. Approval & Execution Lifecycle Fields

每筆 operation 新增：

| 欄位 | 說明 |
| --- | --- |
| `approval_required` | 是否需要人工核可 |
| `approved_by` | 核可者 |
| `approved_at` | 核可時間 |
| `execution_started_at` | 執行開始時間 |
| `execution_finished_at` | 執行完成時間 |
| `verification_result` | pending / passed / failed / observation_only / not_started |
| `verification_summary` | 驗證摘要 |
| `result_feedback` | 修復或觀察結果回饋 |
| `estimated_effort_minutes` | 預估人工處理時間 |

## 5. Today Action Center

Top dashboard 不只顯示 issue summary，必須顯示今日 action 狀態：

- Waiting For Approval
- Executing Operations
- Verifying Operations
- Completed Today
- Rejected / Observation Only

目標是讓使用者一打開就知道今天有哪些 operation 正在等人工核可。

## 6. Approval Queue UI

WAITING FOR APPROVAL 每筆 operation 顯示：

- issue
- queue_type
- priority
- reason
- suggested_action
- suggested_script
- estimated_effort
- confidence
- expected_impact
- verification_target

UI 先提供：

```text
[Approve] [Reject] [Observation Only]
```

v1 只做 UI 與 JSON state，不真的執行 script、不寫回狀態。

## 7. Execution Lifecycle UI

Dashboard 顯示：

- EXECUTING OPERATIONS
- VERIFICATION RESULTS

例如 workflow dependency fix 進入 `verifying` 時，verification target 包含：

- GitHub Actions rerun success
- market_runtime updated
- stale count reduced

## 8. Result Feedback Layer

每筆 operation 修完後可記錄 `result_feedback`，例如：

- workflow fixed successfully
- M1 coverage improved from 92% -> 97%
- stale file count reduced from 4 -> 1

這些 feedback 未來會成為 system operations memory，但 v1 不自動用它改參數。

## 9. Queue Type

保留既有 `queue_type`：

| queue_type | 定義 |
| --- | --- |
| `maintenance` | workflow failure、dependency issues、stale M1/M7、stale runtime |
| `onboarding` | new stock onboarding incomplete、missing research card、missing EPS、missing M7/M1 |
| `runtime` | runtime freshness、runtime coverage、workflow monitoring、stale market runtime |
| `observation` | 樣本不足、outcome observation、M8 abnormal but insufficient confidence、template observation only |
| `evolution` | M8 beta evolution candidate、new template split candidate、template premium adjustment observation、market coupon structural drift |

## 10. Observation Boundary

Observation Queue 的目的不是立即修復，而是持續觀察。低 confidence 的 M8 beta、template coupon drift、basket outcome 異常都必須先保持 `operation_status = observation` 或 `verification_result = observation_only`。

Observation 不直接改 beta、premium、fair rate、size 或 engine。

## 11. v1 結論

Approval & Execution Lifecycle Layer 讓 Center 從 issue monitor 進化成：

```text
AI 發現問題 -> 建議處理 -> 等人工核可 -> 執行 -> 驗證 -> 留下結果回饋
```

這是未來 daily operation automation 的前置層。

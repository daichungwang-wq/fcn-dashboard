# MM System Operations & Evolution Center v1

更新日期：2026-05-26  
範圍：MM system operations / local approval lifecycle / global Codex command generation  
模式：detect-only + operation-assist + local-only approval state

## 1. Local Approval State

Dashboard 按鈕只改瀏覽器本機狀態，不修改 GitHub 檔案、不改 JSON、不執行 script。

狀態保存在：

```text
window.localStorage["mm_operation_queue_local_state_v1"]
```

## 2. Button Behavior

### Approve

- `operation_status` 改成 `approved`
- `approved_by` 改成 `manual`
- `approved_at` 改成目前時間
- 從 Waiting For Approval 移出
- 顯示在 Approved / Ready to Execute

### Reject

- `operation_status` 改成 `rejected`
- `verification_result` 改成 `not_started`
- 移到 Rejected / Observation

### Observation Only

- `operation_status` 改成 `observation`
- `verification_result` 改成 `observation_only`
- 移到 Observation

### Reset Local State

清除 localStorage，回到 JSON 原始狀態。

## 3. Global Generate Codex Commands

右上方 toolbar 放置全域按鈕：

```text
[Generate Codex Commands]
```

位置與 `Reload`、`Reset Local State`、`Design Doc`、`Center JSON` 並列。

點擊後掃描目前所有 `operation_status = approved` 的 operations，統一產出一份可複製給 Codex 的 command report，顯示在 modal / textarea 中。

若沒有 approved operation，顯示：

```text
目前沒有已核可 operation。
```

Report 內容包含：

- approved operation count
- 每筆 operation 的：
  - operation id
  - issue
  - priority
  - queue_type
  - affected_file
  - suggested_action
  - suggested_script
  - verification_target
- 固定限制條件：
  - 不要修改 M1/M7/M8 engine
  - 不要修改非授權檔案
  - 不要 merge
  - 完成後回報修改檔案、驗證結果、是否需要進入 verifying

## 4. Guardrails

目前不做：

- 不自動 rerun script。
- 不自動 commit / push。
- 不修改 GitHub 檔案。
- 不改 engine。
- 不修改正式 fair rate。

UI 必須明確提示：目前只是 local approval 與 command generation，不會真的執行 script。

# M1 Deep Research Card Backfill Workflow v1.1

## 目的

`op-20260525-003` 不應該只是一次性的 `m1_stock_profile.json` refresh。它要變成一個每日可重複的 deep research card backfill 流程，用來逐步補齊 M1 股票的深度研究卡。

v1.1 的重點是先做 coverage verification，再產生 queue。也就是先確認股票是否真的已經存在於 deep profile，避免把已經有資料的股票重複派工。

## 核心規則

深度研究卡優先：

- 若 symbol 已存在於 `data/m1/m1_stock_profile.json` 的頂層 key，或 entry 內的 `symbol` / `ticker` 欄位，視為 deep research card coverage 已通過。
- `data/m1/m1_stock_profile_all.json` 只作為 legacy fallback。
- 內文提到某家公司名稱不等於該家公司已有 deep profile。
- 不為了 coverage 目的自動新增 generic card。
- 不自動產生或捏造研究內容。

## v1.1 範圍

目前只做：

- 每日選出下一批最多 5 檔需要 deep research card 的股票。
- 依照 pool30、candidate80、universe150 的優先順序排序。
- 產生 coverage verification。
- 產生 backfill diagnostic report。
- 讓人工知道今天該補哪 5 檔。

目前不做：

- 不自動改 `m1_stock_profile.json`
- 不自動寫研究內容
- 不修改 M1/M7/M8 engine
- 不移除既有 generic card

## Coverage Verification

每檔股票會輸出：

- `in_pool30`
- `in_candidate80`
- `in_universe150`
- `in_m1_stock_profile`
- `in_m1_stock_profile_all`
- `coverage_status`
- `queue_eligible`
- `skip_reason`

`queue_eligible` 只有在 `in_m1_stock_profile=false` 時才可能是 `true`。

## Coverage Status

- `deep_profile_exists`：已存在於 `m1_stock_profile.json`，不派工。
- `legacy_fallback_only`：只存在於 `m1_stock_profile_all.json`，可列入 deep card backfill queue。
- `missing_deep_card`：deep profile 與 generic fallback 都沒有，優先補。

## Priority Order

Backfill queue 依序檢查：

1. `data/pool30.json`
2. `data/m1/m1_candidate_80.json`
3. `data/m1/universe_150.json`
4. legacy 或 optional names 之後再納入

## Script

```bash
python scripts/m1/build_deep_research_card_backfill_queue.py --limit 5
```

可指定來源檔：

```bash
python scripts/m1/build_deep_research_card_backfill_queue.py \
  --limit 5 \
  --deep-profile data/m1/m1_stock_profile.json
```

輸出：

```text
data/m1/m1_deep_research_card_backfill_report.json
```

Report 會包含：

- missing deep card count
- legacy fallback only count
- covered by deep card count
- coverage verification
- next 5-symbol queue
- skipped reason
- all missing deep card list

## Daily Workflow

GitHub Actions workflow：

```text
.github/workflows/m1-deep-research-card-backfill.yml
```

執行頻率：

```text
Daily 08:20 Asia/Taipei
```

此 workflow 只會產生或更新 diagnostic report，不會自動寫入 `m1_stock_profile.json`。

## Validation Logic

Coverage 判定順序：

1. Deep card exists in `data/m1/m1_stock_profile.json` -> PASS
2. Else generic card exists in `data/m1/m1_stock_profile_all.json` -> legacy fallback only
3. Else mark missing deep research card

若 `m1_stock_profile_all.json` 缺資料，但 deep card 已存在，不能視為 failure。

## Human Operation Flow

1. Daily workflow 產生 coverage verification。
2. 系統跳過已存在 deep profile 的股票。
3. 系統產生 next 5 queue。
4. 人工根據 queue 補齊有來源的 deep research card。
5. 人工更新 `data/m1/m1_stock_profile.json`。
6. 再跑一次 script 檢查 coverage progress。
7. 若 queue 減少，`op-20260525-003` 可進入 verifying。

## 人話結論

這一層不是「自動寫研究卡」。它是每日派工中心：先確認哪些股票真的缺 deep profile，再告訴你最重要的缺口是哪 5 檔。已經有 deep card 的股票會被明確跳過，不會再被重複派工。

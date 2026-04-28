# ==========================================
# update_market_runtime.py V4.3 REAL-AMPLITUDE FINAL
# 功能：
# 1. 從 Yahoo Finance 抓歷史價格
# 2. 用 fast_info.lastPrice 優先取得當前價格
# 3. 歷史資料仍用於計算 1d / 1w / 1m / 3m / 6m / 12m 報酬
# 4. swing_days 改為真實振幅：(High - Low) / Prev Close * 100
# 5. 避免最後一筆 Close 異常導致 price_now = 0
# 6. 輸出 data/market_runtime.json
# 7. 自動輸出 data/m7/m7_fundamental_data.json
# 8. 補入 sector / subsector 給 M8 使用
# ==========================================

#!/usr/bin/env python3
"""Market runtime updater for MM / M7.

Adds the Money v2 fields required by B2/B3:
- volume
- avg_volume / average_volume
- today_dollar_volume
- avg_dollar_volume
- volume_ratio

This script is intentionally conservative: if yfinance is unavailable or a symbol
fails, it keeps the existing runtime row when possible and records warnings.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    import yfinance as yf
except Exception:  # pragma: no cover
    yf = None

ROOT = Path(".")
POOL30_PATH = ROOT / "data/pool30.json"
UNIVERSE_PATH = ROOT / "data/m1/universe_150.json"
OUT_PATH = ROOT / "data/market_runtime.json"
STAGING_OUT_PATH = ROOT / "data/runtime_staging/market_runtime_long_horizon.json"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def load_json(path: Path, default: Any) -> Any:
    try:
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        pass
    return default


def save_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def n(v: Any, fallback: float | None = 0.0) -> float | None:
    try:
        x = float(v)
        if x != x or x in (float("inf"), float("-inf")):
            return fallback
        return x
    except Exception:
        return fallback


def pct_return(price_now: float | None, price_ref: float | None) -> float | None:
    if price_now is None or price_ref is None or price_ref == 0:
        return None
    return (price_now / price_ref - 1.0) * 100.0


def symbols_from_files() -> list[str]:
    syms: set[str] = set()
    for path in [POOL30_PATH, UNIVERSE_PATH]:
        data = load_json(path, [])
        if isinstance(data, list):
            for row in data:
                if isinstance(row, dict) and row.get("symbol"):
                    syms.add(str(row["symbol"]).strip().upper())
    return sorted(syms)


def get_price_ref(hist, days_back: int) -> float | None:
    try:
        if hist is None or hist.empty:
            return None
        if len(hist) <= days_back:
            return n(hist["Close"].iloc[0], None)
        return n(hist["Close"].iloc[-days_back], None)
    except Exception:
        return None


def build_row(symbol: str, old_row: dict[str, Any] | None = None) -> dict[str, Any]:
    old_row = old_row or {}
    if yf is None:
        row = dict(old_row)
        row["symbol"] = symbol
        row["data_warning"] = "yfinance_not_available_keep_existing_row"
        return row

    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info or {}
        hist = ticker.history(period="1y", interval="1d", auto_adjust=False)

        price_now = n(info.get("regularMarketPrice"), None)
        if price_now is None and hist is not None and not hist.empty:
            price_now = n(hist["Close"].iloc[-1], None)

        volume = n(info.get("regularMarketVolume"), None)
        if volume is None and hist is not None and not hist.empty:
            volume = n(hist["Volume"].iloc[-1], None)

        avg_volume = n(
            info.get("averageVolume")
            or info.get("averageDailyVolume3Month")
            or info.get("averageVolume3months"),
            None,
        )
        avg_volume_10d = n(info.get("averageVolume10days"), None)

        if avg_volume is None and hist is not None and not hist.empty and "Volume" in hist:
            avg_volume = n(hist["Volume"].tail(60).mean(), None)
        if avg_volume_10d is None and hist is not None and not hist.empty and "Volume" in hist:
            avg_volume_10d = n(hist["Volume"].tail(10).mean(), None)

        volume_ratio = None
        if volume is not None and avg_volume not in (None, 0):
            volume_ratio = volume / avg_volume

        price_ref_1d = get_price_ref(hist, 2)
        price_ref_1w = get_price_ref(hist, 6)
        price_ref_1m = get_price_ref(hist, 22)
        price_ref_3m = get_price_ref(hist, 66)
        price_ref_6m = get_price_ref(hist, 132)
        price_ref_12m = get_price_ref(hist, 252)

        today_dollar_volume = (price_now or 0.0) * (volume or 0.0)
        avg_dollar_volume = (price_now or 0.0) * (avg_volume or 0.0)

        row = dict(old_row)
        row.update({
            "symbol": symbol,
            "price_now": price_now,
            "volume": volume,
            "avg_volume": avg_volume,
            "avg_volume_10d": avg_volume_10d,
            "average_volume": avg_volume,
            "today_dollar_volume": today_dollar_volume,
            "avg_dollar_volume": avg_dollar_volume,
            "volume_ratio": volume_ratio,
            "price_ref_1d": price_ref_1d,
            "price_ref_1w": price_ref_1w,
            "price_ref_1m": price_ref_1m,
            "price_ref_3m": price_ref_3m,
            "price_ref_6m": price_ref_6m,
            "price_ref_12m": price_ref_12m,
            "ret_1d": pct_return(price_now, price_ref_1d),
            "ret_1w": pct_return(price_now, price_ref_1w),
            "ret_1m": pct_return(price_now, price_ref_1m),
            "ret_3m": pct_return(price_now, price_ref_3m),
            "ret_6m": pct_return(price_now, price_ref_6m),
            "ret_12m": pct_return(price_now, price_ref_12m),
            "updated_at": now_iso(),
            "data_warning": None,
        })
        return row
    except Exception as exc:
        row = dict(old_row)
        row["symbol"] = symbol
        row["data_warning"] = f"fetch_failed:{exc}"
        row["updated_at"] = now_iso()
        return row


def main() -> int:
    symbols = symbols_from_files()
    old_payload = load_json(STAGING_OUT_PATH, load_json(OUT_PATH, {}))
    old_rows = old_payload.get("rows", old_payload) if isinstance(old_payload, dict) else {}
    if not isinstance(old_rows, dict):
        old_rows = {}

    rows: dict[str, dict[str, Any]] = {}
    for sym in symbols:
        rows[sym] = build_row(sym, old_rows.get(sym, {}))

    payload = {
        "generated_at": now_iso(),
        "source": "scripts/update_market_runtime.py",
        "symbol_count": len(rows),
        "rows": rows,
    }
    save_json(OUT_PATH, payload)
    save_json(STAGING_OUT_PATH, payload)
    print(f"✅ market runtime updated: {len(rows)} symbols")
    print(f"✅ {OUT_PATH}")
    print(f"✅ {STAGING_OUT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

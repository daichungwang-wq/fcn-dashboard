#!/usr/bin/env python3
"""Build lightweight pre/post-market runtime for FCN pool underlyings.

This intentionally writes to data/mm/prepost_runtime.json instead of expanding
data/market_runtime.json.
"""

from __future__ import annotations

import json
import math
from datetime import datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

import yfinance as yf


ROOT = Path(__file__).resolve().parents[2]
FCN_POOL_PATH = ROOT / "data" / "fcn_pool.json"
POOL30_PATH = ROOT / "data" / "pool30.json"
OUTPUT_PATH = ROOT / "data" / "mm" / "prepost_runtime.json"
TZ = ZoneInfo("Asia/Taipei")

EXCLUDED_SYMBOLS = {
    "^VIX",
    "^TNX",
    "^TWII",
    "DX-Y.NYB",
    "TWD=X",
    "JPY=X",
    "CL=F",
    "GC=F",
    "SPY",
    "QQQ",
    "SMH",
    "DIA",
    "0050.TW",
}


def load_json(path: Path) -> Any:
    if not path.exists():
        return None
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def normalize_symbol(value: Any) -> str:
    return str(value or "").strip().upper()


def is_stock_symbol(symbol: str) -> bool:
    if not symbol or symbol in EXCLUDED_SYMBOLS:
        return False
    if symbol.startswith("^") or "=" in symbol:
        return False
    return all(ch.isalnum() or ch in {".", "-"} for ch in symbol) and len(symbol) <= 10


def collect_symbols(raw: Any, out: set[str] | None = None, depth: int = 0) -> set[str]:
    if out is None:
        out = set()
    if raw is None or depth > 6:
        return out

    if isinstance(raw, str):
        symbol = normalize_symbol(raw)
        if is_stock_symbol(symbol):
            out.add(symbol)
        return out

    if isinstance(raw, list):
        for item in raw:
            collect_symbols(item, out, depth + 1)
        return out

    if not isinstance(raw, dict):
        return out

    for key in ("symbol", "ticker", "underlying"):
        symbol = normalize_symbol(raw.get(key))
        if is_stock_symbol(symbol):
            out.add(symbol)

    for key in ("basket", "underlyings", "symbols", "stocks"):
        collect_symbols(raw.get(key), out, depth + 1)

    for value in raw.values():
        if isinstance(value, (list, dict)):
            collect_symbols(value, out, depth + 1)

    return out


def safe_number(value: Any) -> float | None:
    try:
        if value is None or value == "":
            return None
        number = float(value)
        if math.isfinite(number):
            return number
    except (TypeError, ValueError):
        return None
    return None


def round_or_none(value: Any, digits: int = 4) -> float | None:
    number = safe_number(value)
    if number is None:
        return None
    return round(number, digits)


def pick_info(info: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        value = info.get(key)
        if value is not None:
            return value
    return None


def build_row(symbol: str, timestamp: str) -> dict[str, Any]:
    warning = None
    info: dict[str, Any] = {}
    try:
        info = yf.Ticker(symbol).fast_info or {}
        regular = pick_info(info, "last_price", "lastPrice")
        previous_close = pick_info(info, "previous_close", "previousClose", "regularMarketPreviousClose")
    except Exception as exc:  # noqa: BLE001 - keep runtime resilient in Actions.
        regular = None
        previous_close = None
        warning = f"yfinance_fast_info_error: {exc}"

    try:
        ticker_info = yf.Ticker(symbol).info or {}
    except Exception as exc:  # noqa: BLE001
        ticker_info = {}
        warning = warning or f"yfinance_info_error: {exc}"

    price_regular = round_or_none(pick_info(ticker_info, "regularMarketPrice") or regular)
    price_pre = round_or_none(pick_info(ticker_info, "preMarketPrice"))
    price_post = round_or_none(pick_info(ticker_info, "postMarketPrice"))
    previous = round_or_none(pick_info(ticker_info, "regularMarketPreviousClose") or previous_close)

    if price_pre is not None:
        session = "pre_market"
        active = price_pre
    elif price_post is not None:
        session = "post_market"
        active = price_post
    else:
        session = "regular"
        active = price_regular

    change_active = None
    change_active_pct = None
    if active is not None and previous not in (None, 0):
        change_active = round(active - previous, 4)
        change_active_pct = round((change_active / previous) * 100, 4)

    if price_regular is None and price_pre is None and price_post is None:
        warning = warning or "price_fields_unavailable"

    return {
        "symbol": symbol,
        "price_regular": price_regular,
        "price_pre": price_pre,
        "price_post": price_post,
        "price_active": active,
        "session": session,
        "change_active": change_active,
        "change_active_pct": change_active_pct,
        "previous_close": previous,
        "updated_at": timestamp,
        "data_warning": warning,
    }


def main() -> None:
    generated_at = datetime.now(TZ).isoformat(timespec="seconds")
    symbols = sorted(collect_symbols(load_json(FCN_POOL_PATH)) | collect_symbols(load_json(POOL30_PATH)))
    rows = {symbol: build_row(symbol, generated_at) for symbol in symbols}
    payload = {
        "generated_at": generated_at,
        "source": "scripts/runtime/update_prepost_runtime.py",
        "version": "v1_prepost_runtime",
        "timezone": "Asia/Taipei",
        "symbol_count": len(rows),
        "rows": rows,
    }
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {OUTPUT_PATH} rows={len(rows)}")


if __name__ == "__main__":
    main()

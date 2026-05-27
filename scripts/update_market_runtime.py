# ==========================================
# update_market_runtime.py V4.6 DAILY RUNTIME ONLY
# 功能：
# 1. 從 Yahoo Finance 抓歷史價格
# 2. 用 fast_info / info 優先取得當前價格，避免最後一筆 Close 異常
# 3. 歷史資料用於計算 1d / 1w / 1m / 3m / 6m / 12m 報酬
# 4. 保留 Money v2 欄位：volume / avg_volume / avg_volume_10d / today_dollar_volume / avg_dollar_volume / volume_ratio
# 5. 新增 Yahoo Finance runtime fallback 基本面欄位：EPS / PE / growth / margins / cashflow / sector / industry
# 6. 這些欄位只作 runtime fallback，不取代 data/m1/eps_history_ai.json
# 7. Daily runtime 只輸出 data/market_runtime.json；long-horizon staging 由 weekly workflow 負責
# 8. V4.6 新增 MM A區 A1/A2：market index / macro symbols，一律寫入同一份 data/market_runtime.json
# ==========================================

#!/usr/bin/env python3
"""Market runtime updater for MM / M1 / M7.

This script is intentionally conservative:
- If yfinance is unavailable, keep the existing runtime row when possible.
- If one symbol fails, keep the existing row and record data_warning.
- Yahoo fundamental fields are runtime fallback only. They do NOT replace
  data/m1/eps_history_ai.json or the EPS Engine's governed data.
- MM A-zone market/macro symbols are included in the same runtime file so
  A1/A2, M1, M6, M7, and M8 share one Global Runtime Layer.
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

# MM Dashboard A1 / Market Pulse.
# Keep these in market_runtime.json instead of creating another macro_runtime.json.
MARKET_INDEX_SYMBOLS = [
    "SPY",      # S&P 500 ETF proxy
    "QQQ",      # NASDAQ 100 ETF proxy
    "SMH",      # Semiconductor ETF proxy
    "DIA",      # Dow Jones ETF proxy
    "0050.TW",  # Taiwan large-cap ETF proxy
    "^TWII",    # Taiwan weighted index fallback
]

# MM Dashboard A2 / Macro Pulse.
MACRO_SYMBOLS = [
    "^VIX",     # VIX
    "^TNX",     # US 10Y yield index from Yahoo, usually displayed as percent-like value
    "DX-Y.NYB", # DXY
    "TWD=X",    # USD/TWD
    "JPY=X",    # USD/JPY
    "CL=F",     # WTI crude oil future
    "GC=F",     # Gold future
]


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


def n(v: Any, fallback: float | None = None) -> float | None:
    try:
        x = float(v)
        if x != x or x in (float("inf"), float("-inf")):
            return fallback
        return x
    except Exception:
        return fallback


def s(v: Any) -> str | None:
    try:
        if v is None:
            return None
        text = str(v).strip()
        return text if text else None
    except Exception:
        return None


def pct_return(price_now: float | None, price_ref: float | None) -> float | None:
    if price_now is None or price_ref is None or price_ref == 0:
        return None
    return (price_now / price_ref - 1.0) * 100.0


def normalize_symbol(symbol: Any) -> str | None:
    text = s(symbol)
    if not text:
        return None
    return text.upper()


def symbols_from_files() -> list[str]:
    syms: set[str] = set()
    for path in [POOL30_PATH, UNIVERSE_PATH]:
        data = load_json(path, [])
        if isinstance(data, dict):
            data = data.get("rows") or data.get("data") or []
        if isinstance(data, list):
            for row in data:
                if isinstance(row, dict) and row.get("symbol"):
                    sym = normalize_symbol(row.get("symbol"))
                    if sym:
                        syms.add(sym)
    return sorted(syms)


def runtime_symbols() -> list[str]:
    """Return all symbols needed by daily runtime.

    This intentionally merges stock universe symbols with MM A-zone market and
    macro symbols. The output schema remains unchanged: every item is still one
    row under data/market_runtime.json["rows"].
    """
    syms = set(symbols_from_files())
    syms.update(MARKET_INDEX_SYMBOLS)
    syms.update(MACRO_SYMBOLS)
    return sorted(sym for sym in syms if sym)


def get_price_ref(hist: Any, days_back: int) -> float | None:
    try:
        if hist is None or hist.empty:
            return None
        if len(hist) <= days_back:
            return n(hist["Close"].iloc[0], None)
        return n(hist["Close"].iloc[-days_back], None)
    except Exception:
        return None


def safe_fast_info(ticker: Any) -> dict[str, Any]:
    try:
        fi = ticker.fast_info
        if fi is None:
            return {}
        return dict(fi)
    except Exception:
        return {}


def safe_info(ticker: Any) -> dict[str, Any]:
    """Fetch Yahoo info defensively.

    yfinance .info / .get_info can be slow or unstable. We still need it for
    fundamental fields, so failure should not break price runtime generation.
    """
    try:
        info = ticker.get_info()
        if isinstance(info, dict):
            return info
    except Exception:
        pass

    try:
        info = ticker.info
        if isinstance(info, dict):
            return info
    except Exception:
        pass

    return {}


def first_number(*values: Any) -> float | None:
    for value in values:
        x = n(value, None)
        if x is not None:
            return x
    return None


def first_text(*values: Any) -> str | None:
    for value in values:
        x = s(value)
        if x is not None:
            return x
    return None


def build_fundamental_block(info: dict[str, Any]) -> dict[str, Any]:
    """Yahoo Finance runtime fallback fundamental fields.

    Naming follows snake_case to match the M1/M7 JSON convention. Values are
    allowed to be None. Do not estimate missing values here.
    """
    return {
        "trailing_eps": n(info.get("trailingEps"), None),
        "forward_eps": n(info.get("forwardEps"), None),
        "trailing_pe": n(info.get("trailingPE"), None),
        "forward_pe": n(info.get("forwardPE"), None),
        "earnings_growth": n(info.get("earningsGrowth"), None),
        "revenue_growth": n(info.get("revenueGrowth"), None),
        "market_cap": n(info.get("marketCap"), None),
        "enterprise_value": n(info.get("enterpriseValue"), None),
        "beta": n(info.get("beta"), None),
        "sector": first_text(info.get("sector")),
        "industry": first_text(info.get("industry")),
        "quote_type": first_text(info.get("quoteType"), info.get("quote_type")),
        "dividend_yield": n(info.get("dividendYield"), None),
        "payout_ratio": n(info.get("payoutRatio"), None),
        "profit_margins": n(info.get("profitMargins"), None),
        "gross_margins": n(info.get("grossMargins"), None),
        "operating_margins": n(info.get("operatingMargins"), None),
        "return_on_equity": n(info.get("returnOnEquity"), None),
        "debt_to_equity": n(info.get("debtToEquity"), None),
        "free_cashflow": n(info.get("freeCashflow"), None),
        "operating_cashflow": n(info.get("operatingCashflow"), None),
        "fundamental_source": "yahoo_runtime_fallback",
        "fundamental_note": "runtime_fallback_only_not_replace_data_m1_eps_history_ai_json",
    }


def runtime_category(symbol: str) -> str:
    if symbol in MARKET_INDEX_SYMBOLS:
        return "market_index"
    if symbol in MACRO_SYMBOLS:
        return "macro"
    return "stock"


def runtime_display_name(symbol: str) -> str | None:
    names = {
        "SPY": "S&P500 / SPY",
        "QQQ": "NASDAQ100 / QQQ",
        "SMH": "Semiconductor / SMH",
        "DIA": "Dow Jones / DIA",
        "0050.TW": "Taiwan 50 ETF",
        "^TWII": "Taiwan Weighted Index",
        "^VIX": "VIX",
        "^TNX": "US 10Y Yield",
        "DX-Y.NYB": "DXY",
        "TWD=X": "USD/TWD",
        "JPY=X": "USD/JPY",
        "CL=F": "WTI Crude Oil",
        "GC=F": "Gold",
    }
    return names.get(symbol)


def build_row(symbol: str, old_row: dict[str, Any] | None = None) -> dict[str, Any]:
    old_row = old_row or {}
    if yf is None:
        row = dict(old_row)
        row["symbol"] = symbol
        row["runtime_category"] = runtime_category(symbol)
        row["runtime_display_name"] = runtime_display_name(symbol)
        row["data_warning"] = "yfinance_not_available_keep_existing_row"
        row["updated_at"] = now_iso()
        return row

    try:
        ticker = yf.Ticker(symbol)
        fast_info = safe_fast_info(ticker)
        info = safe_info(ticker)
        hist = ticker.history(period="1y", interval="1d", auto_adjust=False)

        price_now = first_number(
            fast_info.get("lastPrice"),
            fast_info.get("last_price"),
            info.get("regularMarketPrice"),
            info.get("currentPrice"),
            info.get("previousClose"),
        )
        if price_now is None and hist is not None and not hist.empty:
            price_now = n(hist["Close"].iloc[-1], None)

        volume = first_number(
            info.get("regularMarketVolume"),
            info.get("volume"),
            fast_info.get("lastVolume"),
        )
        if volume is None and hist is not None and not hist.empty and "Volume" in hist:
            volume = n(hist["Volume"].iloc[-1], None)

        avg_volume = first_number(
            info.get("averageVolume"),
            info.get("averageDailyVolume3Month"),
            info.get("averageVolume3months"),
            fast_info.get("threeMonthAverageVolume"),
            fast_info.get("three_month_average_volume"),
        )
        avg_volume_10d = first_number(
            info.get("averageVolume10days"),
            info.get("averageDailyVolume10Day"),
            fast_info.get("tenDayAverageVolume"),
            fast_info.get("ten_day_average_volume"),
        )

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
            "runtime_category": runtime_category(symbol),
            "runtime_display_name": runtime_display_name(symbol),
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

        row.update(build_fundamental_block(info))
        return row

    except Exception as exc:
        row = dict(old_row)
        row["symbol"] = symbol
        row["runtime_category"] = runtime_category(symbol)
        row["runtime_display_name"] = runtime_display_name(symbol)
        row["data_warning"] = f"fetch_failed:{exc}"
        row["updated_at"] = now_iso()
        return row


def main() -> int:
    symbols = runtime_symbols()
    old_payload = load_json(OUT_PATH, {})
    old_rows = old_payload.get("rows", old_payload) if isinstance(old_payload, dict) else {}
    if not isinstance(old_rows, dict):
        old_rows = {}

    rows: dict[str, dict[str, Any]] = {}
    for sym in symbols:
        rows[sym] = build_row(sym, old_rows.get(sym, {}))

    stock_count = sum(1 for row in rows.values() if row.get("runtime_category") == "stock")
    market_index_count = sum(1 for row in rows.values() if row.get("runtime_category") == "market_index")
    macro_count = sum(1 for row in rows.values() if row.get("runtime_category") == "macro")

    payload = {
        "generated_at": now_iso(),
        "source": "scripts/update_market_runtime.py",
        "version": "V4.6_daily_runtime_with_mm_a_zone_market_macro",
        "fundamental_policy": "Yahoo Finance fields are runtime fallback only; do not replace data/m1/eps_history_ai.json.",
        "long_horizon_policy": "Daily runtime does not write data/runtime_staging/market_runtime_long_horizon.json. Weekly long-horizon regression is handled separately.",
        "mm_a_zone_policy": "A1/A2 market and macro symbols are included in the same data/market_runtime.json global runtime layer.",
        "symbol_count": len(rows),
        "stock_count": stock_count,
        "market_index_count": market_index_count,
        "macro_count": macro_count,
        "market_index_symbols": MARKET_INDEX_SYMBOLS,
        "macro_symbols": MACRO_SYMBOLS,
        "rows": rows,
    }
    save_json(OUT_PATH, payload)
    print(f"daily market runtime updated: {len(rows)} symbols")
    print(f"stocks={stock_count}, market_index={market_index_count}, macro={macro_count}")
    print(f"saved {OUT_PATH}")
    print("skipped long-horizon staging; owned by weekly workflow")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

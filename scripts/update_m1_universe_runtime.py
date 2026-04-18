# ==========================================
# update_m1_universe_runtime.py
# 功能：
# 1. 讀取 data/m1/universe_150.json
# 2. 從 Yahoo Finance 抓 150 檔市場資料
# 3. 輸出 data/m1/m1_market_runtime.json
# 4. 具備 None / empty / missing Close / retry 防呆
# ==========================================

import json
import math
import time
from datetime import datetime, timezone
from pathlib import Path

import yfinance as yf

UNIVERSE_PATH = "data/m1/universe_150.json"
OUTPUT_PATH = "data/m1/m1_market_runtime.json"

WINDOWS = {
    "1d": 1,
    "1w": 5,
    "1m": 21,
    "3m": 63,
    "6m": 126,
    "12m": 252
}


# ---------- 基本工具 ----------
def safe_number(v, default=None):
    try:
        if v is None:
            return default
        n = float(v)
        if math.isnan(n) or math.isinf(n):
            return default
        return n
    except Exception:
        return default


def safe_int(v, default=None):
    try:
        if v is None:
            return default
        n = float(v)
        if math.isnan(n) or math.isinf(n):
            return default
        return int(n)
    except Exception:
        return default


def get_safe_series_value(series, idx):
    try:
        if series is None or len(series) == 0:
            return None
        return safe_number(series.iloc[idx], None)
    except Exception:
        return None


def calc_return(now, past):
    now = safe_number(now, None)
    past = safe_number(past, None)

    if now is None or past is None or past == 0:
        return 0

    return round((now - past) / past, 6)


def calc_volume_ratio(volume_series):
    try:
        if volume_series is None or len(volume_series) < 20:
            return 1.0

        latest = safe_number(volume_series.iloc[-1], None)
        avg20 = safe_number(volume_series.tail(20).mean(), None)

        if latest is None or avg20 in (None, 0):
            return 1.0

        return round(latest / avg20, 2)
    except Exception:
        return 1.0


def get_current_price(ticker, close_series):
    # 先抓 fast_info
    try:
        fi = ticker.fast_info
        if fi:
            for key in ["lastPrice", "regularMarketPrice", "previousClose"]:
                v = fi.get(key, None)
                v = safe_number(v, None)
                if v is not None and v > 0:
                    return v
    except Exception:
        pass

    # 再抓 info
    try:
        info = ticker.info
        if info:
            for key in ["regularMarketPrice", "currentPrice", "previousClose"]:
                v = info.get(key, None)
                v = safe_number(v, None)
                if v is not None and v > 0:
                    return v
    except Exception:
        pass

    # 最後 fallback 到 close 最後一筆
    try:
        if close_series is not None and len(close_series) > 0:
            v = safe_number(close_series.iloc[-1], None)
            if v is not None and v > 0:
                return v
    except Exception:
        pass

    return 0


def load_universe():
    path = Path(UNIVERSE_PATH)
    if not path.exists():
        raise FileNotFoundError(f"Universe file not found: {UNIVERSE_PATH}")

    with open(path, "r", encoding="utf-8") as f:
        universe = json.load(f)

    if not isinstance(universe, list):
        raise ValueError("universe_150.json must be a JSON array")

    symbols = []
    seen = set()

    for row in universe:
        if not isinstance(row, dict):
            continue

        sym = str(row.get("symbol", "")).strip().upper()
        if not sym:
            continue

        if sym not in seen:
            seen.add(sym)
            symbols.append(sym)

    return symbols


def fetch_history_with_retry(symbol, retry=2, pause_sec=1):
    last_error = None

    for attempt in range(retry + 1):
        try:
            ticker = yf.Ticker(symbol)
            hist = ticker.history(period="1y", auto_adjust=False)

            if hist is None or hist.empty:
                last_error = "history empty"
                if attempt < retry:
                    time.sleep(pause_sec)
                    continue
                return ticker, None, last_error

            return ticker, hist, None

        except Exception as e:
            last_error = str(e)
            if attempt < retry:
                time.sleep(pause_sec)
                continue

    return None, None, last_error


def build_runtime_for_symbol(symbol):
    ticker, hist, err = fetch_history_with_retry(symbol, retry=2, pause_sec=1)

    if hist is None:
        return None, f"{symbol} ERROR: {err}"

    try:
        close = hist["Close"] if "Close" in hist.columns else None
        volume_series = hist["Volume"] if "Volume" in hist.columns else None

        if close is None or len(close) == 0:
            return None, f"{symbol} ERROR: no close data"

        price_now = safe_number(get_current_price(ticker, close), 0)

        ref_prices = {}
        for key, days in WINDOWS.items():
            ref = get_safe_series_value(close, -1 - days)
            if ref is None or ref <= 0:
                ref = get_safe_series_value(close, 0)
            ref_prices[key] = safe_number(ref, 0)

        row = {
            "price_now": safe_number(price_now, 0),
            "volume": safe_int(volume_series.iloc[-1], None) if volume_series is not None and len(volume_series) > 0 else None,
            "volume_ratio": calc_volume_ratio(volume_series),
            "last_update": datetime.now(timezone.utc).isoformat(),

            "price_ref_1d": safe_number(ref_prices["1d"], 0),
            "price_ref_1w": safe_number(ref_prices["1w"], 0),
            "price_ref_1m": safe_number(ref_prices["1m"], 0),
            "price_ref_3m": safe_number(ref_prices["3m"], 0),
            "price_ref_6m": safe_number(ref_prices["6m"], 0),
            "price_ref_12m": safe_number(ref_prices["12m"], 0),

            "ret_1d": safe_number(calc_return(price_now, ref_prices["1d"]), 0),
            "ret_1w": safe_number(calc_return(price_now, ref_prices["1w"]), 0),
            "ret_1m": safe_number(calc_return(price_now, ref_prices["1m"]), 0),
            "ret_3m": safe_number(calc_return(price_now, ref_prices["3m"]), 0),
            "ret_6m": safe_number(calc_return(price_now, ref_prices["6m"]), 0),
            "ret_12m": safe_number(calc_return(price_now, ref_prices["12m"]), 0)
        }

        return row, f"{symbol} OK"

    except Exception as e:
        return None, f"{symbol} ERROR: {e}"


def main():
    print("🔥 update_m1_universe_runtime.py loaded")

    symbols = load_universe()
    print(f"Total symbols: {len(symbols)}")
    print("First 10 symbols:", symbols[:10])

    output = {}
    failed = []

    for symbol in symbols:
        row, msg = build_runtime_for_symbol(symbol)
        print(msg)

        if row is None:
            failed.append(symbol)
            continue

        output[symbol] = row

    # 自動建立資料夾
    output_path = Path(OUTPUT_PATH)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print("\n==============================")
    print(f"✅ Saved to {OUTPUT_PATH}")
    print(f"✅ Success count: {len(output)}")
    print(f"⚠ Failed count: {len(failed)}")
    if failed:
        print("Failed symbols:", failed)
    print("==============================")


if __name__ == "__main__":
    main()

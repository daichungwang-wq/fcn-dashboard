# ==========================================
# update_market_runtime.py V2.2 CLEAN FINAL
# 功能：
# 1. 從 Yahoo Finance 抓歷史價格
# 2. 自動 fallback（避免 null / NaN）
# 3. 計算 1d / 1w / 1m / 3m / 6m / 12m 報酬
# 4. 輸出合法 JSON（不會出現 NaN / Infinity）
# 5. 舊欄位完全保留，新增 3m，不影響其他 engine
# ==========================================

import json
import math
from datetime import datetime, timezone

import yfinance as yf

# ------------------------------------------
# 參數
# ------------------------------------------
WINDOWS = {
    "1d": 1,
    "1w": 5,
    "1m": 21,
    "3m": 63,
    "6m": 126,
    "12m": 252
}

POOL_PATH = "data/pool30.json"
OUTPUT_PATH = "data/market_runtime.json"


# ------------------------------------------
# 工具：安全數字
# ------------------------------------------
def safe_number(v, default=0):
    try:
        if v is None:
            return default

        n = float(v)

        if math.isnan(n) or math.isinf(n):
            return default

        return n
    except Exception:
        return default


def get_price_safe(series, idx):
    try:
        if series is None or len(series) == 0:
            return None

        # 若索引超出範圍，fallback 到最舊資料
        if abs(idx) >= len(series):
            return safe_number(series.iloc[0], None)

        return safe_number(series.iloc[idx], None)
    except Exception:
        return None


def calc_return(now, past):
    now = safe_number(now, None)
    past = safe_number(past, None)

    if now is None or past is None or past == 0:
        return 0

    return round((now - past) / past, 6)


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


# ------------------------------------------
# 主程式
# ------------------------------------------
def main():
    with open(POOL_PATH, "r", encoding="utf-8") as f:
        pool = json.load(f)

    symbols = [s["symbol"] for s in pool if s.get("symbol")]
    result = {}

    for symbol in symbols:
        print(f"Fetching {symbol}...")

        try:
            ticker = yf.Ticker(symbol)
            hist = ticker.history(period="1y")

            if hist is None or len(hist) < 10:
                raise Exception("Not enough data")

            close = hist["Close"]
            volume_series = hist["Volume"] if "Volume" in hist.columns else None

            price_now = safe_number(get_price_safe(close, -1), 0)

            # 各時間點價格
            ref_prices = {}
            for k, days in WINDOWS.items():
                ref = get_price_safe(close, -1 - days)
                # 抓不到就 fallback 回現價
                ref_prices[k] = safe_number(ref, price_now)

            data = {
                "price_now": safe_number(price_now, 0),
                "volume": safe_int(volume_series.iloc[-1], None) if volume_series is not None and len(volume_series) > 0 else None,
                "last_update": datetime.now(timezone.utc).isoformat(),

                # 參考價（保留舊欄位 + 新增 3m）
                "price_ref_1d": safe_number(ref_prices["1d"], 0),
                "price_ref_1w": safe_number(ref_prices["1w"], 0),
                "price_ref_1m": safe_number(ref_prices["1m"], 0),
                "price_ref_3m": safe_number(ref_prices["3m"], 0),
                "price_ref_6m": safe_number(ref_prices["6m"], 0),
                "price_ref_12m": safe_number(ref_prices["12m"], 0),

                # 報酬率（保留舊欄位 + 新增 3m）
                "ret_1d": safe_number(calc_return(price_now, ref_prices["1d"]), 0),
                "ret_1w": safe_number(calc_return(price_now, ref_prices["1w"]), 0),
                "ret_1m": safe_number(calc_return(price_now, ref_prices["1m"]), 0),
                "ret_3m": safe_number(calc_return(price_now, ref_prices["3m"]), 0),
                "ret_6m": safe_number(calc_return(price_now, ref_prices["6m"]), 0),
                "ret_12m": safe_number(calc_return(price_now, ref_prices["12m"]), 0)
            }

            result[symbol] = data

        except Exception as e:
            print(f"❌ Error {symbol}: {e}")

            # fallback：確保 JSON 永遠合法
            result[symbol] = {
                "price_now": 0,
                "volume": None,
                "last_update": datetime.now(timezone.utc).isoformat(),

                "price_ref_1d": 0,
                "price_ref_1w": 0,
                "price_ref_1m": 0,
                "price_ref_3m": 0,
                "price_ref_6m": 0,
                "price_ref_12m": 0,

                "ret_1d": 0,
                "ret_1w": 0,
                "ret_1m": 0,
                "ret_3m": 0,
                "ret_6m": 0,
                "ret_12m": 0
            }

    # 最終保險：把所有數值再過一次 safe_number，避免任何漏網之魚
    cleaned = {}
    for symbol, node in result.items():
        cleaned_node = {}
        for k, v in node.items():
            if isinstance(v, (int, float)):
                cleaned_node[k] = safe_number(v, 0)
            else:
                cleaned_node[k] = v
        cleaned[symbol] = cleaned_node

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(cleaned, f, indent=2, ensure_ascii=False)

    print("✅ market_runtime.json updated (clean final, no NaN)")


if __name__ == "__main__":
    main()

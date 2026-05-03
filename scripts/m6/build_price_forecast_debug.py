import json
from typing import Dict, Any, List

DEBUG_MODE = True

DEBUG_SYMBOLS = {
    "NVDA","AVGO","TSM","SMH","MRVL","MU","QQQ","TSLA",
    "UNH","PLTR","AMD","NKE","EL","TGT","CCL","LQD",
    "ORCL","GOOG","COIN"
}

PATH_M1_SCORES = "data/m1/m1_scores.json"
PATH_M7_SCORES = "data/m7_sandbox/m7_v2_scores.json"
PATH_MARKET_RUNTIME = "data/market_runtime.json"
PATH_M6_POSITIONS = "data/m6/m6_positions.json"

OUT_PATH = "data/m6/price_forecast_debug.json"


# -------------------------
# utils
# -------------------------
def read_json(path: str, default):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return default


def symbol_map(data):
    if isinstance(data, dict) and "rows" in data:
        return {str(x["symbol"]).upper(): x for x in data["rows"] if "symbol" in x}
    elif isinstance(data, list):
        return {str(x["symbol"]).upper(): x for x in data if "symbol" in x}
    return {}


# -------------------------
# core
# -------------------------
def build_result(symbol, m1, m7, runtime):
    today = runtime.get("price_now")

    return {
        "symbol": symbol,
        "today_price": today,
        "has_m1": bool(m1),
        "has_m7": bool(m7),
        "has_runtime": bool(runtime)
    }


# -------------------------
# main
# -------------------------
def main():
    m1_raw = read_json(PATH_M1_SCORES, {"rows": []})
    m7_raw = read_json(PATH_M7_SCORES, {"rows": []})
    runtime_raw = read_json(PATH_MARKET_RUNTIME, {})
    positions_raw = read_json(PATH_M6_POSITIONS, [])

    m1_map = symbol_map(m1_raw)
    m7_map = symbol_map(m7_raw)

    # 🔥 修正核心（你之前壞在這）
    if isinstance(runtime_raw, dict) and "NVDA" in runtime_raw:
        runtime_map = {k.upper(): v for k, v in runtime_raw.items()}
    elif isinstance(runtime_raw, dict) and isinstance(runtime_raw.get("rows"), dict):
        runtime_map = {
            str(k).upper(): v
            for k, v in runtime_raw["rows"].items()
        }
    else:
        runtime_map = symbol_map(runtime_raw)

    pos_map = symbol_map(positions_raw)

    all_symbols = set(m1_map) | set(m7_map) | set(runtime_map) | set(pos_map)

    print("=== DEBUG SOURCE ===")
    print("m1:", len(m1_map))
    print("m7:", len(m7_map))
    print("runtime:", len(runtime_map))
    print("positions:", len(pos_map))

    if DEBUG_MODE:
        symbols = sorted(DEBUG_SYMBOLS)
    else:
        symbols = sorted(all_symbols)

    rows = []

    for s in symbols:
        rows.append(
            build_result(
                s,
                m1_map.get(s, {}),
                m7_map.get(s, {}),
                runtime_map.get(s, {})
            )
        )

    available = sum(1 for r in rows if r["today_price"] is not None)

    print(f"symbols={len(rows)}")
    print(f"available={available}")

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump({"rows": rows}, f, indent=2)

    print(f"wrote={OUT_PATH}")


if __name__ == "__main__":
    main()

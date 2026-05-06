#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
update_option_runtime.py

Daily Option Runtime builder for MM / FCN system.

Output:
  data/options/option_runtime.json

Concept:
  M7 = FCN eligibility
  M6 = market attractive / short-term price path
  Option Runtime = rate pressure from options market:
    IV + skew + demand

Coverage logic v2:
  1. data/m1/universe_150.json  -> main coverage universe
  2. data/pool30.json           -> active pool supplement
  3. data/m7_sandbox/m7_v2_scores.json high-score supplement
  4. DEFAULT_SYMBOLS fallback

Pilot source:
  yfinance option chain.

Production note:
  yfinance is suitable for pilot testing only.
  For production, replace fetch_option_chain_yfinance() with Tradier / Polygon / Nasdaq Data Link.

Usage:
  python scripts/update_option_runtime.py
  python scripts/update_option_runtime.py MU NVDA TSM SMH
"""

from __future__ import annotations

import json
import math
import statistics
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

try:
    import yfinance as yf
except Exception:
    yf = None


ROOT = Path(__file__).resolve().parents[1]

UNIVERSE150_PATH = ROOT / "data" / "m1" / "universe_150.json"
POOL30_PATH = ROOT / "data" / "pool30.json"
M7_PATH = ROOT / "data" / "m7_sandbox" / "m7_v2_scores.json"

OUT_DIR = ROOT / "data" / "options"
OUT_PATH = OUT_DIR / "option_runtime.json"

DEFAULT_SYMBOLS = [
    "NVDA", "TSM", "SMH", "QQQ", "GOOG", "AAPL", "MSFT",
    "MU", "PLTR", "AMD", "MRVL", "ARM", "SOFI", "CRDO", "ALAB",
    "LQD", "COST", "UNH", "META", "AMZN", "AVGO"
]


# ==================================================
# Basic utilities
# ==================================================

def safe_float(x: Any) -> Optional[float]:
    try:
        if x is None:
            return None
        v = float(x)
        if math.isnan(v) or math.isinf(v):
            return None
        return v
    except Exception:
        return None


def clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def round_or_none(v: Optional[float], ndigits: int = 4) -> Optional[float]:
    if v is None:
        return None
    return round(float(v), ndigits)


def load_json(path: Path) -> Any:
    if not path.exists():
        return None
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def normalize_symbol(x: Any) -> str:
    return str(x or "").strip().upper()


def add_symbol(symbols: List[str], sym: Any) -> None:
    s = normalize_symbol(sym)
    if s:
        symbols.append(s)


def extract_symbol_from_row(row: Any) -> Optional[str]:
    if not isinstance(row, dict):
        return None

    candidates = [
        row.get("symbol"),
        row.get("ticker"),
        row.get("代號"),
        row.get("股號"),
        row.get("Symbol"),
        row.get("Ticker"),
    ]

    for x in candidates:
        s = normalize_symbol(x)
        if s:
            return s

    return None


def rows_from_json(obj: Any) -> List[Dict[str, Any]]:
    """
    Support common shapes:
      - [ {...}, {...} ]
      - { data: [...] }
      - { rows: [...] }
      - { stocks: [...] }
      - { data: { NVDA: {...}, ... } }
      - { NVDA: {...}, ... }
    """
    if isinstance(obj, list):
        return [x for x in obj if isinstance(x, dict)]

    if not isinstance(obj, dict):
        return []

    for key in ["data", "rows", "stocks", "all", "universe"]:
        value = obj.get(key)
        if isinstance(value, list):
            return [x for x in value if isinstance(x, dict)]
        if isinstance(value, dict):
            out = []
            for sym, row in value.items():
                if isinstance(row, dict):
                    merged = dict(row)
                    merged.setdefault("symbol", sym)
                    out.append(merged)
            return out

    # If object itself looks like symbol -> row mapping
    out = []
    for sym, row in obj.items():
        if isinstance(row, dict):
            merged = dict(row)
            merged.setdefault("symbol", sym)
            out.append(merged)

    return out


def get_m7_score(row: Dict[str, Any]) -> Optional[float]:
    """
    Support current and historical M7 v2 field names.
    """
    keys = [
        "m7_v2_score",
        "m7_effective_score",
        "m7_score",
        "score",
        "today_score",
    ]

    for k in keys:
        v = safe_float(row.get(k))
        if v is not None:
            return v

    # Sometimes nested
    for parent_key in ["m7", "scores", "result"]:
        parent = row.get(parent_key)
        if isinstance(parent, dict):
            for k in keys:
                v = safe_float(parent.get(k))
                if v is not None:
                    return v

    return None


# ==================================================
# Universe extraction
# ==================================================

def extract_symbols() -> Tuple[List[str], Dict[str, Any]]:
    """
    Coverage priority:
      1. universe_150: main coverage
      2. pool30: active pool supplement
      3. M7 v2 high-score supplement
      4. DEFAULT_SYMBOLS fallback

    This function returns (symbols, coverage_meta).
    """
    symbols: List[str] = []
    source_counts = {
        "universe_150": 0,
        "pool30": 0,
        "m7_high_score": 0,
        "default": 0,
    }

    # ==================================================
    # 1. Universe 150 main coverage
    # ==================================================
    universe = load_json(UNIVERSE150_PATH)
    universe_rows = rows_from_json(universe)

    for row in universe_rows:
        sym = extract_symbol_from_row(row)
        if sym:
            add_symbol(symbols, sym)
            source_counts["universe_150"] += 1

    # ==================================================
    # 2. Pool30 supplement
    # ==================================================
    pool = load_json(POOL30_PATH)
    pool_rows = rows_from_json(pool)

    for row in pool_rows:
        sym = extract_symbol_from_row(row)
        if sym:
            add_symbol(symbols, sym)
            source_counts["pool30"] += 1

    # ==================================================
    # 3. M7 v2 high-score supplement
    # ==================================================
    m7 = load_json(M7_PATH)
    m7_rows = rows_from_json(m7)

    for row in m7_rows:
        sym = extract_symbol_from_row(row)
        if not sym:
            continue

        score = get_m7_score(row)

        # Only supplement high-quality names if score exists.
        # If M7 file shape has no score, do not flood from unknown rows.
        if score is not None and score >= 8:
            add_symbol(symbols, sym)
            source_counts["m7_high_score"] += 1

    # ==================================================
    # 4. Fallback
    # ==================================================
    if not symbols:
        for sym in DEFAULT_SYMBOLS:
            add_symbol(symbols, sym)
            source_counts["default"] += 1

    # ==================================================
    # Dedupe, preserve order
    # ==================================================
    seen = set()
    out: List[str] = []

    for s in symbols:
        s = normalize_symbol(s)

        if not s:
            continue

        if s in seen:
            continue

        seen.add(s)
        out.append(s)

    meta = {
        "coverage_source": "universe_150 + pool30 + m7_high_score",
        "paths": {
            "universe_150": str(UNIVERSE150_PATH.relative_to(ROOT)),
            "pool30": str(POOL30_PATH.relative_to(ROOT)),
            "m7_v2": str(M7_PATH.relative_to(ROOT)),
        },
        "source_counts_raw": source_counts,
        "deduped_symbol_count": len(out),
    }

    return out, meta


# ==================================================
# Option chain helpers
# ==================================================

def nearest_expiry(options: List[str], target_days: int = 30) -> Optional[str]:
    today = datetime.now(timezone.utc).date()
    best = None
    best_diff = 10**9

    for e in options:
        try:
            d = datetime.strptime(e, "%Y-%m-%d").date()
            days = (d - today).days

            if days <= 0:
                continue

            diff = abs(days - target_days)

            if diff < best_diff:
                best = e
                best_diff = diff
        except Exception:
            continue

    return best


def score_iv(iv: Optional[float]) -> float:
    """
    IV score 0~10.
    IV input is decimal, e.g. 0.55 = 55%.
    """
    if iv is None:
        return 0.0

    # v1 mapping:
    # 10% -> 0
    # 75%+ -> 10
    return round(clamp((iv - 0.10) / 0.65 * 10.0, 0.0, 10.0), 2)


def score_skew(put_skew: Optional[float]) -> float:
    """
    Put skew score 0~10.
    put_skew input is decimal IV difference, e.g. 0.08 = 8 vol points.
    Negative skew means downside fear is not elevated, so score floors at 0.
    """
    if put_skew is None:
        return 0.0

    return round(clamp(put_skew / 0.20 * 10.0, 0.0, 10.0), 2)


def score_demand(pcr_vol: Optional[float], pcr_oi: Optional[float]) -> float:
    """
    Demand proxy 0~10.
    Higher put/call ratios suggest more downside protection demand.
    """
    vals = []

    if pcr_vol is not None:
        vals.append(clamp((pcr_vol - 0.5) / 2.5 * 10.0, 0.0, 10.0))

    if pcr_oi is not None:
        vals.append(clamp((pcr_oi - 0.5) / 2.5 * 10.0, 0.0, 10.0))

    if not vals:
        return 0.0

    return round(sum(vals) / len(vals), 2)


def weighted_rate_pressure(
    iv_score: float,
    skew_score: float,
    demand_score: float,
    event_score: float = 0.0,
) -> float:
    """
    Pilot v1:
      rate_pressure_score = 0.45*IV + 0.30*Skew + 0.20*Demand + 0.05*Event

    Important:
      This is option-runtime pressure, not final M8 fair-yield.
    """
    return round(
        0.45 * iv_score +
        0.30 * skew_score +
        0.20 * demand_score +
        0.05 * event_score,
        2,
    )


def nearest_by_moneyness(df, option_type: str, spot: float):
    """
    yfinance chain usually does not include Greeks/delta.
    Use moneyness proxy:
      ATM: strike nearest spot
      25-delta-ish put: strike around 90% spot
      25-delta-ish call: strike around 110% spot

    Production version should use real delta from Tradier / Polygon / Nasdaq Data Link.
    """
    if df is None or len(df) == 0:
        return None

    if option_type == "put_25d_proxy":
        target_strike = spot * 0.90
    elif option_type == "call_25d_proxy":
        target_strike = spot * 1.10
    else:
        target_strike = spot

    try:
        tmp = df.copy()
        tmp["__dist"] = (tmp["strike"].astype(float) - target_strike).abs()
        tmp = tmp.sort_values("__dist")
        return tmp.iloc[0]
    except Exception:
        return None


def sum_numeric(df, col: str) -> Optional[float]:
    if df is None or len(df) == 0 or col not in df.columns:
        return None

    total = 0.0
    ok = False

    for x in df[col].tolist():
        v = safe_float(x)
        if v is not None:
            total += v
            ok = True

    return total if ok else None


# ==================================================
# Fetch option data
# ==================================================

def fetch_option_chain_yfinance(symbol: str) -> Dict[str, Any]:
    if yf is None:
        return {
            "symbol": symbol,
            "status": "error",
            "warning": "yfinance_not_installed",
        }

    try:
        ticker = yf.Ticker(symbol)

        hist = ticker.history(period="5d", interval="1d")

        if hist is None or len(hist) == 0:
            return {
                "symbol": symbol,
                "status": "error",
                "data_source": "yfinance",
                "warning": "no_price_history",
            }

        spot = safe_float(hist["Close"].iloc[-1])

        if spot is None:
            return {
                "symbol": symbol,
                "status": "error",
                "data_source": "yfinance",
                "warning": "no_spot_price",
            }

        expiries = list(ticker.options or [])
        expiry = nearest_expiry(expiries, 30)

        if not expiry:
            return {
                "symbol": symbol,
                "status": "error",
                "data_source": "yfinance",
                "spot": round_or_none(spot, 4),
                "warning": "no_option_expiry",
            }

        chain = ticker.option_chain(expiry)
        calls = chain.calls
        puts = chain.puts

        atm_call = nearest_by_moneyness(calls, "atm", spot)
        atm_put = nearest_by_moneyness(puts, "atm", spot)
        put_25 = nearest_by_moneyness(puts, "put_25d_proxy", spot)
        call_25 = nearest_by_moneyness(calls, "call_25d_proxy", spot)

        atm_call_iv = safe_float(atm_call.get("impliedVolatility")) if atm_call is not None else None
        atm_put_iv = safe_float(atm_put.get("impliedVolatility")) if atm_put is not None else None
        put_25_iv = safe_float(put_25.get("impliedVolatility")) if put_25 is not None else None
        call_25_iv = safe_float(call_25.get("impliedVolatility")) if call_25 is not None else None

        iv_vals = [v for v in [atm_call_iv, atm_put_iv] if v is not None]
        iv_30d_atm = statistics.mean(iv_vals) if iv_vals else None

        put_skew_30d = None
        if put_25_iv is not None and iv_30d_atm is not None:
            put_skew_30d = put_25_iv - iv_30d_atm

        call_skew_30d = None
        if call_25_iv is not None and iv_30d_atm is not None:
            call_skew_30d = call_25_iv - iv_30d_atm

        put_volume = sum_numeric(puts, "volume")
        call_volume = sum_numeric(calls, "volume")
        put_oi = sum_numeric(puts, "openInterest")
        call_oi = sum_numeric(calls, "openInterest")

        pcr_vol = None
        if put_volume is not None and call_volume is not None and call_volume > 0:
            pcr_vol = put_volume / call_volume

        pcr_oi = None
        if put_oi is not None and call_oi is not None and call_oi > 0:
            pcr_oi = put_oi / call_oi

        iv_s = score_iv(iv_30d_atm)
        skew_s = score_skew(put_skew_30d)
        demand_s = score_demand(pcr_vol, pcr_oi)
        event_s = 0.0
        rate_s = weighted_rate_pressure(iv_s, skew_s, demand_s, event_s)

        return {
            "symbol": symbol,
            "status": "ok",
            "data_source": "yfinance",
            "source_quality": "pilot_proxy",
            "updated_at": datetime.now(timezone.utc).isoformat(),

            "spot": round_or_none(spot, 4),
            "expiry_used": expiry,

            "iv_30d_atm": round_or_none(iv_30d_atm, 6),
            "iv_30d_atm_pct": round_or_none(iv_30d_atm * 100 if iv_30d_atm is not None else None, 2),

            "put_25d_iv": round_or_none(put_25_iv, 6),
            "call_25d_iv": round_or_none(call_25_iv, 6),

            "put_skew_30d": round_or_none(put_skew_30d, 6),
            "put_skew_30d_vol_points": round_or_none(put_skew_30d * 100 if put_skew_30d is not None else None, 2),

            "call_skew_30d": round_or_none(call_skew_30d, 6),
            "call_skew_30d_vol_points": round_or_none(call_skew_30d * 100 if call_skew_30d is not None else None, 2),

            "put_call_volume_ratio": round_or_none(pcr_vol, 4),
            "put_call_oi_ratio": round_or_none(pcr_oi, 4),

            "put_volume": round_or_none(put_volume, 0),
            "call_volume": round_or_none(call_volume, 0),
            "put_open_interest": round_or_none(put_oi, 0),
            "call_open_interest": round_or_none(call_oi, 0),

            "iv_score": iv_s,
            "skew_score": skew_s,
            "demand_score": demand_s,
            "event_score": event_s,
            "rate_pressure_score": rate_s,

            "rate_pressure_formula": "0.45*iv_score + 0.30*skew_score + 0.20*demand_score + 0.05*event_score",

            "rate_driver_label": classify_rate_driver(iv_s, skew_s, demand_s),

            "debug": {
                "atm_method": "nearest strike to spot",
                "put_25d_proxy_method": "nearest strike to 90% spot",
                "call_25d_proxy_method": "nearest strike to 110% spot",
                "warning": "pilot proxy: not real 25-delta; use production options API for Greeks",
            },
        }

    except Exception as exc:
        return {
            "symbol": symbol,
            "status": "error",
            "data_source": "yfinance",
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "warning": str(exc),
        }


def classify_rate_driver(iv_score: float, skew_score: float, demand_score: float) -> str:
    """
    Explain why option premium / FCN pressure is elevated.
    """
    scores = {
        "IV_DRIVEN": iv_score,
        "SKEW_DRIVEN": skew_score,
        "DEMAND_DRIVEN": demand_score,
    }

    top_label, top_score = max(scores.items(), key=lambda kv: kv[1])

    if top_score < 3:
        return "LOW_PRESSURE"

    # If IV is extremely high, label it clearly even if other signals exist.
    if iv_score >= 8 and iv_score >= skew_score and iv_score >= demand_score:
        return "IV_DRIVEN"

    return top_label


# ==================================================
# Build runtime
# ==================================================

def build_runtime(symbols: Optional[List[str]] = None) -> Dict[str, Any]:
    coverage_meta = None

    if symbols is None:
        symbols, coverage_meta = extract_symbols()
    else:
        symbols = [normalize_symbol(s) for s in symbols if normalize_symbol(s)]
        coverage_meta = {
            "coverage_source": "manual_cli_symbols",
            "deduped_symbol_count": len(symbols),
        }

    rows: Dict[str, Any] = {}
    ok_count = 0
    error_count = 0

    for sym in symbols:
        sym = normalize_symbol(sym)

        if not sym:
            continue

        row = fetch_option_chain_yfinance(sym)
        rows[sym] = row

        if row.get("status") == "ok":
            ok_count += 1
        else:
            error_count += 1

    return {
        "meta": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "source": "yfinance",
            "source_quality": "pilot_proxy",
            "symbol_count": len(rows),
            "ok_count": ok_count,
            "error_count": error_count,
            "coverage": coverage_meta,
            "purpose": "FCN rate pressure: IV + skew + demand",
            "rate_pressure_formula": "0.45*iv_score + 0.30*skew_score + 0.20*demand_score + 0.05*event_score",
        },
        "data": rows,
    }


def main(argv: List[str]) -> int:
    symbols = None

    if len(argv) > 1:
        # Example:
        #   python scripts/update_option_runtime.py NVDA MU TSM
        symbols = [normalize_symbol(x) for x in argv[1:] if normalize_symbol(x)]

    runtime = build_runtime(symbols)

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    with OUT_PATH.open("w", encoding="utf-8") as f:
        json.dump(runtime, f, ensure_ascii=False, indent=2)

    print(f"Wrote {OUT_PATH}")
    print(json.dumps(runtime["meta"], ensure_ascii=False, indent=2))

    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))

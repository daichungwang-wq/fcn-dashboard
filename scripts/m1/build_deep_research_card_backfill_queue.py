#!/usr/bin/env python3
"""Build the next deep research card backfill queue for M1.

This script is intentionally detect-only. It selects the next symbols that need
deep research cards and writes a diagnostic report, but it never invents or
updates research-card content.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_POOL30_PATH = REPO_ROOT / "data" / "pool30.json"
DEFAULT_CANDIDATE_PATH = REPO_ROOT / "data" / "m1" / "m1_candidate_80.json"
DEFAULT_UNIVERSE_PATH = REPO_ROOT / "data" / "m1" / "universe_150.json"
DEFAULT_DEEP_PROFILE_PATH = REPO_ROOT / "data" / "m1" / "m1_stock_profile.json"
DEFAULT_GENERIC_PROFILE_PATH = REPO_ROOT / "data" / "m1" / "m1_stock_profile_all.json"
DEFAULT_REPORT_PATH = REPO_ROOT / "data" / "m1" / "m1_deep_research_card_backfill_report.json"


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as fp:
        return json.load(fp)


def normalize_symbol(value: Any) -> str | None:
    if value is None:
        return None

    symbol = str(value).strip().upper()
    return symbol or None


def extract_symbols(payload: Any) -> list[str]:
    """Extract symbols from common list/object JSON shapes while preserving order."""
    raw_symbols: Iterable[Any]

    if isinstance(payload, list):
        raw_symbols = (
            item.get("symbol", item.get("ticker")) if isinstance(item, dict) else item
            for item in payload
        )
    elif isinstance(payload, dict):
        for key in ("symbols", "tickers", "items", "data", "rows", "universe"):
            value = payload.get(key)
            if isinstance(value, list):
                return extract_symbols(value)
        raw_symbols = payload.keys()
    else:
        return []

    seen: set[str] = set()
    symbols: list[str] = []
    for raw_symbol in raw_symbols:
        symbol = normalize_symbol(raw_symbol)
        if symbol and symbol not in seen:
            seen.add(symbol)
            symbols.append(symbol)
    return symbols


def extract_profile_symbols(payload: Any) -> set[str]:
    symbols: set[str] = set()

    if isinstance(payload, dict):
        for key, value in payload.items():
            key_symbol = normalize_symbol(key)
            if key_symbol and key_symbol != "QUALITY_CHECK":
                symbols.add(key_symbol)

            if isinstance(value, dict):
                value_symbol = normalize_symbol(value.get("symbol", value.get("ticker")))
                if value_symbol:
                    symbols.add(value_symbol)
        return symbols

    if isinstance(payload, list):
        return set(extract_symbols(payload))

    return symbols


def as_report_path(path: Path) -> str:
    try:
        return path.relative_to(REPO_ROOT).as_posix()
    except ValueError:
        return str(path)


def ranked_symbol_rows(pool30_path: Path, candidate_path: Path, universe_path: Path) -> list[dict[str, Any]]:
    tiers = [
        ("pool30", pool30_path, 1),
        ("candidate80", candidate_path, 2),
        ("universe150", universe_path, 3),
    ]

    rows: list[dict[str, Any]] = []
    seen: set[str] = set()
    for source, path, priority_rank in tiers:
        for index, symbol in enumerate(extract_symbols(load_json(path)), start=1):
            if symbol in seen:
                continue
            seen.add(symbol)
            rows.append(
                {
                    "symbol": symbol,
                    "source": source,
                    "priority_rank": priority_rank,
                    "source_order": index,
                }
            )
    return rows


def coverage_status(
    symbol: str,
    deep_symbols: set[str],
    generic_symbols: set[str],
) -> tuple[str, bool, str]:
    if symbol in deep_symbols:
        return "deep_profile_exists", False, "already covered by m1_stock_profile.json"
    if symbol in generic_symbols:
        return "legacy_fallback_only", True, "generic fallback exists, but deep profile is missing"
    return "missing_deep_card", True, "missing from deep profile and generic fallback"


def build_report(
    limit: int,
    pool30_path: Path,
    candidate_path: Path,
    universe_path: Path,
    deep_profile_path: Path,
    generic_profile_path: Path,
) -> dict[str, Any]:
    pool30_symbols = set(extract_symbols(load_json(pool30_path)))
    candidate_symbols = set(extract_symbols(load_json(candidate_path)))
    universe_symbols = set(extract_symbols(load_json(universe_path)))
    deep_symbols = extract_profile_symbols(load_json(deep_profile_path))
    generic_symbols = (
        extract_profile_symbols(load_json(generic_profile_path))
        if generic_profile_path.exists()
        else set()
    )

    queue: list[dict[str, Any]] = []
    coverage_rows: list[dict[str, Any]] = []
    covered_by_deep = 0
    legacy_fallback_only = 0
    missing_deep = 0

    ranked_rows = ranked_symbol_rows(pool30_path, candidate_path, universe_path)
    for row in ranked_rows:
        symbol = row["symbol"]
        status, queue_eligible, skip_reason = coverage_status(symbol, deep_symbols, generic_symbols)

        coverage_row = {
            **row,
            "in_pool30": symbol in pool30_symbols,
            "in_candidate80": symbol in candidate_symbols,
            "in_universe150": symbol in universe_symbols,
            "in_m1_stock_profile": symbol in deep_symbols,
            "in_m1_stock_profile_all": symbol in generic_symbols,
            "coverage_status": status,
            "queue_eligible": queue_eligible,
            "skip_reason": None if queue_eligible else skip_reason,
        }
        coverage_rows.append(coverage_row)

        if status == "deep_profile_exists":
            covered_by_deep += 1
            continue

        missing_deep += 1
        if status == "legacy_fallback_only":
            legacy_fallback_only += 1

        queue.append(
            {
                **coverage_row,
                "recommended_action": "prepare sourced deep research card before updating m1_stock_profile.json",
            }
        )

    next_queue = queue[:limit]

    return {
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "mode": "detect_only_backfill_queue",
        "policy": {
            "deep_card_priority": True,
            "generic_card_required": False,
            "auto_generate_research_content": False,
            "auto_update_m1_stock_profile": False,
            "queue_requires_deep_profile_missing": True,
        },
        "inputs": {
            "pool30": as_report_path(pool30_path),
            "candidate80": as_report_path(candidate_path),
            "universe150": as_report_path(universe_path),
            "deep_profile": as_report_path(deep_profile_path),
            "generic_profile": as_report_path(generic_profile_path),
        },
        "summary": {
            "ranked_symbol_count": len(ranked_rows),
            "covered_by_deep_card_count": covered_by_deep,
            "missing_deep_card_count": missing_deep,
            "legacy_fallback_only_count": legacy_fallback_only,
            "next_queue_count": len(next_queue),
            "daily_limit": limit,
        },
        "coverage_verification": coverage_rows,
        "next_5_symbol_queue": next_queue,
        "all_missing_deep_cards": queue,
        "skipped_reason": "Symbols already present in m1_stock_profile.json are treated as covered.",
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--limit", type=int, default=5, help="Maximum queue size.")
    parser.add_argument("--pool30", type=Path, default=DEFAULT_POOL30_PATH)
    parser.add_argument("--candidate80", type=Path, default=DEFAULT_CANDIDATE_PATH)
    parser.add_argument("--universe150", type=Path, default=DEFAULT_UNIVERSE_PATH)
    parser.add_argument("--deep-profile", type=Path, default=DEFAULT_DEEP_PROFILE_PATH)
    parser.add_argument("--generic-profile", type=Path, default=DEFAULT_GENERIC_PROFILE_PATH)
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_REPORT_PATH,
        help="Report path. Defaults to data/m1/m1_deep_research_card_backfill_report.json.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    report = build_report(
        max(args.limit, 1),
        args.pool30,
        args.candidate80,
        args.universe150,
        args.deep_profile,
        args.generic_profile,
    )
    output = args.output if args.output.is_absolute() else REPO_ROOT / args.output
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8") as fp:
        json.dump(report, fp, ensure_ascii=False, indent=2)
        fp.write("\n")

    print(f"Wrote {output.relative_to(REPO_ROOT)}")
    print(json.dumps(report["summary"], ensure_ascii=False, indent=2))
    if report["next_5_symbol_queue"]:
        print("next_queue=" + ", ".join(item["symbol"] for item in report["next_5_symbol_queue"]))
    else:
        print("next_queue=none")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

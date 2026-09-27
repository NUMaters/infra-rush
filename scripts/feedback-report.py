#!/usr/bin/env python3
"""Summarize opt-in solo-match feedback exported from the Fly volume."""

import collections
import json
import statistics
import sys


def main(path: str) -> None:
    records = {}
    with open(path, encoding="utf-8") as source:
        for line in source:
            try:
                record = json.loads(line)
                records[record["id"]] = record
            except (ValueError, KeyError):
                continue
    labels = {"easy": "かんたん", "normal": "ふつう", "hard": "むずかしい"}
    for selected, label in labels.items():
        rows = [r for r in records.values() if r.get("selectedDifficulty") == selected]
        counts = collections.Counter(r.get("feltDifficulty") for r in rows)
        outcomes = collections.Counter(r.get("outcome") for r in rows)
        print(f"{label}: 回答 {len(rows)}件")
        if not rows:
            continue
        print("  体感:", ", ".join(f"{labels[key]} {counts[key]}" for key in labels))
        print("  結果:", ", ".join(f"{key} {outcomes[key]}" for key in ("win", "loss", "draw")))
        print("  試合時間の中央値:", round(statistics.median(r["durationSeconds"] for r in rows)), "秒")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python3 scripts/feedback-report.py feedback.jsonl")
    main(sys.argv[1])

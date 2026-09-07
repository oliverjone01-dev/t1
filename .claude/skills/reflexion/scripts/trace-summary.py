#!/usr/bin/env python3
"""trace-summary.py - агрегация трейсов Protocol 14 за период (для CC-19 Reflexion).

Usage:
    python3 .claude/skills/reflexion/scripts/trace-summary.py [YYYY-MM]   # по умолчанию текущий месяц
    python3 .claude/skills/reflexion/scripts/trace-summary.py 2026-09 --json

Читает traces/YYYY-MM-DD/agents.jsonl (schemas/agent-trace.json) и печатает:
вызовы по агентам, вердикты ФЕНИКСА и распределение оценок, итерации, режимы Council,
эскалации/HITL-блоки, невалидные строки. Никаких содержимых сообщений - только счётчики.
"""
from __future__ import annotations

import json
import statistics
import sys
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

def _find_root() -> Path:
    """Корень проекта: CLAUDE_PROJECT_DIR, иначе вверх от cwd до каталога с traces/ или schemas/,
    иначе положение скрипта (аудит 2026-09-06: при установке плагином parents[4] указывал в каталог плагина)."""
    import os
    env = os.environ.get("CLAUDE_PROJECT_DIR")
    if env and Path(env).is_dir():
        return Path(env).resolve()
    here = Path.cwd().resolve()
    for cand in (here, *here.parents):
        if (cand / "traces").is_dir() or (cand / "schemas").is_dir():
            return cand
    return Path(__file__).resolve().parents[4]


ROOT = _find_root()
sys.path.insert(0, str(ROOT / "schemas"))
try:
    from validate import validate  # noqa: E402
    SCHEMA = json.loads((ROOT / "schemas" / "agent-trace.json").read_text(encoding="utf-8"))
except Exception:  # noqa: BLE001
    validate, SCHEMA = None, None


def main(argv: list[str]) -> int:
    month = next((a for a in argv if not a.startswith("--")), date.today().strftime("%Y-%m"))
    as_json = "--json" in argv
    files = sorted((ROOT / "traces").glob(f"{month}-*/agents.jsonl"))
    if not files:
        print(f"Нет traces/{month}-*/agents.jsonl", file=sys.stderr)
        return 1

    calls = Counter()
    stops = Counter()
    outcomes = defaultdict(Counter)
    verdicts = Counter()
    scores: list[float] = []
    scores_by_agent = defaultdict(list)
    events = Counter()
    modes = Counter()
    invalid = 0
    total = 0
    for f in files:
        for line in f.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            total += 1
            try:
                r = json.loads(line)
            except json.JSONDecodeError:
                invalid += 1
                continue
            if validate and validate(r, SCHEMA):
                invalid += 1
                continue
            ev, ag = r.get("event"), r.get("agent", "unknown")
            events[ev] += 1
            if ev == "subagent_start":
                calls[ag] += 1
            if ev == "subagent_stop":
                stops[ag] += 1
                outcomes[ag][r.get("outcome", "unknown")] += 1
            if ev in ("audit", "council") or ag == "feniks":
                if r.get("verdict"):
                    verdicts[r["verdict"]] += 1
                if isinstance(r.get("feniks_score"), (int, float)):
                    scores.append(float(r["feniks_score"]))
            if r.get("mode"):
                modes[r["mode"]] += 1

    summary = {
        "month": month,
        "days_with_traces": len(files),
        "records": total,
        "invalid_records": invalid,
        "events": dict(events),
        "calls_by_agent": dict(calls.most_common()),
        "outcomes_by_agent": {k: dict(v) for k, v in outcomes.items()},
        "feniks_verdicts": dict(verdicts),
        "feniks_scores": {
            "n": len(scores),
            "mean": round(statistics.mean(scores), 2) if scores else None,
            "median": round(statistics.median(scores), 2) if scores else None,
            "min": min(scores) if scores else None,
            "max": max(scores) if scores else None,
            "share_go": round(verdicts.get("go", 0) / sum(verdicts.values()), 2) if sum(verdicts.values()) else None,
            "share_ge_75": round(sum(1 for s in scores if s >= 7.5) / len(scores), 2) if scores else None,
        },
        "council_modes": dict(modes),
    }
    if as_json:
        print(json.dumps(summary, ensure_ascii=False, indent=2))
        return 0

    print(f"# Traces {month}: {total} записей за {len(files)} дней, невалидных {invalid}")
    print("\n## Вызовы по агентам (start / stop / outcomes)")
    for ag, n in calls.most_common():
        print(f"- {ag}: {n} / {stops[ag]} / {dict(outcomes[ag]) or '-'}")
    print("\n## ФЕНИКС")
    print(f"- вердикты: {dict(verdicts) or '-'}")
    fs = summary["feniks_scores"]
    print(f"- оценки: n={fs['n']} mean={fs['mean']} median={fs['median']} min={fs['min']} max={fs['max']} share_go(по вердикту)={fs['share_go']} share_ge_75(по оценке)={fs['share_ge_75']}")
    print(f"\n## События: {dict(events)}")
    print(f"## Режимы Council: {dict(modes) or '-'}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

#!/usr/bin/env python3
"""Smoke validation for GENGROUP v9.0 JSON schemas.

Runs:
1. Meta-validation: each schema valid against Draft 2020-12
2. Sample-validation: representative payloads pass their schema

Usage:
    python3 schemas/smoke-test.py          # jsonschema опционален (pip install jsonschema для meta-check)

Exit code:
    0 - all valid
    1 - any failure
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

SCHEMA_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCHEMA_DIR))
from validate import validate  # noqa: E402  (jsonschema если есть, иначе встроенный fallback)

try:
    from jsonschema import Draft202012Validator
except ImportError:  # meta-validation пропускается без jsonschema
    Draft202012Validator = None

SAMPLES: dict[str, dict] = {
    "a2a-message.json": {
        "from": "marco",
        "to": "feniks",
        "intent": "review_request",
        "thread_id": "council-2026-06-08-01",
        "context": {"p9_required": True, "cost_budget_usd": 0.5},
        "expected_output": "audit-report",
    },
    "audit-report.json": {
        "agent": "feniks",
        "skill": "phoenix-eval",
        "task_id": "smoke-test-001",
        "timestamp": "2026-06-08T12:00:00+03:00",
        "scores": {
            "accuracy": 8.0,
            "actionability": 8.0,
            "insight": 7.0,
            "brand_fit": 9.0,
            "risk_awareness": 7.0,
        },
        "weighted_total": 7.80,
        "verdict": "go",
    },
    "council-vote.json": {
        "voter": "marco",
        "council_id": "CC-12-smoke",
        "target_id": "AnonymA",
        "scores": {
            "accuracy": 7.0,
            "actionability": 8.0,
            "insight": 6.0,
            "brand_fit": 8.0,
            "risk_awareness": 7.0,
        },
        "weighted_total": 7.20,
        "vote": "best",
    },
    "agent-trace.json": {
        "ts": "2026-09-06T10:00:00Z",
        "event": "subagent_stop",
        "agent": "feniks",
        "tier": "0",
        "outcome": "vetoed",
        "feniks_score": 5.83,
        "verdict": "veto",
        "mode": "council",
    },
    "roadmap-entry.json": {
        "id": "ROAD-2026-Q3-001",
        "title": "Smoke roadmap entry",
        "owner": "Иван",
        "deadline": "2026-09-01",
        "p9_status": "passed",
        "first_checkpoint": {
            "date": "2026-07-01",
            "criterion": "mvp shipped",
            "owner": "Claude",
        },
        "ice": {"impact": 7, "confidence": 6, "ease": 5, "total": 210},
        "effort_hours": {"estimate": 40, "buffer_percent": 30},
        "expected_effect": {
            "value": 1_000_000,
            "tag": "data",
            "source": "CRM cohort",
        },
        "downside": {
            "scenario": "no impact",
            "lost_resources": "40h team",
            "reputational_risk": "low",
        },
    },
}


def _extra_fixtures() -> dict[str, tuple[Path, object]]:
    """Реальные артефакты как фикстуры: канонический пример из phoenix-eval и живой отчёт ФЕНИКСА."""
    import re
    fx: dict[str, tuple[Path, object]] = {}
    root = SCHEMA_DIR.parent
    skill = root / ".claude" / "skills" / "phoenix-eval" / "SKILL.md"
    if skill.exists():
        m = re.search(r"## Output JSON.*?```json\n(.*?)\n```", skill.read_text(encoding="utf-8"), re.S)
        if m:
            fx["phoenix-eval example"] = (SCHEMA_DIR / "audit-report.json", json.loads(m.group(1)))
    live = root / "traces" / "2026-07-01" / "feniks-newsletter-lazer-steel-20260701.json"
    if live.exists():
        fx["traces/2026-07-01 feniks newsletter"] = (SCHEMA_DIR / "audit-report.json", json.loads(live.read_text(encoding="utf-8")))
    return fx


def main() -> int:
    failures = 0
    for label, (path, sample) in _extra_fixtures().items():
        schema = json.loads(path.read_text(encoding="utf-8"))
        errors = validate(sample, schema)
        if errors:
            print(f"FAIL  fixture {label}:")
            for err in errors[:5]:
                print(f"      - {err}")
            failures += 1
        else:
            print(f"OK    fixture {label}")
    for name, sample in SAMPLES.items():
        path = SCHEMA_DIR / name
        try:
            schema = json.loads(path.read_text())
        except Exception as e:
            print(f"FAIL  {name}: cannot load ({e})")
            failures += 1
            continue

        if Draft202012Validator is not None:
            try:
                Draft202012Validator.check_schema(schema)
            except Exception as e:
                print(f"FAIL  {name}: schema meta-invalid ({e})")
                failures += 1
                continue

        errors = validate(sample, schema)
        if errors:
            print(f"FAIL  {name}: sample violates schema:")
            for err in errors[:5]:
                print(f"      - {err}")
            failures += 1
        else:
            print(f"OK    {name}")

    if failures:
        print(f"\n{failures} schema(s) failed validation", file=sys.stderr)
        return 1
    print(f"\nAll {len(SAMPLES)} schemas valid" + (" (meta + sample)" if Draft202012Validator else " (sample; meta skipped: no jsonschema)"))
    return 0


if __name__ == "__main__":
    sys.exit(main())

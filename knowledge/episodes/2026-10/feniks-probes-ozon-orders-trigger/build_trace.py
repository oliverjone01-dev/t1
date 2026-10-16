#!/usr/bin/env python3
"""ФЕНИКС #484: строка трейса event=audit (для переноса координатором в traces/2026-10-16/agents.jsonl)."""
import json

OUT = "/tmp/claude-0/-home-user-t1/76832855-1f9d-5a4f-aeaa-595f7a6dd8fa/scratchpad/out/traces-2026-10-16-agents.pr484.line.jsonl"
note = (
    "PR #484 orders-backfill: push по reakciya.json + dispatch ozon-snapshots. RETURN 7.30. "
    "FAIL A5b: шаг коммита зелёный при 4 отклонённых push (песочница), цепочка пересобирает сайт без заказов. "
    "K1: после 14f92987 ozon-snapshots 4 раза в день в 15 из 15 дней (комментарий неверен). "
    "K7: начисления упали в 4 из 7 попыток, прогонов orders 3 в день. PASS: петли нет (0 бот-коммитов в 100 push), "
    "dispatch 5 сценариев, вечер без неполного дня, actionlint без новых. Охват: весь путь ветки (1 файл)."
)
assert len(note) <= 500, len(note)
rec = {
    "ts": "2026-10-16T07:20:00+00:00",
    "event": "audit",
    "agent": "feniks",
    "tier": "0",
    "task_id": "feniks-ozon-orders-trigger-pr484-20261016",
    "mode": "red_team",
    "outcome": "returned",
    "verdict": "return",
    "feniks_score": 7.3,
    "confidence": 0.8,
    "deliverable_ref": "PR #484 claude/amazing-hawking-0trncq@a8b1100d (.github/workflows/orders-backfill.yml); отчёт knowledge/episodes/2026-10/feniks-audit-ozon-orders-trigger-20261016.md",
    "audited_hash": "f49ba0d7eb4d7993",
    "note": note,
}
open(OUT, "w", encoding="utf-8").write(json.dumps(rec, ensure_ascii=False) + "\n")
print("written", OUT, "note chars", len(note))

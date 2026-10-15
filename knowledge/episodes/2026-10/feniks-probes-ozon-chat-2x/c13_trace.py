# ФЕНИКС, PR #477 @ 889c35b: строка трейса event: audit (Protocol 14, schemas/agent-trace.json).
# python3 -I c13_trace.py
import json, datetime, pathlib

d = datetime.datetime.now(datetime.timezone.utc)
p = pathlib.Path(f"/home/user/t1/traces/{d:%Y-%m-%d}")
p.mkdir(parents=True, exist_ok=True)
note = ("ветка claude/amazing-hawking-0trncq @ 889c35b, PR #477; охват: все 11 путей хеша + инструкция чату (вне хеша). "
        "return 7.4: I1 инструкция противоречит живым файлам (acts 335 из 460 товаров, агрегаты 146 пар test/control), "
        "I2 перезабор вчера для мгновенных состояний, G2 ключ агрегатов без группы, S1 сверка с кабинетом суммой и без охвата, "
        "B3 строка незакрытого дня по строкам (+5,6%). N8, N7, N4 закрыты (Z1, N7, N4 PASS), регресса на живых данных нет (R2).")
assert len(note) <= 500, len(note)
rec = {"ts": d.isoformat(timespec="seconds"), "event": "audit", "agent": "feniks", "tier": "0",
       "task_id": "feniks-ozon-chat-2x-20261015", "outcome": "returned", "confidence": 0.85,
       "feniks_score": 7.4, "verdict": "return",
       "deliverable_ref": "knowledge/episodes/2026-10/feniks-audit-ozon-chat-2x-20261015.md",
       "audited_hash": "de7731763f1d59fd", "note": note}
with (p / "agents.jsonl").open("a", encoding="utf-8") as f:
    f.write(json.dumps(rec, ensure_ascii=False) + "\n")
print("ok", len(note), rec["ts"])

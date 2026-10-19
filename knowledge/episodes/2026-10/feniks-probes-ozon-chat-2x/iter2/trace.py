# ФЕНИКС iter2, PR #477 @ 3121423: строка трейса event: audit (Protocol 14). python3 -I trace.py
import json, datetime, pathlib

d = datetime.datetime.now(datetime.timezone.utc)
p = pathlib.Path(f"/home/user/t1/traces/{d:%Y-%m-%d}")
p.mkdir(parents=True, exist_ok=True)
note = ("ветка claude/amazing-hawking-0trncq @ 3121423, PR #477, iter2; охват: все 13 путей хеша + инструкция чату v4. "
        "go 8.5: return iter1 закрыт live-пробами (I1/I2 на живых файлах, G2 rows 6705 и 16 агрегатов = control, "
        "S1/S2 на полном охвате 1158 пар, B3 21 / 2 683, G1 выборка = c1cff23, E008), регресса нет. "
        "Gaps: спека v2 отстала от кода в трёх полях, допуск сверки 2 -> 1 шт без «да» Ивана (до 22.10); "
        "проверки после пуша без области; остатки P1/P5/группа; тексты «по будням».")
assert len(note) <= 500, len(note)
rec = {"ts": d.isoformat(timespec="seconds"), "event": "audit", "agent": "feniks", "tier": "0",
       "task_id": "feniks-ozon-chat-2x-iter2-20261015", "outcome": "success", "confidence": 0.85,
       "feniks_score": 8.5, "verdict": "go",
       "deliverable_ref": "knowledge/episodes/2026-10/feniks-audit-ozon-chat-2x-iter2-20261015.md",
       "audited_hash": "5800e5d962e8c38a", "note": note}
with (p / "agents.jsonl").open("a", encoding="utf-8") as f:
    f.write(json.dumps(rec, ensure_ascii=False) + "\n")
print("ok", len(note), rec["ts"])

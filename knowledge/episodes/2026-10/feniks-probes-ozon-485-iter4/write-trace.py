#!/usr/bin/env python3
# ФЕНИКС #485 iter4: строка трейса event audit, return без скоринга (Protocol 14). Запуск: python3 -I <этот файл>
import datetime
import json
import pathlib

d = datetime.datetime.now(datetime.timezone.utc)
p = pathlib.Path("/home/user/t1/traces") / d.strftime("%Y-%m-%d")
p.mkdir(parents=True, exist_ok=True)
rec = {
    "ts": d.isoformat(timespec="seconds"), "event": "audit", "agent": "feniks", "outcome": "returned", "confidence": 0.9,
    "deliverable_ref": "PR #485 @ b246e4c8 (knowledge/episodes/2026-10/feniks-audit-ozon-485-iter4-20261016.md)",
    "verdict": "return",
    "note": ("iter4 #485: return без скоринга, self-check не по чек-листу (5 диапазонов вместо 25 чекпоинтов да/нет/частично, "
             "темы 6-20 не совпадают с eval-checklist), предупреждение было в iter3. Факты, не оценка: P1 на b246e4c PASS "
             "(6 строк от 14.10, 0 расхождений, 23 строки = v3, v4 из скрипта байт в байт), plan-tab 87/87, хеш e4bc0cf255f5a6db. "
             "Статусы 16.10: 3 частично из-за сдвига 15.10 (N1). Мерж: подтверждение Ивана в К11 или повтор с self-check."),
}
with (p / "agents.jsonl").open("a", encoding="utf-8") as f:
    f.write(json.dumps(rec, ensure_ascii=False) + "\n")
print("ok", rec["ts"], len(rec["note"]))

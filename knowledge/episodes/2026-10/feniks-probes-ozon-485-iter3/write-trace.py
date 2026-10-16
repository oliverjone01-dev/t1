#!/usr/bin/env python3
# ФЕНИКС #485 iter3: строка трейса event audit (Protocol 14). Запуск: python3 -I <этот файл>
import datetime
import json
import pathlib

d = datetime.datetime.now(datetime.timezone.utc)
p = pathlib.Path("/home/user/t1/traces") / d.strftime("%Y-%m-%d")
p.mkdir(parents=True, exist_ok=True)
rec = {
    "ts": d.isoformat(timespec="seconds"), "event": "audit", "agent": "feniks", "outcome": "success", "confidence": 0.85,
    "deliverable_ref": "PR #485 @ 37ff0b83 (knowledge/episodes/2026-10/feniks-audit-ozon-485-iter3-20261016.md)",
    "feniks_score": 8.65, "verdict": "go", "audited_hash": "6ad41fc549edf0e4",
    "note": ("iter3 #485, охват полный (8 путей). A: K1 закрыт, W1 на 5716b67 S3 exit 0, S2/S5 exit 1; K2/K4 в теле PR. "
             "B: план v4, 6 строк 16.10 пересчитаны из prices_daily 15.10 без расхождений, v4 из скрипта байт в байт, vitest 1086/1087. "
             "Gaps: смена режима prices_daily 15.10 (before==price 464/464, coinv 0, 17 смен цены вне плана) не замечена; "
             "итог от 14.10 у 3 артикулов -10.9/-12.75/-14.5 проц. Ивану не показан; K3 открыт."),
}
with (p / "agents.jsonl").open("a", encoding="utf-8") as f:
    f.write(json.dumps(rec, ensure_ascii=False) + "\n")
print("ok", rec["ts"], len(rec["note"]))

#!/usr/bin/env python3
# ФЕНИКС #485 iter5: строка трейса event audit (Protocol 14). Запуск: python3 -I <этот файл>
import datetime
import json
import pathlib

d = datetime.datetime.now(datetime.timezone.utc)
p = pathlib.Path("/home/user/t1/traces") / d.strftime("%Y-%m-%d")
p.mkdir(parents=True, exist_ok=True)
rec = {
    "ts": d.isoformat(timespec="seconds"), "event": "audit", "agent": "feniks", "outcome": "success", "confidence": 0.85,
    "deliverable_ref": "PR #485 @ 6dfa7b2d, продукт = b246e4c (knowledge/episodes/2026-10/feniks-audit-ozon-485-iter5-20261016.md)",
    "feniks_score": 8.8, "verdict": "go", "audited_hash": "e4bc0cf255f5a6db",
    "note": ("iter5 #485, охват полный (8 путей ветки; b246e4c..6dfa7b2 только episodes/traces, хеш HEAD = e4bc0cf255f5a6db). "
             "Self-check 25 пунктов приложен. Продукт = b246e4c: P1 iter4 PASS, W1 iter3 PASS (yml не менялся). "
             "N2 закрыт решением Ивана (база 14.10), N1 назван в PR и вынесен. Gaps: в PR «не снижение Ивана по плану» "
             "и для GGT-48-2-2, стоявшего в плане на 15.10 (не доказано); K3 открыт; N3 не оценён автором."),
}
with (p / "agents.jsonl").open("a", encoding="utf-8") as f:
    f.write(json.dumps(rec, ensure_ascii=False) + "\n")
print("ok", rec["ts"], len(rec["note"]))

# ФЕНИКС iter4: строка трейса event: audit (Protocol 14) в traces/<дата>/agents.jsonl. python3 -I trace_iter4.py
import json, datetime, pathlib
d = datetime.datetime.now(datetime.timezone.utc)
p = pathlib.Path(f"/home/user/t1/traces/{d:%Y-%m-%d}"); p.mkdir(parents=True, exist_ok=True)
rec = {"ts": d.isoformat(timespec="seconds"), "event": "audit", "agent": "feniks", "outcome": "success", "confidence": 0.8,
       "feniks_score": 7.8, "verdict": "go", "audited_hash": "fe21110678075a4b",
       "deliverable_ref": "knowledge/episodes/2026-10/feniks-audit-ozon-plan-price-status-iter4-20261015.md",
       "task_id": "feniks-ozon-plan-price-status-iter4-20261015",
       "note": ("PR #481 @ ba5b560 поверх b55e514, все 5 путей хеша. Числа v7 повторены своим кодом (170/104, 219,5/151, 14,76/10,35, "
                "812 862/453 018), «на пути» = таблица 1 37 из 37, W6 и W5 закрыты, серверные правила v7 под тестами. Gaps: G1 цвет дуги "
                "под стрелкой спорит со статусом в 62 из 111 состояний (до сборки 16.10), B4 «Как считаем» по v5, T4 1 из 7, M5 23 из 33 живы, "
                "T1, W3. Следующий запрос по блоку без G1 - return.")}
assert len(rec["note"]) <= 500, len(rec["note"])
with (p / "agents.jsonl").open("a", encoding="utf-8") as fh:
    fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
print("ok", p / "agents.jsonl", len(rec["note"]))

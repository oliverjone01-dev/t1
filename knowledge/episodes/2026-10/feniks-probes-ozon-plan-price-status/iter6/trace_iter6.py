# ФЕНИКС iter6: строка трейса event: audit (Protocol 14) в scratch (хуки блокируют /home/user/t1-wt); автор дописывает её
# в /home/user/t1-wt/traces/<дата>/agents.jsonl одной строкой. python3 -I trace_iter6.py
import json, datetime, pathlib
d = datetime.datetime.now(datetime.timezone.utc)
p = pathlib.Path(f'/tmp/claude-0/-home-user-t1/76832855-1f9d-5a4f-aeaa-595f7a6dd8fa/scratchpad/out/traces-{d:%Y-%m-%d}-agents.iter6.line.jsonl')
rec = {"ts": d.isoformat(timespec="seconds"), "event": "audit", "agent": "feniks", "outcome": "success", "confidence": 0.8,
       "feniks_score": 8.4, "verdict": "go", "audited_hash": "28a5fec9f1e28feb",
       "deliverable_ref": "knowledge/episodes/2026-10/feniks-audit-ozon-plan-iter6-20261016.md",
       "task_id": "feniks-ozon-plan-iter6-20261016",
       "note": ("PR #482 голова 2677794e, код db5ede19 (дельта к go 7.95). G3 Codex P2 закрыт: дуг нулевой длины 0, без дуги цвета "
                "статуса 108 -> 0, день 1 стрелки внутри жёлтых; R2 tsc 15 = 15; 83/83, smoke, jsdom 0 ошибок на 61 сборке. Остаток "
                "G1t: тест берёт положение дуг и стрелки из data-атрибутов (G1b, G1n живы). T4/M5, T1 до 22.10, W3, ноябрь в тексте.")}
assert len(rec["note"]) <= 500, len(rec["note"])
p.write_text(json.dumps(rec, ensure_ascii=False) + "\n", encoding="utf-8")
print("ok", p, len(rec["note"]))

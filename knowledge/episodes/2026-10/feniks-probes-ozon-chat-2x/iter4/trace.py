# ФЕНИКС iter4: строка трейса event: audit (Protocol 14). Дописывает одну строку в traces/2026-10-15/agents.jsonl.
# python3 -I trace.py
import json, datetime, pathlib
d = datetime.datetime.now(datetime.timezone.utc)
p = pathlib.Path('/home/user/t1/traces/2026-10-15/agents.jsonl')
note = ('PR #479 @ da0a36b (запрос 753bf11 = d7233195c3f64dc2), iter4; охват: все 6 путей хеша + v8/withdraw_base_1510.py, '
        'инструкция v4, data/ коммита. go 8.5: V3 закрыт (пороги 10 из 10 своим кодом, заморозка байт-в-байт), B1c закрыт на '
        'фикстурах с ts. 753bf11 падал на клиенте (ReferenceError wkLast, нашёл Codex, CI зелёный), da0a36b: jsdom 0 ошибок, '
        'smoke OK. Gaps: T4 клиент вне тестов и смоука PR, W3 спидометр рекламы после 28.10, B1d сверка в день решения.')
assert len(note) <= 500, len(note)
rec = {"ts": d.isoformat(timespec="seconds"), "event": "audit", "agent": "feniks", "tier": "0",
       "task_id": "feniks-ozon-chat-2x-iter4-20261015", "outcome": "success", "confidence": 0.85,
       "feniks_score": 8.5, "verdict": "go",
       "deliverable_ref": "knowledge/episodes/2026-10/feniks-audit-ozon-chat-2x-iter4-20261015.md",
       "audited_hash": "adcdcfd5420b7619", "note": note}
with p.open('a', encoding='utf-8') as f:
    f.write(json.dumps(rec, ensure_ascii=False) + '\n')
print(rec['ts'], len(note))

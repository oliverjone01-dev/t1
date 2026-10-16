# ФЕНИКС iter5: строка трейса event: audit (Protocol 14). Хуки feniks-write-scope / feniks-bash-scope считают зоны записи от
# /home/user/t1 и блокируют /home/user/t1-wt, поэтому строка пишется в scratch (имя по дате события); автор дописывает её в
# /home/user/t1-wt/traces/<дата>/agents.jsonl одной строкой, как есть. python3 -I trace_iter5.py
import json, datetime, pathlib
d = datetime.datetime.now(datetime.timezone.utc)
out = pathlib.Path('/tmp/claude-0/-home-user-t1/76832855-1f9d-5a4f-aeaa-595f7a6dd8fa/scratchpad/out')
for old in out.glob('traces-*-agents.line.jsonl'):
    old.unlink()
p = out / f'traces-{d:%Y-%m-%d}-agents.line.jsonl'
rec = {"ts": d.isoformat(timespec="seconds"), "event": "audit", "agent": "feniks", "outcome": "success", "confidence": 0.8,
       "feniks_score": 7.95, "verdict": "go", "audited_hash": "3fc874ed10dd7cb7",
       "deliverable_ref": "knowledge/episodes/2026-10/feniks-audit-ozon-plan-iter5-20261015.md",
       "task_id": "feniks-ozon-plan-iter5-20261015",
       "note": ("PR #482 @ 381f11d5 (голова afc411aa), все 5 путей хеша. G1 закрыт: стрелка в дуге чужого цвета 0 из 173 состояний "
                "страницы и 0 из 33 177 сетки (iter4 62 из 111); B4 - «Как считаем» v7; 81/81; мутанты k=1 и «реклама как заказы» убиты. "
                "Gaps: Codex P2 подтверждён - в 1-й день периода жёлтая дуга магазина, оборота, рекламы нулевой длины; тест сверяет "
                "атрибут, не картинку (G1b, G1c живы); M5 21 из 39; tsc 15->16; ноябрь в «Как считаем»; T1, W3.")}
assert len(rec["note"]) <= 500, len(rec["note"])
p.write_text(json.dumps(rec, ensure_ascii=False) + "\n", encoding="utf-8")
print("ok", p, len(rec["note"]))

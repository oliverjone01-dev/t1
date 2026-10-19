# ФЕНИКС iter2: строка трейса event: audit (go 7.85 на 3810a26, audited_hash по всем 6 путям ветки).
import json, datetime, pathlib
d = datetime.datetime.now(datetime.timezone.utc)
p = pathlib.Path(f"/home/user/t1/traces/{d:%Y-%m-%d}"); p.mkdir(parents=True, exist_ok=True)
rec = {"ts": d.isoformat(timespec="seconds"), "event": "audit", "agent": "feniks", "outcome": "success", "confidence": 0.8,
       "feniks_score": 7.85, "verdict": "go", "audited_hash": "26fc0bdba53a48a9",
       "deliverable_ref": "knowledge/episodes/2026-10/feniks-audit-ozon-plan-price-status-iter2-20261015.md",
       "note": ("PR #480 @ 3810a26 (4f2409c цена + ab2997f спидометры за месяц + 3810a26 подпись), все 6 путей хеша. "
                "Числа повторены независимо, реклама сверена с финотчётом (862 240 / 862 239), смоук и jsdom целы. "
                "Gaps: W6 подушка 216 398 ₽ (вопрос Ивану до сборки 16.10), W5 «на пути» против решения 29.10, "
                "T1 статус цены по дате сборки (до 22.10), T4 просрочен, F1 мигание, W3 до 29.10, мутанты 17 из 27 живы.")}
assert len(rec["note"]) <= 500, len(rec["note"])
with (p / "agents.jsonl").open("a") as f:
    f.write(json.dumps(rec, ensure_ascii=False) + "\n")
print(p / "agents.jsonl", "note", len(rec["note"]))

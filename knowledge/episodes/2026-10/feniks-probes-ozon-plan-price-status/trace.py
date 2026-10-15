# ФЕНИКС: строка трейса event: audit, outcome: partial - аудит раздела 5 «Цена» прерван координатором до вердикта.
# Без verdict, без feniks_score, без audited_hash: go не выдавался, гейт К11 открываться не должен.
import json, datetime, pathlib
d = datetime.datetime.now(datetime.timezone.utc)
p = pathlib.Path(f"/home/user/t1/traces/{d:%Y-%m-%d}"); p.mkdir(parents=True, exist_ok=True)
rec = {"ts": d.isoformat(timespec="seconds"), "event": "audit", "agent": "feniks", "outcome": "partial", "confidence": 0.6,
       "deliverable_ref": "claude/amazing-hawking-0trncq@4f2409c (раздел 5 «Цена»: plan-tab.ts, test, client.js, css, decisions.md)",
       "note": ("Прерван координатором до вердикта: новые решения Ивана по спидометрам меняют plan-tab.ts и client.js на той же ветке. "
                "Вердикта и audited_hash нет (rev-хеш 28451191e5dcfc21 только для справки). Готово: vitest 74/74, jsdom 0 ошибок 0/20 пустых, "
                "B1 25/25 = страница, price_now = prices_daily 14.10 25/25. Предварительно: статус по дате сборки, а не по дате среза "
                "(16.10 до 09:00 МСК - 4 ложных «не снижена»; срез пропущен - 9 «не снижена» против «ждём» на main), T4 просрочен. "
                "Пробы: knowledge/episodes/2026-10/feniks-probes-ozon-plan-price-status/")}
with (p / "agents.jsonl").open("a") as f:
    f.write(json.dumps(rec, ensure_ascii=False) + "\n")
print(p / "agents.jsonl", len(rec["note"]))

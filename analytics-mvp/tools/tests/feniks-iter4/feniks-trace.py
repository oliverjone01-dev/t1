#!/usr/bin/env python3
import json, datetime, pathlib
d = datetime.datetime.now(datetime.timezone.utc)
p = pathlib.Path(f"/home/user/t1/traces/{d:%Y-%m-%d}")
p.mkdir(parents=True, exist_ok=True)
rec = {
    "ts": d.isoformat(timespec="seconds"),
    "event": "audit",
    "agent": "feniks",
    "tier": "0",
    "task_id": "feniks-ozon-cpc-card-spread-iter4-b243b28-20261013",
    "outcome": "returned",
    "confidence": 0.86,
    "feniks_score": 6.8,
    "verdict": "return",
    "deliverable_ref": "analytics-mvp/public/katya-reklama-kartochki.html @ b243b28",
    "audited_hash": "84ee0ba18466ad49",
    "note": ("OZON «Реклама по карточкам», 705e35e/bc2919e/8730cf3 + слияние main b243b28: return 6.80. "
             "Слияние чистое (страницы = main кроме кнопки, 0 ошибок JS). Главное: выручка CPO из колонки цены за штуку "
             "(сен 14 992 062 вместо 15 680 512, = orders_daily), расходится с «Отчетом» 14 073 867; ДРР CPO на чужом окне; "
             "ИТОГО «Реклама» ≠ «Деньгам» на 7 из 24 периодов. Голова PR 50d9c26f (бот EMO) не проверена, хеш b13c660043a17fd7."),
}
with (p / "agents.jsonl").open("a", encoding="utf-8") as fh:
    fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
print(len(rec["note"]), "note chars; written", p / "agents.jsonl")

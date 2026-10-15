#!/usr/bin/env python3
"""FENIKS iter11: one `event: audit` line into traces/<UTC date>/agents.jsonl (schemas/agent-trace.json)."""
import datetime, json, pathlib

d = datetime.datetime.now(datetime.timezone.utc)
p = pathlib.Path(f"/home/user/t1/traces/{d:%Y-%m-%d}")
p.mkdir(parents=True, exist_ok=True)
rec = {"ts": d.isoformat(timespec="seconds"), "event": "audit", "agent": "feniks", "tier": "0",
       "task_id": "feniks-ozon-report-cpo-iter11-978821206-20261015", "mode": "red_team", "outcome": "success",
       "confidence": 0.85, "feniks_score": 8.75, "verdict": "go",
       "deliverable_ref": "knowledge/episodes/2026-10/feniks-audit-ozon-report-cpo-iter11-20261015.md",
       "audited_hash": "00411db3bfde9957",
       "note": ("OZON «Отчет» + сборщики CPO, iter11 (978821206, все 16 путей ветки; fc9426655 сверху - только пробы и трейс): go 8.75. "
                "Gaps 1-5 iter10 закрыты моими фикстурами дословно: fzS, fzV, fzK - числа = p11, пометка с файлом и строкой; N3c без ложной ошибки, F2L/F3L с ошибкой; MA и RC убиты; U+2014 139 -> 0. "
                "Класс N2: 14 из 15 файлов с вырезанной записью PASS. Остаток: строка null (+792 742 ₽ без пометки), шаблоны katya/katya-tovary без пометки, строка без номера заказа, переобещание спеки.")}
with (p / "agents.jsonl").open("a", encoding="utf-8") as f:
    f.write(json.dumps(rec, ensure_ascii=False) + "\n")
print("trace written", p / "agents.jsonl", len(rec["note"]))

#!/usr/bin/env python3
"""FENIKS iter9: проверка моей рекомендации N1 до rework_tz. Песочницы fzBx (fzB) и p9x (данные ветки) на коде p9 с правкой
report-page.ts:361: под ошибкой cpoCov = нет расхода «за заказ» ни в API, ни в выгрузке. Затем build9.sh и fx9_report.mjs."""
import json, os, subprocess

S = "/tmp/claude-0/-home-user-t1/c4f0dfeb-cd9a-55ac-b7f6-154069ba26c7/scratchpad/i9"
OLD = "s.cpoCov=!!(!REP.cpoErr&&REP.cpoFrom&&per.from<=REP.cpoTo&&per.to>=REP.cpoFrom&&!Math.round(s.cpoExOut))||!Math.round(s.cpoApiSp);"
NEW = ("s.cpoCov=REP.cpoErr?(!Math.round(s.cpoApiSp)&&!Math.round(s.cpoSp)):"
       "(!!(REP.cpoFrom&&per.from<=REP.cpoTo&&per.to>=REP.cpoFrom&&!Math.round(s.cpoExOut))||!Math.round(s.cpoApiSp));")
for sb, drop in (("fzBx", True), ("p9x", False), ("fzCx", None)):
    subprocess.run(["python3", S + "/setup9.py", "fix", sb, "p9"], check=True)
    D = f"{S}/{sb}/analytics-mvp"
    f = D + "/src/scripts/report-page.ts"
    src = open(f, encoding="utf-8").read()
    assert OLD in src
    open(f, "w", encoding="utf-8").write(src.replace(OLD, NEW))
    if drop is True:
        rows = [l for l in open(D + "/data/ads_daily.ndjson", encoding="utf-8") if l.strip() and json.loads(l)["id"] != "28753239"]
        open(D + "/data/ads_daily.ndjson", "w", encoding="utf-8").write("".join(rows))
    elif drop is None:
        lines = open(D + "/data/cpo_sku_daily.ndjson", encoding="utf-8").read().splitlines()
        mid = len(lines) // 2
        open(D + "/data/cpo_sku_daily.ndjson", "w", encoding="utf-8").write("\n".join(lines[:mid] + ["<<<<<<< HEAD"] + lines[mid:]) + "\n")
    print(sb, "patched")

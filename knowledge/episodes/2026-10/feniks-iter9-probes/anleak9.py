#!/usr/bin/env python3
"""FENIKS iter9: «Отчет», вид 2026-09 - сколько из 16 ячеек выгрузки (июнь-сентябрь x 4 строки) показывают число при красной
плашке ошибки (N1, fzB) и что показывает «Отчет» при битой строке ads_daily (N2, fzK). Вход - rep_<sb>.json от fx9_report.mjs."""
import json

S = "/tmp/claude-0/-home-user-t1/c4f0dfeb-cd9a-55ac-b7f6-154069ba26c7/scratchpad/i9/"
EXP = ("за заказ по выгрузке кабинета (списания по дате заказа)", "Выручка заказов «за заказ»",
       "Окупаемость «за заказ» (к списаниям выгрузки), ₽ на 1 ₽", "Окупаемость всего (к расходу за клик и списаниям выгрузки), ₽ на 1 ₽")
MON = ("июнь 2026", "июль 2026", "август 2026", "сентябрь 2026")
EMPTY = ("нет данных", "—", "")
for sb in ("p9", "fzB", "fzC", "fzE", "fzF", "fzG", "fzH", "fzI", "fzJ"):
    R = json.load(open(S + f"rep_{sb}.json"))
    m = R["months"]["2026-09"]
    h = m["h"]
    rows = {x[0]: x[1:] for x in m["rows"]}
    cells = [(k[:22], mo, rows[k][h[1:].index(mo)]) for k in EXP for mo in MON]
    num = [c for c in cells if c[2] not in EMPTY]
    print(sb, "banner:", bool(m["red"]), "| export-month cells with a number:", len(num), "of", len(cells))
R = json.load(open(S + "rep_fzK.json"))
m = R["months"]["2026-09"]
print("fzK head", m["h"], "banner:", bool(m["red"]))
for r in m["rows"][:11]:
    print("  ", r[0][:50], r[1:])

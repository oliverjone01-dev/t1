#!/usr/bin/env python3
"""Old vs new ROAS rows of «Отчет» block 5 per view; independent recompute of total ROAS from rendered rows."""
import json

S = "/tmp/claude-0/-home-user-t1/c4f0dfeb-cd9a-55ac-b7f6-154069ba26c7/scratchpad/i8/"
A = json.load(open(S + "rep_mn.json"))
B = json.load(open(S + "rep_p8.json"))


def num(s):
    s = s.replace("\xa0", "").replace(" ", "").replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


for ym in B["options"]:
    a = {r[0]: r[1:] for r in A["months"][ym]["rows"]}
    b = {r[0]: r[1:] for r in B["months"][ym]["rows"]}
    h = B["months"][ym]["h"][1:]
    oz, ot = a["Окупаемость «за заказ», ₽ на 1 ₽"], a["Окупаемость всего, ₽ на 1 ₽"]
    nz = b["Окупаемость «за заказ» (к списаниям выгрузки), ₽ на 1 ₽"]
    nt = b["Окупаемость всего (к расходу за клик и списаниям выгрузки), ₽ на 1 ₽"]
    print(f"== view {ym}")
    for i, col in enumerate(h):
        if col in ("Отклонение", "%"):
            continue
        # independent: (cpcOm + cpoRev) / (cpcSp + cpoSp) from rendered rows
        cs = num(b["за клик"][i]) if "за клик" in b else None
        cpoSp = num(b["за заказ по выгрузке кабинета (списания по дате заказа)"][i])
        cOm = num(b["Выручка рекламных заказов за клик"][i])
        cRev = num(b["Выручка заказов «за заказ»"][i])
        mine = round((cOm + cRev) / (cs + cpoSp), 2) if None not in (cs, cpoSp, cOm, cRev) and (cs + cpoSp) else None
        flag = "" if (oz[i] == nz[i]) else "  <-- за заказ changed"
        print(f"   {col:14s} за заказ {oz[i]:>11s} -> {nz[i]:>11s} | всего {ot[i]:>11s} -> {nt[i]:>11s} | mine {mine}{flag}")

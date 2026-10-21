#!/usr/bin/env python3
"""ФЕНИКС, аудит PR #492: есть ли данные под «1% запаса на единичные чистки OZON» [ГИПОТЕЗА автора].

По доступной истории orders_daily.ndjson на main (клон мелкий: с 41c44c9, 17.10) для каждой пары
соседних версий считает: исчезнувшие ключи order, изменение числа строк, выручки, paid, и сколько
заказов было бы «потеряно молча» при пороге 99%. Запуск из корня репо: python3 -I <этот файл>
"""
import json
import subprocess

P = "analytics-mvp/data/orders_daily.ndjson"
revs = subprocess.run(["git", "log", "--format=%h", "--reverse", "origin/main", "--", P],
                      capture_output=True, text=True, check=True).stdout.split()
revs.append("5af708906c20474c82c5429080ad5ae6bb7c9160")  # голова ветки: v3/v4


def load(ref):
    t = subprocess.run(["git", "show", f"{ref}:{P}"], capture_output=True, text=True, check=True).stdout
    return {json.loads(l)["order"]: json.loads(l) for l in t.split("\n") if l.strip()}


prev = None
for r in revs:
    cur = load(r)
    if prev is not None:
        pk, ck = set(prev[1]), set(cur)
        gone = pk - ck
        rev_p = sum(x["revenue"] for x in prev[1].values()); rev_c = sum(x["revenue"] for x in cur.values())
        print(f"{prev[0]} -> {r[:7]}: строк {len(pk)} -> {len(ck)}, исчезло ключей {len(gone)}, новых {len(ck - pk)}, "
              f"выручка {rev_p:,} -> {rev_c:,} ({(rev_c - rev_p) / rev_p * 100:+.2f}%)")
    prev = (r[:7], cur)
print(f"версий: {len(revs)}")

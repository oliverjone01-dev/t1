#!/usr/bin/env python3
"""FENIKS iter10 new fixtures on the audited code (a06dcd948), each in its own git-archive copy (no writes to the repo).
N2 class on the «Отчет» page (rework_tz iter9 N2: «проверить все входные файлы страницы, а не один»):
  fzS: one truncated line appended to sku_views.ndjson (read by build-katya.ts:1297, ctx.viewRows of the report).
  fzT: pnl_account_accrual_types.json cut by 40 bytes (report-page.ts:102).
  fzV: one broken line in the MIDDLE of delivery_orders.ndjson (report-page.ts:109).
Ivan 15.10 decision (1) radius for legacy rows:
  fzL: one June-August order (legacy cpo_orders row without d) loses its postings in orders_daily -> all months hidden?
Ivan 15.10 decision (2) on real data:
  fzM: one stale legacy row (order of a real September row, sp 500, no d) appended to cpo_orders -> invariant error.
usage: fuzz10b.py fzS fzT fzV fzL fzM"""
import json, os, subprocess, sys

S = "/tmp/claude-0/-home-user-t1/c4f0dfeb-cd9a-55ac-b7f6-154069ba26c7/scratchpad/f10"
REPO = "/home/user/t1"
NM = REPO + "/analytics-mvp/node_modules"
P10 = "a06dcd94896cd6582191a00086e97673271008c2"


def extract(dest, rev):
    os.makedirs(dest, exist_ok=True)
    a = subprocess.Popen(["git", "-C", REPO, "archive", rev, "analytics-mvp"], stdout=subprocess.PIPE)
    t = subprocess.run(["tar", "-x", "-C", dest], stdin=a.stdout)
    a.wait()
    assert a.returncode == 0 and t.returncode == 0
    link = os.path.join(dest, "analytics-mvp", "node_modules")
    if not os.path.lexists(link):
        os.symlink(NM, link)


def rd(D, f):
    return [json.loads(l) for l in open(D + f, encoding="utf-8") if l.strip()]


def wr(D, f, rows):
    with open(D + f, "w", encoding="utf-8") as fh:
        for r in rows:
            fh.write(json.dumps(r, ensure_ascii=False) + "\n")


for which in sys.argv[1:]:
    extract(f"{S}/{which}", P10)
    D = f"{S}/{which}/analytics-mvp/data/"
    if which == "fzS":
        with open(D + "sku_views.ndjson", "a", encoding="utf-8") as fh:
            fh.write('{"d": "2026-10-13", "sku": "1", "vw\n')
        print(which, "truncated line appended to sku_views.ndjson")
    elif which == "fzT":
        b = open(D + "pnl_account_accrual_types.json", "rb").read()
        open(D + "pnl_account_accrual_types.json", "wb").write(b[:-40])
        print(which, "pnl_account_accrual_types.json", len(b), "->", len(b) - 40, "bytes")
    elif which == "fzV":
        lines = open(D + "delivery_orders.ndjson", encoding="utf-8").read().splitlines()
        mid = len(lines) // 2
        lines = lines[:mid] + ['{"d_ship": "2026-0'] + lines[mid:]
        open(D + "delivery_orders.ndjson", "w", encoding="utf-8").write("\n".join(lines) + "\n")
        print(which, "delivery_orders lines", len(lines), "broken line at", mid + 1)
    elif which == "fzL":
        cpo = rd(D, "cpo_orders.ndjson")
        first = {}
        for r in rd(D, "orders_daily.ndjson"):
            o = str(r.get("order") or "")
            first.setdefault(o[: o.rfind("-")], []).append(str(r["d"]))
        leg = [r for r in cpo if not r.get("d") and min(first.get(str(r["order"]), ["9999"])) < "2026-07-01"]
        victim = min(leg, key=lambda r: float(r["sp"]))
        k = str(victim["order"])
        od = rd(D, "orders_daily.ndjson")
        keep = [r for r in od if str(r["order"])[: str(r["order"]).rfind("-")] != k]
        wr(D, "orders_daily.ndjson", keep)
        print(which, "legacy victim", k, "sp", victim["sp"], "first posting", min(first[k]), "orders_daily", len(od), "->", len(keep))
    elif which == "fzM":
        cpo = rd(D, "cpo_orders.ndjson")
        v = next(r for r in cpo if r.get("d"))
        cpo.append({"order": v["order"], "sp": 500.0})
        wr(D, "cpo_orders.ndjson", cpo)
        print(which, "stale legacy row appended for", v["order"], "sp 500")

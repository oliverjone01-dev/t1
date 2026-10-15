#!/usr/bin/env python3
"""FENIKS iter8 fixtures, each in its own git-archive copy of the branch head (no writes to the repo).
fzA (N9): export starts mid-month - cpo_orders whose order date (earliest posting) < 2026-06-15 and cpo_sku_daily rows < 2026-06-15 removed.
fzB (N8): ads_daily without any row of 28753239 (export campaign absent from the API series).
fzC (N8 hole): a merge-conflict marker line inserted into cpo_sku_daily.ndjson (readNd swallows the parse error -> [] -> co.from = "").
fzD (N9): campaign 28753239 gets 100 RUB of API spend on 2026-06-03 (before the export start 05.06).
usage: fuzz8.py fzA fzB fzC fzD"""
import json, os, subprocess, sys

S = "/tmp/claude-0/-home-user-t1/c4f0dfeb-cd9a-55ac-b7f6-154069ba26c7/scratchpad/i8"
REPO = "/home/user/t1"
NM = REPO + "/analytics-mvp/node_modules"
HEAD = "42db2219537814e8121f938ff7552a4d06a3821a"


def extract(dest):
    os.makedirs(dest, exist_ok=True)
    a = subprocess.Popen(["git", "-C", REPO, "archive", HEAD, "analytics-mvp"], stdout=subprocess.PIPE)
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
    extract(f"{S}/{which}")
    D = f"{S}/{which}/analytics-mvp/data/"
    if which == "fzA":
        od = rd(D, "orders_daily.ndjson")
        first = {}
        for r in od:
            o = str(r.get("order") or "")
            k = o[: o.rfind("-")]
            first[k] = min(first.get(k, "9999"), str(r["d"]))
        cpo = rd(D, "cpo_orders.ndjson")
        keep = [r for r in cpo if first.get(str(r["order"]), "9999") >= "2026-06-15"]
        sku = rd(D, "cpo_sku_daily.ndjson")
        keep2 = [r for r in sku if str(r["d"]) >= "2026-06-15"]
        wr(D, "cpo_orders.ndjson", keep)
        wr(D, "cpo_sku_daily.ndjson", keep2)
        print("fzA cpo_orders", len(cpo), "->", len(keep), "cpo_sku_daily", len(sku), "->", len(keep2))
    elif which == "fzB":
        ads = rd(D, "ads_daily.ndjson")
        keep = [r for r in ads if str(r["id"]) != "28753239"]
        wr(D, "ads_daily.ndjson", keep)
        print("fzB ads_daily", len(ads), "->", len(keep))
    elif which == "fzC":
        lines = open(D + "cpo_sku_daily.ndjson", encoding="utf-8").read().splitlines()
        mid = len(lines) // 2
        lines = lines[:mid] + ["<<<<<<< HEAD"] + lines[mid:]
        open(D + "cpo_sku_daily.ndjson", "w", encoding="utf-8").write("\n".join(lines) + "\n")
        print("fzC cpo_sku_daily lines", len(lines), "marker at", mid)
    elif which == "fzD":
        ads = rd(D, "ads_daily.ndjson")
        tpl = next(r for r in ads if str(r["id"]) == "28753239")
        x = dict(tpl)
        x.update({"d": "2026-06-03", "sp": 100, "om": 0, "o": 0})
        for k in list(x):
            if k not in ("d", "id", "sp", "om", "o", "off", "instr", "line", "place", "status", "views", "clicks"):
                pass
        ads.append(x)
        ads.sort(key=lambda r: (str(r["d"]), str(r["id"])))
        wr(D, "ads_daily.ndjson", ads)
        print("fzD added row", x)

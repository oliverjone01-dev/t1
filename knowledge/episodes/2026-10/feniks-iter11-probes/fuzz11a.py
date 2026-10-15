#!/usr/bin/env python3
"""FENIKS iter10 fixtures, each in its own git-archive copy (no writes to the repo). Code = p9 (9ef5e2d3e) unless name ends with 'o'
(then d07567852, iter8 code) for before/after.
fzA (N9): export starts mid-month (cpo_orders with earliest posting < 15.06 and cpo_sku_daily < 15.06 removed).
fzB (N8): ads_daily without any row of 28753239.
fzC (G2): merge-conflict marker in the middle of cpo_sku_daily.ndjson.
fzD (N9): 28753239 gets 100 RUB API spend on 2026-06-03.
fzE (G1): orders_daily lags: postings of CPO orders with earliest posting >= 2026-09-25 removed (48 orders in iter8).
fzF (G2): cpo_sku_daily.ndjson empty (0 bytes), cpo_orders intact.
fzG (G1 radius): ONE CPO order (the smallest charge in September) has no postings in orders_daily.
fzH (G2): cpo_orders.ndjson deleted, cpo_sku_daily intact.
fzI (G2): merge-conflict marker in cpo_orders.ndjson (bad) -> err; ads_daily intact.
fzJ (G2 radius): one broken line appended to orders_daily.ndjson (truncated JSON), export intact.
fzK (G2 class in the report reader): one truncated line appended to ads_daily.ndjson.
usage: fuzz9.py fzA fzB ..."""
import json, os, subprocess, sys

S = "/tmp/claude-0/-home-user-t1/c4f0dfeb-cd9a-55ac-b7f6-154069ba26c7/scratchpad/f11"
REPO = "/home/user/t1"
NM = REPO + "/analytics-mvp/node_modules"
P9 = "97882120601e7e4e9109fd7c5284395fb1697c30"  # iter11: p11
P8 = "2fd407e17"


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


def first_posting(D):
    first = {}
    for r in rd(D, "orders_daily.ndjson"):
        o = str(r.get("order") or "")
        k = o[: o.rfind("-")]
        first[k] = min(first.get(k, "9999"), str(r["d"]))
    return first


for which in sys.argv[1:]:
    base = which[:-1] if which.endswith("o") else which
    extract(f"{S}/{which}", P8 if which.endswith("o") else P9)
    D = f"{S}/{which}/analytics-mvp/data/"
    if base == "fzA":
        first = first_posting(D)
        cpo = rd(D, "cpo_orders.ndjson")
        keep = [r for r in cpo if first.get(str(r["order"]), "9999") >= "2026-06-15"]
        sku = rd(D, "cpo_sku_daily.ndjson")
        keep2 = [r for r in sku if str(r["d"]) >= "2026-06-15"]
        wr(D, "cpo_orders.ndjson", keep)
        wr(D, "cpo_sku_daily.ndjson", keep2)
        print(which, "cpo_orders", len(cpo), "->", len(keep), "cpo_sku_daily", len(sku), "->", len(keep2))
    elif base == "fzB":
        ads = rd(D, "ads_daily.ndjson")
        keep = [r for r in ads if str(r["id"]) != "28753239"]
        wr(D, "ads_daily.ndjson", keep)
        print(which, "ads_daily", len(ads), "->", len(keep))
    elif base == "fzC":
        lines = open(D + "cpo_sku_daily.ndjson", encoding="utf-8").read().splitlines()
        mid = len(lines) // 2
        lines = lines[:mid] + ["<<<<<<< HEAD"] + lines[mid:]
        open(D + "cpo_sku_daily.ndjson", "w", encoding="utf-8").write("\n".join(lines) + "\n")
        print(which, "cpo_sku_daily lines", len(lines), "marker at line", mid + 1)
    elif base == "fzD":
        ads = rd(D, "ads_daily.ndjson")
        tpl = next(r for r in ads if str(r["id"]) == "28753239")
        x = dict(tpl)
        x.update({"d": "2026-06-03", "sp": 100, "om": 0, "o": 0})
        ads.append(x)
        ads.sort(key=lambda r: (str(r["d"]), str(r["id"])))
        wr(D, "ads_daily.ndjson", ads)
        print(which, "added row", x)
    elif base == "fzE":
        od = rd(D, "orders_daily.ndjson")
        cpo = {}
        for r in rd(D, "cpo_orders.ndjson"):
            cpo[str(r["order"])] = cpo.get(str(r["order"]), 0) + float(r["sp"])
        first = first_posting(D)
        drop = {k for k in cpo if first.get(k, "0000") >= "2026-09-25"}
        keep = [r for r in od if not (str(r["order"])[: str(r["order"]).rfind("-")] in drop and str(r["d"]) >= "2026-09-25")]
        wr(D, "orders_daily.ndjson", keep)
        print(which, "orders_daily", len(od), "->", len(keep), "| CPO orders without postings:", len(drop), "charges",
              round(sum(cpo[k] for k in drop), 2))
    elif base == "fzF":
        open(D + "cpo_sku_daily.ndjson", "w").close()
        print(which, "cpo_sku_daily.ndjson emptied")
    elif base == "fzG":
        cpo = rd(D, "cpo_orders.ndjson")
        first = first_posting(D)
        sep = [r for r in cpo if first.get(str(r["order"]), "") >= "2026-09-01"]
        victim = min(sep, key=lambda r: float(r["sp"]))
        k = str(victim["order"])
        od = rd(D, "orders_daily.ndjson")
        keep = [r for r in od if str(r["order"])[: str(r["order"]).rfind("-")] != k]
        wr(D, "orders_daily.ndjson", keep)
        print(which, "victim order", k, "sp", victim["sp"], "first posting", first.get(k), "orders_daily", len(od), "->", len(keep))
    elif base == "fzH":
        os.remove(D + "cpo_orders.ndjson")
        print(which, "cpo_orders.ndjson removed")
    elif base == "fzI":
        lines = open(D + "cpo_orders.ndjson", encoding="utf-8").read().splitlines()
        mid = len(lines) // 2
        lines = lines[:mid] + ["======="] + lines[mid:]
        open(D + "cpo_orders.ndjson", "w", encoding="utf-8").write("\n".join(lines) + "\n")
        print(which, "cpo_orders lines", len(lines), "marker at line", mid + 1)
    elif base == "fzK":
        with open(D + "ads_daily.ndjson", "a", encoding="utf-8") as fh:
            fh.write('{"d": "2026-10-13", "id": "1", "sp": 1\n')
        print(which, "truncated line appended to ads_daily.ndjson")
    elif base == "fzJ":
        with open(D + "orders_daily.ndjson", "a", encoding="utf-8") as fh:
            fh.write('{"order": "0000-0000-1", "d": "2026-10-13", "reven\n')
        print(which, "truncated line appended to orders_daily.ndjson")

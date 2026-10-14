#!/usr/bin/env python3
"""fzE (N8 total): orders_daily lags - postings of orders with earliest posting date >= 2026-09-25 removed.
The export (cpo_orders, cpo_sku_daily) and ads_daily are intact; campaign 28753239 API spend still equals the full export total.
Expect: miss > 0; does the build fail with «чья выгрузка, не ясно»?"""
import json, os, subprocess

S = "/tmp/claude-0/-home-user-t1/c4f0dfeb-cd9a-55ac-b7f6-154069ba26c7/scratchpad/i8"
REPO = "/home/user/t1"
HEAD = "42db2219537814e8121f938ff7552a4d06a3821a"
dest = S + "/fzE"
os.makedirs(dest, exist_ok=True)
a = subprocess.Popen(["git", "-C", REPO, "archive", HEAD, "analytics-mvp"], stdout=subprocess.PIPE)
subprocess.run(["tar", "-x", "-C", dest], stdin=a.stdout)
a.wait()
link = dest + "/analytics-mvp/node_modules"
if not os.path.lexists(link):
    os.symlink(REPO + "/analytics-mvp/node_modules", link)
D = dest + "/analytics-mvp/data/"
od = [json.loads(l) for l in open(D + "orders_daily.ndjson") if l.strip()]
cpo = {json.loads(l)["order"]: json.loads(l)["sp"] for l in open(D + "cpo_orders.ndjson") if l.strip()}
first = {}
for r in od:
    o = str(r["order"]); k = o[: o.rfind("-")]
    first[k] = min(first.get(k, "9999"), str(r["d"]))
drop = {k for k in cpo if first.get(k, "0000") >= "2026-09-25"}
keep = [r for r in od if not (str(r["order"])[: str(r["order"]).rfind("-")] in drop and str(r["d"]) >= "2026-09-25")]
with open(D + "orders_daily.ndjson", "w") as f:
    for r in keep:
        f.write(json.dumps(r, ensure_ascii=False) + "\n")
dropped_sp = sum(cpo[k] for k in drop)
print("fzE orders_daily", len(od), "->", len(keep), "| CPO orders without postings:", len(drop), "charges", round(dropped_sp, 2),
      "share of export", round(dropped_sp / sum(cpo.values()) * 100, 2), "%")

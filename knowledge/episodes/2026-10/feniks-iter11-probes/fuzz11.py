#!/usr/bin/env python3
"""FENIKS iter11 fixtures on the audited code p11 (978821206), each in its own git-archive copy (no writes to the repo).
Verbatim from iter10 (fuzz10.py / fuzz10b.py, same bytes written):
  fzS: one truncated line appended to sku_views.ndjson.
  fzV: one broken line in the MIDDLE of delivery_orders.ndjson.
  fzK: one truncated line appended to ads_daily.ndjson (report + tab).
  fzT: pnl_account_accrual_types.json cut by 40 bytes (JSON, not ndjson).
  fzJ: one truncated line appended to orders_daily.ndjson (read by ndLines AND by cpo-orders-rev readNd).
New in iter11:
  fzU: a line `null` (valid JSON, not a record) in the MIDDLE of delivery_orders.ndjson.
  fzY: a merge-conflict marker in the MIDDLE of sku_views.ndjson (whole-file vs line).
usage: fuzz11.py fzS fzV ...   (suffix 'm' = same fixture on main pm, e.g. fzUm)"""
import json, os, subprocess, sys

S = "/tmp/claude-0/-home-user-t1/c4f0dfeb-cd9a-55ac-b7f6-154069ba26c7/scratchpad/f11"
REPO = "/home/user/t1"
NM = REPO + "/analytics-mvp/node_modules"
P11 = "97882120601e7e4e9109fd7c5284395fb1697c30"
PM = "d5bc74580d13b0cd2e129687abc46efc8eebe8ce"


def extract(dest, rev):
    os.makedirs(dest, exist_ok=True)
    a = subprocess.Popen(["git", "-C", REPO, "archive", rev, "analytics-mvp"], stdout=subprocess.PIPE)
    t = subprocess.run(["tar", "-x", "-C", dest], stdin=a.stdout)
    a.wait()
    assert a.returncode == 0 and t.returncode == 0
    link = os.path.join(dest, "analytics-mvp", "node_modules")
    if not os.path.lexists(link):
        os.symlink(NM, link)


def mid_insert(D, f, line):
    lines = open(D + f, encoding="utf-8").read().splitlines()
    mid = len(lines) // 2
    lines = lines[:mid] + [line] + lines[mid:]
    open(D + f, "w", encoding="utf-8").write("\n".join(lines) + "\n")
    return len(lines), mid + 1


for which in sys.argv[1:]:
    base = which[:-1] if which.endswith("m") else which
    extract(f"{S}/{which}", PM if which.endswith("m") else P11)
    D = f"{S}/{which}/analytics-mvp/data/"
    if base == "fzS":
        with open(D + "sku_views.ndjson", "a", encoding="utf-8") as fh:
            fh.write('{"d": "2026-10-13", "sku": "1", "vw\n')
        print(which, "truncated line appended to sku_views.ndjson")
    elif base == "fzT":
        b = open(D + "pnl_account_accrual_types.json", "rb").read()
        open(D + "pnl_account_accrual_types.json", "wb").write(b[:-40])
        print(which, "pnl_account_accrual_types.json", len(b), "->", len(b) - 40, "bytes")
    elif base == "fzV":
        n, at = mid_insert(D, "delivery_orders.ndjson", '{"d_ship": "2026-0')
        print(which, "delivery_orders lines", n, "broken line at", at)
    elif base == "fzK":
        with open(D + "ads_daily.ndjson", "a", encoding="utf-8") as fh:
            fh.write('{"d": "2026-10-13", "id": "1", "sp": 1\n')
        print(which, "truncated line appended to ads_daily.ndjson")
    elif base == "fzJ":
        with open(D + "orders_daily.ndjson", "a", encoding="utf-8") as fh:
            fh.write('{"order": "0000-0000-1", "d": "2026-10-13", "reven\n')
        print(which, "truncated line appended to orders_daily.ndjson")
    elif base == "fzU":
        n, at = mid_insert(D, "delivery_orders.ndjson", "null")
        print(which, "delivery_orders lines", n, "`null` line at", at)
    elif base == "fzY":
        n, at = mid_insert(D, "sku_views.ndjson", "=======")
        print(which, "sku_views lines", n, "marker at", at)

#!/usr/bin/env python3
"""FENIKS iter6: CPO_REV / CPO_WIN baked into the built tab vs my rule per day (file-first posting date, non-cancelled sums).
usage: cporev6.py <sandbox> ..."""
import collections, json, re, sys

S = "/tmp/claude-0/-home-user-t1/14242375-b0a2-5b30-b172-6a38ff5cb418/scratchpad/i6"
for sb in sys.argv[1:]:
    root = f"{S}/{sb}/analytics-mvp/"
    html = open(root + "public/katya-reklama-kartochki.html", encoding="utf-8").read()
    rev = json.loads(re.search(r"var CPO_REV=(\[.*?\]);\n", html).group(1))
    win = json.loads(re.search(r"var CPO_WIN=(\[.*?\]);\n", html).group(1))
    nd = lambda f: [json.loads(l) for l in open(root + "data/" + f, encoding="utf-8") if l.strip()]
    post = collections.defaultdict(list)
    for r in nd("orders_daily.ndjson"):
        o = str(r.get("order") or "")
        post[o[: o.rfind("-")]].append(r)
    day = collections.defaultdict(lambda: [0.0, 0])
    miss = 0
    for r in nd("cpo_orders.ndjson"):
        ps = post.get(str(r["order"]))
        if not ps:
            miss += 1
            continue
        a = day[str(ps[0]["d"])]
        for p in ps:
            if p.get("status") != "cancelled":
                try:
                    a[0] += float(p.get("revenue") or 0)
                except ValueError:
                    pass
                try:
                    a[1] += int(p.get("units") or 0)
                except (TypeError, ValueError):
                    pass
    mine = [[d, round(v[0]), v[1]] for d, v in sorted(day.items())]
    ds = sorted(str(r["d"]) for r in nd("cpo_sku_daily.ndjson"))
    print(sb, "days baked", len(rev), "mine", len(mine), "per-day equal:", rev == mine, "| CPO_WIN", win, "mine", [[ds[0], ds[-1]]], "| miss", miss)
    if rev != mine:
        dm = dict((x[0], x[1:]) for x in mine)
        bad = [(x[0], x[1:], dm.get(x[0])) for x in rev if dm.get(x[0]) != x[1:]]
        print("   first diffs:", bad[:5])

import json, collections, sys
root = sys.argv[1]
sku2art = json.load(open(root + "/data/sku_offer.json"))
V = collections.defaultdict(lambda: collections.defaultdict(float))
with open(root + "/data/sku_views.ndjson") as f:
    for line in f:
        if not line.strip():
            continue
        r = json.loads(line)
        a = sku2art.get(str(r.get("sku")))
        d = str(r.get("date") or "")
        try:
            v = float(r.get("vsearch"))
        except Exception:
            continue
        if not a or not d or v != v:
            continue
        if "2026-09-29" <= d <= "2026-10-12":
            V[d][a] += v
T = json.load(open(root + "/tools/tests/tests.json"))["тесты_цены"][0]
test = T["тест"]
excl = set(T.get("исключены", {}))
clean = [a for a in test if a not in excl]
cpc = ["GGM-15-2-2", "GGM-23-1-1"]


def share(S, frm, to):
    t = al = 0.0
    days = 0
    for d, m in V.items():
        if d < frm or not (d < to):
            continue
        days += 1
        for a, v in m.items():
            al += v
            if a in S:
                t += v
    return (t / al if al else None), days, t


print("last views day:", max(V))
for name, S in (("all10", set(test)), ("clean3", set(clean)), ("cpc2", set(cpc)), ("excl7", excl), ("excl5noncpc", excl - set(cpc))):
    b, bd, bt = share(S, "2026-09-30", "2026-10-07")
    w, wd, wt = share(S, "2026-10-07", "2026-10-14")
    print(f"{name:12s} base {b*1000:.2f} permille ({bd}d, {bt:.0f} views)  week1 {w*1000:.2f} ({wd}d, {wt:.0f})  change {(w/b-1)*100:+.0f}%")
print("clean:", clean)
# per-day share for stop rule (STOP_SHARE 0.5 of base, 3 days in a row)
for name, S in (("all10", set(test)), ("clean3", set(clean))):
    b, _, _ = share(S, "2026-09-30", "2026-10-07")
    row = []
    for d in sorted(V):
        if d < "2026-10-07":
            continue
        s, _, _ = share(S, d, "9999" if False else d[:8] + "%02d" % (int(d[8:]) + 1))
        row.append(f"{d[5:]}:{s/b:.2f}")
    print(name, "daily share/base:", " ".join(row))

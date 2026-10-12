import json, sys, collections
root = sys.argv[1]
sku2art = json.load(open(root + "/data/sku_offer.json"))
T = json.load(open(root + "/tools/tests/tests.json"))["тесты_цены"][0]
test = T["тест"]
# acts per art/day
acts = collections.defaultdict(lambda: collections.defaultdict(list))
titles = collections.Counter()
for l in open(root + "/data/acts_daily.ndjson", encoding="utf-8"):
    if not l.strip():
        continue
    r = json.loads(l)
    titles[r["title"]] += 1
    if r["art"] in test:
        acts[r["art"]][r["date"]].append((r["title"][:40], r.get("value")))
print("distinct act titles (top):")
for t, n in titles.most_common(40):
    print("  ", n, t)
print()
for a in test:
    days = sorted(acts[a])
    print(a, "act days:", len(days))
    for d in days:
        if d >= "2026-10-05":
            print("   ", d, acts[a][d])
# CPC per art
cpc = collections.defaultdict(list)
for l in open(root + "/data/ads_sku_daily.ndjson", encoding="utf-8"):
    if not l.strip():
        continue
    r = json.loads(l)
    a = sku2art.get(str(r["sku"]))
    if a in test and float(r.get("sp") or 0) > 0:
        cpc[a].append((r["d"], r["cid"], r["sp"]))
print()
for a in test:
    xs = sorted(cpc.get(a, []))
    if xs:
        print("CPC", a, "first", xs[0], "last", xs[-1], "days", len(set(x[0] for x in xs)), "cids", sorted(set(str(x[1]) for x in xs)))
    else:
        print("CPC", a, "none")

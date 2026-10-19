import json, sys, collections
D = sys.argv[1]
gap = [json.loads(l) for l in open(D + "/gap_daily.ndjson", encoding="utf-8") if l.strip()]
coinv = [json.loads(l) for l in open(D + "/coinv_daily.ndjson", encoding="utf-8") if l.strip()]
print("gap rows", len(gap), "coinv rows", len(coinv))
num = lambda v: v is not None and v != "" and isinstance(v, (int, float))
z = [r for r in gap if num(r.get("gap_pct")) and r["gap_pct"] == 0]
neg = [r for r in gap if num(r.get("gap_pct")) and r["gap_pct"] < 0]
s2s_hi = [r for r in gap if num(r.get("site_to_seller")) and r["site_to_seller"] >= 0.9999]
s2s_gt1 = [r for r in gap if num(r.get("site_to_seller")) and r["site_to_seller"] > 1.0]
small = [r for r in gap if num(r.get("gap_pct")) and 0 < r["gap_pct"] < 5]
ns = [r for r in gap if r.get("no_site") is True]
print("gap_pct==0 raw:", len(z), "neg gap:", len(neg), "s2s>=0.9999:", len(s2s_hi), "s2s>1:", len(s2s_hi and s2s_gt1), "0<gap<5:", len(small), "no_site:", len(ns))
for r in small[:20]:
    print("  small", r["date"], r["art"], r.get("sku"), r.get("site_to_seller"), r.get("gap_pct"), r.get("src"))
for r in neg[:10]:
    print("  neg", r["date"], r["art"], r.get("site_to_seller"), r.get("gap_pct"))
# history of each no_site art in gap_daily
by = collections.defaultdict(list)
for r in gap:
    by[r["art"]].append(r)
print("\n-- no_site arts: first date in gap_daily, rows around --")
for art in sorted({r["art"] for r in ns}):
    rows = sorted(by[art], key=lambda r: r["date"])
    first = rows[0]["date"]
    seq = [(r["date"][5:], "NS" if r.get("no_site") else r.get("gap_pct")) for r in rows[:5]]
    print(art, "first", first, "seq", seq)
# coinv_daily: rows with coinv 0 left, or site_paid == cap with value
cz = [r for r in coinv if r.get("coinv_paid_pct") == 0]
csame = [r for r in coinv if num(r.get("site_paid")) and num(r.get("cap")) and round(r["site_paid"]) == round(r["cap"])]
cneg = [r for r in coinv if num(r.get("coinv_paid_pct")) and r["coinv_paid_pct"] < 0]
cns = [r for r in coinv if r.get("no_site") is True]
print("\ncoinv: paid==0:", len(cz), "site_paid==cap:", len(csame), "of them with value:", sum(1 for r in csame if "coinv_paid_pct" in r), "neg:", len(cneg), "no_site:", len(cns))
cby = collections.defaultdict(list)
for r in coinv:
    cby[r["art"]].append(r)
print("-- coinv no_site arts --")
for art in sorted({r["art"] for r in cns}):
    rows = sorted(cby[art], key=lambda r: r["date"])
    seq = [(r["date"][5:], "NS" if r.get("no_site") else r.get("coinv_paid_pct")) for r in rows[:5]]
    print(art, "first", rows[0]["date"], "seq", seq)

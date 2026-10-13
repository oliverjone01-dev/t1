"""FENIKS probe fixtures for the 950b104 re-audit (writes only inside the given /tmp tree).
argv: <tree analytics-mvp root> <mode>
  s0      - no manual exclusions; 4 not-reduced prices forced to base*0.9 for 10-08..10-11; gap 10-11 copied to 10-25;
            TODAY patched to 2026-10-27 (window 07.10-21.10 closed). Ads stay as in data (last day 10-10).
  s0n     - s0 + neutral ads row on 10-24 with sp=0 (extends ads coverage, no CPC anywhere)
  s1      - s0 + CPC sp=50 on 10-24 (after window) for 4 clean products (also extends ads coverage)
  allexcl - all 10 test products in «исключены» (edge: 0 clean)
  typo    - one extra key in «исключены» that is not a test article (expect build error)
"""
import json, sys, statistics
root, mode = sys.argv[1], sys.argv[2]
assert root.startswith("/tmp/"), root
tp = root + "/tools/tests/tests.json"
T = json.load(open(tp, encoding="utf-8"))
t4 = T["тесты_цены"][0]


def dump_tests():
    with open(tp, "w", encoding="utf-8") as f:
        json.dump(T, f, ensure_ascii=False, indent=2)


if mode == "allexcl":
    t4["исключены"] = {a: "проба ФЕНИКСА" for a in t4["тест"]}
    dump_tests(); print("all excluded"); sys.exit(0)
if mode == "typo":
    t4["исключены"]["GGM-15-2-2X"] = "опечатка (проба ФЕНИКСА)"
    dump_tests(); print("typo key added"); sys.exit(0)

t4["исключены"] = {}
dump_tests()
start = t4["старт"]
fix = ["GGT-03-1-3-E-12080", "GGT-20-2-3-16080", "GGK-05-2-3-7040", "GGM-18-1-1-LED"]
pp = root + "/data/prices_daily.ndjson"
rows = [json.loads(l) for l in open(pp, encoding="utf-8") if l.strip()]
base = {}
for a in fix:
    xs = [float(r["price"]) for r in rows if r.get("offer") == a and "2026-09-23" <= r["d"] < start and float(r.get("price") or 0) > 0]
    base[a] = statistics.median(xs)
for r in rows:
    if r.get("offer") in base and "2026-10-08" <= r["d"] <= "2026-10-11":
        r["price"] = round(base[r["offer"]] * 0.9)
with open(pp, "w", encoding="utf-8") as f:
    f.writelines(json.dumps(r, ensure_ascii=False) + "\n" for r in rows)
gp = root + "/data/gap_daily.ndjson"
g = [json.loads(l) for l in open(gp, encoding="utf-8") if l.strip()]
extra = [dict(r, date="2026-10-25") for r in g if str(r.get("date", ""))[:10] == "2026-10-11"]
with open(gp, "a", encoding="utf-8") as f:
    f.writelines(json.dumps(r, ensure_ascii=False) + "\n" for r in extra)
bp = root + "/src/scripts/build-tests.ts"
src = open(bp, encoding="utf-8").read()
old = 'const TODAY = new Date().toISOString().slice(0, 10);'
assert old in src, "TODAY line changed"
with open(bp, "w", encoding="utf-8") as f:
    f.write(src.replace(old, 'const TODAY = "2026-10-27";'))
sku2art = json.load(open(root + "/data/sku_offer.json"))
art2sku = {}
for s, a in sku2art.items():
    art2sku.setdefault(a, s)
ap = root + "/data/ads_sku_daily.ndjson"
if mode == "s0n":
    with open(ap, "a", encoding="utf-8") as f:
        f.write(json.dumps({"d": "2026-10-24", "cid": "0", "sku": int(art2sku["GGM-16-2-3-LED"]), "sp": 0, "om": 0, "ca": 0}) + "\n")
if mode == "s1":
    with open(ap, "a", encoding="utf-8") as f:
        for a in ["GGM-16-2-3-LED", "GGL-05-XL-slim-2", "GGK-02-3-3-80", "GGK-05-2-3-7040"]:
            f.write(json.dumps({"d": "2026-10-24", "cid": "99999999", "sku": int(art2sku[a]), "sp": 50, "om": 0, "ca": 0}) + "\n")
print("mode", mode, "ok")

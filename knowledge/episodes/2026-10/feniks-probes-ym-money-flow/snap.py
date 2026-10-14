# Снимок реестра из stdin: последние п/п по кабинетам и «В пути» по месяцам проводки (деньги, без п/п).
# git show <sha>:analytics-mvp/data-ym/netting.ndjson | python3 -I snap.py <метка>
import json, sys, collections, re
label = sys.argv[1]
rows = [json.loads(l) for l in sys.stdin if l.strip()]
pp = collections.defaultdict(lambda: [0, 0.0, "9999", "0000"])
for r in rows:
    po = (r.get("po") or "").strip()
    if not po:
        continue
    x = pp[(str(r.get("business")), po)]
    x[0] += 1; x[1] += float(r.get("amount") or 0); x[2] = min(x[2], r["d"]); x[3] = max(x[3], r["d"])
last = {}
for (b, po), v in pp.items():
    if b not in last or v[3] > last[b][1][3]:
        last[b] = (po, v)
maxd = max(r["d"] for r in rows)
print("==", label, "строк", len(rows), "макс d", maxd, "пар кабинет/п/п", len(pp))
for b, (po, v) in sorted(last.items()):
    print("   последний п/п", b, po, "строк", v[0], "сумма", round(v[1]), "проводки", v[2], "..", v[3])
tp = collections.Counter(); tn = collections.Counter()
for r in rows:
    st = (r.get("status") or "").strip()
    if not st or re.search("не будет", st, re.I) or st.lower().startswith("справочно") or "src" not in r:
        continue
    if (r.get("po") or "").strip():
        continue
    tp[r["d"][:7]] += float(r.get("amount") or 0); tn[r["d"][:7]] += 1
print("   В пути по месяцам проводки:", {k: (round(tp[k]), tn[k]) for k in sorted(tp)})

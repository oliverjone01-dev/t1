# Даты доставки (fin / statusDate) у доставленных заказов из «В пути» сентября и октября.
import json, sys, collections, re
net_p, ord_p, acc_to = sys.argv[1:4]
st = {}
for l in open(ord_p, encoding="utf-8"):
    if l.strip():
        o = json.loads(l)
        st.setdefault(str(o.get("order") or ""), (o.get("status"), o.get("fin") or o.get("statusDate")))
by = collections.defaultdict(lambda: [0.0, 0])
for l in open(net_p, encoding="utf-8"):
    if not l.strip():
        continue
    r = json.loads(l)
    d = r.get("d") or ""
    if d < "2026-09-01" or d > acc_to:
        continue
    s = (r.get("status") or "").strip()
    if not s or re.search("не будет", s, re.I) or s.lower().startswith("справочно") or (r.get("po") or "").strip():
        continue
    o = str(r.get("order") or "")
    stt, fin = st.get(o, (None, None))
    if stt != "DELIVERED":
        continue
    wk = "доставлен <=30.09" if (fin or "") <= "2026-09-30" else ("доставлен 01-05.10" if fin <= "2026-10-05" else "доставлен после 05.10")
    a = by[(d[:7], wk)]; a[0] += float(r.get("amount") or 0); a[1] += 1
for k in sorted(by):
    print(k[0], "%-24s %12.0f  строк %d" % (k[1], by[k][0], by[k][1]))

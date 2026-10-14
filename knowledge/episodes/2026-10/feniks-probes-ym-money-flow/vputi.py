# «В пути» сентября по статусу заказа (orders.ndjson): доставлен и ждёт выплаты против ещё не доставлен (может отмениться).
# python3 -I vputi.py <netting.ndjson> <orders.ndjson> <accTo> <ym>
import json, sys, collections, re
net_p, ord_p, acc_to, ym = sys.argv[1:5]
st = {}
for l in open(ord_p, encoding="utf-8"):
    if not l.strip():
        continue
    o = json.loads(l)
    k = str(o.get("order") or "")
    # статус заказа - по первой позиции, этого достаточно для разбивки
    st.setdefault(k, (o.get("status"), o.get("statusDate"), o.get("fin")))
agg = collections.defaultdict(lambda: [0.0, 0])
for l in open(net_p, encoding="utf-8"):
    if not l.strip():
        continue
    r = json.loads(l)
    d = r.get("d") or ""
    if not d.startswith(ym) or d > acc_to:
        continue
    s = (r.get("status") or "").strip()
    if not s or re.search("не будет", s, re.I) or s.lower().startswith("справочно") or (r.get("po") or "").strip():
        continue
    o = str(r.get("order") or "")
    key = "без заказа" if not o else (st.get(o, ("нет в orders.ndjson",))[0] or "?")
    a = agg[key]; a[0] += float(r.get("amount") or 0); a[1] += 1
tot = sum(v[0] for v in agg.values())
print("В пути", ym, "всего", round(tot))
for k, v in sorted(agg.items(), key=lambda x: -x[1][0]):
    print("  %-28s %12.0f  строк %d" % (k, v[0], v[1]))

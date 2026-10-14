# Итерация 2: июньские строки «В пути», взносы продавца по месяцам, кампании в акте по месяцам.
import json, sys, re, collections
net_p, svc_p = sys.argv[1], sys.argv[2]
rows = [json.loads(l) for l in open(net_p, encoding="utf-8") if l.strip()]
print("== Июнь: денежные строки без п/п")
for r in rows:
    st = (r.get("status") or "").strip()
    if r["d"][:7] == "2026-06" and st and not re.search("не будет", st, re.I) and not st.lower().startswith("справочно") and not (r.get("po") or "").strip():
        print("  ", {k: r.get(k) for k in ("d", "business", "order", "src", "type", "service", "amount", "status")})
print("== Взносы продавца (src «Внесено продавцом»): d, кабинет, сумма, статус, п/п")
for r in rows:
    if re.search("внесено продавц", r.get("src") or "", re.I):
        print("  ", r["d"], r.get("business"), r.get("amount"), r.get("status"), r.get("po"), "order=", r.get("order"))
camp = re.compile(r"^(полка|буст продаж с оплатой за показы|товарные баннеры)$", re.I)
act = collections.defaultdict(lambda: [0.0, 0.0])
for l in open(svc_p, encoding="utf-8"):
    if not l.strip():
        continue
    r = json.loads(l)
    a = act[(r.get("ym"), str(r.get("business")))]
    m = float(r.get("money") or 0)
    a[0] += m
    if camp.match(str(r.get("service") or "")):
        a[1] += m
print("== Акт: месяц, кабинет, деньги всего, кампании")
for k in sorted(act):
    print("  ", k[0], k[1], round(act[k][0], 2), round(act[k][1], 2))

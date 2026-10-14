# Итерация 3: (1) пометка под блоком целиком; (2) что попадает в «прочее» по заказу (компенсации) - по всем месяцам;
# (3) реестр 01.03 по кабинетам: сборы по заказам, и строки трёх заказов-примеров автора.
import json, sys, re, collections
render_p, net_p = sys.argv[1], sys.argv[2]
d = json.load(open(render_p, encoding="utf-8"))
print("FLOWNOTE (сентябрь):", d["months"]["2026-09"].get("flowNote"))
print()
rows = [json.loads(l) for l in open(net_p, encoding="utf-8") if l.strip()]
PAY = re.compile(r"^плат[её]ж покупател", re.I); BACK = re.compile(r"^возврат плат[её]жа покупател", re.I)
PTS = re.compile(r"баллы за скидку|возврат баллов", re.I)
def money(r):
    st = (r.get("status") or "").strip()
    return st and not re.search("не будет", st, re.I) and not st.lower().startswith("справочно")
oth = collections.Counter(); othn = collections.Counter()
for r in rows:
    if not money(r) or not (r.get("order") or "").strip():
        continue
    src = r.get("src") or ""
    if PAY.search(src) or BACK.search(src) or PTS.search(src) or src == "Оплата услуг Маркета":
        continue
    k = (r["d"][:7], str(r.get("business")), src, r.get("type"), (r.get("service") or "")[:40])
    oth[k] += float(r.get("amount") or 0); othn[k] += 1
print("== Денежные строки по заказу вне платежей, баллов и «Оплата услуг Маркета» (кандидаты в «прочее»):")
for k in sorted(oth):
    print("  ", k, round(oth[k], 2), "строк", othn[k])
print()
fee01 = collections.Counter()
for r in rows:
    if r["d"] == "2026-03-01" and money(r) and (r.get("order") or "").strip() and (r.get("src") or "") == "Оплата услуг Маркета":
        fee01[str(r.get("business"))] += float(r.get("amount") or 0)
print("== Реестр 01.03, сборы по заказам («Оплата услуг Маркета»), по кабинетам:", {k: round(v, 2) for k, v in fee01.items()})
for o in ("54172938819", "54425659968", "54487962818"):
    hits = [(r["d"], r.get("src"), r.get("type"), (r.get("service") or "")[:30], r.get("amount")) for r in rows if str(r.get("order")) == o and money(r)]
    print("  заказ", o, "строк", len(hits), "дни", sorted({h[0] for h in hits}), "сборы 01.03:", round(sum(h[4] for h in hits if h[0] == "2026-03-01" and h[1] == "Оплата услуг Маркета"), 2))

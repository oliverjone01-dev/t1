# Независимый пересчёт блока 3а по сырому реестру (своя классификация, не код автора) + пробы реестра.
# python3 -I indep.py <netting.ndjson> <accTo> [mode]
import json, sys, collections, re

path, acc_to = sys.argv[1], sys.argv[2]
mode = sys.argv[3] if len(sys.argv) > 3 else "all"
rows = [json.loads(l) for l in open(path, encoding="utf-8") if l.strip()]
CAB = {"1023124": "mir", "74986385": "fur"}

def money_class(r):
    if "src" not in r:
        return "ns_old"
    st = (r.get("status") or "").strip()
    if re.search(r"не будет", st, re.I):
        return "cancel"
    if not st:
        return "ns"
    if st.lower().startswith("справочно"):
        return "points"
    return "money"

agg = collections.defaultdict(lambda: collections.Counter())
for r in rows:
    d = r.get("d") or ""
    if not d or d > acc_to:
        continue
    ym = d[:7]
    cab = CAB.get(str(r.get("business") or ""), "other:" + str(r.get("business")))
    c = money_class(r)
    for k in ("all", cab):
        a = agg[(ym, k)]
        if c in ("ns", "ns_old"):
            a["ns"] += 1
            continue
        if c != "money":
            continue
        amt = float(r.get("amount") or 0)
        a["tot"] += amt
        if (r.get("po") or "").strip():
            a["po"] += amt
        else:
            a["nopo"] += amt
        if (r.get("order") or "").strip():
            a["ordmoney"] += amt
        else:
            src = r.get("src") or ""
            if re.match(r"прем", src, re.I):
                a["prem"] += amt
            elif re.search(r"внесено продавц", src, re.I):
                a["seller"] += amt
            else:
                a["acct"] += amt

if mode in ("all", "agg"):
    print("== Пересчёт по сырому реестру (d <= %s): month cab tot po nopo ordmoney acct prem seller ns" % acc_to)
    for (ym, k) in sorted(agg):
        a = agg[(ym, k)]
        print(ym, k, *[round(a[x]) for x in ("tot", "po", "nopo", "ordmoney", "acct", "prem", "seller")], int(a["ns"]))

if mode in ("all", "probe"):
    inwin = [r for r in rows if (r.get("d") or "") and r["d"] <= acc_to]
    print("\n== Бизнесы:", collections.Counter(str(r.get("business")) for r in rows))
    print("== Ключ src отсутствует:", sum(1 for r in rows if "src" not in r), "по месяцам", collections.Counter(r["d"][:7] for r in rows if "src" not in r))
    print("\n== Статус x наличие п/п (d<=accTo):")
    ct = collections.Counter(((r.get("status") or "").strip(), bool((r.get("po") or "").strip())) for r in inwin if "src" in r)
    for (st, haspo), n in sorted(ct.items(), key=lambda x: -x[1]):
        print("  %5d  po=%s  %s" % (n, haspo, st or "<пусто>"))
    print("\n== Денежные строки без заказа: src, знак, сумма")
    nz = collections.defaultdict(lambda: [0, 0, 0.0, 0.0])
    for r in inwin:
        if money_class(r) != "money" or (r.get("order") or "").strip():
            continue
        a = float(r.get("amount") or 0)
        x = nz[(r.get("src") or "", r.get("type") or "")]
        x[0 if a >= 0 else 1] += 1
        x[2 if a >= 0 else 3] += a
    for k, v in sorted(nz.items(), key=lambda x: x[1][2] + x[1][3]):
        print("  src=%r type=%r  +%d строк %.0f  / -%d строк %.0f" % (k[0], k[1], v[0], v[2], v[1], v[3]))
    print("\n== Денежные строки ПО ЗАКАЗУ: src x type, сумма (сентябрь)")
    oz = collections.Counter()
    for r in inwin:
        if money_class(r) != "money" or not (r.get("order") or "").strip() or r["d"][:7] != "2026-09":
            continue
        oz[(r.get("src") or "", r.get("type") or "")] += float(r.get("amount") or 0)
    for k, v in sorted(oz.items(), key=lambda x: x[1]):
        print("  %14.0f  src=%r type=%r" % (v, k[0], k[1]))
    print("\n== Дубли, отличающиеся только п/п (d, order, sku, type, service, amount, n):")
    g = collections.defaultdict(set)
    for r in rows:
        k = (r.get("d"), r.get("business"), r.get("order") or "", r.get("sku") or "", r.get("type") or "", r.get("service") or "", r.get("amount"), r.get("n") or 0)
        g[k].add((r.get("po") or "").strip())
    dup = [(k, v) for k, v in g.items() if len(v) > 1]
    print("  ключей с разными п/п:", len(dup), "из них с пустым и непустым:", sum(1 for k, v in dup if "" in v))
    for k, v in dup[:8]:
        print("   ", k, sorted(v))
    print("\n== Платёжки: кабинет, п/п, строк, сумма, мин d, макс d (по возрастанию макс d), последние 12")
    pp = collections.defaultdict(lambda: [0, 0.0, "9999", "0000"])
    for r in rows:
        po = (r.get("po") or "").strip()
        if not po:
            continue
        x = pp[(str(r.get("business")), po)]
        x[0] += 1; x[1] += float(r.get("amount") or 0); x[2] = min(x[2], r["d"]); x[3] = max(x[3], r["d"])
    lst = sorted(pp.items(), key=lambda x: (x[1][3], x[0]))
    print("  всего пар кабинет/п/п:", len(lst))
    for (b, po), v in lst[-12:]:
        print("   %s п/п %s: %d строк, %.0f, проводки %s..%s" % (b, po, v[0], v[1], v[2], v[3]))
    print("\n== «В пути» (денежные без п/п) по дню проводки, сентябрь-октябрь: d cab сумма строк статусы")
    tp = collections.defaultdict(lambda: [0.0, 0, collections.Counter()])
    for r in inwin:
        if money_class(r) != "money" or (r.get("po") or "").strip() or r["d"] < "2026-09-01":
            continue
        x = tp[(r["d"], CAB.get(str(r.get("business")), "?"))]
        x[0] += float(r.get("amount") or 0); x[1] += 1; x[2][(r.get("status") or "").strip()] += 1
    for k in sorted(tp):
        v = tp[k]
        print("  ", k[0], k[1], round(v[0]), v[1], dict(v[2]))

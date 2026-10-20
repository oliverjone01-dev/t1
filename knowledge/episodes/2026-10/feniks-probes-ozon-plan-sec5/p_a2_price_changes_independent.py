"""Проба (а2) и (г-цены): независимый расчёт «Смен цены» по prices_daily для 29 артикулов плана + покрытие снимков.
Своя реализация: цена на 14.10 = последняя конечная цена не позже 14.10; смена = день после 14.10 с наблюдением,
где цена != предыдущему наблюдению. Проверяет: дубли строк одного дня (два снимка), дни без снимка, «Сейчас» = последняя смена.
Запуск: python3 -I p_a2_price_changes_independent.py <data_dir> <head.html>
ФЕНИКС 2026-10-20, аудит PR #490."""
import sys, json, re, collections, html as H

DATA, PAGE = sys.argv[1], sys.argv[2]
P = json.load(open(f"{DATA}/plan_2026-10-15_v4.json", encoding="utf-8"))
arts = [p["art"] for p in P["price"]]
rows = [json.loads(l) for l in open(f"{DATA}/prices_daily.ndjson", encoding="utf-8") if l.strip()]
all_days = sorted({r["d"] for r in rows})
print("дни снимков prices_daily после 10.10:", [d for d in all_days if d > "2026-10-10"])
per = collections.defaultdict(lambda: collections.defaultdict(list))
for r in rows:
    if r["offer"] in arts:
        per[r["offer"]][r["d"]].append(r.get("price"))
dups = {a: {d: v for d, v in m.items() if len(v) > 1} for a, m in per.items()}
dups = {a: v for a, v in dups.items() if v}
print("дубли строк одного дня у 29 артикулов (offer: {день: [цены]}):", dups or "нет")
alld = collections.Counter((r["offer"], r["d"]) for r in rows)
print("дубли (offer, день) по всему файлу:", sum(1 for v in alld.values() if v > 1), "из", len(alld))
nonfinite = [(r["offer"], r["d"], r.get("price")) for r in rows if r["offer"] in arts and not isinstance(r.get("price"), (int, float))]
print("строки 29 артикулов без конечной цены:", nonfinite or "нет")

s = open(PAGE, encoding="utf-8").read()
i = s.find('<summary class="sec">5. Цена')
t = s[s.find("<table", i):s.find("</table>", s.find("<table", i))]
page = {}
for tr in re.findall(r"<tr>(.*?)</tr>", t[t.find("<tbody>"):], re.S):
    tds = []
    for x in re.findall(r"<td[^>]*>(.*?)</td>", tr, re.S):
        x = x.replace('<div class="muted s">', " ~").replace("<br>", " | ")
        tds.append(re.sub(r"\s+", " ", H.unescape(re.sub(r"<[^>]+>", "", x))).strip())
    page[tds[1].split(" ~")[0].strip()] = (tds[2], tds[3], tds[4])


def F(x):
    return f"{x:,.0f}".replace(",", " ")


bad = 0
print("\nартикул | дни снимков после 14.10 | моё 14.10 | мои смены | страница 14.10 | смены | сейчас | совпало | сейчас=последняя")
for a in arts:
    m = {d: v[-1] for d, v in per[a].items() if isinstance(v[-1], (int, float))}
    before = [d for d in m if d <= "2026-10-14"]
    base = m[max(before)] if before else None
    prev = base
    ch = []
    for d in sorted(x for x in m if x > "2026-10-14"):
        if prev is not None and m[d] != prev:
            ch.append((d, m[d]))
        prev = m[d]
    mine = " | ".join(f"{d[8:10]}.{d[5:7]} {F(p)}" for d, p in ch) or "без смен"
    pg = page[a]
    ok = (F(base) if base is not None else "-", mine) == (pg[0], pg[1])
    last = ch[-1][1] if ch else base
    now_ok = pg[2].split(" ~")[0] == (F(last) if last is not None else "-")
    bad += 0 if ok and now_ok else 1
    seen = [d[8:10] for d in sorted(m) if d > "2026-10-14"]
    print(f"  {a:22s} | {','.join(seen):17s} | {F(base) if base else '-':>7s} | {mine:32s} | {pg[0]:>7s} | {pg[1]:32s} | {pg[2]:>16s} | {'OK' if ok else 'РАСХ'} | {'OK' if now_ok else 'РАСХ'}")
print("расхождений (смены + сейчас):", bad, "из", len(arts))

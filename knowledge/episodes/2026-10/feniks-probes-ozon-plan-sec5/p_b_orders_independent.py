"""Пробы (б), (в), (г-переименования), (д-отмены): независимый счёт заказов артикула по orders_daily.
Своя реализация на Python, не код билдера: день по Москве = t (UTC) + 3 ч; строки с днём позже последнего
сырого дня выгрузки (max d) отброшены; без отмен (status != cancelled); OD_LAST - по всем оставшимся строкам.
Запуск: python3 -I p_b_orders_independent.py <data_dir> <head.html>
ФЕНИКС 2026-10-20, аудит PR #490."""
import sys, json, re, datetime as dt, math, collections, html as H

DATA, PAGE = sys.argv[1], sys.argv[2]
P = json.load(open(f"{DATA}/plan_2026-10-15_v4.json", encoding="utf-8"))
G = json.load(open(f"{DATA}/plan_card_groups_1510.json", encoding="utf-8"))["groups"]
rows = [json.loads(l) for l in open(f"{DATA}/orders_daily.ndjson", encoding="utf-8") if l.strip()]
RAW_LAST = max(r["d"] for r in rows)


def msk(r):
    t = r.get("t")
    if not t:
        return r["d"]
    x = dt.datetime.fromisoformat(t.replace("Z", "+00:00")) + dt.timedelta(hours=3)
    return x.date().isoformat()


def days(a, b):
    return (dt.date.fromisoformat(b) - dt.date.fromisoformat(a)).days + 1


def jsround1(x):  # Math.round(x*10)/10 из JS: половина вверх к +inf
    return math.floor(x * 10 + 0.5) / 10


kept = []
dropped = 0
for r in rows:
    d = msk(r)
    if d > RAW_LAST:
        dropped += 1
        continue
    kept.append((r, d))
OD_LAST = max(d for _, d in kept)
START, W1 = P["start"], P["window"][1]
nIn = max(0, min(days(START, OD_LAST), 14)) if OD_LAST >= START else 0
print(f"rows={len(rows)} RAW_LAST={RAW_LAST} dropped_after_raw_last={dropped} OD_LAST={OD_LAST} nIn={nIn}")

by_offer = collections.Counter()
for r, d in kept:
    if r["status"] == "cancelled":
        continue
    by_offer[(r["offer"], d)] += int(r["units"])


def units(art, a, b):
    return sum(v for (o, d), v in by_offer.items() if o == art and a <= d <= b)


# --- страница: раздел 5
s = open(PAGE, encoding="utf-8").read()
i = s.find('<summary class="sec">5. Цена')
t = s[s.find("<table", i):s.find("</table>", s.find("<table", i))]
page = {}
for tr in re.findall(r"<tr>(.*?)</tr>", t[t.find("<tbody>"):], re.S):
    tds = [re.sub(r"\s+", " ", H.unescape(re.sub(r"<[^>]+>", " ", x.replace('<div class="muted s">', " ~")))).strip()
           for x in re.findall(r"<td[^>]*>(.*?)</td>", tr, re.S)]
    page[tds[1].split(" ~")[0].strip()] = (tds[7], tds[8], tds[9])

print("\n(б) артикул | моё 01-14 | моё с15 | моя дельта | страница 01-14 | с15 | дельта | совпало")
bad = 0
mine = {}
for p in P["price"]:
    a = p["art"]
    uB, uA = units(a, "2026-10-01", "2026-10-14"), (units(a, START, OD_LAST) if nIn else None)
    dW = None if uA is None else jsround1(uA / nIn * 7 - uB / 14 * 7)
    mine[a] = (uB, uA)
    fmt = "-" if dW is None else (("+" if dW > 0 else "") + f"{dW:.1f}".replace(".", ","))
    pg = page[a]
    ok = (str(uB), "-" if uA is None else str(uA), fmt) == pg
    bad += 0 if ok else 1
    print(f"  {a:22s} | {uB:3d} | {uA!s:>3s} | {fmt:>5s} | {pg[0]:>3s} | {pg[1]:>3s} | {pg[2]:>5s} | {'OK' if ok else 'РАСХОЖДЕНИЕ'}")
print(f"(б) расхождений: {bad} из {len(P['price'])}")
print("(б) сумма 01-14 =", sum(v[0] for v in mine.values()), " сумма с15 =", sum(v[1] or 0 for v in mine.values()),
      " артикулов с заказами в октябре:", sum(1 for v in mine.values() if v[0] + (v[1] or 0) > 0))

# --- день по UTC вместо Москвы (как в «независимом» счёте автора): что бы это поменяло
by_utc = collections.Counter()
for r in rows:
    if r["status"] != "cancelled":
        by_utc[(r["offer"], r["d"])] += int(r["units"])
diff_utc = []
for p in P["price"]:
    a = p["art"]
    b = sum(v for (o, d), v in by_utc.items() if o == a and "2026-10-01" <= d <= "2026-10-14")
    af = sum(v for (o, d), v in by_utc.items() if o == a and START <= d <= OD_LAST)
    if (b, af) != mine[a]:
        diff_utc.append((a, (b, af), mine[a]))
print("(б') день по UTC против Москвы, артикулы с другой цифрой:", diff_utc or "нет")

# --- (в) инвариант: сумма артикулов карточки в разделе 5 <= заказы карточки в блоке 1
off2sku = {s_["offer"]: str(s_["sku"]) for g in G for s_ in g["skus"]}
OUT = {off2sku.get(a, "") for a in P.get("withdrawn", [])}
print("\n(в) карточка | артикулы раздела 5 (выводимые помечены *) | сумма 01-14 / с15 | карточка 01-14 / с15 (моё) | <=")
b1 = s[s.find('<table class="gtbl single"><thead><tr><th>Карточка</th>'):]
b1 = b1[:b1.find("</table>")]
blk = {}
for tr in re.findall(r'<tr class="crow"[^>]*>(.*?)</tr>', b1, re.S):
    tds = [re.sub(r"\s+", " ", H.unescape(re.sub(r"<[^>]+>", " ", x.replace('<div class="muted s">', " ~")))).strip()
           for x in re.findall(r"<td[^>]*>(.*?)</td>", tr, re.S)]
    blk[tds[0].replace("▸", "").split(" ~")[0].strip()] = (tds[5], tds[2])
for c in P["cards"]:
    ms = off2sku.get(c["main_art"])
    g = next((g for g in G if any(str(x["sku"]) == ms for x in g["skus"])), None)
    if not g:
        continue
    gsk = {str(x["sku"]) for x in g["skus"]}
    csk = gsk - OUT
    arts = [p["art"] for p in P["price"] if off2sku.get(p["art"]) in gsk]
    if not arts:
        continue
    sb = sum(mine[a][0] for a in arts)
    sa = sum(mine[a][1] or 0 for a in arts)
    cb = sum(int(r["units"]) for r, d in kept if r["status"] != "cancelled" and str(r["sku"]) in csk and "2026-10-01" <= d <= "2026-10-14")
    ca = sum(int(r["units"]) for r, d in kept if r["status"] != "cancelled" and str(r["sku"]) in csk and START <= d <= min(OD_LAST, W1))
    tag = [a + ("*" if off2sku.get(a) in OUT else "") for a in arts]
    ok = sb <= cb and sa <= ca
    print(f"  {c['short']:12s} | {', '.join(tag)} | {sb}/{sa} | {cb}/{ca} (страница {blk.get(c['short'])}) | {'OK' if ok else 'НАРУШЕН'}")
    wd = [a for a in arts if off2sku.get(a) in OUT]
    if wd:
        print(f"      выводимые в разделе 5 и вне карточки блока 1: {[(a, mine[a]) for a in wd]}; без них {sb - sum(mine[a][0] for a in wd)}/{sa - sum(mine[a][1] or 0 for a in wd)}")
noc = [p["art"] for p in P["price"] if not any(off2sku.get(p["art"]) in {str(x["sku"]) for x in g["skus"]} for g in G
                                              if any(str(x["sku"]) == off2sku.get(c["main_art"]) for c in P["cards"] for x in g["skus"]))]
print("  артикулы раздела 5 вне карточек плана:", len(noc), noc)
print("  выводимые среди 29:", [p["art"] for p in P["price"] if p["art"] in set(P.get("withdrawn", []))])

# --- (г) переименования: SKU с двумя offer
sku_off = collections.defaultdict(lambda: collections.defaultdict(list))
for r, d in kept:
    sku_off[str(r["sku"])][r["offer"]].append((d, r["status"], int(r["units"])))
print("\n(г) SKU с двумя и более offer в orders_daily:")
plan_arts = {p["art"] for p in P["price"]}
for sku, offs in sku_off.items():
    if len(offs) < 2:
        continue
    print(f"  sku {sku}:")
    for o, lst in offs.items():
        ds = sorted(x[0] for x in lst)
        nb = sum(x[2] for x in lst if x[1] != "cancelled" and "2026-10-01" <= x[0] <= "2026-10-14")
        na = sum(x[2] for x in lst if x[1] != "cancelled" and START <= x[0] <= OD_LAST)
        print(f"     offer {o:24s} строк {len(lst):3d}  {ds[0]}..{ds[-1]}  в плане 29: {'ДА' if o in plan_arts else 'нет'}  01-14.10: {nb}  с15: {na}")
# обратная сторона: offer с двумя SKU
off_sku = collections.defaultdict(set)
for r, d in kept:
    off_sku[r["offer"]].add(str(r["sku"]))
print("  offer с двумя и более SKU:", {o: sorted(v) for o, v in off_sku.items() if len(v) > 1} or "нет")
print("  артикулы 29, чей SKU (по карте плана) встречается в orders_daily под другим offer:")
for p in P["price"]:
    sk = off2sku.get(p["art"])
    if sk and sk in sku_off:
        others = [o for o in sku_off[sk] if o != p["art"]]
        if others:
            print("    ", p["art"], sk, "другие offer:", others)
    if not sk:
        print("    ", p["art"], "нет в plan_card_groups_1510 (SKU неизвестен по карте плана)")

# --- (д) отмены по дням: смещение «без отмен» в свежих днях
print("\n(д) доля отмен в штуках по окнам (все товары):")
def canc_share(a, b):
    tot = sum(int(r["units"]) for r, d in kept if a <= d <= b)
    c = sum(int(r["units"]) for r, d in kept if a <= d <= b and r["status"] == "cancelled")
    return tot, c, (c / tot if tot else float("nan"))
for a, b in [("2026-10-01", "2026-10-14"), ("2026-09-15", "2026-10-14"), (START, OD_LAST),
             ((dt.date.fromisoformat(OD_LAST) - dt.timedelta(days=2)).isoformat(), OD_LAST)]:
    tot, c, sh = canc_share(a, b)
    print(f"  {a}..{b}: всего {tot} шт, отменено {c}, доля {sh:.1%}")
print("  по дням 01.10..OD_LAST:")
d0 = dt.date(2026, 10, 1)
while d0.isoformat() <= OD_LAST:
    tot, c, sh = canc_share(d0.isoformat(), d0.isoformat())
    print(f"    {d0.isoformat()}: {tot:3d} шт, отмен {c:2d} ({sh:.0%})")
    d0 += dt.timedelta(days=1)
# лаг отмены: для отменённых в сентябре-октябре - нет даты отмены в строке; смотрим статус-структуру
print("  статусы окна с 15.10:", collections.Counter(r["status"] for r, d in kept if START <= d <= OD_LAST))
print("  статусы 01-14.10:", collections.Counter(r["status"] for r, d in kept if "2026-10-01" <= d <= "2026-10-14"))

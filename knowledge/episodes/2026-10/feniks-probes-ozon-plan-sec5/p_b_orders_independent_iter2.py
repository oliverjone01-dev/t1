"""Проба (б) iter2: независимый счёт раздела 5 по спеке iter2, своя реализация на Python, не код билдера.
Окно заказов: с начала плана по min(последний день заказов, конец окна плана 28.10); сумма и дни из одного окна.
Пометка Δ (спека decisions 2026-10-20 п.(4)): окно < 7 дн -> «мало данных: окно N дн, нужно 7»;
заказов в двух окнах < 5 -> «мало данных: заказов N, нужно 5»; цена в окне заказов не менялась -> «цена в окне не менялась»;
иначе Δ со знаком и цветом. Строка магазина: все offer, без отмен, день по Москве, те же окна.
Запуск: python3 -I p_b_orders_independent_iter2.py <data_dir> <page.html> [overlay_dir]
overlay_dir: файлы фикстуры (orders_daily.ndjson, prices_daily.ndjson) поверх data_dir.
ФЕНИКС 2026-10-20, аудит PR #490 iter2."""
import sys, os, json, re, datetime as dt, math, collections, html as H
from decimal import Decimal, ROUND_HALF_UP

DATA, PAGE = sys.argv[1], sys.argv[2]
OVL = sys.argv[3] if len(sys.argv) > 3 else None


def path(f):
    if OVL and os.path.exists(os.path.join(OVL, f)):
        return os.path.join(OVL, f)
    return os.path.join(DATA, f)


def nd(f):
    with open(path(f), encoding="utf-8") as fh:
        return [json.loads(l) for l in fh if l.strip()]


with open(path("plan_2026-10-15_v4.json"), encoding="utf-8") as fh:
    P = json.load(fh)
with open(path("plan_card_groups_1510.json"), encoding="utf-8") as fh:
    G = json.load(fh)["groups"]
rows = nd("orders_daily.ndjson")
RAW_LAST = max(r["d"] for r in rows)
START, W1 = P["start"], P["window"][1]
MIN_DAYS, MIN_ORD = 7, 5


def msk(r):
    t = r.get("t")
    if not t:
        return r["d"]
    return (dt.datetime.fromisoformat(t.replace("Z", "+00:00")) + dt.timedelta(hours=3)).date().isoformat()


def ndays(a, b):
    return (dt.date.fromisoformat(b) - dt.date.fromisoformat(a)).days + 1


def jsround1(x):  # Math.round(x*10)/10: половина к +inf
    return math.floor(x * 10 + 0.5) / 10


def fix1(x):  # Number.toFixed(1) + разделитель тысяч пробелом, запятая
    q = Decimal(x).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)
    s = f"{abs(q):,.1f}".replace(",", " ").replace(".", ",")
    return ("-" if q < 0 else "") + s


def dm(d):
    return f"{d[8:10]}.{d[5:7]}"


kept = [(r, msk(r)) for r in rows]
kept = [(r, d) for r, d in kept if d <= RAW_LAST]
OD_LAST = max(d for _, d in kept)
if OD_LAST < START:
    END, DAYS = "", 0
else:
    END = OD_LAST if OD_LAST < W1 else W1
    DAYS = ndays(START, END)
print(f"RAW_LAST={RAW_LAST} OD_LAST={OD_LAST} окно={START}..{END or '-'} дней={DAYS}")

u = collections.Counter()
store = collections.Counter()
for r, d in kept:
    if r["status"] == "cancelled":
        continue
    u[(r["offer"], d)] += int(r["units"])
    store[d] += int(r["units"])


def U(a, x, y):
    return sum(v for (o, d), v in u.items() if o == a and x <= d <= y)


# цены: своя реализация смен (цена на 14.10 - последняя не позже 14.10; смена - отличие от предыдущего наблюдения)
pr = collections.defaultdict(dict)
for r in nd("prices_daily.ndjson"):
    if isinstance(r.get("price"), (int, float)):
        pr[r["offer"]][r["d"]] = r["price"]


def changes(a):
    m = pr.get(a, {})
    b = [d for d in m if d <= "2026-10-14"]
    prev = m[max(b)] if b else None
    out = []
    for d in sorted(x for x in m if x > "2026-10-14"):
        if prev is not None and m[d] != prev:
            out.append(d)
        prev = m[d]
    return out


# --- страница
with open(PAGE, encoding="utf-8") as fh:
    s = fh.read()
i = s.find('<summary class="sec">5. Цена')
j = s.find("<table", i)
k = s.find("</table>", j)
t = s[j:k]
ths = re.findall(r"<th([^>]*)>(.*?)</th>", t, re.S)
hdr = [(re.sub(r"<[^>]+>", "", x).strip(), (re.search(r'title="([^"]*)"', a) or [None, ""])[1]) for a, x in ths]
after_tbl = s[k:k + 1500]
m = re.search(r'</table></div><div class="muted s">(.*?)</div>', s[k:k + 1500], re.S)
store_line_page = H.unescape(m.group(1)).strip() if m else None


def cell_text(x):
    x = x.replace('<div class="muted s">', " ~").replace("<br>", " | ")
    return re.sub(r"\s+", " ", H.unescape(re.sub(r"<[^>]+>", "", x))).strip()


page = {}
for tr in re.findall(r"<tr>(.*?)</tr>", t[t.find("<tbody>"):], re.S):
    tds = re.findall(r"<td[^>]*>(.*?)</td>", tr, re.S)
    a = cell_text(tds[1]).split(" ~")[0].strip()
    draw = tds[9]
    if draw.strip() == "-":
        st, val, note = "dash", "-", None
    elif draw.startswith('<span class="muted"'):
        st = "gray"
        val = cell_text(re.search(r"<span[^>]*>(.*?)</span>", draw, re.S).group(1))
        nm = re.search(r'<div class="muted s">(.*?)</div>', draw, re.S)
        note = H.unescape(nm.group(1)) if nm else None
    else:
        col = re.search(r"color:([^\"]+)\"", draw).group(1)
        st = {"#34D399": "green", "#FF7A7E": "red", "inherit": "inherit"}.get(col, "?" + col)
        val, note = cell_text(draw), None
    page[a] = (cell_text(tds[7]), cell_text(tds[8]), val, st, note)

# --- шапка
th15 = [h for h in hdr if h[0].startswith("С 15.10")]
exp_head = "С 15.10" + (f" ({DAYS} дн)" if DAYS else "")
exp_title_start = f"заказы артикула {dm(START)}-{dm(END) if END else '-'} ({DAYS} дн, окно плана до {dm(W1)})"
print(f"шапка страницы: «{th15[0][0] if th15 else None}»; ожидаю «{exp_head}» -> {'OK' if th15 and th15[0][0] == exp_head else 'РАСХОЖДЕНИЕ'}")
print(f"title страницы: «{th15[0][1] if th15 else None}»")
print(f"  ожидаю начало «{exp_title_start}» -> {'OK' if th15 and th15[0][1].startswith(exp_title_start) else 'РАСХОЖДЕНИЕ'}")

# --- строки
print("\nартикул | моё 01-14 | моё окно | моя Δ | моё состояние / пометка || страница 01-14 | окно | Δ | состояние / пометка | совпало")
bad = 0
cnt = collections.Counter()
mine = {}
for p in P["price"]:
    a = p["art"]
    b = U(a, "2026-10-01", "2026-10-14")
    af = U(a, START, END) if DAYS else None
    dW = None if af is None else jsround1(af / DAYS * 7 - b / 14 * 7)
    ch_in = any(START <= d <= END for d in changes(a)) if DAYS else False
    if dW is None:
        est, enote = "dash", None
    elif DAYS < MIN_DAYS:
        est, enote = "gray", f"мало данных: окно {DAYS} дн, нужно {MIN_DAYS}"
    elif b + af < MIN_ORD:
        est, enote = "gray", f"мало данных: заказов {b + af}, нужно {MIN_ORD}"
    elif not ch_in:
        est, enote = "gray", "цена в окне не менялась"
    else:
        est, enote = ("green" if dW > 0 else "red" if dW < 0 else "inherit"), None
    ev = "-" if dW is None else (("+" if dW > 0 else "") + fix1(dW))
    mine[a] = (b, af)
    pg = page[a]
    ok = (str(b), "-" if af is None else str(af), ev, est, enote) == pg
    bad += 0 if ok else 1
    cnt[est] += 1
    print(f"  {a:22s} | {b:2d} | {('-' if af is None else af)!s:>2s} | {ev:>5s} | {est:5s} {enote or ''} || {pg[0]:>2s} | {pg[1]:>2s} | {pg[2]:>5s} | {pg[3]:5s} {pg[4] or ''} | {'OK' if ok else 'РАСХОЖДЕНИЕ'}")
print(f"расхождений: {bad} из {len(P['price'])}; состояния (моё): {dict(cnt)}")
print(f"сумма 01-14 = {sum(v[0] for v in mine.values())}, сумма окна = {sum(v[1] or 0 for v in mine.values())}")

# --- строка магазина
if DAYS:
    sB = sum(v for d, v in store.items() if "2026-10-01" <= d <= "2026-10-14")
    sA = sum(v for d, v in store.items() if START <= d <= END)
    sD = jsround1(sA / DAYS * 7 - sB / 14 * 7)
    exp_line = (f"Весь магазин за те же окна, шт/нед: 01-14.10 {fix1(sB / 14 * 7)}, {dm(START)}-{dm(END)} {fix1(sA / DAYS * 7)}"
                f" (Δ {'+' if sD > 0 else ''}{fix1(sD)}). Δ артикула - направление, не эффект цены: заказов по артикулу мало, сравнивать с магазином.")
    print(f"\nмагазин: 01-14.10 {sB} шт, окно {sA} шт за {DAYS} дн")
else:
    exp_line = f"Заказов с {dm(START)} ещё нет: Δ не считается."
print(f"строка магазина страницы: «{store_line_page}»")
print(f"моя:                       «{exp_line}» -> {'OK' if store_line_page == exp_line else 'РАСХОЖДЕНИЕ'}")

# --- инвариант (в): сумма невыводимых артикулов карточки <= карточка блока 1 (по SKU, окно до min(OD_LAST, 28.10))
off2sku = {x["offer"]: str(x["sku"]) for g in G for x in g["skus"]}
OUT = {off2sku.get(a, "") for a in P.get("withdrawn", [])}
print("\n(в) карточка | артикулы (* выводимый) с окном | сумма невыводимых 01-14 / окно | карточка 01-14 / окно | <=")
viol = 0
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
    live = [a for a in arts if off2sku.get(a) not in OUT]
    sb = sum(mine[a][0] for a in live)
    sa = sum(mine[a][1] or 0 for a in live)
    cb = sum(int(r["units"]) for r, d in kept if r["status"] != "cancelled" and str(r["sku"]) in csk and "2026-10-01" <= d <= "2026-10-14")
    ca = sum(int(r["units"]) for r, d in kept if r["status"] != "cancelled" and str(r["sku"]) in csk and DAYS and START <= d <= END)
    ok = sb <= cb and sa <= ca
    viol += 0 if ok else 1
    det = ", ".join(f"{a}{'*' if off2sku.get(a) in OUT else ''} {mine[a][1] if mine[a][1] is not None else '-'}" for a in arts)
    print(f"  {c['short']:12s} | {det} | {sb}/{sa} | {cb}/{ca} | {'OK' if ok else 'НАРУШЕН'}")
print(f"(в) нарушений: {viol}")

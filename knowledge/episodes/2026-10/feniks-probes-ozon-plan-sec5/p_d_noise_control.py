"""Проба (д): К3/К14 - шум и смешение в «Δ шт/нед» раздела 5. Независимый счёт по orders_daily (как p_b).
(1) условный биномиальный тест на артикул: при равном темпе доля окна с 15.10 в сумме заказов = nIn/(14+nIn);
(2) «контроль»: артикулы, у которых цена в окне заказов (15.10..OD_LAST) не менялась, против сменивших цену;
(3) весь магазин тем же правилом; (4) что показала бы страница при OD_LAST = 15, 16, 17, 18.10 (смена знака);
(5) состав дней недели в окнах.
Запуск: python3 -I p_d_noise_control.py <data_dir>
ФЕНИКС 2026-10-20, аудит PR #490. Расчёт - мой, [ДАННЫЕ: orders_daily.ndjson, prices_daily.ndjson на 20.10]."""
import sys, json, datetime as dt, math, collections

DATA = sys.argv[1]
P = json.load(open(f"{DATA}/plan_2026-10-15_v4.json", encoding="utf-8"))
rows = [json.loads(l) for l in open(f"{DATA}/orders_daily.ndjson", encoding="utf-8") if l.strip()]
RAW_LAST = max(r["d"] for r in rows)


def msk(r):
    x = dt.datetime.fromisoformat(r["t"].replace("Z", "+00:00")) + dt.timedelta(hours=3)
    return x.date().isoformat()


kept = [(r, msk(r)) for r in rows if msk(r) <= RAW_LAST]
OD_LAST = max(d for _, d in kept)
nIn = (dt.date.fromisoformat(OD_LAST) - dt.date(2026, 10, 15)).days + 1
u = collections.Counter()
for r, d in kept:
    if r["status"] != "cancelled":
        u[(r["offer"], d)] += r["units"]


def U(a, x, y):
    return sum(v for (o, d), v in u.items() if o == a and x <= d <= y)


def jsr(x):
    return math.floor(x * 10 + 0.5) / 10


def binom_two_sided(k, n, p):
    if n == 0:
        return 1.0
    pk = [math.comb(n, i) * p ** i * (1 - p) ** (n - i) for i in range(n + 1)]
    return min(1.0, sum(q for q in pk if q <= pk[k] * (1 + 1e-9)))


# первая смена цены по prices_daily (как priceChanges)
pr = collections.defaultdict(dict)
for l in open(f"{DATA}/prices_daily.ndjson", encoding="utf-8"):
    if l.strip():
        r = json.loads(l)
        if isinstance(r.get("price"), (int, float)):
            pr[r["offer"]][r["d"]] = r["price"]


def first_change(a):
    m = pr[a]
    b = [d for d in m if d <= "2026-10-14"]
    prev = m[max(b)] if b else None
    for d in sorted(x for x in m if x > "2026-10-14"):
        if prev is not None and m[d] != prev:
            return d
        prev = m[d]
    return None


p0 = nIn / (14 + nIn)
print(f"OD_LAST={OD_LAST} nIn={nIn}; при равном темпе доля окна с 15.10 = {p0:.3f}")
print("\n(1) артикул | 01-14 | с15 | Δ | первая смена | p (двусторонний, условный биномиальный) | цена в окне")
grp = {"цена сменилась в окне заказов": [0, 0, 0], "цена в окне не менялась": [0, 0, 0]}
sig05 = sig20 = 0
withorders = 0
colored = 0
for p in P["price"]:
    a = p["art"]
    b, af = U(a, "2026-10-01", "2026-10-14"), U(a, "2026-10-15", OD_LAST)
    dW = jsr(af / nIn * 7 - b / 14 * 7)
    fc = first_change(a)
    inwin = fc is not None and fc <= OD_LAST
    pv = binom_two_sided(af, b + af, p0)
    if b + af:
        withorders += 1
        sig05 += pv < 0.05
        sig20 += pv < 0.2
    colored += dW != 0
    g = grp["цена сменилась в окне заказов" if inwin else "цена в окне не менялась"]
    g[0] += b; g[1] += af; g[2] += 1
    print(f"  {a:22s} | {b:2d} | {af:2d} | {dW:+5.1f} | {fc or '-':10s} | {pv:.3f} | {'да, ' + fc[8:10] + '.' + fc[5:7] if inwin else ('после окна ' + fc[8:10] + '.' + fc[5:7] if fc else 'нет')}")
print(f"  артикулов с заказами: {withorders}; p<0.05: {sig05}; p<0.20: {sig20}; цветных ячеек Δ (не 0): {colored}")
print(f"  ожидаемо ложных p<0.05 при {withorders} проверках и нулевом эффекте: около {0.05 * withorders:.1f}")

print("\n(2) группа | артикулов | 01-14 | с15 | темп 01-14 шт/нед | темп с15 шт/нед | рост темпа")
for k, (b, af, n) in grp.items():
    rb, ra = b / 14 * 7, af / nIn * 7
    print(f"  {k:32s} | {n:2d} | {b:3d} | {af:3d} | {rb:6.2f} | {ra:6.2f} | {(ra / rb - 1) * 100 if rb else float('nan'):+.0f}%")

sb = sum(r["units"] for r, d in kept if r["status"] != "cancelled" and "2026-10-01" <= d <= "2026-10-14")
sa = sum(r["units"] for r, d in kept if r["status"] != "cancelled" and "2026-10-15" <= d <= OD_LAST)
print(f"\n(3) весь магазин без отмен: 01-14 {sb} шт ({sb / 2:.1f}/нед), с15 {sa} шт за {nIn} дн ({sa / nIn * 7:.1f}/нед), рост {(sa / nIn * 7) / (sb / 2) * 100 - 100:+.0f}%")

print("\n(4) что показывала бы страница (Δ шт/нед) при OD_LAST = 15..18.10, артикулы с заказами:")
print("  артикул               | " + " | ".join(f"по {d}.10" for d in (15, 16, 17, 18)))
flips = 0
for p in P["price"]:
    a = p["art"]
    b = U(a, "2026-10-01", "2026-10-14")
    vals = []
    for last in (15, 16, 17, 18):
        n = last - 14
        af = U(a, "2026-10-15", f"2026-10-{last}")
        vals.append(jsr(af / n * 7 - b / 14 * 7))
    if b + U(a, "2026-10-15", OD_LAST) == 0:
        continue
    sgn = {(v > 0) - (v < 0) for v in vals}
    flips += (1 in sgn and -1 in sgn)
    print(f"  {a:22s} | " + " | ".join(f"{v:+6.1f}" for v in vals) + ("   <- знак менялся" if (1 in sgn and -1 in sgn) else ""))
print(f"  артикулов, у которых знак Δ менялся между сборками 16-19.10: {flips}")

wd = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"]
def wmix(a, b):
    d, e = dt.date.fromisoformat(a), dt.date.fromisoformat(b)
    c = collections.Counter()
    while d <= e:
        c[wd[d.weekday()]] += 1
        d += dt.timedelta(days=1)
    return dict(c)
print("\n(5) дни недели: 01-14.10", wmix("2026-10-01", "2026-10-14"), "; с 15.10", wmix("2026-10-15", OD_LAST))

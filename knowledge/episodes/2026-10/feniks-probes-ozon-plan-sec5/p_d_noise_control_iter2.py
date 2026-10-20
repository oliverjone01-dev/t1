"""Проба (д) iter2: К3/К14 - хватает ли порогов deltaNote (окно >= 7 дн, заказов >= 5, смена цены в окне), чтобы шум
и фон магазина не читались как эффект цены. Расчёт мой, [ДАННЫЕ: orders_daily.ndjson, prices_daily.ndjson на 20.10].
(1) сегодня: все Δ серые? (окно 4 дня);
(2) точный порог: при n заказов в двух окнах какой исход вообще значим (двусторонний биномиальный, p < 0,05);
(3) прогноз на сборки с заказами по 21.10 (7 дн), 24.10 (10 дн), 28.10 (14 дн), Монте-Карло 4000 прогонов, seed 20261020:
    H0a - темп артикула не менялся; H0b - артикул растёт как магазин, цена не действует; H1 - +30% к фону у сменивших цену.
    Первые 4 дня окна (15-18.10) - факт, дальше - симуляция. Смена цены в окне: факт на 20.10 + [ГИПОТЕЗА] 9 артикулов
    со сроком 22.10 меняют цену 22.10 по плану.
    Правила: A - автор (n >= 5); A10, A20 - то же при n >= 10 и 20; S - предложение: цвет только если заказы артикула
    отличаются от ожидаемых по темпу магазина (биномиальный, p < 0,05), иначе серым.
Запуск: python3 -I p_d_noise_control_iter2.py <data_dir>
ФЕНИКС 2026-10-20, аудит PR #490 iter2."""
import sys, json, math, random, collections, datetime as dt
from functools import lru_cache

DATA = sys.argv[1]


def nd(f):
    with open(f"{DATA}/{f}", encoding="utf-8") as fh:
        return [json.loads(l) for l in fh if l.strip()]


with open(f"{DATA}/plan_2026-10-15_v4.json", encoding="utf-8") as fh:
    P = json.load(fh)
rows = nd("orders_daily.ndjson")
RAW_LAST = max(r["d"] for r in rows)


def msk(r):
    return (dt.datetime.fromisoformat(r["t"].replace("Z", "+00:00")) + dt.timedelta(hours=3)).date().isoformat() if r.get("t") else r["d"]


kept = [(r, msk(r)) for r in rows]
kept = [(r, d) for r, d in kept if d <= RAW_LAST]
OD_LAST = max(d for _, d in kept)
W0 = (dt.date.fromisoformat(OD_LAST) - dt.date(2026, 10, 15)).days + 1
u = collections.Counter()
sB = sA = 0
for r, d in kept:
    if r["status"] == "cancelled":
        continue
    u[(r["offer"], d)] += r["units"]
    if "2026-10-01" <= d <= "2026-10-14":
        sB += r["units"]
    if "2026-10-15" <= d <= OD_LAST:
        sA += r["units"]
R = (sA / W0) / (sB / 14)
pr = collections.defaultdict(dict)
for r in nd("prices_daily.ndjson"):
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


arts = []
for p in P["price"]:
    a = p["art"]
    b = sum(v for (o, d), v in u.items() if o == a and "2026-10-01" <= d <= "2026-10-14")
    ao = sum(v for (o, d), v in u.items() if o == a and "2026-10-15" <= d <= OD_LAST)
    fc = first_change(a)
    planned = None if fc else (f"2026-{p['when'][3:5]}-{p['when'][0:2]}" if p["when"] > "16.10" else None)
    arts.append((a, b, ao, fc, planned))

print(f"OD_LAST={OD_LAST} окно {W0} дн; магазин 01-14.10 {sB} шт ({sB / 2:.1f}/нед), 15.10-{OD_LAST[8:]}.10 {sA} шт ({sA / W0 * 7:.1f}/нед), отношение темпов R = {R:.3f}")
print(f"(1) сегодня окно {W0} дн < 7: по правилу все {len(arts)} Δ серые (сверка со страницей - в out_b_orders_independent_iter2.txt)")
print(f"    артикулов со сменой цены по факту: {sum(1 for x in arts if x[3])}; без смены: {sum(1 for x in arts if not x[3])}, из них со сроком 22.10 [ГИПОТЕЗА: сменят 22.10]: {sum(1 for x in arts if x[4])}")


@lru_cache(maxsize=None)
def pmf(n, q):
    return tuple(math.comb(n, i) * q ** i * (1 - q) ** (n - i) for i in range(n + 1))


@lru_cache(maxsize=None)
def p2(k, n, q):
    if n == 0:
        return 1.0
    f = pmf(n, q)
    return min(1.0, sum(x for x in f if x <= f[k] * (1 + 1e-9)))


print("\n(2) окно 14 дн против базы 14 дн, равный темп (q = 0,5): какой исход значим (p < 0,05, двусторонний)")
for n in (5, 6, 8, 10, 15, 20, 30):
    sig = [k for k in range(n + 1) if p2(k, n, 0.5) < 0.05]
    lo = max([k for k in sig if k < n / 2], default=None)
    hi = min([k for k in sig if k > n / 2], default=None)
    rr = (f"окно <= {lo} или >= {hi} из {n}" if sig else "ни один исход") + (f"; отношение темпов вне {lo / (n - lo) if lo is not None and lo < n else 0:.2f}..{hi / (n - hi) if hi is not None and hi < n else float('inf'):.2f}" if sig else "")
    print(f"  n = {n:2d}: {rr}")


def poisson(rng, lam):
    if lam <= 0:
        return 0
    L, k, p = math.exp(-lam), 0, 1.0
    while True:
        p *= rng.random()
        if p <= L:
            return k
        k += 1


def changed(fc, planned, end):
    return (fc is not None and "2026-10-15" <= fc <= end) or (planned is not None and planned <= end)


NS = 4000
rng = random.Random(20261020)
print(f"\n(3) прогноз, {NS} прогонов на точку; в ячейках - среднее число цветных Δ из 29 (зелёных / красных)")
print("  сборка по | окно | модель | A: n>=5 | A10: n>=10 | A20: n>=20 | S: к темпу магазина p<0,05")
for end, w in (("2026-10-21", 7), ("2026-10-24", 10), ("2026-10-28", 14)):
    e = w - W0
    q = R * w / (14 + R * w)
    for model in ("H0a", "H0b", "H1"):
        acc = {k: [0, 0] for k in ("A", "A10", "A20", "S")}
        for _ in range(NS):
            for a, b, ao, fc, planned in arts:
                ch = changed(fc, planned, end)
                if model == "H0a":
                    lam = (b + ao) / (14 + W0)
                elif model == "H0b":
                    lam = (b + ao) / (14 + W0 * R) * R
                else:
                    lam = (b + ao) / (14 + W0 * R) * R * (1.3 if ch else 1.0)
                af = ao + poisson(rng, lam * e)
                n = b + af
                dW = af / w * 7 - b / 14 * 7
                if not ch or dW == 0:
                    continue
                for key, nmin in (("A", 5), ("A10", 10), ("A20", 20)):
                    if n >= nmin:
                        acc[key][0 if dW > 0 else 1] += 1
                if n and p2(af, n, q) < 0.05:
                    acc["S"][0 if af > n * q else 1] += 1
        cells = " | ".join(f"{(acc[k][0] + acc[k][1]) / NS:4.1f} ({acc[k][0] / NS:4.1f} / {acc[k][1] / NS:3.1f})" for k in ("A", "A10", "A20", "S"))
        print(f"  {end[8:]}.10 | {w:2d} | {model} | {cells}")
print("  H0b: любой цветной Δ - не эффект цены (цена не действует по построению); зелёный там - рост магазина.")
print("  H1: верный цвет - зелёный у сменивших цену; S показывает, сколько из них отличимо от фона при таких объёмах.")

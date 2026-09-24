# -*- coding: utf-8 -*-
"""Что стоит за соинвестом: доля Ozon или наша скидка.

Решает выплата на единицу. Если она привязана к предельной цене и не зависит
от глубины соинвеста, разрыв между предельной ценой и витриной оплачивает Ozon.
Если привязана к витрине, платим мы.

Источники (все из data/, ничего не скачивает):
  coinv_daily.ndjson          date, sku, art, site, cap, coinv_pct, cap_reliable
  pnl_sku_accrual_daily.ndjson d, sku, accruals, commission, ..., amount
  order_accruals.ndjson       order, ym, rev_cash, rev_points, rev_other, commission

Запуск: python3 tools/tests/payout_base_check.py   (из analytics-mvp)
"""
import collections
import json
import statistics
import sys

D = "data/"


def frac(x: float) -> float:
    return abs(x - round(x))


def load_prices():
    cv = collections.defaultdict(dict)
    for line in open(D + "coinv_daily.ndjson", encoding="utf-8"):
        o = json.loads(line)
        cv[o["sku"]][o["date"]] = o
    return cv


def matched(cv):
    """Дни, где начисление это целое число предельных цен того же дня.

    Берём только надёжную предельную цену. Дата начисления это дата выплаты,
    а не дата заказа, поэтому часть дней не сойдётся; это шум в одну сторону,
    совпадения он создать не может.
    """
    out = []
    for line in open(D + "pnl_sku_accrual_daily.ndjson", encoding="utf-8"):
        o = json.loads(line)
        if o["accruals"] <= 0:
            continue
        hist = cv.get(o["sku"])
        days = [d for d in (hist or {}) if d <= o["d"]]
        if not days:
            continue
        c = hist[max(days)]
        if not c["cap_reliable"]:
            continue
        r = o["accruals"] / c["cap"]
        if 0.9 <= r <= 4.5 and frac(r) <= 0.02:
            out.append((o, c, round(r)))
    return out


def base_test(cv):
    """К чему прилипает начисление: к предельной цене или к витрине."""
    hc, hs, n = collections.Counter(), collections.Counter(), 0
    for line in open(D + "pnl_sku_accrual_daily.ndjson", encoding="utf-8"):
        o = json.loads(line)
        if o["accruals"] <= 0:
            continue
        hist = cv.get(o["sku"])
        days = [d for d in (hist or {}) if d <= o["d"]]
        if not days:
            continue
        c = hist[max(days)]
        if not c["cap_reliable"]:
            continue
        rc, rs = o["accruals"] / c["cap"], o["accruals"] / c["site"]
        if not (0.9 <= rc <= 4.5 and 0.9 <= rs <= 9):
            continue
        n += 1
        hc[round(frac(rc), 1)] += 1
        hs[round(frac(rs), 1)] += 1
    print("База начисления, наблюдений: %d" % n)
    print("  дробная часть | к предельной | к витрине")
    for k in sorted(set(hc) | set(hs)):
        print("      %.1f       |   %4d       |  %4d" % (k, hc.get(k, 0), hs.get(k, 0)))
    print("  точных кратных: предельная %.0f %%, витрина %.0f %%"
          % (100 * hc[0.0] / n, 100 * hs[0.0] / n))
    return n


def payout_test(rows):
    """Главный тест: зависит ли выплата на единицу от глубины соинвеста."""
    buck = collections.defaultdict(list)
    for o, c, u in rows:
        net = o["amount"] / u
        buck[int(c["coinv_pct"] // 5 * 5)].append((net / c["site"], net / c["cap"]))
    print("\nВыплата на единицу, совпавших наблюдений: %d" % len(rows))
    print("  соинвест, %  |  n  | выплата/витрина | выплата/предельная")
    for b in sorted(buck):
        v = buck[b]
        if len(v) < 4:
            continue
        print("    %2d-%2d      | %3d |      %.2f       |       %.2f"
              % (b, b + 5, len(v),
                 statistics.median(x[0] for x in v),
                 statistics.median(x[1] for x in v)))
    com = [-o["commission"] / o["accruals"] for o, _, _ in rows if o["accruals"]]
    print("  комиссия от начисления: медиана %.1f %%" % (100 * statistics.median(com)))
    print("  последний день начислений: %s" % max(o["d"] for o, _, _ in rows))


def points_test():
    """Из чего складывается начисленная выручка на уровне заказа."""
    rs = []
    for line in open(D + "order_accruals.ndjson", encoding="utf-8"):
        o = json.loads(line)
        tot = o.get("rev_cash", 0) + o.get("rev_points", 0) + o.get("rev_other", 0)
        if tot > 0:
            rs.append((o.get("rev_points", 0) / tot, o.get("commission", 0), tot, o["ym"]))
    print("\nЗаказов с начисленной выручкой: %d" % len(rs))
    print("  баллы Ozon в выручке: медиана %.1f %%, заказов с баллами %.0f %%"
          % (100 * statistics.median(r[0] for r in rs),
             100 * sum(1 for r in rs if r[0] > 0) / len(rs)))
    com = [-r[1] / r[2] for r in rs if r[1]]
    print("  комиссия от выручки: медиана %.1f %%" % (100 * statistics.median(com)))
    print("  последний месяц: %s" % max(r[3] for r in rs))


def main() -> int:
    cv = load_prices()
    base_test(cv)
    rows = matched(cv)
    if not rows:
        print("нет совпавших наблюдений", file=sys.stderr)
        return 1
    payout_test(rows)
    points_test()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

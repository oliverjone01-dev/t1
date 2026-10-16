# ФЕНИКС iter3, PR #478 @ 528604a. Калибровка порога после вывода 27 артикулов (пороги как в Excel, Иван 15.10).
# Спека :47: «порог карточки: Пуассон, карточка без эффекта проходит не чаще 15%». λ без эффекта за 14 дней = база/2.
# Сравниваю P(пройти без эффекта) и прирост, нужный оставшимся товарам для 50% шанса пройти, если выводимые
# артикулы продают (а) как в базе, (б) ноль. Числа базы - v2_withdrawn.py (день МСК, без отмен). python3 -I v2_poisson.py
import math

CARDS = [('KUVINO', 30, 4, 20), ('EVELIX', 21, 5, 15), ('OSOLIS', 17, 5, 13), ('ARFEO', 11, 6, 9), ('ARKIS', 10, 5, 8)]


def p_ge(lam, k):
    return 1 - sum(math.exp(-lam) * lam ** i / math.factorial(i) for i in range(k))


def need(rest, k):   # множитель на оставшиеся товары, при котором P(X >= k) = 0.5
    lo, hi = 0.0, 50.0
    for _ in range(80):
        m = (lo + hi) / 2
        lo, hi = (m, hi) if p_ge(rest * m, k) < 0.5 else (lo, m)
    return hi


print('карточка | база / от выводимых | порог | P(пройти без эффекта): как в базе / выводимые = 0 | прирост для 50%: как в базе / выводимые = 0')
for name, base, out, thr in CARDS:
    lam_all, lam_rest = base / 2, (base - out) / 2
    print(f'{name} | {base} / {out} | {thr} | {p_ge(lam_all, thr):.1%} / {p_ge(lam_rest, thr):.2%} | '
          f'+{need(lam_all, thr) - 1:.0%} / +{need(lam_rest, thr) - 1:.0%}')

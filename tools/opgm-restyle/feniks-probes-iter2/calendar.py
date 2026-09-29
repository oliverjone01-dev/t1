# ФЕНИКС iter2: арифметика календаря плана v2 §7 по его же допущениям (8 активных часов в рабочий день, выходные не рабочие)
import datetime as dt
H = 8.0
lo, hi = 17.5, 27.5
buf = hi * 0.30
print('Д-пакет часы: низ', lo, 'верх', hi, 'буфер 30% верха', round(buf, 2), 'верх+буфер', round(hi + buf, 2))
print('в рабочих днях: низ', round(lo / H, 2), 'верх', round(hi / H, 2), 'верх+буфер', round((hi + buf) / H, 2))

def finish(start, hours, weekend=False):
    d, left = start, hours
    while True:
        if weekend or d.weekday() < 5:
            if left <= H:
                return d, left
            left -= H
        d += dt.timedelta(days=1)

P = dt.date(2026, 9, 30)
for label, h in [('низ', lo), ('верх', hi), ('верх+буфер', hi + buf)]:
    f1, r1 = finish(P, h); f2, r2 = finish(P, h, weekend=True)
    print(f'P=30.09 утро, {label} {h} ч: без выходных конец {f1:%d.%m %a} (часов в последний день {r1:.1f}); с выходными {f2:%d.%m %a}')
# P позже 01.10 12:00: сколько рабочих часов до 04.10 18:00 без выходных
print('часов с 01.10 12:00 до 02.10 конца дня без выходных:', 4 + 8)
print('часов с 30.09 утра до 02.10 конца дня без выходных:', 3 * 8)
# цепочка до выпуска W1/W2 07.10 при одном исполнителе (допущение А плана)
days = [dt.date(2026, 9, 30) + dt.timedelta(days=i) for i in range(7)]
work = [d for d in days if d.weekday() < 5]
print('рабочих дней 30.09-06.10:', len(work), [d.strftime('%d.%m %a') for d in work])
need_lo = lo / H + 1 + 1 + 1
need_hi = hi / H + 1 + 2 + 2
print('нужно при одном исполнителе (Д-пакет + W0 + W1 + W2): низ', round(need_lo, 2), 'верх', round(need_hi, 2))
for d in [dt.date(2026, 10, 3), dt.date(2026, 10, 5), dt.date(2026, 10, 6), dt.date(2026, 10, 14), dt.date(2026, 10, 23), dt.date(2026, 10, 29)]:
    print(d.strftime('%d.%m.%Y'), d.strftime('%A'))
# буфер волн: 5 рабочих дней 23.10 и 26-29.10
b = [dt.date(2026, 10, 23)] + [dt.date(2026, 10, 26) + dt.timedelta(days=i) for i in range(4)]
print('буфер:', [x.strftime('%d.%m %a') for x in b], 'доля от 16:', round(5 / 16 * 100, 1))
# середина срока: от 30.09 (или 05.10 W0) до 29.10
s0, e0 = dt.date(2026, 9, 30), dt.date(2026, 10, 29)
print('середина 30.09-29.10:', (s0 + (e0 - s0) / 2).strftime('%d.%m'))
s1 = dt.date(2026, 10, 5)
print('середина 05.10-29.10:', (s1 + (e0 - s1) / 2).strftime('%d.%m'))

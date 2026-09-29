# ФЕНИКС iter3: проверка арифметики §7 плана v3 по его же допущениям (день 10:00-18:00, 8 ч)
import datetime as dt
H0, H1 = 10, 18
def add(start, hours, weekends):
    t = start; left = hours
    while True:
        wd = t.weekday()
        if (wd < 5 or weekends):
            end = t.replace(hour=H1, minute=0)
            if t < end:
                avail = (end - t).total_seconds() / 3600
                if avail >= left - 1e-9:
                    return t + dt.timedelta(hours=left)
                left -= avail
        t = (t + dt.timedelta(days=1)).replace(hour=H0, minute=0)
P = dt.datetime(2026, 9, 30, 10, 0)
for name, h in [('нижняя', 17.5), ('верхняя', 27.5), ('верхняя с буфером', 35.75), ('50% нижней', 8.75), ('50% верхней', 13.75), ('P + 14 ч', 14), ('50% верхней с буфером', 35.75 / 2)]:
    print(f'{name:24} {h:6} ч: без выходных {add(P, h, False):%d.%m %H:%M} | с выходными {add(P, h, True):%d.%m %H:%M}')
# пороги P из §7.1
for name, h, dl, we in [('цель 02.10 нижняя', 17.5, dt.datetime(2026,10,2,18), False), ('верхняя к 04.10 18:00 с вых.', 27.5, dt.datetime(2026,10,4,18), True), ('верх.+буфер к 04.10 18:00 с вых.', 35.75, dt.datetime(2026,10,4,18), True)]:
    t = dt.datetime(2026, 9, 30, 10, 0); last = None
    while t < dl:
        if add(t, h, we) <= dl: last = t
        t += dt.timedelta(minutes=15)
        if t.hour >= H1: t = (t + dt.timedelta(days=1)).replace(hour=H0, minute=0)
    print(f'порог P, {name}: не позже {last:%d.%m %H:%M}')
# волны сессии рестайлинга W1+W2 последовательно от 30.09 10:00
for lo, hi in [(2, 4)]:
    print('W1+W2 одной сессией, дней', lo, '-', hi, ': конец', f'{add(P, lo * 8, False):%d.%m %H:%M}', '-', f'{add(P, hi * 8, False):%d.%m %H:%M}', '(без выходных)')

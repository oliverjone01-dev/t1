# ФЕНИКС iter2, проба Q07: «заказов магазина в выходные 9,0 против 10,0 в день» (03.07-11.10), заказы без отмен и все.
import json, datetime as dt, collections as C
D = '/home/user/t1/analytics-mvp/data/'
for lab, a, b in (('03.07-11.10', '2026-07-03', '2026-10-11'), ('01.07-11.10', '2026-07-01', '2026-10-11')):
    u = C.Counter(); ua = C.Counter(); days = set()
    for l in open(D + 'orders_daily.ndjson'):
        o = json.loads(l)
        if a <= o['d'] <= b:
            days.add(o['d']); ua[o['d']] += o['units']
            if o['status'] != 'cancelled': u[o['d']] += o['units']
    wk = [d for d in days if dt.date.fromisoformat(d).weekday() >= 5]; bd = [d for d in days if dt.date.fromisoformat(d).weekday() < 5]
    f = lambda c, ds: sum(c[d] for d in ds) / len(ds)
    print(lab, f'без отмен: Сб-Вс {f(u, wk):.2f} будни {f(u, bd):.2f} | все: Сб-Вс {f(ua, wk):.2f} будни {f(ua, bd):.2f} | дней {len(wk)} / {len(bd)}')

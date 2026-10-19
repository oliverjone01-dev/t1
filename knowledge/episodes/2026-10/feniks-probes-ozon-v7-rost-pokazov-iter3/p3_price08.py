# P3: снижения цены внутри окна базы порога (14.09-11.10) и после него - по 10 карточкам волны 1.
# Порог 29.10 = Пуассон с базой 2 x заказов/нед 14.09-11.10. Если цена товара карточки снижена 08.10 (или 25.09), база занижена,
# и карточка без эффекта рекламы проходит порог чаще 15%. Считаем P(пройти | реклама ноль, только цена) по эластичности модели v5.
import sys, json, collections as C
V7 = '/home/user/t1/knowledge/episodes/2026-10/ozon-testy-scripts/v7'
sys.path.insert(0, V7); sys.path.insert(0, V7 + '/../v5')
import cards7 as K, plan7 as P, forecast as F
D = F.D
pr = C.defaultdict(list)
for l in open(D + 'prices_daily.ndjson'):
    x = json.loads(l); pr[x['offer']].append((x['d'], x['price']))
def changes(o, since='2026-09-23'):
    out = []; prev = None
    for d, p in pr.get(o, []):
        if d >= since and prev is not None and p != prev: out.append((d, prev, p))
        prev = p
    return out
G = json.load(open(D + 'card_groups.json'))['groups']
skus_of = {g['main']: [(s['sku'], s['offer']) for s in g['skus']] for g in G}
o4 = K.o4
# все снижения цены с 23.10 (с 23.09 поле price - наша цена) по товарам 10 карточек
print('снижения нашей цены с 23.09 по 14.10 в 10 карточках волны 1 (товары с заказами в базе):')
cut08 = {}
for i, c in enumerate(K.cards[:10], 1):
    for sku, off in skus_of[c['card']]:
        ch = [(d, a, b) for d, a, b in changes(off) if b < a * 0.98]
        if ch:
            cut08[sku] = ch
            print(f"  #{i} {c['main_art']:20} {off:22} заказов в базе {o4[sku]:3}  " + '; '.join(f'{d}: {a} -> {b} ({b / a - 1:+.1%})' for d, a, b in ch))
# доля дней базы после снижения
A, B = F.A, F.B
import datetime as dt
def days(a, b): return (dt.date.fromisoformat(b) - dt.date.fromisoformat(a)).days + 1
print('\nP(пройти порог 29.10 | эффект рекламы 0, эффект только цены), по сценариям эластичности v5 (EPS -1 / -2 / -3,6), переток XFER 0,5 / 0,25 / 0:')
print('  учтено: снижения 25.09-08.10 (полное окно 15-28.10; база занижена пропорционально дням до снижения), шаг списка 26 (15.10 - 14 дней, 22.10 - 7 дней)')
for i, c in enumerate(K.cards[:10], 1):
    lam0 = 2 * c['u_wk']; N = K.threshold(c)
    row = []
    for sc in F.SCN:
        eps, xf = F.EPS[sc], F.XFER[sc]; add = 0.0; add08 = 0.0
        for sku, off in skus_of[c['card']]:
            u = o4[sku] / F.WEEKS                                 # заказов/нед в базе
            for d, a, b in cut08.get(sku, []):
                if d <= '2026-10-11':                              # снижение внутри окна базы: доля базы до снижения
                    pre = days(A, min(B, (dt.date.fromisoformat(d) - dt.timedelta(days=1)).isoformat())) / days(A, B)
                    m = (b / a) ** eps                             # множитель заказов товара после снижения
                    u_old = u / (pre + (1 - pre) * m)              # заказы при старой цене
                    add08 += 2 * (u_old * m - u) * (1 - xf)        # окно 15-28.10 целиком по новой цене, против базы
            if sku in F.lst:
                st = F.lst[sku]['step'] / 100; when = 2 if sku in P.NOW else 1    # недели окна под новой ценой
                if sku in P.PRICE_08 or sku in P.WAIT or sku == F.art2sku['GGT-48-5-1-100-180']: when = 1
                add += when * u * ((1 - st) ** eps - 1) * (1 - xf)
        p_only08 = K.pois_sf(N, lam0 + add08); p_all = K.pois_sf(N, lam0 + add08 + add)
        row.append(f'{sc[:3]} 08.10: {p_only08:.2f} все цены: {p_all:.2f}')
    print(f"  #{i:2} {c['main_art']:20} база λ={lam0:5.1f} порог {N:2} P0={K.pois_sf(N, lam0):.3f} | " + ' | '.join(row))
# факт: заказы карточки 08-13.10 против базы (6 дней после снижения 08.10)
print('\nфакт: заказов карточки без отмен в день, база 14.09-07.10 против 08-13.10:')
od = C.defaultdict(C.Counter)
for o in F.L('orders_daily.ndjson'):
    if o['status'] == 'cancelled': continue
    od[o['sku']][o['d']] += o['units']
for i, c in enumerate(K.cards[:10], 1):
    ss = [s for s, _ in skus_of[c['card']]]
    pre = sum(od[s][d] for s in ss for d in od[s] if '2026-09-14' <= d <= '2026-10-07') / days('2026-09-14', '2026-10-07')
    post = sum(od[s][d] for s in ss for d in od[s] if '2026-10-08' <= d <= '2026-10-13') / 6
    flag = 'снижение 08.10' if any(s in cut08 for s in ss) else ''
    print(f"  #{i:2} {c['main_art']:20} {pre:5.2f} -> {post:5.2f} в день  {flag}")

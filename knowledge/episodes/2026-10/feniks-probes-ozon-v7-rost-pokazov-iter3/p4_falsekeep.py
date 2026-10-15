# P4 (v2): ложное «оставляем» 29.10 при нулевом эффекте рекламы, но с эффектом цены.
# Поле price в prices_daily сменило смысл 23.09 (все цены x1,9-2,5 за один день) - поэтому путь цены берём только с 23.09,
# дни базы 14-22.09 считаем по цене 23.09. Для каждого товара 10 карточек: заказы базы u (14.09-11.10) получены при ценах p_d;
# по эластичности модели v5 (EPS) заказы при цене p: u_ref x (p / p_ref)^eps. Окно 15-28.10: цена на 14.10, плюс шаг списка 26
# (15.10 - 2 недели, 22.10 - 1 неделя). Переток XFER к соседям по карточке вычитается из прироста (как в forecast.run).
import sys, json, collections as C, datetime as dt
V7 = '/home/user/t1/knowledge/episodes/2026-10/ozon-testy-scripts/v7'
sys.path.insert(0, V7); sys.path.insert(0, V7 + '/../v5')
import cards7 as K, plan7 as P, forecast as F
D = F.D
pr = C.defaultdict(dict)
for l in open(D + 'prices_daily.ndjson'):
    x = json.loads(l)
    if x['d'] >= '2026-09-23': pr[x['offer']][x['d']] = x['price']
G = json.load(open(D + 'card_groups.json'))['groups']
skus_of = {g['main']: [(s['sku'], s['offer']) for s in g['skus']] for g in G}
o4 = K.o4; A, B = F.A, F.B
base_days = [(dt.date.fromisoformat(A) + dt.timedelta(days=i)).isoformat() for i in range(28)]
def path(off):
    p = pr.get(off, {})
    if not p: return None
    ds = sorted(p); out = []
    for d in base_days:
        prev = [x for x in ds if x <= d]
        out.append(p[prev[-1]] if prev else p[ds[0]])
    return out, p[ds[-1]]
def lam_price(c, sc, steps=True, verbose=False):
    eps, xf = F.EPS[sc], F.XFER[sc]; add = 0.0
    for sku, off in skus_of[c['card']]:
        u = o4[sku] / F.WEEKS
        if not u: continue
        pt = path(off)
        if not pt: continue
        ps, pnow = pt
        mean_mult = sum((pd / pnow) ** eps for pd in ps) / len(ps)       # средний множитель базы к цене сейчас
        u_now = u / mean_mult                                            # заказов/нед при цене сейчас (без шага списка)
        wk_add = u_now - u
        if steps and sku in F.lst:
            st = F.lst[sku]['step'] / 100; wk = 2 if sku in P.NOW else 1
            extra = wk * u_now * ((1 - st) ** eps - 1)
        else: extra = 0
        delta = (2 * wk_add + extra) * (1 - xf if (2 * wk_add + extra) > 0 else 1)
        add += delta
        if verbose and abs(2 * wk_add) > 0.05:
            print(f"     {off:22} u {u:.2f}/нед, цена базы ср. {sum(ps) / len(ps):9,.0f} -> сейчас {pnow:9,.0f} ({pnow / (sum(ps) / len(ps)) - 1:+.0%}), за 2 нед {2 * wk_add:+.2f}".replace(',', ' '))
    return 2 * c['u_wk'] + add
def pb_atleast(ps, k):
    dist = [1.0]
    for p in ps:
        nd = [0.0] * (len(dist) + 1)
        for j, q in enumerate(dist): nd[j] += q * (1 - p); nd[j + 1] += q * p
        dist = nd
    return sum(dist[k:])
cards = K.cards[:10]
print('сдвиг λ от цен, сложившихся к 14.10, средний сценарий (EPS -2), по товарам с заказами в базе:')
for i, c in enumerate(cards, 1):
    print(f"  #{i} {c['main_art']}: λ базы {2 * c['u_wk']:.1f} -> {lam_price(c, 'средний', steps=False, verbose=False):.1f} (только цены к 14.10), "
          f"{lam_price(c, 'средний'):.1f} (с шагами списка 26); порог {K.threshold(c)}")
    lam_price(c, 'средний', steps=False, verbose=True)
p0 = [K.pois_sf(K.threshold(c), 2 * c['u_wk']) for c in cards]
print('\nбез цены (как в книге): ложно оставленных %.2f, P(5 из 10) %.3f, «плохо с проверкой» %+.0f тыс.' % (sum(p0), pb_atleast(p0, 5), K.bad_month(20000) / 1e3))
for steps in (False, True):
    for sc in F.SCN:
        ps = [K.pois_sf(K.threshold(c), lam_price(c, sc, steps)) for c in cards]
        loss = 0
        for c, p in zip(cards, ps):
            _, _, sp, _ = K.main_effect(c, 20000, 'низкий'); n, _, sp2, _ = K.min_effect(c, 'низкий')
            w = sp + sp2; loss += w * 2 + p * w * (K.MO - 2)
        print('%s, эластичность %-8s: ложно оставленных %.2f, P(5 из 10 при нуле рекламы) %.3f, «плохо с проверкой» %+.0f тыс.' % (
            'цены к 14.10 + шаги 26' if steps else 'только цены к 14.10  ', sc, sum(ps), pb_atleast(ps, 5), -loss / 1e3))
        print('     ' + ', '.join('%s %.2f' % (c['main_art'][:10], p) for c, p in zip(cards, ps)))
od = C.defaultdict(C.Counter)
for o in F.L('orders_daily.ndjson'):
    if o['status'] != 'cancelled': od[o['sku']][o['d']] += o['units']
ps = []
for c in cards:
    ss = [s for s, _ in skus_of[c['card']]]
    post = sum(od[s][d] for s in ss for d in od[s] if '2026-10-08' <= d <= '2026-10-13') / 6 * 14
    ps.append(K.pois_sf(K.threshold(c), post))
print('\nесли темп 08-13.10 (6 дней) сохранится без эффекта новой рекламы: ложно оставленных %.2f, P(5 из 10) %.3f' % (sum(ps), pb_atleast(ps, 5)))
print('     ' + ', '.join('%s %.2f' % (c['main_art'][:10], p) for c, p in zip(cards, ps)))

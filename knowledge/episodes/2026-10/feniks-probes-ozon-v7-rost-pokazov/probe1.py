# ФЕНИКС, пробы по cards7 (только чтение данных, импорт модели автора без изменений)
import sys, json, collections as C, random, math
V7 = '/home/user/t1/knowledge/episodes/2026-10/ozon-testy-scripts/v7'
sys.path.insert(0, V7); sys.path.insert(0, V7 + '/../v5')
import cards7 as K, forecast as F
D = F.D
L = F.L
A, B = F.A, F.B

# P1. U0 = 286: заказы без отмен 14.09-11.10 в месяц
u = sum(o['units'] for o in L('orders_daily.ndjson') if A <= o['d'] <= B and o['status'] != 'cancelled')
print('P1 orders 14.09-11.10 no-cancel', u, '-> per month x4.33/4 =', round(u / 4 * 4.33, 1))
print('   last date in orders_daily', max(o['d'] for o in L('orders_daily.ndjson')))

# P2. SHOW_PER_RUB 1,63: показы/расход ads_daily за окно
ads = L('ads_daily.ndjson')
sp_all = sum(a['sp'] for a in ads if A <= a['d'] <= B); vw_all = sum(a.get('vw', 0) for a in ads if A <= a['d'] <= B)
sp_nc = sum(a['sp'] for a in ads if A <= a['d'] <= B and a['id'] != F.CPO_ID); vw_nc = sum(a.get('vw', 0) for a in ads if A <= a['d'] <= B and a['id'] != F.CPO_ID)
print('P2 shows per rub: all', round(vw_all / sp_all, 3), ' without CPO', round(vw_nc / sp_nc, 3), ' sp_nc', round(sp_nc), 'vw_nc', vw_nc)

# P3. разложение среднего сценария: главный клик против минимального
top = K.cards[:10]
for sc in F.SCN:
    mu = mp = ms = nu = npf = nsp = 0
    for c in top:
        sh, du, sp, pr = K.main_effect(c, 10000, sc); mu += du; mp += pr; ms += sp
        n, du2, sp2, pr2 = K.min_effect(c, sc); nu += du2; npf += pr2; nsp += sp2
    f = 4.33
    print(f'P3 {sc}: main units/mo {mu*f:.1f} prof {mp*f/1e3:.0f}K spend {ms*f/1e3:.0f}K | min units/mo {nu*f:.1f} prof {npf*f/1e3:.0f}K spend {nsp*f/1e3:.0f}K')

# P4. доля 10 карточек в заказах магазина (база окна)
store_wk = u / 4
top_wk = sum(c['u_wk'] for c in top)
print('P4 store/wk', round(store_wk, 2), 'top10/wk', round(top_wk, 2), 'share', round(top_wk / store_wk, 3), 'rest/wk', round(store_wk - top_wk, 2))

# P5. база «остальных» (60 дней) против теста 1
o60 = sum(o for c in top for (_, _, _, o) in c['others']); n = sum(len(c['others']) for c in top)
print('P5 others n', n, 'orders 60d', o60, 'per sku-week', round(o60 / n / 60 * 7, 3))
dist = C.Counter(o for c in top for (_, _, _, o) in c['others'])
print('   distribution of 60d orders among others', sorted(dist.items()))

# P6. якорь степенной формулы: показы на 10 000 при разном текущем
for cur in (0, 1, 100, 455, 1194, 2014, 4412, 9000):
    c = dict(main_sp_wk=cur, conv=0.0003, main='x')
    base = max(cur, 1.0)
    sh = K.SHOW_PER_RUB * (10000 ** F.E_SP - base ** F.E_SP) * (base ** (1 - F.E_SP))
    print(f'P6 cur {cur:6} -> extra shows/wk {sh:8.0f}  per extra rub {sh / max(10000 - cur, 1):.2f}')
# сколько главных в 35 карточках с текущим 0
z = [c for c in K.cards if c['main_sp_wk'] == 0]
print('   mains with cur=0 among all', len(K.cards), ':', len(z))

# P7. выбор главного: показы против заказов внутри карточки
vs = K.vs; o4 = K.o4
G = json.load(open(D + 'card_groups.json'))['groups']
g_by_main = {}
for g in G:
    for s in g['skus']:
        g_by_main.setdefault(g['main'], []).append(s)
ads_sku = C.Counter()
for a in L('ads_sku_daily.ndjson'):
    if a['cid'] != F.CPO_ID and A <= a['d'] <= B: ads_sku[a['sku']] += a['sp']
for c in top:
    skus = [s['sku'] for s in g_by_main[c['card']]]
    off = {s['sku']: s['offer'] for s in g_by_main[c['card']]}
    best_u = max(skus, key=lambda s: o4[s])
    print(f"P7 {c['main_art']:22} main vs={vs[c['main']]:7} o4={o4[c['main']]:3} sp4w={ads_sku[c['main']]:7.0f} | top-seller {off[best_u]:22} o4={o4[best_u]:3} vs={vs[best_u]:7} sp4w={ads_sku[best_u]:7.0f} | card o4={sum(o4[s] for s in skus)}")

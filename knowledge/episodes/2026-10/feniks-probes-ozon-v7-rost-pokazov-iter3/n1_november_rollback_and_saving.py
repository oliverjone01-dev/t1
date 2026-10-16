# ФЕНИКС iter3, проба N1: строка «Ноябрь средне с учётом откатов 29.10» (формула автора против взвешивания по карточкам),
# прибыль ноября с откатом (в книге её нет), и сколько денег главных товаров сидит в «экономии» уреза (cut_saving).
# Только агрегаты по 10 карточкам, без прибыли по артикулам. python3 -I -B n1_november_rollback_and_saving.py
import sys, io, contextlib, collections as C
V7 = '/home/user/t1/knowledge/episodes/2026-10/ozon-testy-scripts/v7'
sys.path.insert(0, V7); sys.path.insert(0, V7 + '/../v5')
with contextlib.redirect_stdout(io.StringIO()):
    import cards7 as K, forecast as F, plan7 as P
LV = 20000; DM = 30.3; top = K.cards[:10]; U0 = round(sum(F.U_all.values()) / F.WEEKS * 4.33); P0 = 8.0e6
t = {sc: K.total(LV, sc, 10) for sc in F.SCN}
# 1) формула автора (cards7_xlsx.py: keep_frac по заказам, применён и к заказам, и к К выплате)
eff = lambda c: K.main_effect(c, LV, 'средний')[1] + K.min_effect(c, 'средний')[1]
kf = sum(K.pass_prob(c, LV, 'средний') * eff(c) for c in top) / sum(eff(c) for c in top)
print(f'keep_frac автора {kf:.4f}; ноябрь: заказов {U0 * 30 / DM + t["средний"]["units"] * kf:.2f}, К выплате {(P0 * 30 / DM + t["средний"]["pay"] * kf) / 1e6:.3f} млн')
# 2) по карточкам (iter2 probe_iter2c.py), 30 дней
for sc in F.SCN:
    u = pay = prof = sp_all = 0
    for c in top:
        p = K.pass_prob(c, LV, sc); _, du, sp, pr = K.main_effect(c, LV, sc); n, du2, sp2, pr2 = K.min_effect(c, sc)
        u += p * (du + du2) * 30 / 7; prof += p * (pr + pr2) * 30 / 7
        pay += p * (du * K.price(c['main']) * K.keep(c['main']) + sum(K.UP_MIN[sc] * K.price(s) * K.keep(s) for s, *_ in c['others'])) * 30 / 7
    print(f'  по карточкам {sc:8}: заказов {U0 * 30 / DM + u:6.1f}, К выплате {(P0 * 30 / DM + pay) / 1e6:5.2f} млн, прибыль ноября с откатом {prof / 1e3:+5.0f} тыс. (в книге без отката {((t[sc]["prof"]) * 30 / DM) / 1e3:+5.0f})')
# 3) деньги главных товаров внутри кампаний «на минимум» (темп 08-11.10, ads_sku_daily), в месяц
mains = {c['main'] for c in top}
on_main = C.Counter()
for x in F.L('ads_sku_daily.ndjson'):
    if '2026-10-08' <= x['d'] <= F.B and x['sku'] in mains and x['cid'] != F.CPO_ID: on_main[x['cid']] += x['sp'] / 4 * 7
n, save = K.cut_saving(LV, 10)
mins = [c for c in P.ACTIVE if K.campaign_action(c, LV, 10)[0] == 'min']
dbl = sum(min(on_main[c], P.tempo(c) - F.MIN_WK) for c in mins) * K.MO
print(f'урез: {n} кампаний, экономия в книге {save / 1e6:.3f} млн/мес; из неё клик главных товаров (уже вычтен как «клик главного сейчас») {dbl / 1e3:.0f} тыс./мес')
for c in mins:
    if on_main[c]: print(f'   кампания {c}: на главный {on_main[c]:,.0f} ₽/нед из темпа {P.tempo(c):,.0f}'.replace(',', ' '))
keepers = [c for c in P.ACTIVE if K.campaign_action(c, LV, 10)[0] == 'keep' and on_main[c]]
print('кампании «оставляем», которые тоже крутят главный товар (₽/нед):', {c: round(on_main[c]) for c in keepers})

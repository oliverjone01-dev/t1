import sys, json
V7 = '/home/user/t1/knowledge/episodes/2026-10/ozon-testy-scripts/v7'
sys.path.insert(0, V7); sys.path.insert(0, V7 + '/../v5')
import cards7 as K, forecast as F
P = K.P
store_vs = sum(K.vs.values()) / F.WEEKS
# показы поиска магазина за последнюю неделю окна (05-11.10) - ближе к базе 15.10
last = 0
for l in open(F.D + 'sku_views.ndjson'):
    x = json.loads(l)
    if '2026-10-05' <= x['date'] <= '2026-10-11': last += x['vsearch']
add_main = sum(K.main_effect(c, 20000, 'средний')[0] for c in K.cards[:10])
n_min = sum(len(c['others']) for c in K.cards[:10])
add_min = n_min * K.MIN_WK_SKU * K.SHOW_PER_RUB
cut = P.EXP - P.LAD_IDS
cut_sh = sum(P.tempo(k) for k in cut) * K.SHOW_PER_RUB
print(f'S store vsearch/wk avg 14.09-11.10 {store_vs:,.0f}; last week 05-11.10 {last:,.0f}')
print(f'S added shows/wk: mains@20K {add_main:,.0f}; min-click {add_min:,.0f}; cut 7 campaigns -{cut_sh:,.0f} (tempo 08-11.10 x1.63)')
net = add_main + add_min - cut_sh
print(f'S net change {net:+,.0f}/wk = {net/last:+.1%} of last-week store shows; without the cut {(add_main+add_min)/last:+.1%}')

# ФЕНИКС проба P11: зависит ли комиссия и доля покупателя от участия в акциях (сценарий «без акций»)
import json, collections as C, statistics as S
D = '/home/user/t1/analytics-mvp/data/'
L = lambda f: [json.loads(l) for l in open(D + f)]
O = L('orders_daily.ndjson'); A = L('acts_daily.ndjson'); G = L('gap_daily.ndjson'); P = L('prices_daily.ndjson')
acts = C.defaultdict(set)
for a in A: acts[(a['date'], a['art'])].add(a['title'])
def kind(ts):
    if not ts: return 'нет записей'
    if any('Эластичн' in x for x in ts): return 'Эластичный'
    if any('бустинг' in x.lower() for x in ts): return 'Максимальный бустинг'
    if all(x.startswith('Автоакция') or 'Рассрочка' in x or 'кредит' in x for x in ts): return 'только рассрочка/автоакции'
    return 'другие'
R = C.defaultdict(lambda: [0, 0, 0, 0])
for o in O:
    if o['d'] < '2026-09-23' or o['status'] != 'delivered' or o['revenue'] <= 0: continue
    k = kind(acts.get((o['d'], o['offer']), set()))
    r = R[k]; r[0] += -o['commission']; r[1] += o['revenue']; r[2] += 1; r[3] += o['payout']
print('[P11a] доставленные заказы с 23.09 по участию в акции в день заказа: комиссия/цена, К выплате/цена, n')
for k, r in R.items(): print('   %-28s ком %.3f keep %.3f n %d' % (k, r[0] / r[1], r[3] / r[1], r[2]))
# s по видам участия: число разных товаров и наблюдений
gs = C.defaultdict(list); arts = C.defaultdict(set)
days = set(a['date'] for a in A)
for g in G:
    if g['date'] not in days: continue
    k = kind(acts.get((g['date'], g['art']), set()))
    gs[k].append(g['site_to_seller']); arts[k].add(g['art'])
for k, v in gs.items():
    print('[P11b] %-28s s медиана %.3f, наблюдений %d, товаров %d' % (k, S.median(v), len(v), len(arts[k])))
# 6 из 171 без акции продавца (price == before): какая у них доля s
rows = json.load(open('/home/user/t1/knowledge/episodes/2026-10/ozon-price-floor/floor_rows.json'))
last = {}
for p in P: last[p['offer']] = p
np_ = [(r['art'], round(r['s'], 3), sorted(acts.get(('2026-10-11', r['art']), set()))) for r in rows if last[r['art']]['price'] >= last[r['art']]['before']]
print('[P11c] из 171 без скидки продавца (price>=before):', len(np_))
for x in np_: print('    ', x[0], 's', x[1], [t[:28] for t in x[2]])

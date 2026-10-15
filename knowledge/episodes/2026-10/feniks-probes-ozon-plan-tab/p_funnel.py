# Проба воронки: пересчёт базы по sku_views своим кодом, «Заказы» воронки против заказов таблицы 1, доли >100%,
# daily_totals 14.09, позиция у трёх карточек, store CPC (sp из ads_sku_daily, клики из ads_daily).
import json, collections, re
SP = '/tmp/claude-0/-home-user-t1/39ce78b8-29b6-551f-9a34-e54649462146/scratchpad/'
DD = '/home/user/t1/analytics-mvp/data/'
PD = json.load(open(SP + 'pd.json'))
P = json.load(open(DD + 'plan_2026-10-15.json'))
G = json.load(open(DD + 'card_groups.json'))['groups']
off2sku = {s['offer']: str(s['sku']) for g in G for s in g['skus']}
cs = []
for c in P['cards']:
    ms = off2sku[c['main_art']]; g = [g for g in G if any(str(s['sku']) == ms for s in g['skus'])][0]
    cs.append(set(str(s['sku']) for s in g['skus']))
sku2c = {s: i for i, S in enumerate(cs) for s in S}
agg = collections.defaultdict(lambda: collections.defaultdict(float)); days = set(); dt14 = collections.defaultdict(float)
for l in open(DD + 'sku_views.ndjson', encoding='utf-8'):
    if '"2026-09-1' not in l and '"2026-09-2' not in l and '"2026-09-3' not in l and '"2026-10-' not in l: continue
    r = json.loads(l)
    if not ('2026-09-14' <= r['date'] <= '2026-10-11'): continue
    days.add(r['date']); i = sku2c.get(str(r['sku']))
    for k in ('views', 'vsearch', 'pdp', 'cart', 'units'):
        v = float(r.get(k) or 0); agg['store'][k] += v
        if i is not None: agg[i][k] += v
    if r['date'] == '2026-09-14': dt14['pdp'] += float(r.get('pdp') or 0)
n = len(days); print('дней базы в sku_views', n)
h = open(SP + 'out/katya-tests.html', encoding='utf-8').read()
a = h.index('id="pt-plan"'); tb = h[a:]
t3 = tb[tb.index('Показы в поиске'):]; t3 = t3[:t3.index('</table>')]
rows = re.findall(r'<tr><td>(.*?)</tr>', t3)
def cells(r): return [re.sub('<[^>]+>', '', c) for c in re.findall(r'<td[^>]*>(.*?)</td>', '<td>' + r)]
for i, c in enumerate(P['cards'][:3]):
    A = agg[i]; mine = [A[k] / n * 7 for k in ('vsearch', 'pdp', 'cart', 'units')]
    print(c['short'], 'мой пересчёт в неделю: показы', round(mine[0]), 'карточка', round(mine[1]), 'корзина', round(mine[2]), 'заказы(sv)', round(mine[3], 1), '| u_wk_base (orders_daily)', c['u_wk_base'])
    print('   страница:', cells(rows[i])[:13])
A = agg['store']; print('магазин мой: показы', round(A['vsearch'] / n * 7), 'заказы(sv)/нед', round(A['units'] / n * 7, 1), '| страница:', cells(rows[-1])[:13])
# доли > 100%: корзина / карточка, заказы / корзина по дням и карточкам
over = collections.Counter()
for j, d in enumerate(PD['days']):
    for i, s in enumerate(PD['ser']):
        p, c, u = s['pdp'][j], s['cart'][j], s['units'][j]
        if p and c is not None and c > p: over['cart>pdp'] += 1
        if c and u is not None and u > c: over['units>cart'] += 1
print('дней-карточек с долей >100%:', dict(over))
# daily_totals 14.09
for l in open(DD + 'daily_totals.ndjson', encoding='utf-8'):
    r = json.loads(l)
    if r['date'] == '2026-09-14': print('daily_totals 14.09 pdp_views', r['pdp_views'], '| сумма sku_views pdp', dt14['pdp'])
# позиция
for i, c in enumerate(P['cards']):
    nn = sum(1 for x in PD['ser'][i]['pos'] if x is not None)
    if nn == 0: print('позиции нет:', c['short'])
# CPC магазина 13.10 против 10.10
j13, j10 = PD['days'].index('2026-10-13'), PD['days'].index('2026-10-10')
for j in (j10, j13):
    sp, cl = PD['store']['sp'][j], PD['store']['clk'][j]
    print(PD['days'][j], 'магазин расход', sp, 'клики', cl, 'CPC', round(sp / cl, 1) if cl else None)

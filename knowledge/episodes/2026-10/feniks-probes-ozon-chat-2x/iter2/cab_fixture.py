# ФЕНИКС iter2, PR #477 @ 3121423. Фикстуры сверки с кабинетом с ПОЛНЫМ охватом (все товары 10 карточек x дни, нули тоже).
#   cab2ok   - кабинет = отправления по каждой паре
#   cab2off  - TRUBIS 160 +3 шт (15.10), KONUX -3 шт (16.10): каждая карточка мимо, сумма та же
#   cab2cov  - как ok, но без строк второго товара TRUBIS 160 (6 пар)
#   cab2edge1/cab2edge2 - заказы БЕЗ поля t (как живой orders_daily сейчас): 1 или 2 заказа TRUBIS 160 сделаны
#             в 01:30 МСК 15.10 = 22:30 UTC 14.10 (d=14.10, вне окна), кабинет честно пишет их в 15.10 по Москве
# Заказы: 14-20.10, TRUBIS главный 2/день, второй 1/день, KONUX главный 2/день, sku-заглушка 12/день.
# python3 -I cab_fixture.py <cab2ok|cab2off|cab2cov|cab2edge1|cab2edge2>
import json, os, sys, shutil, datetime as dt

SP = '/tmp/claude-0/-home-user-t1/f57f6776-149c-58f9-8707-d73e74e89ad9/scratchpad/'
DD = '/home/user/t1/analytics-mvp/data/'
sc = sys.argv[1]
OUT = SP + 'fxc_' + sc + '/'
if os.path.isdir(OUT):
    shutil.rmtree(OUT)
os.makedirs(OUT)
OVR = ('orders_daily.ndjson', 'sku_views.ndjson', 'cabinet_orders_check.ndjson')
for f in os.listdir(DD):
    if os.path.isfile(DD + f) and f not in OVR:
        os.symlink(DD + f, OUT + f)
days = lambda a, b: [(dt.date.fromisoformat(a) + dt.timedelta(days=i)).isoformat() for i in range((dt.date.fromisoformat(b) - dt.date.fromisoformat(a)).days + 1)]
groups = json.load(open(DD + 'card_groups.json', encoding='utf-8'))['groups']
plan = json.load(open(DD + 'plan_2026-10-15.json', encoding='utf-8'))
off2sku = {s['offer']: str(s['sku']) for g in groups for s in g['skus']}
card_skus = []
for c in plan['cards']:
    ms = off2sku.get(c['main_art'])
    g = next((g for g in groups if any(str(s['sku']) == ms for s in g['skus'])), None)
    card_skus.append([str(s['sku']) for s in g['skus']] if g else [])
TR_MAIN = off2sku['GGT-03-3-3-E-16080']
TRI = next(i for i, s in enumerate(card_skus) if TR_MAIN in s)
TR_SECOND = next(s for s in card_skus[TRI] if s != TR_MAIN)
KI = next(i for i, c in enumerate(plan['cards']) if c['short'] == 'KONUX')
K_MAIN = off2sku[plan['cards'][KI]['main_art']]
edge = {'cab2edge1': 1, 'cab2edge2': 2}.get(sc, 0)
real = [json.loads(l) for l in open(DD + 'orders_daily.ndjson', encoding='utf-8') if l.strip()]
if not edge:
    for r in real:
        r['t'] = r['d'] + 'T12:00:00.000Z'
rows, n = [], 0
ours = {}


def order(d, sku, k=1, t=True, cab_day=None):
    global n
    for _ in range(k):
        n += 1
        o = dict(order=f'FX-{n}', d=d, status='delivered', scheme='FBO', sku=sku, offer='FX', units=1, revenue=70000)
        if t:
            o['t'] = f'{d}T12:00:00.000Z'
        rows.append(o)
        cd = cab_day or d
        ours[(sku, cd)] = ours.get((sku, cd), 0) + 1


for d in days('2026-10-14', '2026-10-20'):
    order(d, '9999999999', 12, t=not edge)
    if d >= '2026-10-15':
        order(d, TR_MAIN, 2, t=not edge); order(d, TR_SECOND, 1, t=not edge); order(d, K_MAIN, 2, t=not edge)
for _ in range(edge):   # 22:30 UTC 14.10 = 01:30 МСК 15.10: отправления кладут в 14.10 (нет t), кабинет - в 15.10
    order('2026-10-14', TR_MAIN, 1, t=False, cab_day='2026-10-15')
cab = []
for d in days('2026-10-15', '2026-10-20'):
    for i, skus in enumerate(card_skus):
        for s in skus:
            if sc == 'cab2cov' and s == TR_SECOND:
                continue
            u = ours.get((s, d), 0)
            if sc == 'cab2off' and s == TR_MAIN and d == '2026-10-15':
                u += 3
            if sc == 'cab2off' and s == K_MAIN and d == '2026-10-16':
                u -= 3
            cab.append(dict(date=d, sku=s, art='FX', ordered_units=u, source='cabinet', ts=f'{d}T08:00:00+03:00'))
with open(OUT + 'orders_daily.ndjson', 'w', encoding='utf-8') as w:
    for r in real + rows:
        w.write(json.dumps(r, ensure_ascii=False) + '\n')
with open(OUT + 'sku_views.ndjson', 'w', encoding='utf-8') as w:
    for l in open(DD + 'sku_views.ndjson', encoding='utf-8'):
        w.write(l if l.endswith('\n') else l + '\n')
with open(OUT + 'cabinet_orders_check.ndjson', 'w', encoding='utf-8') as w:
    for r in cab:
        w.write(json.dumps(r, ensure_ascii=False) + '\n')
print(sc, '| карточек', len(card_skus), 'товаров', sum(map(len, card_skus)), '| строк кабинета', len(cab), '| TRUBIS', TRI, len(card_skus[TRI]), '| KONUX', KI, len(card_skus[KI]))

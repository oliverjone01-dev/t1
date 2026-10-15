# ФЕНИКС iter4 @ da0a36b. Проба B1c (закрытие) и соседние случаи: фикстуры сверки с кабинетом с РЕАЛЬНЫМ ts съёма
# (инструкция чату :43 и :58: ts - время съёма по Москве, «дни с 15.10 по вчера», строка на каждый товар 10 карточек, нули тоже).
# В iter3 ts стоял на дату строки (cab3_fixture.py) - для правила «конец = вчера от ts» это нереалистично, поэтому новые фикстуры.
# Заказы: живые (копия коммита) + синтетика 15.10..OD с t в 12:00 МСК: главный 2/день, второй товар карточки 1/день.
# Выгрузка кабинета = наши отправления с отменами по паре «товар + день МСК» (идеальный кабинет), все товары card_groups карточки.
#   cab4ok        - съём 22.10 07:40 МСК, дни 15-21, заказы по 21.10; ожидаю «в допуске», 15.10-21.10
#   cab4hole      - то же без всех строк за 17.10; ожидаю «неполная»
#   cab4short     - строки только 15-18.10, ts 22.10; ожидаю «неполная» (случай iter3 cab3short)
#   cab4shortnots - строки 15-18.10 без ts; по правилу «без ts - последний день строк» пройдёт: остаток by design
#   cab4tsru      - строки 15-18.10, ts «22.10.2026 07:40» (не ISO): Date.parse -> NaN -> как без ts
#   cab4stale     - день решения: сегодня 29.10, заказы по 28.10, съёма 29.10 нет, только съём 22.10 (15-21)
#   cab4wd        - как ok, но без строк выводимых товаров (их нет в карточках v3); ожидаю «в допуске»
#   cab4today     - как ok, плюс строки за 22.10 (незакрытый день) с тем же ts; ожидаю, что 22.10 не сверяется
# python3 -I cab4_fixture.py <сценарий>   ->  scratch/c4/fx_<сценарий>/ (data/ для render4.mts)
import json, os, sys, shutil, datetime as dt

SP = '/tmp/claude-0/-home-user-t1/67620a7f-7583-5c98-9212-3a5e79611236/scratchpad/c4/'
DD = '/tmp/claude-0/-home-user-t1/67620a7f-7583-5c98-9212-3a5e79611236/scratchpad/data_753bf11/analytics-mvp/data/'
sc = sys.argv[1]
OUT = SP + 'fx_' + sc + '/'
if os.path.isdir(OUT):
    shutil.rmtree(OUT)
os.makedirs(OUT)
for f in os.listdir(DD):
    if os.path.isfile(DD + f) and f not in ('orders_daily.ndjson', 'cabinet_orders_check.ndjson'):
        os.symlink(DD + f, OUT + f)
days = lambda a, b: [(dt.date.fromisoformat(a) + dt.timedelta(days=i)).isoformat() for i in range((dt.date.fromisoformat(b) - dt.date.fromisoformat(a)).days + 1)]
G = json.load(open(DD + 'card_groups.json', encoding='utf-8'))['groups']
P = json.load(open(DD + 'plan_2026-10-15_v3.json', encoding='utf-8'))
off2sku = {s['offer']: str(s['sku']) for g in G for s in g['skus']}
W = {off2sku[a] for a in P['withdrawn']}
card_skus = []
for c in P['cards']:
    ms = off2sku[c['main_art']]
    g = next(g for g in G if any(str(s['sku']) == ms for s in g['skus']))
    card_skus.append((ms, [str(s['sku']) for s in g['skus']]))
od_last = '2026-10-28' if sc == 'cab4stale' else '2026-10-21'
real = [json.loads(l) for l in open(DD + 'orders_daily.ndjson', encoding='utf-8') if l.strip()]
rows, ours, n = [], {}, 0
for d in days('2026-10-15', od_last):
    for ms, skus in card_skus:
        second = next(s for s in skus if s != ms)
        for sku, k in ((ms, 2), (second, 1)):
            for _ in range(k):
                n += 1
                rows.append(dict(order=f'FX4-{n}', d=d, t=f'{d}T09:00:00.000Z', status='delivered', scheme='FBO', sku=sku, offer='FX', units=1, revenue=50000))
                ours[(sku, d)] = ours.get((sku, d), 0) + 1
TS = '2026-10-22T07:40:00+03:00'
spec = {'cab4ok': ('2026-10-21', TS), 'cab4hole': ('2026-10-21', TS), 'cab4short': ('2026-10-18', TS), 'cab4shortnots': ('2026-10-18', None),
        'cab4tsru': ('2026-10-18', '22.10.2026 07:40'), 'cab4stale': ('2026-10-21', TS), 'cab4wd': ('2026-10-21', TS), 'cab4today': ('2026-10-22', TS)}[sc]
cab = []
for d in days('2026-10-15', spec[0]):
    if sc == 'cab4hole' and d == '2026-10-17':
        continue
    for ms, skus in card_skus:
        for s in skus:
            if sc == 'cab4wd' and s in W:
                continue
            r = dict(date=d, sku=s, art='FX', ordered_units=ours.get((s, d), 0), source='cabinet')
            if spec[1]:
                r['ts'] = spec[1]
            cab.append(r)
with open(OUT + 'orders_daily.ndjson', 'w', encoding='utf-8') as w:
    for r in real + rows:
        w.write(json.dumps(r, ensure_ascii=False) + '\n')
with open(OUT + 'cabinet_orders_check.ndjson', 'w', encoding='utf-8') as w:
    for r in cab:
        w.write(json.dumps(r, ensure_ascii=False) + '\n')
print(sc, '| товаров в карточках', sum(len(s) for _, s in card_skus), '(выводимых', len(W), ') | строк кабинета', len(cab), '| дней', len({r['date'] for r in cab}), '| заказов-фикстур', len(rows), '| заказы по', od_last)

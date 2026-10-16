# ФЕНИКС iter3, ветка claude/amazing-hawking-0trncq @ 754cf5c. Фикстуры сверки с кабинетом на ЖИВОМ orders_daily
# с полем t (3794 из 3794 с a02b59d). Полный охват: все товары 10 карточек x дни 15-20.10, нули тоже.
#   cab3ok        - кабинет = отправления по каждой паре (контроль)
#   cab3edge2     - S3 повтор: 2 заказа TRUBIS 160 в 01:30 МСК 15.10 = 22:30 UTC 14.10, t ЕСТЬ (d=14.10 по UTC);
#                   кабинет честно пишет их в 15.10 по Москве. Ожидаю «в допуске»
#   cab3edge2not  - то же, но у этих 2 заказов t НЕТ (сбор без t): зависимость допуска 1 шт от поля t
#   cab3tail      - 2 заказа TRUBIS в 01:30 МСК 21.10 = 22:30 UTC 20.10 (последний d); выгрузка кабинета по 21.10
#                   включительно (чат снял и сегодняшний обрывок). Ожидаю: 21.10 не сверяется, «в допуске»
#   cab3cov       - как ok, без строк второго товара TRUBIS 160 (6 пар): случай iter2, ожидаю «неполная - не пройдена»
#   cab3hole      - как ok, но в выгрузке нет ВСЕХ строк за 17.10 (день пропущен целиком). Спека v3 :43:
#                   «охват - все пары товар + день, неполная выгрузка = сверка не пройдена». Ожидаю «неполная»
#   cab3short     - выгрузка только по 18.10, заказы по 20.10: последние 2 дня окна не сверены
# Заказы-фикстуры 14-20.10: TRUBIS главный 2/день, второй 1/день, KONUX главный 2/день, sku-заглушка 12/день.
# python3 -I cab3_fixture.py <сценарий>
import json, os, sys, shutil, datetime as dt

SP = '/tmp/claude-0/-home-user-t1/f57f6776-149c-58f9-8707-d73e74e89ad9/scratchpad/c3/'
DD = '/home/user/t1/analytics-mvp/data/'
sc = sys.argv[1]
OUT = SP + 'fx_' + sc + '/'
if os.path.isdir(OUT):
    shutil.rmtree(OUT)
os.makedirs(OUT)
OVR = ('orders_daily.ndjson', 'cabinet_orders_check.ndjson')
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
real = [json.loads(l) for l in open(DD + 'orders_daily.ndjson', encoding='utf-8') if l.strip()]
assert all(r.get('t') for r in real), 'в живом orders_daily есть строки без t'
rows, n = [], 0
ours = {}


def order(d, sku, k=1, t=None, cab_day=None):
    global n
    for _ in range(k):
        n += 1
        o = dict(order=f'FX-{n}', d=d, status='delivered', scheme='FBO', sku=sku, offer='FX', units=1, revenue=70000)
        if t is not False:
            o['t'] = t or f'{d}T12:00:00.000Z'
        rows.append(o)
        cd = cab_day or d
        ours[(sku, cd)] = ours.get((sku, cd), 0) + 1


for d in days('2026-10-14', '2026-10-20'):
    order(d, '9999999999', 12)
    if d >= '2026-10-15':
        order(d, TR_MAIN, 2); order(d, TR_SECOND, 1); order(d, K_MAIN, 2)
if sc in ('cab3edge2', 'cab3edge2not'):
    order('2026-10-14', TR_MAIN, 2, t='2026-10-14T22:30:00.000Z' if sc == 'cab3edge2' else False, cab_day='2026-10-15')
if sc == 'cab3tail':
    order('2026-10-20', TR_MAIN, 2, t='2026-10-20T22:30:00.000Z', cab_day='2026-10-21')
last = {'cab3tail': '2026-10-21', 'cab3short': '2026-10-18'}.get(sc, '2026-10-20')
cab = []
for d in days('2026-10-15', last):
    if sc == 'cab3hole' and d == '2026-10-17':
        continue
    for skus in card_skus:
        for s in skus:
            if sc == 'cab3cov' and s == TR_SECOND:
                continue
            cab.append(dict(date=d, sku=s, art='FX', ordered_units=ours.get((s, d), 0), source='cabinet', ts=f'{d}T08:00:00+03:00'))
# cab3dup / cab3dupr - выгрузка 22.10 (15-17.10) и повтор 29.10 тех же дней: последняя строка «дата + товар» заменяет прежнюю.
#   dup: первая копия с ошибкой +3 у TRUBIS 15.10, последняя верная -> ожидаю «в допуске»; dupr: наоборот -> ожидаю «не в допуске»
if sc in ('cab3dup', 'cab3dupr'):
    wrong = [dict(r, ordered_units=r['ordered_units'] + (3 if r['sku'] == TR_MAIN and r['date'] == '2026-10-15' else 0))
             for r in cab if r['date'] <= '2026-10-17']
    cab = wrong + cab if sc == 'cab3dup' else cab + wrong
with open(OUT + 'orders_daily.ndjson', 'w', encoding='utf-8') as w:
    for r in real + rows:
        w.write(json.dumps(r, ensure_ascii=False) + '\n')
with open(OUT + 'cabinet_orders_check.ndjson', 'w', encoding='utf-8') as w:
    for r in cab:
        w.write(json.dumps(r, ensure_ascii=False) + '\n')
print(sc, '| товаров', sum(map(len, card_skus)), '| строк кабинета', len(cab), '| дней', len({r['date'] for r in cab}), '| заказов-фикстур', len(rows))

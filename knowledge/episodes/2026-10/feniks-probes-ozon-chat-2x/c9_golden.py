# ФЕНИКС, PR #477 @ 889c35b. Проба G1: эталоны спеки 137 (магазин 01-13.10 без отмен, день UTC) и 49
# (TRUBIS 160, вся объединённая карточка, 14.09-11.10 без отмен) на каждой версии orders_daily из git.
# Тест plan-tab.test.ts допускает 134..137 и 48..49 (вниз 2%, «отмены только уменьшают»). Смотрим дрейф.
# python3 -I c9_golden.py
import json, subprocess

R = '/home/user/t1'
F = 'analytics-mvp/data/orders_daily.ndjson'
groups = json.load(open(R + '/analytics-mvp/data/card_groups.json', encoding='utf-8'))['groups']
g = next(x for x in groups if any(s['offer'] == 'GGT-03-3-3-E-16080' for s in x['skus']))
TR = {str(s['sku']) for s in g['skus']}
print('TRUBIS 160 товаров в карточке', len(TR))


def calc(txt):
    rows = [json.loads(l) for l in txt.splitlines() if l.strip()]
    net = lambda a, b, sk=None: sum(int(r.get('units') or 0) for r in rows if a <= r['d'] <= b and r.get('status') != 'cancelled' and (sk is None or str(r['sku']) in sk))
    allu = lambda a, b: sum(int(r.get('units') or 0) for r in rows if a <= r['d'] <= b)
    return net('2026-10-01', '2026-10-13'), allu('2026-10-01', '2026-10-13'), net('2026-09-14', '2026-10-11', TR), max(r['d'] for r in rows)


log = subprocess.run(['git', '-C', R, 'log', '--format=%h %cI', '--since=2026-10-13', '--', F], capture_output=True, text=True).stdout.split('\n')
print('коммит      время (UTC+?)               магазин 01-13.10 без отмен / с отменами | TRUBIS 160 14.09-11.10 | max d')
for line in [x for x in log if x][::-1]:
    h, ts = line.split()
    txt = subprocess.run(['git', '-C', R, 'show', f'{h}:{F}'], capture_output=True, text=True).stdout
    a, b, c, m = calc(txt)
    print(f'{h} {ts}  {a} / {b} | {c} | {m}')
a, b, c, m = calc(open(R + '/' + F, encoding='utf-8').read())
print(f'рабочее дерево: {a} / {b} | {c} | {m}  (допуск теста: 134..137 и 48..49)')

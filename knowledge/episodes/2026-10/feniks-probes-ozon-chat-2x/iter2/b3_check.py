# ФЕНИКС iter2, PR #477 @ 3121423. Проба B3b: независимый пересчёт строки «день не закрыт» за 15.10
# (уникальные товары с ролью test_ad / test_sibling, последняя строка товара) против страницы fx_eve.
# Плюс проверка ключей инструкции v4 на живых файлах (I1b): товар funnel дата+role+art (одинаковы ли значения),
# агрегат дата+role+test_id+group, acts полный ключ (по всему файлу и за 14-15.10), gap/boost дата+art, store_moves дата.
# python3 -I b3_check.py
import json, collections

DD = '/home/user/t1/analytics-mvp/data/'
ft = [json.loads(l) for l in open(DD + 'funnel_tests.ndjson', encoding='utf-8') if l.strip()]
one = {}
for r in ft:
    if r['date'] == '2026-10-15' and r.get('role') in ('test_ad', 'test_sibling'):
        one[r['art'].strip()] = r
s = lambda k: int(sum(float(r.get(k) or 0) for r in one.values()))
print('B3b 15.10: тестовых товаров', len(one), '| показы', s('search_views'), '| карточка', s('pdp_views'), '| корзина', s('hits_to_cart'), '| заказано', s('ordered_units'))

M = ('search_views', 'pdp_views', 'hits_to_cart', 'ordered_units', 'search_position')
prod = collections.defaultdict(list)
aggk = collections.Counter()
for r in ft:
    if r.get('role') in ('agg_median', 'agg_sum'):
        aggk[(r['date'], r['role'], str(r.get('test_id') or ''), str(r.get('group') or ''))] += 1
    else:
        prod[(r['date'], r['role'], r['art'].strip())].append(r)
pm = {k: v for k, v in prod.items() if len(v) - 1}
same = sum(1 for v in pm.values() if len({tuple(x.get(m) for m in M) for x in v}) == 1)
print('I1b funnel товар дата+role+art: ключей с 2+ строками', len(pm), '| значения одинаковые у', same, '| за 15.10:', sum(1 for k in pm if k[0] == '2026-10-15'))
print('I1b funnel агрегат дата+role+test_id+group: повторов', sum(v - 1 for v in aggk.values() if v - 1))
ad = [json.loads(l) for l in open(DD + 'acts_daily.ndjson', encoding='utf-8') if l.strip()]
ak = collections.Counter((r['date'], r['art'].strip(), r['title'].strip(), r.get('date_from'), r.get('date_to')) for r in ad)
dup = {k: v for k, v in ak.items() if v - 1}
print('I1b acts полный ключ: повторов по всему файлу', sum(v - 1 for v in dup.values()), 'в', len(dup), 'ключах; за 14-15.10:', sum(v - 1 for k, v in dup.items() if k[0] >= '2026-10-14'),
      '| даты повторов:', min((k[0] for k in dup), default='-'), '..', max((k[0] for k in dup), default='-'))
vals = collections.defaultdict(set)
for r in ad:
    vals[(r['date'], r['art'].strip(), r['title'].strip(), r.get('date_from'), r.get('date_to'))].add(str(r.get('value')))
print('I1b acts: ключей с разным value при одном полном ключе', sum(1 for v in vals.values() if len(v) - 1))
for f, kf in (('gap_daily.ndjson', lambda r: (r['date'], r['art'].strip())), ('boost_daily.ndjson', lambda r: (r['date'], r['art'].strip())), ('store_moves.ndjson', lambda r: (r['date'],))):
    c = collections.Counter(kf(json.loads(l)) for l in open(DD + f, encoding='utf-8') if l.strip())
    print(f'I1b {f}: повторов по ключу', sum(v - 1 for v in c.values() if v - 1))

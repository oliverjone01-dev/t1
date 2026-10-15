# ФЕНИКС iter3, @ 754cf5c. P1 на живых данных: строки funnel_tests за 15.10 (сегодня) без full и ts.
# Сравниваю суммы тестовых товаров (уникальный товар, как в partialLine) за 12-15.10 и смотрю, что видит сборщик:
# незакрытый день (partialDay) или закрытый. python3 -I p1_live.py
import json, collections, subprocess

DD = '/home/user/t1/analytics-mvp/data/'
ft = [json.loads(l) for l in open(DD + 'funnel_tests.ndjson', encoding='utf-8') if l.strip()]
roles = collections.Counter(r.get('role') for r in ft)
print('роли:', dict(roles))
for d in ('2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15'):
    one = {}
    for r in ft:
        if str(r.get('date'))[:10] == d and str(r.get('role', '')).startswith('test'):
            one[r.get('art')] = r
    s = lambda k: sum(float(x.get(k) or 0) for x in one.values())
    print(d, 'тестовых товаров', len(one), '| показы в поиске', s('search_views'), '| карточка', s('pdp_views'), '| корзина', s('hits_to_cart'), '| заказано', s('ordered_units'),
          '| snap', dict(collections.Counter(str(x.get('snap')) for x in one.values())))

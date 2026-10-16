# ФЕНИКС, PR #477 @ 889c35b. Проба K-post: проверка после пуша из инструкции чату
# («нет двух строк с одной датой и товаром», ozon-testy-dannye-dlya-chata.md:63) против живых файлов за 15.10.
# python3 -I c12_postcheck.py
import json, collections

DD = '/home/user/t1/analytics-mvp/data/'
DAY = '2026-10-15'
for f in ('funnel_tests.ndjson', 'acts_daily.ndjson', 'gap_daily.ndjson', 'boost_daily.ndjson'):
    c = collections.Counter()
    for l in open(DD + f, encoding='utf-8'):
        if not l.strip():
            continue
        r = json.loads(l)
        if str(r.get('date', ''))[:10] != DAY:
            continue
        c[str(r.get('art', '')).strip()] += 1
    bad = {a: n for a, n in c.items() if n - 1}
    print(f'{f}: товаров за {DAY} {len(c)}, нарушают «одна строка на дату и товар» {len(bad)}, лишних строк {sum(n - 1 for n in bad.values())}')

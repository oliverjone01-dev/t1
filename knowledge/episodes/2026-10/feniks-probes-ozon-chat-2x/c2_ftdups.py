# ФЕНИКС, PR #477 @ 889c35b. Проба B3-ft: дубли funnel_tests по ключу кода и товары под двумя ключами.
# (а) где 146 дублей ключа role|art|test_id|date и различаются ли значения;
# (б) за 13-15.10: товар в двух строках (разные роль / test_id) - сумма строки «день не закрыт»
#     в build-tests.ts:3408-3414 идёт по строкам, а не по товарам.
# python3 -I c2_ftdups.py
import json, collections

DD = '/home/user/t1/analytics-mvp/data/'
AGG = {'agg_median', 'agg_sum'}
M = ('search_views', 'pdp_views', 'hits_to_cart', 'ordered_units')
ft = []
for i, l in enumerate(open(DD + 'funnel_tests.ndjson', encoding='utf-8')):
    if l.strip():
        r = json.loads(l); r['_line'] = i + 1; ft.append(r)


def key(r):
    role = r.get('role', '')
    art = '' if role in AGG else str(r.get('art', '')).strip()
    tid = str(r.get('test_id') or '').strip()
    if role in AGG and not tid and str(r.get('art', '')).startswith('AGG:'):
        tid = str(r['art']).split(':')[1]
    return f"{role}|{art}|{tid}|{str(r.get('date', ''))[:10]}"


g = collections.defaultdict(list)
for r in ft:
    g[key(r)].append(r)
dup = {k: v for k, v in g.items() if len(v) > 1}
byd = collections.Counter(k.split('|')[3] for k in dup)
print('ключей с дублями', len(dup), 'по датам:', sorted(byd.items()))
same = sum(1 for v in dup.values() if len({tuple(x.get(m) for m in M) + (x.get('search_position'),) for x in v}) == 1)
print('  из них значения одинаковые', same, ', разные', len(dup) - same)
for k, v in list(dup.items())[:3]:
    print('  пример', k, [(x['_line'], [x.get(m) for m in M], x.get('search_position')) for x in v])
# первая против последней в файле: сколько показов «потеряет/добавит» правило «побеждает последняя»
d_first = sum(float(v[0].get('search_views') or 0) for v in dup.values())
d_last = sum(float(v[-1].get('search_views') or 0) for v in dup.values())
print('  показы: сумма первых', int(d_first), 'последних', int(d_last))

print('--- (б) товар под двумя ключами за 13-15.10')
for d in ('2026-10-13', '2026-10-14', '2026-10-15'):
    rows = [r for r in ft if str(r.get('date', ''))[:10] == d and r.get('role') not in AGG]
    by_art = collections.defaultdict(list)
    for r in rows:
        by_art[str(r.get('art', '')).strip()].append(r)
    multi = {a: v for a, v in by_art.items() if len(v) > 1}
    s_rows = sum(float(r.get('search_views') or 0) for r in rows)
    s_uniq = sum(float(v[-1].get('search_views') or 0) for v in by_art.values())
    test_rows = sum(1 for r in rows if r.get('role') in ('test_ad', 'test_sibling'))
    print(f'  {d}: строк {len(rows)}, товаров {len(by_art)}, товаров в 2+ строках {len(multi)}; показы по строкам {int(s_rows)}, по товарам {int(s_uniq)}, лишнее {int(s_rows - s_uniq)} ({(s_rows - s_uniq) / s_uniq * 100:.1f}%); тестовых строк (test_ad+test_sibling) {test_rows}')
    for a, v in list(multi.items())[:2]:
        print('     ', a, [(x.get('role'), x.get('test_id'), x.get('search_views')) for x in v])

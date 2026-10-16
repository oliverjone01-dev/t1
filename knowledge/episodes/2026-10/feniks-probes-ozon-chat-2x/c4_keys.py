# ФЕНИКС, PR #477 @ 889c35b. Проба K-instr: ключ инструкции чату для funnel_tests
# («дата + роль + товар (у агрегатов - тест)», ozon-testy-dannye-dlya-chata.md:56) против живого файла.
# python3 -I c4_keys.py
import json, collections

ft = [json.loads(l) for l in open('/home/user/t1/analytics-mvp/data/funnel_tests.ndjson', encoding='utf-8') if l.strip()]
AGG = ('agg_median', 'agg_sum')
prod = collections.defaultdict(set)
aggk = collections.defaultdict(set)
for r in ft:
    if r.get('role') in AGG:
        aggk[(r['date'], r['role'], str(r.get('test_id') or ''))].add(str(r.get('group')))
    else:
        prod[(r['date'], r['role'], r['art'].strip())].add(str(r.get('test_id') or ''))
pm = {k: v for k, v in prod.items() if len(v) - 1}
am = {k: v for k, v in aggk.items() if len(v) - 1}
print('товарные ключи инструкции с 2+ test_id:', len(pm), '| с 01.10:', sum(1 for k in pm if k[0] >= '2026-10-01'))
print('  примеры:', sorted(pm.items())[-3:])
print('агрегатные ключи инструкции с 2+ группами:', len(am), '| с 01.10:', sum(1 for k in am if k[0] >= '2026-10-01'))
print('  примеры:', sorted(am.items())[-2:])

# iter3, N3: список «позиции нет» - независимо по funnel_tests.ndjson; и верна ли причина «их нет в съёме тестов».
# python3 -I p3_nopos.py
import json
DD = '/home/user/t1/analytics-mvp/data/'
plan = json.load(open(DD + 'plan_2026-10-15.json'))
arts = {c['main_art']: c['short'] for c in plan['cards']}
seen = {}
for l in open(DD + 'funnel_tests.ndjson', encoding='utf-8'):
    if not l.strip(): continue
    r = json.loads(l)
    if r.get('art') in arts:
        s = seen.setdefault(r['art'], [0, 0])
        s[0] += 1
        if (r.get('search_position') or 0) > 0: s[1] += 1
for a, sh in arts.items():
    print(f'{sh:12} {a:22} строк в funnel_tests {seen.get(a, [0, 0])[0]:4}  с позицией {seen.get(a, [0, 0])[1]:4}')
print('без позиции (независимо):', ', '.join(sh for a, sh in arts.items() if seen.get(a, [0, 0])[1] == 0))
print('из них вообще нет в съёме:', ', '.join(sh for a, sh in arts.items() if seen.get(a, [0, 0])[0] == 0))

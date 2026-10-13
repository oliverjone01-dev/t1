import json, re
rows = json.load(open('/home/user/t1/knowledge/episodes/2026-10/ozon-price-floor/floor_rows.json'))
T = json.load(open('/home/user/t1/analytics-mvp/tools/tests/tests.json'))
sel = set()
for r in rows:
    t = r['p_10']
    if t and (1 - t / r['p0']) * 100 >= 5: sel.add(r['art'])
print('статусы_тестов:', json.dumps(T.get('статусы_тестов'), ensure_ascii=False)[:600])
for sec in ('тесты', 'тесты_ставок', 'тесты_цены'):
    for t in T.get(sec, []):
        tid = t.get('id') or t.get('название') or '?'
        for key, val in t.items():
            s = json.dumps(val, ensure_ascii=False)
            hit = sorted(a for a in sel if '"' + a + '"' in s)
            if hit and key not in ('история', 'заметка', 'гипотеза'):
                print(sec, '|', str(tid)[:30], '| статус', t.get('статус'), '| замер', t.get('замер') or t.get('дата_замера'), '| поле', key, ':', len(hit), hit[:8])

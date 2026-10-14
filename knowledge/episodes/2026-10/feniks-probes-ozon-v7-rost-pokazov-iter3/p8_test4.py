# P8: тест 4 - какие его товары попадают в «Минимальный клик» 15.10 (правило 12.10 «4да»: тестовый товар при рекламе за клик не засчитывается)
import json, sys
t = json.load(open('/home/user/t1/analytics-mvp/tools/tests/tests.json'))
items = t if isinstance(t, list) else t.get('tests', [])
for x in items:
    s = json.dumps(x, ensure_ascii=False)
    if 'GGK-02-3-3-80' in s:
        keys = list(x.keys()) if isinstance(x, dict) else []
        print('ключи:', keys)
        for k in ('id', 'name', 'title', 'start', 'end', 'measure', 'extend', 'skus', 'items', 'excluded', 'исключены'):
            if isinstance(x, dict) and k in x: print(k, '=', json.dumps(x[k], ensure_ascii=False)[:900])
V7 = '/home/user/t1/knowledge/episodes/2026-10/ozon-testy-scripts/v7'
sys.path.insert(0, V7); sys.path.insert(0, V7 + '/../v5')
import cards7 as K
T4 = ['GGT-03-1-3-E-12080', 'GGT-20-2-3-16080', 'GGT-03-3-5-L-90', 'GGM-16-2-3-LED', 'GGM-15-2-2', 'GGM-23-1-1', 'GGL-05-XL-slim-2', 'GGM-18-1-1-LED', 'GGK-02-3-3-80', 'GGK-05-2-3-7040']
mk = {}
for i, c in enumerate(K.cards, 1):
    for s, off, nm, o in c['others']: mk[off] = (i, c['main_art'])
    mk.setdefault(c['main_art'], (i, 'ГЛАВНЫЙ'))
print('товары теста 4 в плане (место карточки в очереди; 1-10 - волна 1 с 15.10):')
for a in T4: print(' ', a, mk.get(a, '-'))

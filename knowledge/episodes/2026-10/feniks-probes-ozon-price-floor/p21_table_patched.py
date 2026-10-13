# ФЕНИКС проба P21: сколько строк дала бы таблица table.py (запас до 10% >= 5%) на исправленной модели P20,
# сколько из них в группах идущих тестов (tests.json) и с рекламой за клик сейчас
import json
rows = json.load(open('/tmp/feniks-floor/floor_rows_patched.json'))
T = json.load(open('/home/user/t1/analytics-mvp/tools/tests/tests.json'))
run_arts = set()
for sec in ('тесты', 'тесты_ставок', 'тесты_цены'):
    for t in T.get(sec, []):
        if t.get('статус') == 'завершён': continue
        s = json.dumps({k: v for k, v in t.items() if k not in ('история', 'заметка', 'гипотеза', 'промежуточный_вывод')}, ensure_ascii=False)
        for r in rows:
            if '"' + r['art'] + '"' in s: run_arts.add(r['art'])
sel = [r for r in rows if r['p_10'] and (1 - r['p_10'] / r['p0']) * 100 >= 5]
print('[P21] строк таблицы на исправленной модели:', len(sel), '; от 0,5 шт/нед:', sum(r['wk'] >= 0.5 for r in sel),
      '; в группах идущих тестов:', sum(r['art'] in run_arts for r in sel), '; с рекламой за клик сейчас:', sum(r['ads'] for r in sel))

# v7: восстановить входы /tmp после переезда: floor_rows.json (floor.py), list26.json (шаги из таблицы раздела 3 Word 13.10), names.json.
# python3 -I restore_inputs.py
import json, os, subprocess
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = HERE.split('knowledge/')[0]
subprocess.run(['python3', '-I', ROOT + 'knowledge/episodes/2026-10/ozon-price-floor/floor.py'], check=True, capture_output=True)
rows = {r['art']: r for r in json.load(open('/tmp/ozon-floor/floor_rows.json'))}
os.makedirs('/tmp/ozon-v5', exist_ok=True); os.makedirs('/tmp/ozon-v7', exist_ok=True)
L = [dict(art=x['art'], sku=rows[x['art']]['sku'], step=x['step']) for x in json.load(open(HERE + '/list26_steps.json'))]
json.dump(L, open('/tmp/ozon-v5/list26.json', 'w'), ensure_ascii=False)
json.dump(json.load(open(HERE + '/names.json')), open('/tmp/ozon-v7/names.json', 'w'), ensure_ascii=False)
print('ok', len(L))

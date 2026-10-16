# ФЕНИКС iter3. Сводка B4 / U3 по jsonl из render7.mts: ошибки клиента, пустые контейнеры, спидометр «на пути» против таблицы 1.
# python3 -I b4_summary.py <file.jsonl>
import json, sys
rows = [json.loads(l) for l in open(sys.argv[1], encoding='utf-8') if l.strip()]
agree = dis = 0
for r in rows:
    g = r['gauges'][1]
    early = 'рано' in g['v']
    if r['n_in'] == 0:
        ok = r['gauge_on'] is None and r['t1_go'] == 0
    elif early:
        ok = r['t1_early'] == 10 and r['n_in'] < 3
    else:
        ok = r['gauge_on'] == r['t1_go'] and r['t1_early'] == 0
    agree += ok; dis += not ok
    print(f"{r['dir']:<16} {r['today']} n_in {r['n_in']:>2} | центр {g['v']:<10} | {g['l1']:<10} | {g['l2'][:60]:<60} | табл. идём {r['t1_go']} рано {r['t1_early']} | {'ок' if ok else 'РАСХОЖДЕНИЕ'}"
          f" | ошибок {len(r['errs'])} пустых {len(r['empty'])}")
print(f'итого {len(rows)}: совпало {agree}, расхождений {dis}; ошибок клиента {sum(len(r["errs"]) for r in rows)}, пустых контейнеров {sum(len(r["empty"]) for r in rows)}')

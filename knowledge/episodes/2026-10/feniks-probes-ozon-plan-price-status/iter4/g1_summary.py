# ФЕНИКС iter4. Сводка G1 / U3 / B4 по jsonl из render8.mts: на каждом спидометре периода (карточки, магазин, оборот, реклама)
# цвет зоны под стрелкой против цвета статуса; ошибки клиента и пустые контейнеры; «на пути» против таблицы 1.
# python3 -I g1_summary.py <file.jsonl> [...]
import json, sys
rows = [json.loads(l) for f in sys.argv[1:] for l in open(f, encoding='utf-8') if l.strip()]
n = mis = 0; b4_ok = b4_bad = 0
for r in rows:
    for g in [r['gauges'][i] for i in (0, 2, 3, 4)]:
        if g['needle'] is None or g['status_col'] is None: continue
        n += 1; bad = g['zone'] != g['status_col']; mis += bad
        if bad or r['dir'].startswith('fx_g1') and g['title'].startswith('Заказы 10'):
            print(f"{r['dir']:<16} {r['today']} {g['title']:<19} центр {g['v']:>5} | стрелка {g['needle']:>5}% в зоне «{g['zone']}» | метка {g['mark']:>5}% | статус «{g['status']}» ({g['status_col']})"
                  f"{'  <- РАСХОЖДЕНИЕ' if bad else ''}")
    g2 = r['gauges'][1]
    if r['n_in'] == 0: ok = r['gauge_on'] is None and r['t1_go'] == 0
    elif 'рано' in g2['v']: ok = r['t1_early'] == 10 and r['n_in'] < 3
    else: ok = r['gauge_on'] == r['t1_go'] and r['t1_early'] == 0
    b4_ok += ok; b4_bad += not ok
print(f'G1: спидометров периода со стрелкой и статусом {n}, цвет зоны под стрелкой != цвет статуса: {mis}')
print(f'B4: «на пути» = таблица 1: {b4_ok} из {b4_ok + b4_bad}; ошибок клиента {sum(len(r["errs"]) for r in rows)}, пустых контейнеров {sum(len(r["empty"]) for r in rows)}, сборок {len(rows)}')

# ФЕНИКС iter5. Строгая сводка G1 по jsonl из render9.mts (страница целиком: planBlock + клиентский скрипт в jsdom).
# По каждому спидометру периода со стрелкой и статусом: стрелка внутри нарисованной дуги чужого цвета (IN-mis); стрелка между дугами
# (GAP) и дуга цвета статуса нулевой длины или отсутствует (NOARC); data-zone != data-st (атрибут теста автора); дуги нулевой длины.
# python3 -I g1_strict.py <file.jsonl> [...]
import json, sys
rows = [json.loads(l) for f in sys.argv[1:] for l in open(f, encoding='utf-8') if l.strip()]
n = inmis = gap = noarc = attr = zero = 0
for r in rows:
    for g in [r['gauges'][i] for i in (0, 2, 3, 4)]:
        zero += g['zero']
        if g['needle'] is None or g['status_col'] is None: continue
        n += 1
        drawn = {c for a, b, c in g['arcs'] if b - a > 1e-6}
        bad_in = g['zone_exact'] not in ('gap', g['status_col'])
        no_arc = g['status_col'] not in drawn
        inmis += bad_in; gap += g['zone_exact'] == 'gap'; noarc += no_arc; attr += g['data_zone'] != g['data_st']
        if bad_in or no_arc or g['data_zone'] != g['data_st'] or g['zero']:
            print(f"{r['dir']:<14} {r['today']} {g['title']:<19} {g['v']:>5} | стрелка {g['needle']:>5}% строго «{g['zone_exact']}» ближе {g['near']} | статус «{g['status']}» ({g['status_col']}) | "
                  f"нарисовано {sorted(drawn)} нулевых {g['zero']} | data-zone {g['data_zone']} data-st {g['data_st']}")
print(f'G1 строго: спидометров {n}, стрелка в дуге чужого цвета {inmis}, между дугами {gap}, дуги цвета статуса нет на циферблате {noarc}, '
      f'data-zone != data-st {attr}, дуг нулевой длины {zero}; сборок {len(rows)}, ошибок клиента {sum(len(r["errs"]) for r in rows)}, пустых {sum(len(r["empty"]) for r in rows)}')

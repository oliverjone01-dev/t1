# P3b: сырые записи prices_daily вокруг 08-09.10 (наша цена, зачёркнутая, соинвест) - не артефакт ли поля
import json
rows = [json.loads(l) for l in open('/home/user/t1/analytics-mvp/data/prices_daily.ndjson')]
for art in ('GGT-03-2-2-E-16080', 'GGT-03-3-3-E-14080', 'GGM-02-1-1', 'GGK-02-3-3-80', 'GGT-03-3-5-L-90', 'GGM-02-1-2', 'GGM-20-2'):
    seq = [(r['d'][5:], r['price'], r['before'], r['coinv']) for r in rows if r['offer'] == art and r['d'] >= '2026-10-05']
    print(art, seq)
# сколько офферов магазина сменили цену 08-09.10 и в какую сторону
prev = {}; ch = {}
for r in rows:
    o = r['offer']
    if o in prev and r['price'] != prev[o][1] and r['d'] in ('2026-10-08', '2026-10-09'):
        ch[o] = (r['d'], prev[o][1], r['price'])
    prev[o] = (r['d'], r['price'])
down = [v for v in ch.values() if v[2] < v[1]]; up = [v for v in ch.values() if v[2] > v[1]]
print('офферов со сменой цены 08-09.10:', len(ch), 'вниз', len(down), 'вверх', len(up), 'всего офферов', len(prev))

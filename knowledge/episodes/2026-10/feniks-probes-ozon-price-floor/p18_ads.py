# ФЕНИКС проба P18: сколько строк таблицы держатся на заказах, сделанных с текущей (часто дорогой) рекламой
import json, collections as C
D = '/home/user/t1/analytics-mvp/data/'
rows = json.load(open('/home/user/t1/knowledge/episodes/2026-10/ozon-price-floor/floor_rows.json'))
sp = C.Counter()
for l in open(D + 'ads_sku_daily.ndjson'):
    r = json.loads(l)
    if '2026-10-01' <= r['d'] <= '2026-10-10': sp[r['sku']] += r['sp']
sel = [r for r in rows if r['p_10'] and (1 - r['p_10'] / r['p0']) * 100 >= 5]
print('[P18] строк таблицы', len(sel), '; с рекламой за клик сейчас', sum(r['ads'] for r in sel))
by = C.Counter(); exp = []
for r in sel:
    g = 'от 0,5 шт/нед' if r['wk'] >= 0.5 else 'медленный'
    by[(g, r['ads'])] += 1
    wk_sp = sp[r['sku']] / 10 * 7
    if wk_sp > 3000: exp.append((r['art'], round(wk_sp), round(r['wk'], 2)))
print('[P18] по группам (группа, реклама сейчас):', dict(by))
print('[P18] в таблице с расходом на клики > 3 000 ₽/нед (01-10.10):', len(exp), sorted(exp, key=lambda x: -x[1])[:8])
print('[P18] вся модель: с рекламой сейчас', sum(r['ads'] for r in rows), 'из', len(rows), '; в группе 0,5-1,5:', sum(r['ads'] for r in rows if 0.5 <= r['wk'] < 1.5), 'из', sum(1 for r in rows if 0.5 <= r['wk'] < 1.5))

# ФЕНИКС iter2, PR #477 @ 3121423. Проба G1b: происхождение замороженной выборки эталонов.
# (1) каждая строка plan-golden-orders.ndjson есть в orders_daily версии c1cff23 (поля совпадают);
# (2) в выборке ВСЕ строки c1cff23 из окон эталонов (магазин d 01-13.10; TRUBIS 160 d 14.09-11.10), без отбора;
# (3) 48 sku plan-golden-card.json = группа TRUBIS 160 в card_groups.json; (4) пересчёт 137 / 49 на выборке и на c1cff23.
# python3 -I g_fixture.py
import json, subprocess

R = '/home/user/t1'
FX = R + '/analytics-mvp/src/scripts/__fixtures__/'
fx = [json.loads(l) for l in open(FX + 'plan-golden-orders.ndjson', encoding='utf-8') if l.strip()]
card = json.load(open(FX + 'plan-golden-card.json', encoding='utf-8'))
src = [json.loads(l) for l in subprocess.run(['git', '-C', R, 'show', 'c1cff23:analytics-mvp/data/orders_daily.ndjson'], capture_output=True, text=True).stdout.splitlines() if l.strip()]
print('выборка строк', len(fx), '| поля', sorted(fx[0].keys()))
print('c1cff23 строк', len(src))
key = lambda r: json.dumps({k: r.get(k) for k in sorted(fx[0].keys())}, sort_keys=True, ensure_ascii=False)
srcset = {}
for r in src:
    srcset.setdefault(key(r), 0)
    srcset[key(r)] += 1
miss = [r for r in fx if key(r) not in srcset]
print('(1) строк выборки, которых нет в c1cff23:', len(miss), miss[:2])
TR = set(card.get('trubis160_skus', []))
groups = json.load(open(R + '/analytics-mvp/data/card_groups.json', encoding='utf-8'))['groups']
g = next(x for x in groups if any(s['offer'] == 'GGT-03-3-3-E-16080' for s in x['skus']))
print('(3) sku карточки в выборке', len(TR), '= card_groups', TR == {str(s['sku']) for s in g['skus']})
need = [r for r in src if ('2026-10-01' <= r['d'] <= '2026-10-13') or (str(r['sku']) in TR and '2026-09-14' <= r['d'] <= '2026-10-11')]
fxset = {}
for r in fx:
    fxset.setdefault(key(r), 0)
    fxset[key(r)] += 1
lost = [r for r in need if key(r) not in fxset]
extra = [r for r in fx if not (('2026-10-01' <= r['d'] <= '2026-10-13') or (str(r['sku']) in TR and '2026-09-14' <= r['d'] <= '2026-10-11'))]
print('(2) строк окон в c1cff23', len(need), '| не попали в выборку', len(lost), '| лишних в выборке', len(extra))
net = lambda rows, a, b, sk=None: sum(int(r.get('units') or 0) for r in rows if a <= r['d'] <= b and r.get('status') != 'cancelled' and (sk is None or str(r['sku']) in sk))
print('(4) выборка: 137 ->', net(fx, '2026-10-01', '2026-10-13'), '| 49 ->', net(fx, '2026-09-14', '2026-10-11', TR))
print('    c1cff23: 137 ->', net(src, '2026-10-01', '2026-10-13'), '| 49 ->', net(src, '2026-09-14', '2026-10-11', TR))

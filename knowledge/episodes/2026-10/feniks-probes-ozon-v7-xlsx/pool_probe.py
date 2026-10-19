# ФЕНИКС проба X1: пул волны 2 по условиям itogi.md:78, диагностика карточек
import sys, os, json, collections as C
V7 = '/home/user/t1/knowledge/episodes/2026-10/ozon-testy-scripts/v7'
sys.path.insert(0, V7); sys.path.insert(0, V7 + '/../v5')
import plan7 as P, forecast as F
T = json.load(open('/home/user/t1/analytics-mvp/tools/tests/tests.json'))
G = json.load(open(F.D + 'card_groups.json'))['groups']
card = P.card; off2card = P.off2card
sku2off = {s['sku']: s['offer'] for g in G for s in g['skus']}
members = C.defaultdict(list)
for g in G:
    for s in g['skus']: members[g['main']].append(s['offer'])
# 1) карточки активных кампаний, неоднозначные
amb = {}
for k in sorted(P.ACTIVE):
    c = F.camp[k]; cc = P.camp_card(c)
    if str(cc).startswith('?'):
        t = c['off'].split('-')
        hits = sorted({cd for of, cd in off2card.items() if all(x in of.split('-') for x in t)})
        amb[k] = (c['off'], hits)
print('неоднозначные кампании (camp_card = ?):', {k: (v[0], len(v[1])) for k, v in amb.items()})
# 2) пул как в генераторе
ads_sku = C.defaultdict(float)
for a in F.L('ads_sku_daily.ndjson'):
    if a['cid'] != F.CPO_ID and a['d'] >= '2026-09-01': ads_sku[a['sku']] += a['sp']
o60 = C.Counter()
for o in F.L('orders_daily.ndjson'):
    if '2026-08-13' <= o['d'] <= '2026-10-11' and o['status'] != 'cancelled': o60[o['sku']] += o['units']
camp_cards = {P.camp_card(F.camp[k]) for k in P.ACTIVE}
excl_cards = P.PCARDS | {P.card.get(s) for s in P.WAIT}
print('excl_cards == PCARDS:', excl_cards == P.PCARDS, '| WAIT cards subset PCARDS:', {P.card.get(s) for s in P.WAIT} <= P.PCARDS)
pool = []
for sku, r in F.rows.items():
    cd = card.get(sku)
    if not cd or cd in camp_cards or cd in excl_cards or ads_sku[sku] > 0 or o60[sku] < 1: continue
    pool.append((o60[sku], r['art'], sku, cd, F.pi(r, r['p0'], 0.05, r['s']), r['p0']))
pool.sort(key=lambda x: (-x[0], -x[4]))
wave, per = [], C.Counter()
for x in pool:
    if per[x[3]] >= 3 or len(wave) >= 20: continue
    per[x[3]] += 1; wave.append(x)
print('пул', len(pool), 'карточек', len({x[3] for x in pool}), '| волна', len(wave), 'карточек', len({x[3] for x in wave}))
# 3) участники тестов 1-4 и их карточки
def arts_of(t): return set(t.get('тест') or []) | set(t.get('контроль') or [])
t1, t2 = T['тесты'][0], T['тесты'][1]; t3 = T['тесты_ставок'][0]; t4 = T['тесты_цены'][0]
part = {'t1': set(t1['тест']), 't1c': set(t1.get('контроль') or []), 't2': set(t2['тест']), 't2c': set(t2.get('контроль') or []),
        't3': set(json.dumps(t3, ensure_ascii=False).split('"')) & set(off2card), 't4': set(t4['тест'])}
pc = {k: {off2card.get(a) for a in v} - {None} for k, v in part.items()}
for x in pool:
    off = x[1]; cd = x[3]
    flags = [k for k in part if off in part[k]] + [k + '_card' for k in pc if cd in pc[k]]
    amb_hit = [k for k, (o, hits) in amb.items() if cd in hits]
    inw = x in wave
    print(f"{'W' if inw else ' '} {off:24} o60={x[0]} card={cd} n_card={len(members[cd])} test={flags} amb_campaign_could_cover={[(k, amb[k][0]) for k in amb_hit]}")
print('по карточкам в волне:', C.Counter(x[3] for x in wave).most_common(6))
gg = [x for x in pool if x[1].startswith('GGTP-03')]
print('GGTP-03 в пуле:', [(x[1], x[3]) for x in gg])

# ФЕНИКС iter2, проба X1b: пул / волна / контроль как в plan7_xlsx.py (рабочее дерево), карточки, группы, база заказов
import sys, json, re, collections as C
V7 = '/home/user/t1/knowledge/episodes/2026-10/ozon-testy-scripts/v7'
sys.path.insert(0, V7); sys.path.insert(0, V7 + '/../v5')
import plan7 as P, forecast as F
G = json.load(open(F.D + 'card_groups.json'))['groups']
members = C.defaultdict(list)
for g in G:
    for s in g['skus']: members[g['main']].append(s['offer'])
ads_sku = C.defaultdict(float)
for a in F.L('ads_sku_daily.ndjson'):
    if a['cid'] != F.CPO_ID and a['d'] >= '2026-09-01': ads_sku[a['sku']] += a['sp']
o60 = C.Counter(); o4 = C.Counter(); o4card = C.Counter()
for o in F.L('orders_daily.ndjson'):
    if o['status'] == 'cancelled': continue
    if '2026-08-13' <= o['d'] <= '2026-10-11': o60[o['sku']] += o['units']
    if '2026-09-14' <= o['d'] <= '2026-10-11': o4[o['sku']] += o['units']; o4card[P.card.get(o['sku'], o['sku'])] += o['units']
camp_cards = {P.camp_card(F.camp[k]) for k in P.ACTIVE}
TT = json.load(open('/home/user/t1/analytics-mvp/tools/tests/tests.json'))
TEST_ARTS = set(re.findall(r'\b(?:GG[A-Z]*|B)-[0-9A-Za-z-]+', json.dumps({k: TT[k] for k in ('тесты', 'тесты_ставок', 'тесты_цены')}, ensure_ascii=False)))
unm = sorted(a for a in TEST_ARTS if a not in P.off2card)
excl = P.PCARDS | {P.card.get(s) for s in P.WAIT} | {P.off2card[a] for a in TEST_ARTS if a in P.off2card}
print('TEST_ARTS', len(TEST_ARTS), '| не найдены в off2card:', len(unm), unm[:12])
pool = []
for sku, r in F.rows.items():
    cd = P.card.get(sku)
    if not cd or cd in camp_cards or cd in excl or ads_sku[sku] > 0 or o60[sku] < 1: continue
    pool.append((o60[sku], r['art'], sku, cd, F.pi(r, r['p0'], 0.05, r['s']), r['p0']))
pool.sort(key=lambda x: (-x[0], -x[4]))
grp = lambda a: '-'.join(a.split('-')[:2])
cs = []
for x in pool:
    if x[3] not in cs: cs.append(x[3])
WC, CC = set(cs[0::2]), set(cs[1::2])
wave, pc, pg = [], C.Counter(), C.Counter()
for x in pool:
    if x[3] not in WC or pc[x[3]] >= 3 or pg[grp(x[1])] >= 3: continue
    pc[x[3]] += 1; pg[grp(x[1])] += 1; wave.append(x)
ctrl = [x for x in pool if x[3] in CC]
left = [x for x in pool if x not in wave and x not in ctrl]
print('пул', len(pool), 'карточек', len(cs), '| волна', len(wave), 'карточек', len({x[3] for x in wave}), '| контроль', len(ctrl), 'карточек', len(CC), '| в карточке волны, но вне волны:', [(x[1], x[3]) for x in left])
print('порядок карточек (ранг: карточка -> W/C):', [(i, c, 'W' if c in WC else 'C') for i, c in enumerate(cs)])
for lbl, S in (('W', wave), ('C', ctrl), ('-', left)):
    for x in S:
        cd = x[3]
        print(f'{lbl} {x[1]:20} grp={grp(x[1]):8} o60={x[0]} o4={o4[x[2]]} card={cd} n_card={len(members[cd])} card_o4={o4card[cd]} card_members={members[cd][:6]}')
for lbl, S, cards in (('волна', wave, WC), ('контроль', ctrl, CC)):
    s60 = sum(x[0] for x in S); s4 = sum(o4[x[2]] for x in S); c4 = sum(o4card[c] for c in cards)
    print(f'{lbl}: товаров {len(S)}, заказов за 60 дней {s60} ({s60 / (60 / 7):.2f}/нед), за 14.09-11.10 {s4}; карточки целиком за 14.09-11.10 {c4} ({c4 / 4:.2f}/нед)')
json.dump({'wave': [x[2] for x in wave], 'ctrl': [x[2] for x in ctrl], 'WC': sorted(WC), 'CC': sorted(CC)}, open('/tmp/claude-0/-home-user-t1/76dea677-6fab-5e1c-b5c2-6cb8af229fe7/scratchpad/feniks-x2/pool2.json', 'w'))

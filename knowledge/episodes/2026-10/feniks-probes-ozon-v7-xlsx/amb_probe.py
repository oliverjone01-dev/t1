import sys, json, collections as C
V7 = '/home/user/t1/knowledge/episodes/2026-10/ozon-testy-scripts/v7'
sys.path.insert(0, V7); sys.path.insert(0, V7 + '/../v5')
import plan7 as P, forecast as F
G = json.load(open(F.D + 'card_groups.json'))
print('card_groups imported_at', G.get('imported_at'), '| source', str(G.get('source'))[:80])
G = G['groups']; sku2off = {s['sku']: s['offer'] for g in G for s in g['skus']}
by = C.defaultdict(lambda: C.Counter()); last = C.defaultdict(str); dates = set()
for a in F.L('ads_sku_daily.ndjson'):
    dates.add(a['d'])
    if a['cid'] in ('44990317', '43629636', '44989441', '44990352', '44989034', '40047060'):
        by[a['cid']][a['sku']] += a['sp']
print('ads_sku_daily max date', max(dates))
for cid, cnt in by.items():
    print(cid, F.camp[cid]['off'], [(sku2off.get(s, s), P.card.get(s), round(v)) for s, v in cnt.most_common(8)])
for cid in ('44990317', '43629636'):
    if cid not in by: print(cid, F.camp[cid]['off'], 'НЕТ строк в ads_sku_daily')
# карточка 4756828433: кто из теста 4
T = json.load(open('/home/user/t1/analytics-mvp/tools/tests/tests.json')); t4 = T['тесты_цены'][0]
for a in t4['тест']:
    print('t4', a, P.off2card.get(a), 'исключён' if a in t4.get('исключены', {}) else 'в счёте')
print('карточка 4756842305:', [s['offer'] for g in G if g['main'] == '4756842305' for s in g['skus']])
print('карточка 4756834245:', [s['offer'] for g in G if g['main'] == '4756834245' for s in g['skus']][:30])
print('4756834245 in PCARDS', '4756834245' in P.PCARDS, '| 4756842305 in PCARDS', '4756842305' in P.PCARDS)
print('44990317 in IN_P', '44990317' in P.IN_P, P.camp_card(F.camp['44990317']))

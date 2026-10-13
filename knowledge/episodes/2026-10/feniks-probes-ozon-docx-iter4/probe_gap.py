# ФЕНИКС, проба B1/B4 по абзацу «Что это уже дало»: контроль без рекламы в тех же карточках
import json, collections, statistics as st
D = '/home/user/t1/analytics-mvp/data/'
offer = json.load(open(D + 'sku_offer.json'))
G = json.load(open(D + 'card_groups.json'))['groups']
card = {s['offer']: g['main'] for g in G for s in g['skus']}
members = collections.defaultdict(list)
for g in G:
    for s in g['skus']:
        members[g['main']].append(s['offer'])

NEW = {'44989034', '44988191', '44988572', '44920406', '44989441', '44990352'}
STOP = {'37239106', '37007560', '43315519'}
sp_new = collections.Counter(); sp_stop = collections.Counter(); sp_other_after = collections.Counter(); sp_any_before = collections.Counter()
for l in open(D + 'ads_sku_daily.ndjson'):
    x = json.loads(l); a = offer.get(x['sku'], x['sku'])
    if x['d'] >= '2026-10-08' and x['cid'] in NEW: sp_new[a] += x['sp']
    if x['cid'] in STOP and x['d'] >= '2026-10-01': sp_stop[a] += x['sp']
    if x['d'] >= '2026-10-09' and x['cid'] not in NEW: sp_other_after[a] += x['sp']
    if '2026-10-01' <= x['d'] <= '2026-10-07': sp_any_before[a] += x['sp']

gap = collections.defaultdict(dict); src = collections.defaultdict(collections.Counter)
for l in open(D + 'gap_daily.ndjson'):
    x = json.loads(l)
    if x['date'] >= '2026-10-01' and x.get('gap_pct') is not None:
        gap[x['date']][x['art']] = x['gap_pct']
        src[x['date']][(x.get('src'), x.get('oa_used'))] += 1
ds = sorted(gap); med = {d: st.median(gap[d].values()) for d in ds}
print('src by date:', {d[5:]: dict(src[d]) for d in ds})

def status(a):
    if sp_new[a] > 0: return 'NEW'
    if sp_stop[a] > 0: return 'STOP'
    if sp_other_after[a] > 0: return 'ADOTHER'
    return 'NOAD'

for cm in ('4756834245', '5728188877', '6279981715'):
    print('=== card', cm, 'skus', len(members[cm]))
    for a in sorted(members[cm], key=lambda z: (status(z), z)):
        row = ' '.join(f"{d[8:]}:{gap[d][a]-med[d]:+.1f}" if a in gap[d] else f"{d[8:]}:  na" for d in ds if d >= '2026-10-05')
        print(f"{status(a):7} bef_sp={sp_any_before[a]:6d} {a:24} {row}")

# магазин целиком: сдвиг 09.10 -> 11.10 относительно медианы, по статусу
print('=== store: shift (11.10 - 09.10) of gap minus median, by status')
by = collections.defaultdict(list)
for a in gap['2026-10-11']:
    if a in gap['2026-10-09']:
        sh = (gap['2026-10-11'][a] - med['2026-10-11']) - (gap['2026-10-09'][a] - med['2026-10-09'])
        by[(status(a), card.get(a) in ('4756834245', '5728188877', '6279981715'))].append(sh)
for k, v in sorted(by.items()):
    print(k, 'n=', len(v), 'median shift %+.1f' % st.median(v), 'share >=+5: %d/%d' % (sum(1 for z in v if z >= 5), len(v)))

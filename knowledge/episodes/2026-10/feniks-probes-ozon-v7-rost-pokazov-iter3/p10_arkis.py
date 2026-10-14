# P10: GGM-24-2 - в «Минимальном клике» (новая кампания 8 ₽) и одновременно своя идущая кампания 43629680 («оставляем»).
# Куда реально тратит 43629680 и 43629672 (ARKIS), какие SKU у GGM-24-1 / GGM-24-2 в card_groups и в floor rows
import json, collections as C
D = '/home/user/t1/analytics-mvp/data/'
off = {}
for g in json.load(open(D + 'card_groups.json'))['groups']:
    for s in g['skus']: off[s['sku']] = s['offer']
inv = {v: k for k, v in off.items()}
print('SKU по card_groups: GGM-24-1', inv.get('GGM-24-1'), 'GGM-24-2', inv.get('GGM-24-2'))
for cid in ('43629680', '43629672'):
    s = C.Counter(); days = set()
    for l in open(D + 'ads_sku_daily.ndjson'):
        a = json.loads(l)
        if a['cid'] == cid and '2026-09-14' <= a['d'] <= '2026-10-13': s[(a['sku'], off.get(a['sku'], '?'))] += a['sp']; days.add(a['d'])
    print(cid, 'расход 14.09-13.10 по SKU:', dict(s), 'дней', len(days))
for l in open(D + 'ads_daily.ndjson'):
    a = json.loads(l)
    if a['id'] in ('43629680', '43629672') and a['d'] == '2026-10-10': print('ads_daily 10.10', a['id'], a['off'], a['sp'])

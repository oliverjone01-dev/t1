import json, collections as C
R = [json.loads(l) for l in open('/home/user/t1/analytics-mvp/data/ads_daily.ndjson')]
print('rows', len(R), 'keys', sorted(R[0].keys()))
print('date range', min(r['d'] for r in R), max(r['d'] for r in R))
for cid in ('28753239', '37675958', '39931246', '37676554'):
    rr = sorted([r for r in R if r['id'] == cid], key=lambda r: r['d'])
    act = [r for r in rr if r['sp'] > 0]
    print(cid, rr[0].get('off') if rr else None, 'rows', len(rr),
          'first spend day', act[0]['d'] if act else None, 'last', act[-1]['d'] if act else None)
    if rr:
        print('   sample last', rr[-1])
agg = C.defaultdict(C.Counter); off = {}
for r in R:
    if '2026-09-22' <= r['d'] <= '2026-10-07' and r['sp'] > 0:
        a = agg[r['id']]; a['sp'] += r['sp']; a['vw'] += r['vw']; a['cl'] += r['cl']; a['days'] += 1; off[r['id']] = r['off']
print('campaigns with spend in window:', len(agg))
for i, a in agg.items():
    wk = a['sp'] * 7 / a['days']
    reason = []
    if not a['vw']: reason.append('vw=0')
    if not a['cl']: reason.append('cl=0')
    if i == '28753239': reason.append('excluded id')
    if wk <= 500: reason.append('wk_le_500 (%.0f)' % wk)
    if reason: print('  EXCL', i, off[i], dict(a), reason)

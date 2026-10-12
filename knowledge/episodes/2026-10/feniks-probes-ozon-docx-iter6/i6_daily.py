import json
R = [json.loads(l) for l in open('/home/user/t1/analytics-mvp/data/ads_daily.ndjson')]
def series(cid, lo, hi):
    return sorted([r for r in R if r['id'] == cid and lo <= r['d'] <= hi and r['sp'] > 0], key=lambda r: r['d'])
for cid, nm in (('37675958', 'KONUX big'), ('39931246', 'KUVINO big')):
    s = series(cid, '2026-09-15', '2026-10-10')
    print(nm, cid)
    print('   ' + ' '.join('%s:%.1f' % (r['d'][5:], r['sp'] / r['cl']) for r in s if r['cl']))
    for lo, hi in (('2026-09-22', '2026-09-30'), ('2026-10-01', '2026-10-07'), ('2026-09-22', '2026-10-07'), ('2026-10-08', '2026-10-10'), ('2026-10-09', '2026-10-10')):
        ss = series(cid, lo, hi)
        sp = sum(r['sp'] for r in ss); cl = sum(r['cl'] for r in ss); vw = sum(r['vw'] for r in ss)
        print('   %s..%s days %2d CPC %.1f CTR %.2f%% CPM %.0f' % (lo, hi, len(ss), sp / cl, cl / vw * 100, sp / vw * 1000))
# test-3 window ad impressions per week (ads_daily vw) vs table search impressions
def wk(cid, lo, hi):
    ss = series(cid, lo, hi)
    n = len(ss)
    return sum(r['sp'] for r in ss) * 7 / n, sum(r['vw'] for r in ss) * 7 / n, n
for lab, big, cheap, lo, hi in (('KONUX', '37675958', '42274229', '2026-09-22', '2026-10-10'), ('KUVINO', '39931246', '43629636', '2026-10-01', '2026-10-10')):
    b = wk(big, lo, hi); c = wk(cheap, lo, hi)
    print('%s %s..%s: big sp/wk %.0f ad-vw/wk %.0f (%d d) | cheap sp/wk %.0f ad-vw/wk %.0f (%d d) | spend x%.1f, ad impressions x%.1f' % (lab, lo, hi, b[0], b[1], b[2], c[0], c[1], c[2], b[0] / c[0], b[1] / c[1]))
print('table (search impressions): KONUX 54718/3088 = x%.1f at spend 30004/2024 = x%.1f; KUVINO 21360/1712 = x%.1f at 19984/651 = x%.1f' % (54718 / 3088, 30004 / 2024, 21360 / 1712, 19984 / 651))

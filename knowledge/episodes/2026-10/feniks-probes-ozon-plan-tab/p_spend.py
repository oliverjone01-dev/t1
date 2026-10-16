# Проба: расход в PD (сборка) против ads_daily (кампании, полный день) за неделю 08-14.10 (данные по 13.10).
import json, collections
SP = '/tmp/claude-0/-home-user-t1/39ce78b8-29b6-551f-9a34-e54649462146/scratchpad/'
DD = '/home/user/t1/analytics-mvp/data/'
PD = json.load(open(SP + 'pd.json'))
def nd(f):
    out = []
    for l in open(DD + f, encoding='utf-8'):
        l = l.strip()
        if l:
            try: out.append(json.loads(l))
            except Exception: pass
    return out
ad = nd('ads_daily.ndjson')
camp = collections.defaultdict(float); day13 = collections.defaultdict(float)
for r in ad:
    if '2026-10-08' <= r['d'] <= '2026-10-13': camp[str(r['id'])] += float(r.get('sp') or 0)
for g in PD['spend']:
    print('==', g['g'])
    for r in g['rows']:
        w0 = r['w'][0]
        extra = ''
        if g['g'].startswith('11'):
            extra = f"  ads_daily={camp.get(r['n'],0):.0f}"
        print(f"  {r['n']:<12} {r['sub']:<22} plan {r['plan']:>6}  08-14.10: {w0}{extra}")
asd = nd('ads_sku_daily.ndjson')
tot13 = sum(float(r.get('sp') or 0) for r in ad if r['d'] == '2026-10-13' and str(r['id']) != '28753239')
sku13 = sum(float(r.get('sp') or 0) for r in asd if r['d'] == '2026-10-13' and str(r['cid']) != '28753239')
print(f'13.10: ads_daily {tot13:.0f}, ads_sku_daily {sku13:.0f} ({sku13/tot13*100:.0f}%)')

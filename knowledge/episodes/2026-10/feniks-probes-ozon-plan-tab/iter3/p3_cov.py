# iter3, N2: порог покрытия 95% на реальной истории. Не режет ли он настоящие (собранные) кампания-дни,
# из-за округления строк по товарам (ad-sku-daily.ts: sp = Math.round по строке d|cid|sku) или строк без sku.
# Если режет - adsFullDay «застревает» навсегда: цикл обрывается на первом плохом дне окна.
# python3 -I p3_cov.py
import json, collections, datetime as dt
DD = '/home/user/t1/analytics-mvp/data/'
def nd(f):
    out = []
    for l in open(DD + f, encoding='utf-8'):
        l = l.strip()
        if l:
            try: out.append(json.loads(l))
            except Exception: pass
    return out
CPO = '28753239'
ad = nd('ads_daily.ndjson'); asd = nd('ads_sku_daily.ndjson')
state = json.load(open(DD + 'ads_sku_state.json'))
def minus1(s): return (dt.date.fromisoformat(s) - dt.timedelta(days=1)).isoformat()
camp = collections.defaultdict(float); sku = collections.defaultdict(float); nsku = collections.Counter()
for r in ad:
    if str(r['id']) != CPO: camp[(str(r['id']), r['d'])] += float(r.get('sp') or 0)
for r in asd:
    sku[(str(r['cid']), r['d'])] += float(r.get('sp') or 0); nsku[(str(r['cid']), r['d'])] += 1
lo = min(r['d'] for r in asd); hi = max(r['d'] for r in asd)
print('ads_sku_daily: дни', lo, '..', hi, 'строк', len(asd), '| ads_daily дробные sp:', sum(1 for r in ad if float(r.get('sp') or 0) != int(float(r.get('sp') or 0))), 'из', len(ad))
ok = bad = 0; bads = []; ratios = []
for (c, d), v in camp.items():
    if v <= 0 or d < lo or d > hi: continue
    if not (state.get(c) and minus1(state[c]) >= d): continue        # кампания-день ещё не собран - вне пробы
    g = sku.get((c, d), 0.0)
    ratios.append(g / v)
    if g >= 0.95 * v: ok += 1
    else: bad += 1; bads.append((d, c, round(v, 2), round(g, 2), nsku.get((c, d), 0)))
print('собранных кампания-дней с расходом:', ok + bad, '| покрытие >= 95%:', ok, '| < 95%:', bad)
bads.sort()
for b in bads[:25]: print('   ', b[0], b[1], 'ads_daily', b[2], 'по товарам', b[3], 'строк', b[4])
by_day = collections.Counter(b[0] for b in bads)
print('дней, где хотя бы одна собранная кампания < 95%:', len(by_day), sorted(by_day)[:20])
# Что это значит для окна теста: если такой день попадёт в 08.10..28.10, ADS_FULL встанет на день раньше навсегда.
days = sorted({d for (_, d) in camp if lo <= d <= hi})
print('дней в истории', len(days), '| доля дней с застреванием', f'{len(by_day) / len(days):.0%}' if days else '-')
small = [(c, d, v) for (c, d), v in camp.items() if 0 < v < 50 and lo <= d <= hi]
print('кампания-дней с расходом < 50 ₽ в истории:', len(small))

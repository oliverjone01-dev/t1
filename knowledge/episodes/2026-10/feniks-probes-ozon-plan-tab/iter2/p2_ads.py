# iter2, G1: независимый пересчёт «последнего полного дня» рекламы по товарам и проверка, не врёт ли ads_sku_state.
# python3 -I p2_ads.py
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
plan = json.load(open(DD + 'plan_2026-10-15.json'))
tomin = {str(k['cid']) for k in plan['to_min']}
def minus1(s): return (dt.date.fromisoformat(s) - dt.timedelta(days=1)).isoformat()
camp = collections.defaultdict(float); skus = collections.defaultdict(float)
for r in ad:
    if r['d'] >= '2026-10-08' and str(r['id']) != CPO: camp[(str(r['id']), r['d'])] += float(r.get('sp') or 0)
for r in asd:
    if r['d'] >= '2026-10-08' and str(r['cid']) != CPO: skus[(str(r['cid']), r['d'])] += float(r.get('sp') or 0)
days = sorted({d for (_, d) in camp})
full = ''
print('день | кампаний с расходом | не собрано по state | расход ads_daily | по товарам | доля')
for d in days:
    act = [c for (c, dd), v in camp.items() if dd == d and v > 0]
    miss = [c for c in act if not state.get(c) or minus1(state[c]) < d]
    tot = sum(camp[(c, d)] for c in act); got = sum(skus.get((c, d), 0) for c in act)
    print(d, '|', len(act), '|', len(miss), '|', round(tot), '|', round(got), '|', f'{got / tot:.1%}' if tot else '-', '| из 11 на минимум не собрано:', len([c for c in miss if c in tomin]))
    if not miss and full == days[days.index(d) - 1] if days.index(d) else not miss: full = d
print('последний полный день (независимо):', full)
# Врёт ли state: кампания «собрана» (state-1 >= d), расход в ads_daily есть, а строк по товарам нет или заметно меньше
print('--- кампания-день, где state говорит «собрано», а по товарам < 95% ads_daily (08-12.10)')
bad = 0
for (c, d), v in sorted(camp.items()):
    if d > '2026-10-12' or v <= 0: continue
    if state.get(c) and minus1(state[c]) >= d:
        g = skus.get((c, d), 0)
        if g < 0.95 * v - 1: bad += 1; print('  ', c, d, 'ads_daily', round(v), 'по товарам', round(g), 'state', state[c])
print('таких кампания-дней:', bad)
# Сколько кампаний с расходом в окне ads_sku_daily (62 дня) не имеют ни одной строки по товарам
win_from = '2026-08-13'
spent = collections.defaultdict(float)
for r in ad:
    if win_from <= r['d'] <= '2026-10-13' and str(r['id']) != CPO: spent[str(r['id'])] += float(r.get('sp') or 0)
has = {str(r['cid']) for r in asd if r['d'] >= win_from}
nos = [(c, round(v), state.get(c)) for c, v in spent.items() if v > 0 and c not in has]
print('кампаний с расходом 13.08-13.10 без строк по товарам:', len(nos), sorted(nos, key=lambda x: -x[1])[:8])

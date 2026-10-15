# Проба K7 рекламы: покрытие ads_sku_daily (по SKU, добор по кампаниям) против ads_daily (по кампаниям, полный день).
import json, collections
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
asd = nd('ads_sku_daily.ndjson'); ad = nd('ads_daily.ndjson')
state = json.load(open(DD + 'ads_sku_state.json'))
A, B = '2026-10-08', '2026-10-13'
sku_sp = collections.defaultdict(float); camp_sp = collections.defaultdict(float)
for r in asd:
    if A <= r['d'] <= B and str(r['cid']) != CPO: sku_sp[(str(r['cid']), r['d'])] += float(r.get('sp') or 0)
for r in ad:
    if A <= r['d'] <= B and str(r['id']) != CPO: camp_sp[(str(r['id']), r['d'])] += float(r.get('sp') or 0)
print('ads_sku_daily max d', max(r['d'] for r in asd), ' ads_daily max d', max(r['d'] for r in ad))
tot_a = sum(camp_sp.values()); tot_s = sum(sku_sp.values())
print(f'08-13.10 без CPO: ads_daily {tot_a:.0f}, ads_sku_daily {tot_s:.0f}, покрытие {tot_s/tot_a*100:.1f}%')
# по кампаниям: где ads_daily > 0, а ads_sku_daily нет дня
miss = collections.defaultdict(float); missd = collections.defaultdict(list)
for (cid, d), v in camp_sp.items():
    s = sku_sp.get((cid, d), 0)
    if v - s > 50:
        miss[cid] += v - s; missd[cid].append(d)
for cid, v in sorted(miss.items(), key=lambda x: -x[1])[:15]:
    print(cid, 'state', state.get(cid), 'недостаёт', round(v), 'дни', sorted(missd[cid]))
print('всего недостаёт', round(sum(miss.values())))
# дубликаты ключа (cid,d,sku)
cnt = collections.Counter((str(r['cid']), r['d'], str(r['sku'])) for r in asd)
print('строк', len(asd), 'уникальных (cid,d,sku)', len(cnt), 'дублей', sum(v - 1 for v in cnt.values() if v > 1))
# ads_daily дубликаты ключа (id,d)
cnt2 = collections.Counter((str(r['id']), r['d']) for r in ad)
print('ads_daily строк', len(ad), 'уникальных (id,d)', len(cnt2), 'дублей', sum(v - 1 for v in cnt2.values() if v > 1))
# состояние: сколько кампаний обновлено в последнюю ночь
c = collections.Counter(state.values()); print('state по датам (топ):', c.most_common(6))

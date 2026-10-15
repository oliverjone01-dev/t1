# ФЕНИКС iter3 (e063381). Спидометры v6 независимым кодом (не код автора) по правилу брифа / decisions.md 15.10 / спеки v6.
# 1) реклама: факт = ads_daily без 28753239 за 01.10..последний день; план на день = факт дня до 15.10, (план 15.10 + прочие)/7 с 15.10;
#    месяц = сумма плана на день по всем дням октября. Ожидание брифа: fact 453 018, plan 453 018, pre, month 1 265 880.
# 2) карточки «на пути» v6: окно 15.10..min(28.10, последний день заказов), n_in = дней окна в данных, need = порог x n_in / 14.
# 3) второй порядок W6: перерасход x r с 15.10 (дни до 15.10 - факт). По дням 15-31.10: % спидометра и статус по порогам клиента
#    (>100 выше плана, >120 перерасход) против недельного статуса раздела 4 (тот же r). Подушки больше нет, но факт 01-14.10
#    стоит и в числителе, и в знаменателе: перерасход разбавлен.
# python3 -I s3_gauges.py <dataDir>
import json, sys, datetime as dt
DD = sys.argv[1] + '/'
nd = lambda f: [json.loads(l) for l in open(DD + f, encoding='utf-8') if l.strip()]
P = json.load(open(DD + 'plan_2026-10-15_v3.json', encoding='utf-8'))
G = json.load(open(DD + 'card_groups.json', encoding='utf-8'))['groups']
off2sku = {s['offer']: str(s['sku']) for g in G for s in g['skus']}
OUT = {off2sku.get(a, '') for a in P.get('withdrawn', [])}
START, W1, CPO = P['start'], P['window'][1], '28753239'
D = lambda s: dt.date.fromisoformat(s)
rng = lambda a, b: [(D(a) + dt.timedelta(days=k)).isoformat() for k in range((D(b) - D(a)).days + 1)]
cards = []
for c in P['cards']:
    ms = off2sku[c['main_art']]
    g = next(g for g in G if any(str(s['sku']) == ms for s in g['skus']))
    cards.append(dict(c, skus={str(s['sku']) for s in g['skus']} - OUT, mins={off2sku[a] for a in c['min_arts'] if a in off2sku}, ms=ms))
print('пороги (целые?)', [c['threshold'] for c in cards], all(float(c['threshold']).is_integer() for c in cards))
# 2) карточки: день по МСК из t, без отмен, обрывок последнего дня отбрасывается (как правило N1)
rows = nd('orders_daily.ndjson'); raw_last = max(o['d'] for o in rows)
def oday(o):
    if o.get('t'):
        return (dt.datetime.fromisoformat(o['t'].replace('Z', '+00:00')) + dt.timedelta(hours=3)).date().isoformat()
    return o['d']
days = [oday(o) for o in rows]
od_last = max(d for d in days if d <= raw_last)
n_in = 0 if od_last < START else min((D(od_last) - D(START)).days + 1, 14)
hi = min(W1, od_last)
fact = [sum((o.get('units') or 0) for o, d in zip(rows, days) if d <= raw_last and o.get('status') != 'cancelled'
            and START <= d <= hi and str(o['sku']) in c['skus']) for c in cards]
need = [round(c['threshold'] * n_in / 14, 1) for c in cards]
print(f'карточки: OD_LAST {od_last}, n_in {n_in}, факт окна {fact}, нужно {need}, на пути {sum(f >= n for f, n in zip(fact, need)) if n_in else "-"}')
# 1) реклама
ad = [a for a in nd('ads_daily.ndjson')]
camp_last = max(a['d'] for a in ad)
stsp = {}
for a in ad:
    if str(a['id']) == CPO: continue
    stsp[a['d']] = stsp.get(a['d'], 0) + (a.get('sp') or 0)
asd = nd('ads_sku_daily.ndjson')
TO_MIN = {str(k['cid']) for k in P['to_min']}
W0, WE = '2026-10-01', '2026-10-13'
allc = sum(v for d, v in stsp.items() if W0 <= d <= WE)
main_sp = sum(x.get('sp') or 0 for x in asd if W0 <= x['d'] <= WE and str(x['cid']) != CPO and str(x['cid']) not in TO_MIN and any(str(x['sku']) == c['ms'] for c in cards))
min_sp = sum(x.get('sp') or 0 for x in asd if W0 <= x['d'] <= WE and str(x['cid']) != CPO and any(str(x['sku']) in c['mins'] for c in cards))
tomin_sp = sum(x.get('sp') or 0 for x in ad if W0 <= x['d'] <= WE and str(x['id']) in TO_MIN)
plan_wk = sum(c['click_new'] + c['n_min'] * P['min_budget_sku'] for c in cards) + len(P['to_min']) * P['min_campaign_budget']
other_wk = max(0, allc - main_sp - min_sp - tomin_sp) / 13 * 7
rate = (plan_wk + other_wk) / 7
pday = lambda d: stsp.get(d, 0) if d < START else rate
mfrom = camp_last[:8] + '01'
win = [d for d in rng(mfrom, camp_last) if d in stsp]
f_ads = sum(stsp[d] for d in win); p_ads = sum(pday(d) for d in win)
mend = (D(mfrom).replace(day=28) + dt.timedelta(days=4)).replace(day=1) - dt.timedelta(days=1)
month = sum(pday(d) for d in rng(mfrom, mend.isoformat()))
print(f'реклама: последний день {camp_last}, pre {camp_last < START} | факт {round(f_ads)} | план {round(p_ads)} | в неделю {round(plan_wk)} + прочие {round(other_wk)}'
      f' | ставка в день {rate:.1f} | месяц {round(month)} (факт 01-14.10 {round(sum(stsp.get(d, 0) for d in rng(mfrom, "2026-10-14")))} + 17 x ставка)')
# 3) перерасход с 15.10: % спидометра по дням (окно 01.10..N), статус клиента; раздел 4 по неделе - сразу r
f14 = sum(stsp.get(d, 0) for d in rng('2026-10-01', '2026-10-14'))
st = lambda p: 'перерасход' if p > 120 else 'выше плана' if p > 100 else 'в плане'
print(f'перерасход с 15.10 (дни до 15.10 = факт {round(f14)}): % спидометра на последний день рекламы 15..31.10')
for r in (1.1, 1.2, 1.3, 1.4, 1.5, 2.0):
    seq = [(f14 + n * r * rate) / (f14 + n * rate) * 100 for n in range(1, 18)]
    first_mid = next((15 + k for k, p in enumerate(seq) if p > 100), None); first_red = next((15 + k for k, p in enumerate(seq) if p > 120), None)
    print(f'  x{r}: 15.10 {seq[0]:.0f}% | 21.10 {seq[6]:.0f}% | 28.10 {seq[13]:.0f}% | 31.10 {seq[16]:.0f}%'
          f' | жёлтый с {first_mid}.10 | красный с {first_red and str(first_red) + ".10" or "- (в октябре нет)"} | раздел 4 (неделя): {st(r * 100)}')
# граница: какой r краснеет к 28.10 и к 31.10
for N in (14, 17):
    print(f'  на {14 + N}.10 красный только с x{(1.2 * (f14 + N * rate) - f14) / (N * rate):.2f}')

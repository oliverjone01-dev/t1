# ФЕНИКС iter4 @ da0a36b. Проба A1-A3: спидометр «Реклама за месяц» (Иван 15.10) независимым кодом.
# 1) ADS_FULL по смыслу adsFullDay (с 08.10: у каждой кампании с расходом за день дата сбора - 1 >= день и по товарам >= 95%);
# 2) факт = клик главного (sku главного, без CPO и 11 кампаний на минимум) + минимальный клик (sku min_arts, без CPO), окно спидометра;
#    план = сумма (click_new + n_min * min_budget_sku) * дней / 7;
# 3) состав: min_arts пересекаются с выводимыми? доля спидометра в расходе на клики магазина за то же окно;
# 4) второе семейство: начисления «adv» финотчёта (pnl_account_accrual_daily) против ads_daily за те же дни.
# python3 -I v4_ads.py [dataDir]
import json, sys, datetime as dt

DD = (sys.argv[1] if len(sys.argv) > 1 else '/tmp/claude-0/-home-user-t1/67620a7f-7583-5c98-9212-3a5e79611236/scratchpad/data_753bf11/analytics-mvp/data') + '/'
nd = lambda f: [json.loads(l) for l in open(DD + f, encoding='utf-8') if l.strip()]
P = json.load(open(DD + 'plan_2026-10-15_v3.json', encoding='utf-8'))
G = json.load(open(DD + 'card_groups.json', encoding='utf-8'))['groups']
off2sku = {s['offer']: str(s['sku']) for g in G for s in g['skus']}
CPO = '28753239'
TO_MIN = {str(k['cid']) for k in P['to_min']}
asd, ad = nd('ads_sku_daily.ndjson'), nd('ads_daily.ndjson')
state = json.load(open(DD + 'ads_sku_state.json', encoding='utf-8'))
iso = lambda d: d.isoformat()
prev = lambda s: iso(dt.date.fromisoformat(s) - dt.timedelta(days=1))

# 1) ADS_FULL
sku_sp = {}
for a in asd:
    k = (str(a['cid']), a['d']); sku_sp[k] = sku_sp.get(k, 0) + (a.get('sp') or 0)
full = ''
for d in sorted({a['d'] for a in ad if a['d'] >= '2026-10-08'}):
    ok = all(state.get(str(a['id'])) and prev(state[str(a['id'])]) >= d and sku_sp.get((str(a['id']), d), 0) >= 0.95 * a['sp']
             for a in ad if a['d'] == d and (a.get('sp') or 0) > 0 and str(a['id']) != CPO)
    if not ok:
        break
    full = d
print('ADS_FULL', full)

# 2) окно и факт / план
start = P['start']
m1 = full[:8] + '01'
frm, to, pre = (m1, full, True) if full < start else (max(m1, start), full, False)
days = (dt.date.fromisoformat(to) - dt.date.fromisoformat(frm)).days + 1
W = {off2sku[x] for x in P.get('withdrawn', [])}
fact = plan = 0.0
rows = []
for c in P['cards']:
    ms = off2sku[c['main_art']]
    mins = {off2sku[a] for a in c['min_arts']}
    fm = sum(a['sp'] for a in asd if frm <= a['d'] <= to and str(a['cid']) != CPO and str(a['sku']) == ms and str(a['cid']) not in TO_MIN)
    fn = sum(a['sp'] for a in asd if frm <= a['d'] <= to and str(a['cid']) != CPO and str(a['sku']) in mins)
    pl = (c['click_new'] + c['n_min'] * P['min_budget_sku']) * days / 7
    fact += fm + (fn if c['n_min'] else 0); plan += pl
    rows.append((c['short'], round(fm), round(fn), round(pl), len(mins & W)))
print(f'окно {frm}..{to} ({days} дн), до плана: {pre} | факт {round(fact)} | план {round(plan)} | {fact / plan:.1%}')
for r in rows:
    print('  ', r[0], '| клик главного', r[1], '| минимальный', r[2], '| план', r[3], '| min_arts среди выводимых', r[4])

# 3) доля спидометра в расходе на клики магазина (ads_daily без CPO) за то же окно
shop = sum(a['sp'] for a in ad if frm <= a['d'] <= to and str(a['id']) != CPO)
cpo = sum(a['sp'] for a in ad if frm <= a['d'] <= to and str(a['id']) == CPO)
tomin = sum(a['sp'] for a in ad if frm <= a['d'] <= to and str(a['id']) in TO_MIN)
print(f'расход на клики магазина (ads_daily без CPO) {round(shop)}; спидометр {fact / shop:.1%} от него; 11 кампаний на минимум {round(tomin)}; CPO {round(cpo)}')

# 4) второе семейство: финотчёт, категория adv (клик + продвижение), по дням начисления
acc = {r['d']: -r.get('adv', 0) for r in nd('pnl_account_accrual_daily.ndjson')}
fin = sum(v for d, v in acc.items() if frm <= d <= to)
print(f'финотчёт adv за {frm}..{to}: {round(fin)} (дней с данными {sum(1 for d in acc if frm <= d <= to)}); ads_daily все кампании {round(shop + cpo)}; '
      f'отношение {((shop + cpo) / fin) if fin else float("nan"):.3f}')

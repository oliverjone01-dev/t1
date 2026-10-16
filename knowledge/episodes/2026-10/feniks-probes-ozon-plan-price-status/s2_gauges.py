# ФЕНИКС iter2 (3810a26). S2: спидометры «за месяц» независимым кодом (не код автора) + второй порядок.
# 1) карточки: факт 01.10..OD_LAST по правилу спеки v5 (шт без отмен, день по МСК из t, иначе d; товары группы без выводимых),
#    план на день u_wk_base/7 до 15.10, threshold/14 с 15.10; «на пути» = факт >= план.
# 2) реклама: ads_daily без 28753239 за 01.10..последний день; план 15.10 + прочие по темпу 01-13.10;
#    проверка двойного вычета: расход 11 кампаний на товары минимального клика (ads_sku_daily) вычтен и в spmin, и целиком по кампании.
# 3) второе семейство: начисления adv финотчёта против ads_daily (все кампании, вместе с «Оплатой за заказ»).
# 4) подушка до плана: какой перерасход с 15.10 месячный спидометр рекламы показывает зелёным / жёлтым на 28.10 и 31.10;
#    сценарий «эффекта нет» у карточек (окно = 2 x u_wk_base): сколько «на пути» на 28.10 против числа прошедших порог.
# python3 -I s2_gauges.py <dataDir>
import json, sys, datetime as dt, math
DD = sys.argv[1] + '/'
nd = lambda f: [json.loads(l) for l in open(DD + f, encoding='utf-8') if l.strip()]
P = json.load(open(DD + 'plan_2026-10-15_v3.json', encoding='utf-8'))
G = json.load(open(DD + 'card_groups.json', encoding='utf-8'))['groups']
off2sku = {s['offer']: str(s['sku']) for g in G for s in g['skus']}
OUT = {off2sku.get(a, '') for a in P.get('withdrawn', [])}
START, CPO = P['start'], '28753239'
D = lambda s: dt.date.fromisoformat(s)
rng = lambda a, b: [(D(a) + dt.timedelta(days=k)).isoformat() for k in range((D(b) - D(a)).days + 1)]
cards = []
for c in P['cards']:
    ms = off2sku[c['main_art']]
    g = next(g for g in G if any(str(s['sku']) == ms for s in g['skus']))
    cards.append(dict(c, skus={str(s['sku']) for s in g['skus']} - OUT, mins={off2sku[a] for a in c['min_arts'] if a in off2sku}, ms=ms))
# 1) заказы
rows = nd('orders_daily.ndjson'); raw_last = max(o['d'] for o in rows)
def oday(o):
    if o.get('t'):
        t = dt.datetime.fromisoformat(o['t'].replace('Z', '+00:00')) + dt.timedelta(hours=3)
        return t.date().isoformat()
    return o['d']
fact = [0] * len(cards); od_last = ''
for o in rows:
    d = oday(o)
    if d > raw_last: continue
    od_last = max(od_last, d)
    if o.get('status') == 'cancelled' or not d.startswith(od_last[:8] if False else d[:8]): pass
for o in rows:
    d = oday(o)
    if d > raw_last or o.get('status') == 'cancelled' or not ('2026-10-01' <= d <= od_last): continue
    for i, c in enumerate(cards):
        if str(o['sku']) in c['skus']: fact[i] += o.get('units') or 0
pday = lambda c, d: c['u_wk_base'] / 7 if d < START else c['threshold'] / 14
plan = [round(sum(pday(c, d) for d in rng('2026-10-01', od_last)), 1) for c in cards]
month = [round(sum(pday(c, d) for d in rng('2026-10-01', '2026-10-31')), 1) for c in cards]
print('OD_LAST', od_last, '| факт', fact, 'сумма', sum(fact), '| план', plan, 'сумма', round(sum(plan), 1), '| месяц', round(sum(month), 1))
print('на пути', sum(f >= p for f, p in zip(fact, plan)), 'из', len(cards), '| подушка 01-14.10 по карточкам', [round(f - p, 1) for f, p in zip(fact, plan)])
# 2) реклама
ad, asd = nd('ads_daily.ndjson'), nd('ads_sku_daily.ndjson')
TO_MIN = {str(k['cid']) for k in P['to_min']}
camp_last = max(a['d'] for a in ad)
W0, W1 = '2026-10-01', '2026-10-13'
allc = lambda a, b: sum(x.get('sp') or 0 for x in ad if a <= x['d'] <= b and str(x['id']) != CPO)
main_sp = sum(x.get('sp') or 0 for x in asd if W0 <= x['d'] <= W1 and str(x['cid']) != CPO and str(x['cid']) not in TO_MIN and any(str(x['sku']) == c['ms'] for c in cards))
min_sp = sum(x.get('sp') or 0 for x in asd if W0 <= x['d'] <= W1 and str(x['cid']) != CPO and any(str(x['sku']) in c['mins'] for c in cards))
tomin_sp = sum(x.get('sp') or 0 for x in ad if W0 <= x['d'] <= W1 and str(x['id']) in TO_MIN)
dbl = sum(x.get('sp') or 0 for x in asd if W0 <= x['d'] <= W1 and str(x['cid']) in TO_MIN and any(str(x['sku']) in c['mins'] for c in cards))
other = allc(W0, W1) - main_sp - min_sp - tomin_sp
plan_wk = sum(c['click_new'] + c['n_min'] * P['min_budget_sku'] for c in cards) + len(P['to_min']) * P['min_campaign_budget']
other_wk = max(0, other) / 13 * 7
days = len({x['d'] for x in ad if W0 <= x['d'] <= camp_last and str(x['id']) != CPO})
f_ads = allc('2026-10-01', camp_last); p_ads = (plan_wk + other_wk) * days / 7
print(f'реклама: последний день {camp_last}, дней {days} | факт {round(f_ads)} | план {round(p_ads)} | в неделю {round(plan_wk)} + прочие {round(other_wk)} | месяц {round((plan_wk + other_wk) * 31 / 7)}')
print(f'  прочие 01-13.10: все клики {round(allc(W0, W1))} - главные {round(main_sp)} - минимальный {round(min_sp)} - 11 кампаний {round(tomin_sp)} = {round(other)};'
      f' из них 11 кампаний на товары минимального клика (вычтено дважды) {round(dbl)} -> прочие в неделю без двойного вычета {round((other + dbl) / 13 * 7)}')
# 3) второе семейство
acc = {r['d']: -r.get('adv', 0) for r in nd('pnl_account_accrual_daily.ndjson')}
fin = sum(v for d, v in acc.items() if '2026-10-01' <= d <= camp_last)
cpo = sum(x.get('sp') or 0 for x in ad if '2026-10-01' <= x['d'] <= camp_last and str(x['id']) == CPO)
print(f'  финотчёт adv 01.10-{camp_last[8:]}.10: {round(fin)} (дней {sum(1 for d in acc if "2026-10-01" <= d <= camp_last)}) | ads_daily все кампании {round(f_ads + cpo)} (клики {round(f_ads)} + CPO {round(cpo)})')
# 4а) подушка рекламы: месячный % при перерасходе r с 15.10 (остальные дни - по плану в день)
pd_ = (plan_wk + other_wk) / 7; f14 = allc('2026-10-01', '2026-10-14')
for N in (28, 31):
    g = lambda r: (f14 + (N - 14) * r * pd_) / (N * pd_) * 100
    lo = (N * pd_ - f14) / ((N - 14) * pd_); red = (1.2 * N * pd_ - f14) / ((N - 14) * pd_)
    print(f'  {N}.10: перерасход с 15.10 x1,5 -> спидометр {g(1.5):.0f}%; зелёный («в плане») до x{lo:.2f}, красный только с x{red:.2f}')
# 4б) карточки без эффекта: окно 15-28.10 = 2 x u_wk_base (ожидание без эффекта), сколько «на пути» на 28.10 и сколько прошли порог
on28 = sum(f + 2 * c['u_wk_base'] >= p + c['threshold'] for f, p, c in zip(fact, plan, cards))
pas = sum(2 * c['u_wk_base'] >= c['threshold'] for c in cards)
print(f'  без эффекта (окно = 2 x u_wk_base): «на пути» 28.10 {on28} из 10 (спидометр {"зелёный" if on28 >= 5 else "жёлтый" if on28 >= 3.5 else "красный"}), прошли порог {pas} из 10')
print('  карточка | порог | подушка 01-14.10 | «на пути» 28.10, если окно >= порог - подушка:')
for f, p, c in zip(fact, plan, cards):
    print(f'    {c["short"]:<12} {c["threshold"]:>3} {f - p:+5.1f}  окно нужно для «на пути» {c["threshold"] - (f - p):5.1f}, для решения {c["threshold"]}')

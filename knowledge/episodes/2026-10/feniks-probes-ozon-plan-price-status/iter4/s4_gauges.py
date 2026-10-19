# ФЕНИКС iter4 (ba5b560). Спидометры v7 независимым кодом (не код автора) по постановке Ивана 15.10 / decisions.md / спеке v7:
# период 15-31.10 (с ноября - месяц целиком), факт за период по последний день источника, план всего периода, план на дату,
# справочно факт 01-14.10. Ожидание брифа на живых данных: факта нет (last ""), карточки план 170 ref 104, магазин 219,5 ref 151,
# оборот 14,76 млн ref 10,35, реклама 812 862 ref 453 018.
# Плюс проверка источника: дни ads_daily только с «Оплатой за заказ» (тогда последний день рекламы есть, а клика за него нет).
# python3 -I s4_gauges.py <dataDir>
import json, sys, datetime as dt
DD = sys.argv[1] + '/'
nd = lambda f: [json.loads(l) for l in open(DD + f, encoding='utf-8') if l.strip()]
P = json.load(open(DD + 'plan_2026-10-15_v3.json', encoding='utf-8'))
G = json.load(open(DD + 'card_groups.json', encoding='utf-8'))['groups']
off2sku = {s['offer']: str(s['sku']) for g in G for s in g['skus']}
OUT = {off2sku.get(a, '') for a in P.get('withdrawn', [])}
START, CPO = P['start'], '28753239'
D = lambda s: dt.date.fromisoformat(s)
rng = lambda a, b: [(D(a) + dt.timedelta(days=k)).isoformat() for k in range((D(b) - D(a)).days + 1)] if a and b and a <= b else []
gpath = lambda g, d: g['lo'] / 31 * d + (g['mid'] - g['lo']) * max(0, min(15, d - 16)) / 15
cards = []
for c in P['cards']:
    ms = off2sku[c['main_art']]
    g = next(g for g in G if any(str(s['sku']) == ms for s in g['skus']))
    cards.append(dict(c, skus={str(s['sku']) for s in g['skus']} - OUT))
# заказы: день по МСК из t, обрывок после последнего d выгрузки отброшен, без отмен
rows = nd('orders_daily.ndjson'); raw_last = max(o['d'] for o in rows)
def oday(o):
    if o.get('t'):
        return (dt.datetime.fromisoformat(o['t'].replace('Z', '+00:00')) + dt.timedelta(hours=3)).date().isoformat()
    return o['d']
card_d, store_d, rev_d = {}, {}, {}
od_last = ''
for o in rows:
    d = oday(o)
    if d > raw_last: continue
    od_last = max(od_last, d)
    if o.get('status') == 'cancelled': continue
    u = o.get('units') or 0
    store_d[d] = store_d.get(d, 0) + u; rev_d[d] = rev_d.get(d, 0) + (o.get('revenue') or 0)
    if any(str(o['sku']) in c['skus'] for c in cards): card_d[d] = card_d.get(d, 0) + u
ad = nd('ads_daily.ndjson')
sp_d, cpo_only = {}, set()
days_all = {a['d'] for a in ad}; days_click = {a['d'] for a in ad if str(a['id']) != CPO}
for a in ad:
    if str(a['id']) == CPO: continue
    sp_d[a['d']] = sp_d.get(a['d'], 0) + (a.get('sp') or 0)
camp_last = max(days_all)
print(f'источники: заказы по {od_last}, ads_daily по {camp_last}; дни ads_daily только с «Оплатой за заказ»: {sorted(days_all - days_click) or "нет"}')
# ставка рекламы (как s3_gauges.py: план 15.10 + прочие по темпу 01-13.10)
asd = nd('ads_sku_daily.ndjson'); TO_MIN = {str(k['cid']) for k in P['to_min']}
mains = {off2sku[c['main_art']] for c in P['cards']}; mins = {off2sku[a] for c in P['cards'] for a in c['min_arts'] if a in off2sku}
W0, WE = '2026-10-01', '2026-10-13'
allc = sum(v for d, v in sp_d.items() if W0 <= d <= WE)
main_sp = sum(x.get('sp') or 0 for x in asd if W0 <= x['d'] <= WE and str(x['cid']) != CPO and str(x['cid']) not in TO_MIN and str(x['sku']) in mains)
min_sp = sum(x.get('sp') or 0 for x in asd if W0 <= x['d'] <= WE and str(x['cid']) != CPO and str(x['sku']) in mins)
tomin_sp = sum(x.get('sp') or 0 for x in ad if W0 <= x['d'] <= WE and str(x['id']) in TO_MIN)
rate = (sum(c['click_new'] + c['n_min'] * P['min_budget_sku'] for c in P['cards']) + len(P['to_min']) * P['min_campaign_budget']
        + max(0, allc - main_sp - min_sp - tomin_sp) / 13 * 7) / 7
def period(last):
    m1 = last[:8] + '01' if last > START else START[:8] + '01'
    frm = m1 if m1 > START else START
    to = ((D(frm).replace(day=28) + dt.timedelta(days=4)).replace(day=1) - dt.timedelta(days=1)).isoformat()
    return frm, to, (last if last >= frm else '')
U, T = P['goal']['units'], P['goal']['turn_mln']
def store_day(g, d):
    n = int(d[8:10])
    return gpath(g['oct'], n) - gpath(g['oct'], n - 1) if d[5:7] == '10' else g['nov']['mid'] / 30
def gauge(name, last, by_day, plan_day, nd_=0, div=1):
    frm, to, l = period(last)
    fact = round(sum(by_day.get(d, 0) for d in rng(frm, l)) / div, nd_) if l else None
    plan = round(sum(plan_day(d) for d in rng(frm, to)), nd_); ptd = round(sum(plan_day(d) for d in rng(frm, l)), nd_) if l else 0
    ref = round(sum(by_day.get(d, 0) for d in rng('2026-10-01', '2026-10-14')) / div, nd_) if frm == START and last >= '2026-10-14' else None
    print(f'  {name:<20} период {frm}..{to}, last {l or "-"} | факт {fact} | план {plan} | план на дату {ptd} | справочно 01-14.10 {ref}')
print('спидометры v7 на живых данных:')
gauge('Заказы 10 карточек', od_last, card_d, lambda d: sum(c['threshold'] / 14 for c in P['cards']), 1)
gauge('Заказы магазина', od_last, store_d, lambda d: store_day(U, d), 1)
gauge('Оборот магазина, млн', od_last, rev_d, lambda d: store_day(T, d), 2, 1e6)
gauge('Реклама, все клики', camp_last, sp_d, lambda d: rate, 0)
print(f'  ставка рекламы в день {rate:.1f}; 17 дней = {17 * rate:.0f}; цель октября: шт {U["oct"]}, оборот {T["oct"]}')

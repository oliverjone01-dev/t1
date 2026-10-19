#!/usr/bin/env python3
"""Максимальная ставка буста по SKU с учётом всех расходов, в том числе АДМ и налога. Только чтение.

Запуск: python3 -I max-stavka.py <корень репо> [мин. штук = 3] [дата с = 2026-07-01] [json для прототипа]
Метрика (спека), по доставленным и не возвращённым заказам, созданным с <дата с> по 15.10, проводки по номеру заказа из реестра:
  цена карточки     = orders.price (цена до скидки Маркета, с неё считается буст)
  Начислено         = платёж покупателя деньгами за товар и доставку                      [Начисление «Платёж покупателя», минус возвраты]
  баллы скидки      = баллы за скидку Маркета и Плюс                                       [Начисление «Баллы ...»]
  сборы деньгами    = удержания: размещение, приём и перевод платежа, доставка Маркета, буст, штрафы и прочее   [Удержание]
  списано баллами   = те же услуги баллами                                                 [Списание]
  К выплате         = Начислено - сборы деньгами (как в «Отчёте» и на «Деньгах»)
  С/С               = sku_cogs x шт; наша доставка = ведомость перевозчика (pnl ship / units по SKU за период, оценка)
  АДМ               = 30% от К выплате; налог = 15% от Начислено   (ставки «Отчёта» Маркета, ACC_RATE, решение 02.10)
  чистая по «Отчёту» = К выплате - С/С - наша доставка - АДМ - налог   (буст и размещение баллами справочно, как в «Отчёте»)
  чистая с баллами   = чистая по «Отчёту» - буст баллами              (решение v18: расход на рекламу = деньги + баллы)
  МАКС. СТАВКА в ноль = (чистая + буст) / цена карточки, по каждой из двух баз
Чего в данных нет: упаковка, возвраты после периода. Каждые 1 000 ₽ на заказ = минус 1 000 / цена карточки.
Проверка (две семьи): деньгами по реестру (Начислено - удержания) = paid - fee_total из API заказов по всем позициям заказа.
"""
import json, sys, collections, statistics
root = sys.argv[1]; MINU = int(sys.argv[2]) if len(sys.argv) > 2 else 3; D0 = sys.argv[3] if len(sys.argv) > 3 else '2026-07-01'; D1 = '2026-10-15'
OUT = sys.argv[4] if len(sys.argv) > 4 else None
ADM, TAX = 0.30, 0.15
D = f'{root}/analytics-mvp/data-ym/'
rd = lambda f: [json.loads(l) for l in open(D + f, encoding='utf-8') if l.strip()]
net = rd('netting.ndjson'); orders = rd('orders.ndjson'); cogs = json.load(open(D + 'sku_cogs.json')); cat = json.load(open(D + 'catalog.json'))['items']
pnl = [r for r in rd('pnl_sku_netting_daily.ndjson') if r['basis'] == 'netting' and D0 <= r['d'] <= D1]
CAB = {'1023124': 'зеркала', '74986385': 'мебель'}
def grp(svc):
    s = svc.lower()
    if s.startswith('буст'): return 'boost'
    if s.startswith('размещение'): return 'place'
    if 'платеж' in s or 'платёж' in s: return 'pay'
    if 'доставка' in s or 'миля' in s: return 'dlv'
    if 'не вовремя' in s or 'штраф' in s or 'отмен' in s: return 'fine'
    return 'other'
GR = ('place', 'pay', 'dlv', 'boost', 'fine', 'other')
L = collections.defaultdict(lambda: collections.defaultdict(float))   # заказ -> статьи, знак реестра (минус = ушло)
for r in net:
    t = L[r['order']]; a = r['amount']
    if r['type'] == 'Начисление':
        if r['src'] == 'Платёж покупателя': t['money_in'] += a
        elif 'Баллы' in r['src']: t['pts_in'] += a
        else: t['other_in'] += a
    elif r['type'] == 'Возврат':
        if 'баллов' in r['src'].lower(): t['pts_in'] += a
        else: t['money_in'] += a
    elif r['type'] in ('Удержание', 'Списание', 'Возврат списания'):
        t[('m_' if r['type'] == 'Удержание' else 'p_') + grp(r['service'])] += a
dl = [r for r in orders if not r['service'] and not r.get('fake') and r['status'] == 'DELIVERED' and not r['returned'] and D0 <= r['created'] <= D1]
api_cash = collections.defaultdict(float)
for r in orders:
    if not r.get('fake'): api_cash[r['order']] += (r['paid'] or 0) - (r['fee_total'] or 0)
mism = []; gaps = []
for r in dl:
    t = L.get(r['order'])
    if not t: mism.append((r['order'], 'нет проводок')); continue
    cash = t['money_in'] + sum(t['m_' + g] for g in GR); api = api_cash[r['order']]
    if abs(cash - api) > 2: mism.append((r['order'], round(cash), round(api)))
    gaps.append(cash - api)
ok = len(dl) - len(mism); gap_med = statistics.median(gaps) if gaps else 0
ship = collections.defaultdict(lambda: [0.0, 0.0, 0, 0])
for r in pnl: s = ship[r['sku']]; s[0] += r['ship'] or 0; s[1] += r['units'] or 0; s[2] += r['shipn'] or 0; s[3] += r['shipk'] or 0
S = collections.defaultdict(lambda: collections.defaultdict(float)); names = {}
for r in dl:
    t = L.get(r['order'])
    if not t: continue
    s = S[r['sku']]; s['n'] += 1; s['u'] += r['count']; s['price'] += r['price'] * r['count']; s['business'] = r['business']; names[r['sku']] = r['name']
    for k, v in t.items(): s[k] += v
rows = []
for sku, s in S.items():
    if s['u'] < 1: continue
    u = s['u']; price = s['price'] / u; cg = cogs.get(sku); sh = ship[sku]; shp = (sh[0] / sh[1]) if sh[1] > 0 else 0.0
    m = {g: -s['m_' + g] / u for g in GR}; p = {g: -s['p_' + g] / u for g in GR}
    acc = s['money_in'] / u; fees = sum(m.values()); payout = acc - fees
    adm = ADM * payout; tax = TAX * acc
    net_rep = payout - (cg or 0) - shp - adm - tax
    net_pts = net_rep - p['boost']
    boost_m, boost_p = m['boost'], p['boost']
    r = dict(sku=sku, name=names.get(sku, ''), cab=CAB.get(s['business'], '?'), n=s['n'], u=u, price=price, cat=cat.get(sku, {}).get('price'),
             acc=acc, pts_in=s['pts_in'] / u, m=m, p=p, fees=fees, payout=payout, cogs=cg, ship=shp, shipflag=sh[3] < sh[2], adm=adm, tax=tax,
             net_rep=net_rep, net_pts=net_pts, boost_m=boost_m, boost_p=boost_p, boost=boost_m + boost_p,
             cur=100 * (boost_m + boost_p) / price, max_rep=100 * (net_rep + boost_m) / price, max_pts=100 * (net_pts + boost_m + boost_p) / price)
    rows.append(r)
rows.sort(key=lambda r: -r['boost'] * r['u'])
if OUT:
    json.dump(dict(period=[D0, D1], adm=ADM, tax=TAX, check=dict(ok=ok, total=len(dl), gap_med=gap_med, mism=mism[:10]), rows=rows), open(OUT, 'w'), ensure_ascii=False)
f0 = lambda x: '-' if x is None else f'{x:,.0f}'.replace(',', ' ')
print(f'## Максимальная ставка буста по SKU с учётом расходов, АДМ {ADM:.0%} и налога {TAX:.0%}: доставленные заказы, созданы {D0}..{D1}, на 1 штуку, SKU с {MINU}+ штук')
print(f'Проверка (две семьи): деньгами по реестру = paid минус fee_total из API заказов по всем позициям (допуск 2 ₽) у {ok} из {len(dl)} заказов, медиана расхождения {gap_med:+.2f} ₽; не сошлись: {mism[:7]}. Все цифры [ДАННЫЕ], макс. ставка [РАСЧЁТ].\n')
print('кабинет | SKU | заказов | штук | цена карточки (сейчас) | Начислено деньгами | баллы скидки | сборы деньгами: размещение | платёж | доставка Маркета | буст | прочее | К выплате | С/С | наша доставка | АДМ 30% | налог 15% | чистая по «Отчёту» | буст баллами | размещение баллами | чистая с бустом баллами | ставка факт (деньги+баллы) | МАКС. в ноль по «Отчёту» | МАКС. в ноль с баллами')
print('|'.join(['---'] * 24))
for r in [x for x in rows if x['u'] >= MINU][:30]:
    m, p = r['m'], r['p']
    print(f"{r['cab']} | {r['sku']} | {r['n']:.0f} | {r['u']:.0f} | {f0(r['price'])} ({f0(r['cat'])}) | {f0(r['acc'])} | {f0(r['pts_in'])} | {f0(m['place'])} | {f0(m['pay'])} | {f0(m['dlv'])} | {f0(m['boost'])} | {f0(m['fine'] + m['other'])} | {f0(r['payout'])} | {f0(r['cogs'])}{'' if r['cogs'] else ' (нет)'} | {f0(r['ship'])}{' (занижена)' if r['shipflag'] else ''} | {f0(r['adm'])} | {f0(r['tax'])} | {f0(r['net_rep'])} | {f0(p['boost'])} | {f0(p['place'])} | {f0(r['net_pts'])} | {r['cur']:.1f}% | {r['max_rep']:.1f}% | {r['max_pts']:.1f}%")
print('\nКак читать: «чистая по «Отчёту»» считается как на вкладке «Отчет» Маркета: К выплате минус С/С, наша доставка, АДМ 30% от К выплате и налог 15% от Начислено; буст и размещение баллами там справочно. «Чистая с бустом баллами» дополнительно вычитает буст баллами (решение v18: расход на рекламу = деньги + баллы). «Макс. в ноль» - списанная ставка, при которой чистая по соответствующей базе равна нулю. Списывают уровень конкурента, не потолок.')

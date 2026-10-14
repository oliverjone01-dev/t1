# Разбор падения заказов OZON: март-июнь против июль-сентябрь (задача Ивана 14.10).
# Только чтение analytics-mvp/data. Запуск: python3 -I razbor.py [путь_к_data] > razbor_out.txt
# Определения (спека в шапке вывода):
#   заказ = строка orders_daily со status != cancelled, дата = d (дата заказа), шт = units;
#   показы/поиск/карточка/корзина = sku_views (views, vsearch, pdp, cart), сумма по SKU = daily_totals (проверяется);
#   наша цена = revenue/units заказа (price продавца в отправлении);
#   цена витрины = paid/units (customer_price из финансовых данных = что заплатил покупатель);
#   разрыв (доплата OZON) = 1 - sum(paid)/sum(revenue) по заказам с paid;
#   зеркала = sku_taxonomy.category == "Зеркала", иначе по линии sku_views (зеркала/NOLVIS/OSOLIS), остальное = мебель.
import json, sys, os, math, collections, datetime as dt
import numpy as np

D = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../../../../analytics-mvp/data')
P = lambda f: os.path.join(D, f)
def nd(f):
    with open(P(f)) as fh:
        for l in fh:
            l = l.strip()
            if l: yield json.loads(l)

MONTHS = ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']
BEFORE = MONTHS[:4]; AFTER = MONTHS[4:7]
OCT_END = '2026-10-11'  # общий последний день sku_views и orders (orders до 10-12, sku_views до 10-11)
CATS = ['зеркала', 'мебель']
def mon(d): return d[:7]
def inwin(d): return '2026-03-01' <= d <= OCT_END
def days_in(m):
    if m == '2026-10': return 11
    y, mm = map(int, m.split('-')); nx = dt.date(y + (mm == 12), mm % 12 + 1, 1)
    return (nx - dt.date(y, mm, 1)).days
def pct(x): return '-' if x is None else f'{100*x:.1f}%'
def f0(x): return '-' if x is None else f'{x:,.0f}'.replace(',', ' ')
def safe(a, b): return None if not b else a / b
def out(*a): print(*a)

# ---------- категория ----------
tax = json.load(open(P('sku_taxonomy.json')))
line_of, name_of = {}, {}
for r in nd('sku_views.ndjson'):
    line_of[r['sku']] = r['line']; name_of[r['sku']] = r['name']
def cat(sku):
    t = tax.get(sku)
    if t: return 'зеркала' if t['category'] == 'Зеркала' else 'мебель'
    ln = line_of.get(sku)
    if ln in ('зеркала', 'NOLVIS', 'OSOLIS'): return 'зеркала'
    if 'Зеркал' in name_of.get(sku, ''): return 'зеркала'
    return 'мебель'
def model(sku):
    t = tax.get(sku)
    return t['model'] if t else (name_of.get(sku, sku)[:40])

# ---------- загрузка ----------
orders = list(nd('orders_daily.ndjson'))
ok = [o for o in orders if o['status'] != 'cancelled' and inwin(o['d'])]
canc = [o for o in orders if o['status'] == 'cancelled' and inwin(o['d'])]
views = [r for r in nd('sku_views.ndjson') if inwin(r['date'])]
totals = {r['date']: r for r in nd('daily_totals.ndjson')}

out('=== 0. Проверки данных (probe + инварианты) ===')
assert len({o['order'] for o in orders}) == len(orders), 'дубли order'
s = collections.defaultdict(lambda: [0] * 5)
for r in views:
    x = s[r['date']]; x[0] += r['views']; x[1] += r['vsearch']; x[2] += r['pdp']; x[3] += r['cart']; x[4] += r['units']
for j, (nm, kk) in enumerate((('показы', 'views'), ('поиск', 'views_search'), ('карточка', 'pdp_views'), ('корзина', 'to_cart'), ('шт', 'units'))):
    bad = [d for d in s if d in totals and abs(s[d][j] - totals[d][kk]) > 0.02 * max(1, totals[d][kk])]
    out(f'sku_views сумма по SKU против daily_totals, {nm}: дней {len(s)}, расхождение >2% в {len(bad)} дн.' + (f' ({bad[0]}..{bad[-1]})' if bad else ''))
miss = [d for d in (dt.date(2026, 3, 1) + dt.timedelta(i) for i in range(225)) if d.isoformat() <= OCT_END and d.isoformat() not in s]
out('дней без sku_views в окне 03-01..10-11:', len(miss), [d.isoformat() for d in miss[:5]])
out(f'заказы: всего строк {len(orders)}, в окне без отмен {len(ok)}, отмен {len(canc)}; paid пусто у {sum(o["paid"] is None for o in ok)} заказов без отмен')
nt = sum(1 for o in ok if o['sku'] not in tax)
out(f'SKU заказов вне sku_taxonomy: {nt} заказов (категория по линии/названию)')
out('октябрь = 01-11 (неполный, 11 дн.), сравнение по дням через "в день"')

# ---------- 1. воронка ----------
out('\n=== 1. Воронка по месяцам (sku_views + orders_daily без отмен) ===')
F = collections.defaultdict(lambda: collections.Counter())
for r in views:
    for c in (cat(r['sku']), 'все'):
        k = (mon(r['date']), c); F[k]['v'] += r['views']; F[k]['vs'] += r['vsearch']; F[k]['pdp'] += r['pdp']; F[k]['cart'] += r['cart']; F[k]['au'] += r['units']; F[k]['canc_a'] += r['canc']
for o in ok:
    for c in (cat(o['sku']), 'все'):
        k = (mon(o['d']), c); F[k]['u'] += o['units']; F[k]['n'] += 1
for o in canc:
    for c in (cat(o['sku']), 'все'):
        F[(mon(o['d']), c)]['cn'] += 1
FUN = {}
for d, t in totals.items():
    if inwin(d):
        k = (mon(d), 'все_итоги'); F[k]['v'] += t['views']; F[k]['vs'] += t['views_search']; F[k]['pdp'] += t['pdp_views']; F[k]['cart'] += t['to_cart']
for m in MONTHS: F[(m, 'все_итоги')]['u'] = F[(m, 'все')]['u']
out('все_итоги = daily_totals (дедуп. как в кабинете; карточка = уникальные посещения за день). все/зеркала/мебель = сумма sku_views по SKU:')
out('  в sku_views "карточка" = сумма сессий по SKU, примерно 2.0-2.1x от итога за день (отношение стабильно по месяцам); показы 13.05-17.06 недобраны на 3-10% (сверка в разделе 0)')
for c in ['все_итоги', 'все'] + CATS:
    out(f'\n-- {c} --')
    out('мес      дн  показы/д  поиск/д  карточ/д корз/д шт/д | CTR карт/показ  корз/карт  шт/корз  шт/карт  шт на 1000 пок | доля поиска')
    for m in MONTHS:
        x = F[(m, c)]; n = days_in(m)
        FUN[(m, c)] = x
        out(f'{m} {n:3d} {x["v"]/n:9.0f} {x["vs"]/n:8.0f} {x["pdp"]/n:8.0f} {x["cart"]/n:6.1f} {x["u"]/n:5.2f} | {pct(safe(x["pdp"],x["v"])):>8} {pct(safe(x["cart"],x["pdp"])):>9} {pct(safe(x["u"],x["cart"])):>8} {pct(safe(x["u"],x["pdp"])):>7} {1000*safe(x["u"],x["v"]):8.3f} | {pct(safe(x["vs"],x["v"]))}')
    # разложение: шт/день = показы/д * карт/показ * корз/карт * шт/корз
    def agg(ms):
        t = collections.Counter(); n = 0
        for m in ms: t.update(FUN[(m, c)]); n += days_in(m)
        return t, n
    b, nb = agg(BEFORE); a, na = agg(AFTER)
    steps = [('показы/день', b['v'] / nb, a['v'] / na), ('карточка/показ', b['pdp'] / b['v'], a['pdp'] / a['v']),
             ('корзина/карточка', b['cart'] / b['pdp'], a['cart'] / a['pdp']), ('шт/корзина', b['u'] / b['cart'], a['u'] / a['cart'])]
    tot = math.log((a['u'] / na) / (b['u'] / nb))
    out(f'разложение мар-июн -> июл-сен: шт/день {b["u"]/nb:.2f} -> {a["u"]/na:.2f} ({100*(math.exp(tot)-1):+.0f}%), лог-вклад шагов:')
    for nm, x0, x1 in steps:
        l = math.log(x1 / x0)
        out(f'   {nm:18s} {x0:.4g} -> {x1:.4g}  {100*(x1/x0-1):+.0f}%   доля падения {100*l/tot:5.0f}%')
    out(f'   доля поиска в показах {pct(b["vs"]/b["v"])} -> {pct(a["vs"]/a["v"])}; показы в поиске/день {b["vs"]/nb:.0f} -> {a["vs"]/na:.0f} ({100*((a["vs"]/na)/(b["vs"]/nb)-1):+.0f}%)')

# ---------- 2. цена ----------
out('\n=== 2. Цена по месяцам (заказы без отмен с paid) ===')
out('мес     кат      шт  наша цена/шт  витрина/шт  разрыв  чек витр/заказ  чек наш/заказ')
PR = {}
for c in ['все'] + CATS:
    for m in MONTHS:
        os_ = [o for o in ok if mon(o['d']) == m and (c == 'все' or cat(o['sku']) == c) and o['paid'] is not None]
        u = sum(o['units'] for o in os_); rv = sum(o['revenue'] for o in os_); pd = sum(o['paid'] for o in os_)
        PR[(m, c)] = (u, rv, pd, len(os_))
        if u: out(f'{m} {c:7s} {u:5d} {rv/u:12,.0f} {pd/u:11,.0f} {pct(1-pd/rv):>7} {pd/len(os_):14,.0f} {rv/len(os_):14,.0f}'.replace(',', ' '))
# like-for-like: SKU, проданные в обоих периодах
out('\nСопоставимые SKU (продавались и в мар-июн, и в июл-сен): медиана отношения цены за шт после/до')
def unit_prices(ms, c):
    d = collections.defaultdict(lambda: [0, 0, 0])
    for o in ok:
        if mon(o['d']) in ms and o['paid'] is not None and (c == 'все' or cat(o['sku']) == c):
            x = d[o['sku']]; x[0] += o['units']; x[1] += o['revenue']; x[2] += o['paid']
    return d
for c in ['все'] + CATS:
    b = unit_prices(BEFORE, c); a = unit_prices(AFTER, c)
    com = [k for k in b if k in a]
    rs = np.array([(a[k][1] / a[k][0]) / (b[k][1] / b[k][0]) for k in com]); rp = np.array([(a[k][2] / a[k][0]) / (b[k][2] / b[k][0]) for k in com])
    w = np.array([b[k][0] + a[k][0] for k in com])
    ub = sum(b[k][0] for k in com); ua = sum(a[k][0] for k in com)
    if len(com):
        out(f'  {c:7s} n SKU={len(com)} (шт до {ub}, после {ua}); наша цена: медиана {100*(np.median(rs)-1):+.1f}% [Q1 {100*(np.percentile(rs,25)-1):+.1f}%, Q3 {100*(np.percentile(rs,75)-1):+.1f}%], взвеш. {100*(np.exp(np.average(np.log(rs),weights=w))-1):+.1f}%, выросла у {int((rs>1.03).sum())}, упала у {int((rs<0.97).sum())}; витрина: медиана {100*(np.median(rp)-1):+.1f}% [Q1 {100*(np.percentile(rp,25)-1):+.1f}%, Q3 {100*(np.percentile(rp,75)-1):+.1f}%], взвеш. {100*(np.exp(np.average(np.log(rp),weights=w))-1):+.1f}%')
    tb = sum(v[0] for v in b.values()); ta = sum(v[0] for v in a.values())
    out(f'          шт с paid всего до {tb}, после {ta}; доля шт сопоставимых SKU: до {pct(ub/tb) if tb else "-"}, после {pct(ua/ta) if ta else "-"}')
# микс по ценовым корзинам витрины
out('\nМикс: доля шт по цене витрины за шт (все категории)')
bands = [(0, 15000), (15000, 30000), (30000, 60000), (60000, 10**9)]
out('мес      ' + '  '.join(f'{lo//1000}-{(hi//1000 if hi<10**8 else "")}K' for lo, hi in bands) + '   шт/день по корзинам')
for m in MONTHS:
    os_ = [o for o in ok if mon(o['d']) == m and o['paid'] is not None]
    u = sum(o['units'] for o in os_); cnt = []
    for lo, hi in bands: cnt.append(sum(o['units'] for o in os_ if lo <= o['paid'] / o['units'] < hi))
    out(f'{m}  ' + '  '.join(f'{pct(x/u):>7}' for x in cnt) + '   ' + ' '.join(f'{x/days_in(m):5.2f}' for x in cnt))

# цена витрины по всем карточкам панели (не только проданным), coinv_daily, сопоставимые арт
out('\nЦена витрины по всей панели (coinv_daily, observed, арт. с данными во всех месяцах): медиана индекса к июню (12-30.06)')
CV = collections.defaultdict(lambda: collections.defaultdict(list)); art_sku = {}
cv_rows = []
for r in nd('coinv_daily.ndjson'):
    art_sku[r['art']] = r['sku']
    if r.get('observed') and r.get('site_listed'):
        CV[r['art']][mon(r['date'])].append(r['site_listed']); cv_rows.append(r)
ms_cv = ['2026-06', '2026-07', '2026-08', '2026-09']
for c in ['все'] + CATS:
    arts = [a for a in CV if all(CV[a][m] for m in ms_cv) and (c == 'все' or cat(art_sku[a]) == c)]
    row = []
    for m in ms_cv:
        r_ = np.array([np.median(CV[a][m]) / np.median(CV[a]['2026-06']) for a in arts]); row.append(f'{m}: {100*(np.median(r_)-1):+.1f}% [Q1 {100*(np.percentile(r_,25)-1):+.1f}, Q3 {100*(np.percentile(r_,75)-1):+.1f}]')
    out(f'  {c:7s} n арт={len(arts)}  ' + '; '.join(row[1:]))
out('Доплата OZON из coinv_daily (coinv_listed_pct) НЕ используется: база cap заморожена на 09.09 (cap_source=frozen_2026-09-09), сравнение по месяцам ложное. Разрыв считается по заказам (выше).')
out('prices_daily (с 19.09) для истории нашей цены не используется: ряд короткий, в первые дни поле price скачет (B-100-150-9003: 34 379 -> 51 813 за 4 дня), смысл не проверен.')

# ---------- 3. панель SKU x неделя ----------
out('\n=== 3. Показы и цена: панель SKU x неделя (окно 15.06-20.09, 14 полных недель, coinv_daily observed) ===')
def wk(d): x = dt.date.fromisoformat(d); return (x - dt.timedelta(x.weekday())).isoformat()
W0, W1 = '2026-06-15', '2026-09-21'  # понедельники; последняя неделя 21-27.09 неполная по цене (coinv до 24.09) - исключена
pw = collections.defaultdict(list)
for r in cv_rows:
    w = wk(r['date'])
    if W0 <= w < W1: pw[(r['sku'], w)].append(math.log(r['site_listed']))
vw = collections.defaultdict(lambda: [0, 0, 0])
for r in views:
    w = wk(r['date'])
    if W0 <= w < W1: x = vw[(r['sku'], w)]; x[0] += r['views']; x[1] += r['pdp']; x[2] += r['vsearch']
uw = collections.Counter()
for o in ok:
    w = wk(o['d'])
    if W0 <= w < W1: uw[(o['sku'], w)] += o['units']
pos = collections.defaultdict(list)
for r in nd('funnel_sku_daily.ndjson'):
    w = wk(r['date'])
    if W0 <= w < W1 and r.get('search_position'): pos[(r['sku'], w)].append(r['search_position'])
rows = []
for (sku, w), lp in pw.items():
    if len(lp) >= 3:
        v = vw.get((sku, w), [0, 0, 0])
        rows.append(dict(sku=sku, w=w, lp=float(np.mean(lp)), v=v[0], pdp=v[1], vs=v[2], u=uw.get((sku, w), 0), cat=cat(sku),
                         pos=float(np.median(pos[(sku, w)])) if pos.get((sku, w)) else None))
weeks = sorted({r['w'] for r in rows}); skus = sorted({r['sku'] for r in rows})
out(f'строк SKU-неделя {len(rows)}, SKU {len(skus)}, недель {len(weeks)} ({weeks[0]}..{weeks[-1]}); с показами >0: {sum(r["v"]>0 for r in rows)}; с заказами: {sum(r["u"]>0 for r in rows)}')

def twfe(rs, ycol, rng, nboot=300):
    # y_it = b*logP_it + a_i + g_t ; демининг чередованием; кластерный бутстрап по SKU
    def fit(sel):
        y = np.array([r[ycol] for r in sel]); x = np.array([r['lp'] for r in sel])
        si = np.array([r['_i'] for r in sel]); ti = np.array([r['_t'] for r in sel])
        for _ in range(30):
            for g in (si, ti):
                cnt = np.bincount(g); cnt[cnt == 0] = 1
                y = y - (np.bincount(g, y) / cnt)[g]; x = x - (np.bincount(g, x) / cnt)[g]
        return float((x * y).sum() / (x * x).sum()) if (x * x).sum() > 1e-9 else float('nan')
    idx = {s: i for i, s in enumerate(sorted({r['sku'] for r in rs}))}; tix = {w: i for i, w in enumerate(weeks)}
    for r in rs: r['_i'] = idx[r['sku']]; r['_t'] = tix[r['w']]
    b = fit(rs)
    by = collections.defaultdict(list)
    for r in rs: by[r['sku']].append(r)
    keys = list(by); bs = []
    for _ in range(nboot):
        pick = rng.choice(len(keys), len(keys)); sel = []
        for j, k in enumerate(pick):
            for r in by[keys[k]]: sel.append(dict(r, _i=j))
        bs.append(fit(sel))
    bs = np.array(bs); bs = bs[~np.isnan(bs)]
    return b, np.percentile(bs, 2.5), np.percentile(bs, 97.5), len(keys), len(rs)
rng = np.random.default_rng(14)
for r in rows: r['lv'] = math.log(r['v'] + 1); r['lpdp'] = math.log(r['pdp'] + 1); r['lu'] = math.log(r['u'] + 1); r['lpos'] = math.log(r['pos']) if r['pos'] else None
# только SKU, у которых цена реально менялась (размах > 3%), и показы есть хотя бы в половине недель
rng_p = collections.defaultdict(list)
for r in rows: rng_p[r['sku']].append(r)
mov = {s for s, rs in rng_p.items() if max(x['lp'] for x in rs) - min(x['lp'] for x in rs) > 0.03 and sum(x['v'] > 0 for x in rs) >= len(rs) / 2}
out(f'SKU с размахом цены витрины >3% за окно и показами в >=половине недель: {len(mov)}')
out('Эластичность (лог-лог, фикс. эффекты SKU и недели: недельные распродажи и общие сдвиги OZON сняты), 95% ДИ кластерный бутстрап по SKU, 300 повторов:')
for c in ['все'] + CATS:
    sel = [r for r in rows if r['sku'] in mov and (c == 'все' or r['cat'] == c)]
    for yc, nm in (('lv', 'показы'), ('lpdp', 'заходы в карточку'), ('lu', 'заказы шт (log(1+шт))')):
        b, lo, hi, n_s, n = twfe(sel, yc, rng)
        out(f'  {c:7s} {nm:24s} b={b:+.2f}  ДИ [{lo:+.2f}; {hi:+.2f}]  n SKU={n_s}, SKU-недель={n}')
    selp = [dict(r, lpos=r['lpos']) for r in sel if r['lpos'] is not None]
    b, lo, hi, n_s, n = twfe([dict(r) for r in selp], 'lpos', rng)
    out(f'  {c:7s} {"позиция в поиске (лог)":24s} b={b:+.2f}  ДИ [{lo:+.2f}; {hi:+.2f}]  n SKU={n_s}, SKU-недель={n}  (плюс = позиция хуже)')

# Пуассон с фикс. эффектами SKU и недели (PPML): y ~ exp(a_i + g_t + b*logP); b = эластичность в процентах
def ppml(rs, ycol, rng, nboot=200):
    def fit(i_, t_, x, y):
        ni, nt = i_.max() + 1, t_.max() + 1
        b = 0.0; a = np.zeros(ni); g = np.zeros(nt)
        for _ in range(200):
            for __ in range(3):
                e = np.exp(g[t_] + b * x); a = np.log(np.maximum(np.bincount(i_, y, ni), 1e-12) / np.bincount(i_, e, ni))
                e = np.exp(a[i_] + b * x); g = np.log(np.maximum(np.bincount(t_, y, nt), 1e-12) / np.maximum(np.bincount(t_, e, nt), 1e-12))
            mu = np.exp(a[i_] + g[t_] + b * x)
            # шаг Ньютона по b с учётом демининга x внутри SKU (приближение)
            xm = x - (np.bincount(i_, mu * x, ni) / np.maximum(np.bincount(i_, mu, ni), 1e-12))[i_]
            step = (xm * (y - mu)).sum() / max((mu * xm * xm).sum(), 1e-12)
            b += step
            if abs(step) < 1e-6: break
        return b
    keep = collections.defaultdict(float)
    for r in rs: keep[r['sku']] += r[ycol]
    rs = [r for r in rs if keep[r['sku']] > 0]
    sk = sorted({r['sku'] for r in rs}); idx = {s: i for i, s in enumerate(sk)}; tix = {w: i for i, w in enumerate(weeks)}
    by = collections.defaultdict(list)
    for r in rs: by[r['sku']].append(r)
    def arr(groups):
        i_, t_, x, y = [], [], [], []
        for j, k in enumerate(groups):
            for r in by[k]: i_.append(j); t_.append(tix[r['w']]); x.append(r['lp'] - med_lp0[k]); y.append(r[ycol])
        return np.array(i_), np.array(t_), np.array(x), np.array(y, float)
    b = fit(*arr(sk))
    bs = [fit(*arr([sk[k] for k in rng.choice(len(sk), len(sk))])) for _ in range(nboot)]
    return b, np.percentile(bs, 2.5), np.percentile(bs, 97.5), len(sk), len(rs)
med_lp0 = {s: float(np.median([x['lp'] for x in rr])) for s, rr in rng_p.items()}
out('Пуассон с фикс. эффектами SKU и недели (эластичность в %: +1% цены витрины -> b% показов/заказов), 95% ДИ бутстрап по SKU, 200 повторов:')
for c in ['все'] + CATS:
    sel = [r for r in rows if r['sku'] in mov and (c == 'все' or r['cat'] == c)]
    for yc, nm in (('v', 'показы'), ('vs', 'показы в поиске'), ('pdp', 'заходы в карточку'), ('u', 'заказы шт')):
        b, lo, hi, n_s, n = ppml(sel, yc, rng)
        out(f'  {c:7s} {nm:18s} b={b:+.2f}  ДИ [{lo:+.2f}; {hi:+.2f}]  n SKU={n_s}, SKU-недель={n}')

vol = collections.Counter()
for r in rows: vol[r['sku']] += r['v']
top20 = {k for k, _ in vol.most_common(20)}
sel = [r for r in rows if r['sku'] in mov and r['sku'] not in top20]
for yc, nm in (('v', 'показы'), ('u', 'заказы шт')):
    b, lo, hi, n_s, n = ppml(sel, yc, rng)
    out(f'  проверка: без топ-20 SKU по показам, {nm:10s} b={b:+.2f}  ДИ [{lo:+.2f}; {hi:+.2f}]  n SKU={n_s}')
for half, ws_ in (('15.06-26.07', weeks[:6]), ('27.07-20.09', weeks[6:])):
    sel = [r for r in rows if r['sku'] in mov and r['w'] in ws_]
    for yc, nm in (('v', 'показы'), ('u', 'заказы шт')):
        b, lo, hi, n_s, n = ppml(sel, yc, rng)
        out(f'  проверка: только {half}, {nm:10s} b={b:+.2f}  ДИ [{lo:+.2f}; {hi:+.2f}]  n SKU={n_s}')

# событийный разбор: недельный шаг цены -> изменение показов против SKU без изменения цены в ту же неделю
out('\nШаг цены витрины неделя к неделе -> изменение показов (минус медиана SKU без изменения цены той же недели):')
byS = collections.defaultdict(dict)
for r in rows: byS[r['sku']][r['w']] = r
steps = []
for s, d in byS.items():
    ws = sorted(d)
    for w0, w1 in zip(ws, ws[1:]):
        if (dt.date.fromisoformat(w1) - dt.date.fromisoformat(w0)).days != 7: continue
        a, b_ = d[w0], d[w1]
        if a['v'] < 20 and b_['v'] < 20: continue
        steps.append(dict(sku=s, w=w1, cat=a['cat'], dp=b_['lp'] - a['lp'], dv=math.log((b_['v'] + 1) / (a['v'] + 1)), u0=a['u'], u1=b_['u'], v0=a['v'], v1=b_['v']))
ctrl = collections.defaultdict(list)
for x in steps:
    if abs(x['dp']) < 0.02: ctrl[(x['w'], x['cat'])].append(x['dv'])
for x in steps: x['adj'] = x['dv'] - (np.median(ctrl[(x['w'], x['cat'])]) if len(ctrl[(x['w'], x['cat'])]) >= 5 else np.nan)
bins = [(-9, -0.15, 'дешевле >15%'), (-0.15, -0.05, 'дешевле 5-15%'), (-0.05, -0.02, 'дешевле 2-5%'), (-0.02, 0.02, 'без изменения ±2%'), (0.02, 0.05, 'дороже 2-5%'), (0.05, 0.15, 'дороже 5-15%'), (0.15, 9, 'дороже >15%')]
for c in ['все'] + CATS:
    out(f'  -- {c}: шаг цены | n шагов | изменение показов (медиана, Q1..Q3) | шт до -> после (сумма)')
    for lo, hi, nm in bins:
        xs = [x for x in steps if lo <= x['dp'] < hi and (c == 'все' or x['cat'] == c) and not np.isnan(x['adj'])]
        if not xs: continue
        a = np.array([x['adj'] for x in xs])
        out(f'     {nm:18s} n={len(xs):4d}  {100*(math.exp(np.median(a))-1):+5.0f}%  [{100*(math.exp(np.percentile(a,25))-1):+.0f}%..{100*(math.exp(np.percentile(a,75))-1):+.0f}%]  шт {sum(x["u0"] for x in xs)} -> {sum(x["u1"] for x in xs)}')

# уровень цены относительно своей медианы окна -> показы и заказы (баланс)
out('\nБаланс: цена витрины SKU относительно её же медианы за окно -> показы (индекс к медиане SKU, с поправкой на неделю) и заказы')
wk_idx = {}
for w in weeks:
    vs_ = [r['v'] for r in rows if r['w'] == w and r['sku'] in mov]; wk_idx[w] = sum(vs_)
mw = np.median(list(wk_idx.values()))
med_lp = {s: np.median([x['lp'] for x in rs]) for s, rs in rng_p.items()}
med_v = {s: np.median([x['v'] for x in rs]) for s, rs in rng_p.items()}
lv = [(-9, -0.10, 'ниже медианы >10%'), (-0.10, -0.03, 'ниже 3-10%'), (-0.03, 0.03, 'около медианы ±3%'), (0.03, 0.10, 'выше 3-10%'), (0.10, 0.20, 'выше 10-20%'), (0.20, 9, 'выше >20%')]
for c in ['все'] + CATS:
    out(f'  -- {c}: уровень | SKU-недель | показы, индекс (медиана, Q1..Q3) | шт на 100 SKU-недель | шт на 10 тыс. показов')
    for lo, hi, nm in lv:
        xs = [r for r in rows if r['sku'] in mov and med_v[r['sku']] >= 20 and (c == 'все' or r['cat'] == c) and lo <= r['lp'] - med_lp[r['sku']] < hi]
        if not xs: continue
        ix = np.array([(r['v'] / med_v[r['sku']]) / (wk_idx[r['w']] / mw) for r in xs])
        u = sum(r['u'] for r in xs); v = sum(r['v'] for r in xs)
        out(f'     {nm:20s} n={len(xs):4d}  {np.median(ix):.2f} [{np.percentile(ix,25):.2f}..{np.percentile(ix,75):.2f}]  {100*u/len(xs):6.1f}  {1e4*u/v if v else 0:6.2f}')

# ---------- 4. другие кандидаты ----------
out('\n=== 4. Другие кандидаты ===')
ad = collections.defaultdict(collections.Counter)
for r in nd('ads_daily.ndjson'):
    if inwin(r['d']): x = ad[mon(r['d'])]; x['sp'] += r['sp']; x['vw'] += r['vw']; x['cl'] += r['cl']; x['o'] += r['o']; x['om'] += r['om']; x['camp'] += 0
camps = collections.defaultdict(set)
for r in nd('ads_daily.ndjson'):
    if inwin(r['d']) and r['sp'] > 0: camps[mon(r['d'])].add(r['id'])
out('Реклама (ads_daily): мес | расход/день | показы рекламы/день | клики/день | заказы рекл. шт/день | активных кампаний (расход>0) | доля рекл. показов в общих')
for m in MONTHS:
    x = ad[m]; n = days_in(m)
    out(f'  {m}  {x["sp"]/n:9,.0f}  {x["vw"]/n:9,.0f}  {x["cl"]/n:7,.0f}  {x["o"]/n:5.2f}  {len(camps[m]):3d}  {pct(safe(x["vw"], FUN[(m,"все_итоги")]["v"]))}'.replace(',', ' '))
meta = json.load(open(P('ads_30d.json'))).get('camp_meta', {})
for per in ('p7', 'p30', 'p90'):
    meta = {**json.load(open(P('ads_periods.json')))[per].get('camp_meta', {}), **meta}
IN = collections.defaultdict(collections.Counter); CB = collections.defaultdict(lambda: collections.Counter())
for r in nd('ads_daily.ndjson'):
    if not inwin(r['d']): continue
    ins = meta.get(r['id'], {}).get('instr', 'нет в справочнике')
    x = IN[(mon(r['d']), ins)]; x['sp'] += r['sp']; x['vw'] += r['vw']; x['cl'] += r['cl']; x['o'] += r['o']
    per = 'b' if mon(r['d']) in BEFORE else 'a' if mon(r['d']) in AFTER else None
    if per: y = CB[(r['id'], r['off'], ins)]; y[per + 'o'] += r['o']; y[per + 'sp'] += r['sp']; y[per + 'vw'] += r['vw']
out('Показы без рекламных (итоги минус показы рекламы; допущение: рекламные показы входят в итоговые) в день:')
out('  ' + '; '.join(f'{m}: {f0((FUN[(m,"все_итоги")]["v"]-ad[m]["vw"])/days_in(m))}' for m in MONTHS))
out('Реклама по инструменту (справочник camp_meta из ads_30d/ads_periods): мес | инструмент | расход/день | показы/день | клики/день | заказы шт/день')
for m in MONTHS:
    for ins in sorted({k[1] for k in IN}):
        x = IN[(m, ins)]; n = days_in(m)
        if x['sp'] or x['o']: out(f'  {m} {ins[:22]:22s} {x["sp"]/n:8,.0f} {x["vw"]/n:9,.0f} {x["cl"]/n:6,.0f} {x["o"]/n:5.2f}'.replace(',', ' '))
out('Кампании с наибольшим числом рекламных заказов в мар-июн: заказы/мес до -> после, расход/мес до -> после')
for (cid, off, ins), y in sorted(CB.items(), key=lambda kv: -kv[1]['bo'])[:12]:
    out(f'  {cid} {off.replace(chr(8212), '-')[:38]:38s} {ins[:16]:16s} {y["bo"]/4:5.1f} -> {y["ao"]/3:5.1f} | {f0(y["bsp"]/4):>8} -> {f0(y["asp"]/3):>8}')
nb = sum(y['bo'] for y in CB.values()) / 4; na = sum(y['ao'] for y in CB.values()) / 3
out(f'  рекламные заказы всего, шт/мес: {nb:.0f} -> {na:.0f} (поле o в ads_daily; атрибуция OZON, пересекается с органикой)')
cpo = {}
for r in nd('cpo_orders.ndjson'): cpo[r['order']] = r['sp']
cm = collections.Counter(); cs = collections.Counter()
for o in ok:
    k = o['order'] if o['order'] in cpo else o['order'].rsplit('-', 1)[0]
    if k in cpo: cm[mon(o['d'])] += o['units']; cs[mon(o['d'])] += cpo[k]
out(f'  cpo_orders: {len(cpo)} заказов, сопоставлено с orders_daily без отмен: {sum(cm.values())} шт')
out('Оплата за заказ (cpo_orders x orders_daily без отмен): мес | шт с оплатой за заказ | расход | доля в шт месяца')
for m in MONTHS:
    out(f'  {m} {cm[m]:4d} {f0(cs[m]):>9}  {pct(safe(cm[m], FUN[(m,"все")]["u"]))}')
PS = collections.defaultdict(lambda: collections.defaultdict(list))
for r in nd('funnel_sku_daily.ndjson'):
    if r.get('search_position'): PS[r['sku']][mon(r['date'])].append(r['search_position'])
out('Позиция в поиске (funnel_sku_daily, 12.06-21.09; медиана по SKU с данными во всех 4 месяцах, индекс к июню; меньше = выше в выдаче):')
for c in ['все'] + CATS:
    ss = [k for k in PS if all(PS[k][m] for m in ms_cv) and (c == 'все' or cat(k) == c)]
    out(f'  {c:7s} n SKU={len(ss)} ' + '; '.join(f'{m}: медиана позиции {np.median([np.median(PS[k][m]) for k in ss]):.0f}, индекс {np.median([np.median(PS[k][m])/np.median(PS[k]["2026-06"]) for k in ss]):.2f}' for m in ms_cv))
out('Ассортимент и концентрация: мес | кат | SKU с показами>=100 за 30 дн (порог пропорц. дням) | SKU с заказом | топ-10 SKU доля шт | топ-10 доля показов | показы на 1 такой SKU в день')
for c in ['все'] + CATS:
    for m in MONTHS:
        vv = collections.Counter(); uu = collections.Counter()
        for r in views:
            if mon(r['date']) == m and (c == 'все' or cat(r['sku']) == c): vv[r['sku']] += r['views']
        for o in ok:
            if mon(o['d']) == m and (c == 'все' or cat(o['sku']) == c): uu[o['sku']] += o['units']
        act = [s for s, v in vv.items() if v >= 100 * days_in(m) / 30]; tu = sum(uu.values()); tv = sum(vv.values())
        out(f'  {m} {c:7s} {len(act):4d} {len(uu):4d}  {pct(safe(sum(v for _,v in uu.most_common(10)),tu)):>6}  {pct(safe(sum(v for _,v in vv.most_common(10)),tv)):>6}  {sum(vv[s] for s in act)/max(1,len(act))/days_in(m):7.1f}')
out('Отмены (orders_daily): мес | заказов | отмен | доля отмен ; схема доставки доля шт FBS/rFBS/FBO ; дней от заказа до начисления продажи (медиана, Q3) [прокси срока доставки]')
for m in MONTHS:
    n_ok = sum(1 for o in ok if mon(o['d']) == m); n_c = sum(1 for o in canc if mon(o['d']) == m)
    sc = collections.Counter()
    for o in ok:
        if mon(o['d']) == m: sc[o['scheme']] += o['units']
    tu = sum(sc.values())
    lag = [(dt.date.fromisoformat(o['sd']) - dt.date.fromisoformat(o['d'])).days for o in ok if mon(o['d']) == m and o['sd'] and o['status'] == 'delivered']
    out(f'  {m}  {n_ok:4d} {n_c:4d}  {pct(n_c/(n_ok+n_c))}  FBS {pct(sc["FBS"]/tu)} rFBS {pct(sc["rFBS"]/tu)} FBO {pct(sc["FBO"]/tu)}  лаг {np.median(lag) if lag else "-"} дн, Q3 {np.percentile(lag,75) if lag else "-"} (n={len(lag)})')

out('\nХронология по неделям (понедельник): шт/день | показы/день (итоги) | реклама "за клик" расход/день | реклама "за заказ" расход/день | медиана цены витрины к неделе 15.06 (арт. панели)')
WS = sorted({wk(d) for d in totals if '2026-05-25' <= d <= OCT_END})
uday = collections.Counter(); vday = collections.Counter(); ndays = collections.Counter()
for o in ok: uday[wk(o['d'])] += o['units']
for d, t in totals.items():
    if inwin(d): vday[wk(d)] += t['views']; ndays[wk(d)] += 1
cpc = collections.Counter(); cpo_w = collections.Counter()
for r in nd('ads_daily.ndjson'):
    ins = meta.get(r['id'], {}).get('instr', '')
    if ins == 'Оплата за клик': cpc[wk(r['d'])] += r['sp']
    elif ins == 'Оплата за заказ': cpo_w[wk(r['d'])] += r['sp']
pa = collections.defaultdict(dict)
for r in cv_rows: pa[r['art']].setdefault(wk(r['date']), []).append(r['site_listed'])
base = {a: np.median(v['2026-06-15']) for a, v in pa.items() if '2026-06-15' in v}
for w in WS:
    n = ndays[w] or 1
    ix = [np.median(pa[a][w]) / base[a] for a in base if w in pa[a]]
    out(f'  {w}  {uday[w]/n:5.1f}  {vday[w]/n:8,.0f}  {cpc[w]/n:8,.0f}  {cpo_w[w]/n:8,.0f}  {(f"{100*(np.median(ix)-1):+.0f}% (n={len(ix)})") if ix else "-"}'.replace(',', ' '))

# ---------- 5. топ-10 по вкладу в падение ----------
out('\n=== 5. Топ-10 по вкладу в падение (шт/мес: среднее мар-июн против июл-сен) ===')
def per_key(keyf):
    U = collections.defaultdict(lambda: [0, 0]); V = collections.defaultdict(lambda: [0, 0]); PP = collections.defaultdict(lambda: [[0, 0, 0], [0, 0, 0]])
    for o in ok:
        m = mon(o['d']); i = 0 if m in BEFORE else 1 if m in AFTER else None
        if i is None: continue
        k = keyf(o['sku']); U[k][i] += o['units']
        if o['paid'] is not None: x = PP[k][i]; x[0] += o['units']; x[1] += o['revenue']; x[2] += o['paid']
    for r in views:
        m = mon(r['date']); i = 0 if m in BEFORE else 1 if m in AFTER else None
        if i is None: continue
        V[keyf(r['sku'])][i] += r['views']
    return U, V, PP
tot_b = sum(o['units'] for o in ok if mon(o['d']) in BEFORE) / 4; tot_a = sum(o['units'] for o in ok if mon(o['d']) in AFTER) / 3
out(f'всего шт/мес: {tot_b:.0f} -> {tot_a:.0f}, падение {tot_b-tot_a:.0f}')
cvlast = {}
for r in cv_rows:
    if mon(r['date']) in AFTER: cvlast.setdefault(r['sku'], []).append(r['site_listed'])
cvfirst = {}
for r in cv_rows:
    if r['date'] < '2026-07-01': cvfirst.setdefault(r['sku'], []).append(r['site_listed'])
for title, keyf in (('по SKU', lambda s: s), ('по модели (sku_taxonomy.model)', model)):
    U, V, PP = per_key(keyf)
    dl = sorted(U, key=lambda k: U[k][1] / 3 - U[k][0] / 4)[:10]
    s10 = sum(U[k][0] / 4 - U[k][1] / 3 for k in dl)
    out(f'\n-- {title}: топ-10 дают {s10:.0f} шт/мес из {tot_b-tot_a:.0f} ({100*s10/(tot_b-tot_a):.0f}%)')
    out('ключ | кат | шт/мес до -> после | показы/мес до -> после | витрина/шт до -> после | наша/шт до -> после | витрина панели июнь -> июл-сен')
    for k in dl:
        b, a = PP[k]
        vb = b[2] / b[0] if b[0] else None; va = a[2] / a[0] if a[0] else None
        rb = b[1] / b[0] if b[0] else None; ra = a[1] / a[0] if a[0] else None
        sk = k if title == 'по SKU' else None
        nm = (k + ' ' + (tax.get(k, {}).get('offer') or '') + ' ' + model(k)) if sk else k
        c_ = cat(k) if sk else '-'
        pf = f'{f0(np.median(cvfirst[k]))} -> {f0(np.median(cvlast[k]))}' if sk and k in cvfirst and k in cvlast else '-'
        out(f'  {nm[:52]:52s} {c_:7s} {U[k][0]/4:5.1f} -> {U[k][1]/3:5.1f} | {f0(V[k][0]/4):>7} -> {f0(V[k][1]/3):>7} | {f0(vb):>7} -> {f0(va):>7} | {f0(rb):>7} -> {f0(ra):>7} | {pf}')
    gain = sorted(U, key=lambda k: U[k][1] / 3 - U[k][0] / 4, reverse=True)[:5]
    out('  растущие (топ-5): ' + '; '.join(f'{k[:30]} {U[k][0]/4:.1f}->{U[k][1]/3:.1f}' for k in gain))

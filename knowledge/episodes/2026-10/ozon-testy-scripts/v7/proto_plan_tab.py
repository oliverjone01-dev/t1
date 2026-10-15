# v11: ПРОТОТИП блока «План с 15.10: как идём к цели» страницы «Тесты» - для показа Ивану до кода сборщика.
# Не сборщик: после одобрения логика переезжает в analytics-mvp/src/scripts/build-tests.ts с тестами vitest.
# Вход: план (freeze_plan.py) + analytics-mvp/data. Выход - один HTML (вне репо: стиль и данные страницы, без прибыли по артикулам).
# python3 -I proto_plan_tab.py <plan.json> <out.html> [сегодня ГГГГ-ММ-ДД]
import sys, os, json, datetime as dt, collections as C, statistics as S, html
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = HERE.split('knowledge/')[0]; D = ROOT + 'analytics-mvp/data/'
PLAN, OUT = sys.argv[1], sys.argv[2]; TODAY = sys.argv[3] if len(sys.argv) > 3 else dt.date.today().isoformat()
P = json.load(open(PLAN))
L = lambda f: (json.loads(l) for l in open(D + f) if l.strip())
day = lambda s: dt.date.fromisoformat(s)
iso = lambda d: d.isoformat()
def drange(a, b): return [iso(day(a) + dt.timedelta(k)) for k in range((day(b) - day(a)).days + 1)]
DM = lambda s: f'{s[8:10]}.{s[5:7]}'
CPO_ID = '28753239'                                         # «Оплата за заказ - все товары»: не клик, в расход клика не идёт
START, CHECK = P['start'], P['check']; W0, W1 = P['window']
BASE = ('2026-09-14', '2026-10-11')                         # база порогов и плана (4 недели)
DAYS = drange('2026-09-14', '2026-10-31')

# ---------- карточки: все товары объединённой карточки из кабинета (card_groups.json)
G = json.load(open(D + 'card_groups.json'))['groups']
off2sku = {s['offer']: s['sku'] for g in G for s in g['skus']}
sku2off = {v: k for k, v in off2sku.items()}
cards = []
for c in P['cards']:
    ms = off2sku[c['main_art']]
    g = next(g for g in G if any(s['sku'] == ms for s in g['skus']))
    cards.append(dict(c, main_sku=ms, skus=[s['sku'] for s in g['skus']], min_skus=[off2sku[a] for a in c['min_arts']]))
SKU_CARD = {s: i for i, c in enumerate(cards) for s in c['skus']}
assert sum(len(c['skus']) for c in cards) == len(SKU_CARD), 'товар в двух карточках'

# ---------- воронка: ночной синк OZON по дню OZON (sku_views); день есть в файле - сумма (0 законен), дня нет - пропуск
FK = ('views', 'vsearch', 'pdp', 'cart', 'units', 'canc')
fv = C.defaultdict(lambda: C.defaultdict(C.Counter)); sv_days = set(); fstore = C.defaultdict(C.Counter)
for r in L('sku_views.ndjson'):
    if r['date'] < DAYS[0]: continue
    sv_days.add(r['date']); i = SKU_CARD.get(r['sku'])
    for k in FK: fstore[r['date']][k] += r.get(k) or 0
    if i is not None:
        for k in FK: fv[i][r['date']][k] += r.get(k) or 0
SV_LAST = max(sv_days)
# позиция главного товара - съём тестов (funnel_tests), есть не у всех главных
pos = C.defaultdict(dict)
mains = {c['main_art']: i for i, c in enumerate(cards)}
for r in L('funnel_tests.ndjson'):
    if r.get('art') in mains and r.get('search_position'): pos[mains[r['art']]][r['date']] = r['search_position']
# заказы: orders_daily без отмен, шт; поле d - дата из API (UTC, без времени)
od = C.defaultdict(C.Counter); store_u = C.Counter(); store_rev = C.Counter(); OD_LAST = ''
for o in L('orders_daily.ndjson'):
    OD_LAST = max(OD_LAST, o['d'])
    if o['status'] == 'cancelled': continue
    i = SKU_CARD.get(o['sku'])
    if i is not None: od[i][o['d']] += o['units']
    store_u[o['d']] += o['units']; store_rev[o['d']] += o['revenue']
# реклама: расход по товару (ads_sku_daily, без ставки за заказ); клики кампании - по доле расхода товара в кампании
asd = list(L('ads_sku_daily.ndjson')); AD_LAST = max(a['d'] for a in asd)
camp_day_sp = C.Counter()
for a in asd: camp_day_sp[(a['cid'], a['d'])] += a['sp']
cl = {(a['id'], a['d']): a.get('cl') or 0 for a in L('ads_daily.ndjson')}
sp = C.defaultdict(C.Counter); spm = C.defaultdict(C.Counter); spmin = C.defaultdict(C.Counter); clk = C.defaultdict(C.Counter)
acart = C.defaultdict(C.Counter); camp_sp = C.defaultdict(C.Counter)
for a in asd:
    if a['cid'] == CPO_ID: continue
    camp_sp[a['cid']][a['d']] += a['sp']
    i = SKU_CARD.get(a['sku'])
    if i is None: continue
    c = cards[i]; sp[i][a['d']] += a['sp']; acart[i][a['d']] += a.get('ca') or 0
    if a['sku'] == c['main_sku']: spm[i][a['d']] += a['sp']
    if a['sku'] in c['min_skus']: spmin[i][a['d']] += a['sp']
    tot = camp_day_sp[(a['cid'], a['d'])]
    if tot: clk[i][a['d']] += cl.get((a['cid'], a['d']), 0) * a['sp'] / tot
# магазин: сумма всех товаров того же синка. daily_totals не берём: у него «карточка» (pdp_views) другого определения,
# примерно вдвое меньше суммы по товарам (14.09: 2 940 против 5 959), остальные поля совпадают

def ser(get, last):
    return [None if d > last else get(d) for d in DAYS]
SER = []
for i, c in enumerate(cards):
    SER.append(dict(
        views=ser(lambda d: fv[i][d]['views'] if d in sv_days else None, SV_LAST),
        vsearch=ser(lambda d: fv[i][d]['vsearch'] if d in sv_days else None, SV_LAST),
        pdp=ser(lambda d: fv[i][d]['pdp'] if d in sv_days else None, SV_LAST),
        cart=ser(lambda d: fv[i][d]['cart'] if d in sv_days else None, SV_LAST),
        units=ser(lambda d: fv[i][d]['units'] if d in sv_days else None, SV_LAST),
        pos=[pos[i].get(d) for d in DAYS],
        orders=ser(lambda d: od[i][d], OD_LAST),
        sp=ser(lambda d: round(sp[i][d]), AD_LAST), clk=ser(lambda d: round(clk[i][d]), AD_LAST),
        acart=ser(lambda d: acart[i][d], AD_LAST)))
STORE = dict(
    views=ser(lambda d: fstore[d]['views'] if d in sv_days else None, SV_LAST),
    vsearch=ser(lambda d: fstore[d]['vsearch'] if d in sv_days else None, SV_LAST),
    pdp=ser(lambda d: fstore[d]['pdp'] if d in sv_days else None, SV_LAST),
    cart=ser(lambda d: fstore[d]['cart'] if d in sv_days else None, SV_LAST),
    units=ser(lambda d: fstore[d]['units'] if d in sv_days else None, SV_LAST),
    pos=[None] * len(DAYS),
    orders=ser(lambda d: store_u[d], OD_LAST),
    sp=ser(lambda d: round(sum(camp_sp[k][d] for k in camp_sp)), AD_LAST),
    clk=ser(lambda d: sum(v for (k, dd), v in cl.items() if dd == d and k != CPO_ID), AD_LAST),
    acart=[None] * len(DAYS))
# инвариант: сумма карточек не больше магазина в любой день
for k in ('views', 'pdp', 'orders'):
    for j, d in enumerate(DAYS):
        s = sum(x[k][j] or 0 for x in SER); m = STORE[k][j]
        assert m is None or s <= m * 1.001 + 1, (k, d, s, m)

# ---------- агрегаты окон
def wsum(series, a, b):
    vals = [v for d, v in zip(DAYS, series) if a <= d <= b and v is not None]
    n = len(vals); return (sum(vals), n) if n else (None, 0)
def per_wk(series, a, b):
    s, n = wsum(series, a, b); return None if s is None else s / n * 7
WINS = [('База 14.09-11.10', BASE[0], BASE[1]), (f'Неделя {DM(iso(day(SV_LAST) - dt.timedelta(6)))}-{DM(SV_LAST)}', iso(day(SV_LAST) - dt.timedelta(6)), SV_LAST),
        ('С 15.10', START, W1)]
F = lambda x, nd=0: '-' if x is None else (f'{x:,.{nd}f}').replace(',', ' ').replace('.', ',')
def pct_d(a, b): return None if a in (None, 0) or b is None else (b / a - 1) * 100
def dchip(x):
    if x is None: return '<span class="muted">-</span>'
    return f'<span class="{"up" if x >= 0 else "dn"}">{"+" if x >= 0 else ""}{x:.0f}%</span>'

# ---------- блок 1: шапка-сводка
cum = lambda s, a, b: wsum(s, a, b)[0]
sum_thr = sum(c['threshold'] for c in cards)
card_orders_now = cum([sum(x['orders'][j] or 0 for x in SER) if DAYS[j] <= OD_LAST else None for j in range(len(DAYS))], START, W1)
oct_u = cum(STORE['orders'], '2026-10-01', '2026-10-31'); oct_rev = cum(ser(lambda d: store_rev[d], OD_LAST), '2026-10-01', '2026-10-31')
g_u, g_t = P['goal']['units']['oct'], P['goal']['turn_mln']['oct']
def goal_path(g, d_idx, sc):                                 # цель накопительно на день d_idx (1..31): база ровно, прирост с 17.10
    base = g['lo'] / 31 * d_idx; extra = (g[sc] - g['lo']) * max(0, min(15, d_idx - 16)) / 15
    return base + extra
od_day = int(OD_LAST[8:10]) if OD_LAST >= '2026-10-01' else 0
tiles = [
    ('10 карточек: заказов с 15.10', F(card_orders_now) if card_orders_now is not None else 'ещё нет', f'порог 29.10 в сумме {sum_thr}; пройти должны 5 из 10'),
    ('Магазин, октябрь: заказов', F(oct_u), f'по {DM(OD_LAST)}; цель на эту дату {F(goal_path(g_u, od_day, "mid"))}, месяц {F(g_u["mid"])} ({F(g_u["lo"])}...{F(g_u["hi"])})'),
    ('Магазин, октябрь: оборот', F(oct_rev / 1e6, 1) + ' млн' if oct_rev else '-', f'цель на эту дату {F(goal_path(g_t, od_day, "mid"), 1)}, месяц {F(g_t["mid"], 1)} млн'),
    ('К выплате', 'раз в месяц', f'по закрытию «Отчета»: октябрь {F(P["goal"]["pay_mln"]["oct"]["mid"], 1)} млн, ноябрь {F(P["goal"]["pay_mln"]["nov"]["mid"], 1)} (с откатами {F(P["goal"]["nov_rollback"]["pay_mln"], 1)})'),
]
tiles_html = ''.join(f'<div class="tile"><div class="tl">{html.escape(a)}</div><div class="tv">{b}</div><div class="ts">{html.escape(s)}</div></div>' for a, b, s in tiles)

# ---------- блок 2: 10 карточек против порога
n_days_in = max(0, min((day(OD_LAST) - day(START)).days + 1, 14))
rows2 = []
for i, c in enumerate(cards):
    got = cum(SER[i]['orders'], START, W1)
    pre = cum(SER[i]['orders'], '2026-10-01', '2026-10-14')
    need = c['threshold']; path = need * n_days_in / 14
    if got is None: st = '<span class="chip chip-off">ещё нет данных</span>'
    elif n_days_in < 3: st = '<span class="chip chip-off">рано</span>'
    elif got >= path: st = '<span class="chip chip-done">идём</span>'
    else: st = '<span class="chip chip-bad">отстаём</span>'
    thr_p = f' <span class="muted" title="Порог, если считать вклад снижения цены отдельно">(с ценой {c["threshold_price"]})</span>' if c['threshold_price'] else ''
    rows2.append(f'<tr><td><b>{html.escape(c["short"])}</b><div class="muted s">{html.escape(c["main_art"])}</div></td>'
                 f'<td class="r">{need}{thr_p}</td><td class="r">{F(got) if got is not None else "-"}</td>'
                 f'<td class="r">{F(max(0, need - (got or 0)))}</td><td class="r">{F(2 * c["u_wk_base"], 1)}</td>'
                 f'<td class="r">{F(pre)}</td><td>{st}</td></tr>')
tbl2 = ('<div class="tbl-wrap"><table class="gtbl single"><thead><tr><th>Карточка</th><th class="r">Порог 29.10</th><th class="r">Заказов с 15.10</th>'
        '<th class="r">Осталось до порога</th><th class="r" title="2 недели × заказов карточки в неделю за 14.09-11.10">Было бы без эффекта</th>'
        '<th class="r" title="Заказы карточки 01-14.10: те же 14 дней до старта">01-14.10, для сравнения</th><th>Статус</th></tr></thead><tbody>'
        + ''.join(rows2) + '</tbody></table></div>')

# ---------- блок 5: расход по неделям чт-ср
WEEKS = [('08-14.10 (до плана)', '2026-10-08', '2026-10-14'), ('15-21.10', '2026-10-15', '2026-10-21'), ('22-28.10', '2026-10-22', '2026-10-28')]
def wk_cell(series_by_day, a, b, plan, only_high=False):
    if a > AD_LAST: return '<td class="r muted">ещё нет данных</td>'
    s = sum(series_by_day[d] for d in drange(a, min(b, AD_LAST))); nd = (day(min(b, AD_LAST)) - day(a)).days + 1
    pr = s / plan * 100 if plan else None
    bad = a >= START and pr is not None and (pr > 120 or (pr < 50 and not only_high))   # до плана не красим
    part = f' <span class="muted">({nd} из 7 дн)</span>' if nd < 7 else ''
    return f'<td class="r{" bad" if bad else ""}">{F(s)}{part}<div class="s muted">{F(pr)}% плана</div></td>'
r5 = ['<tr class="grp"><td colspan="5">Клик главного товара, ₽ за неделю</td></tr>']
for i, c in enumerate(cards):
    r5.append(f'<tr><td>{html.escape(c["short"])} <span class="muted s">{html.escape(c["main_art"])}</span></td><td class="r">{F(c["click_new"])}</td>'
              + ''.join(wk_cell(spm[i], a, b, c['click_new']) for _, a, b in WEEKS) + '</tr>')
r5.append('<tr class="grp"><td colspan="5">Минимальный клик 8 ₽ на остальных товарах карточки, ₽ за неделю (около 1 500 на товар)</td></tr>')
for i, c in enumerate(cards):
    if not c['n_min']: continue
    pl = c['n_min'] * P['min_budget_sku']
    r5.append(f'<tr><td>{html.escape(c["short"])} <span class="muted s">{c["n_min"]} тов.</span></td><td class="r">{F(pl)}</td>'
              + ''.join(wk_cell(spmin[i], a, b, pl) for _, a, b in WEEKS) + '</tr>')
r5.append('<tr class="grp"><td colspan="5">11 кампаний на минимум с 15.10, ₽ за неделю (красным - больше 120% от 2 000)</td></tr>')
for k in P['to_min']:
    r5.append(f'<tr><td>{k["cid"]} <span class="muted s">{html.escape(str(k["art"]))}</span></td><td class="r">{F(P["min_campaign_budget"])}</td>'
              + ''.join(wk_cell(camp_sp[k['cid']], a, b, P['min_campaign_budget'], True) for _, a, b in WEEKS) + '</tr>')
def wk_val(series_by_day, a, b):
    if a > AD_LAST: return None
    return [round(sum(series_by_day[d] for d in drange(a, min(b, AD_LAST)))), (day(min(b, AD_LAST)) - day(a)).days + 1]
SPEND = [dict(g='Клик главного товара', only_high=False, rows=[dict(n=c['short'], sub=c['main_art'], plan=c['click_new'],
              w=[wk_val(spm[i], a, b) for _, a, b in WEEKS]) for i, c in enumerate(cards)]),
         dict(g='Минимальный клик 8 ₽ (≈1 500 на товар)', only_high=False, rows=[dict(n=c['short'], sub=f"{c['n_min']} тов.", plan=c['n_min'] * P['min_budget_sku'],
              w=[wk_val(spmin[i], a, b) for _, a, b in WEEKS]) for i, c in enumerate(cards) if c['n_min']]),
         dict(g='11 кампаний на минимум (план 2 000)', only_high=True, rows=[dict(n=k['cid'], sub=str(k['art']), plan=P['min_campaign_budget'],
              w=[wk_val(camp_sp[k['cid']], a, b) for _, a, b in WEEKS]) for k in P['to_min']])]
tbl5 = ('<div class="tbl-wrap tall"><table class="gtbl single"><thead><tr><th>Что</th><th class="r">План, ₽/нед</th>'
        + ''.join(f'<th class="r">{w}</th>' for w, _, _ in WEEKS) + '</tr></thead><tbody>' + ''.join(r5) + '</tbody></table></div>')

# ---------- блок 6: цена 26 артикулов
pr_last = {}; gap_last = {}
for r in L('prices_daily.ndjson'):
    if r['d'] >= pr_last.get(r['offer'], ('',))[0]: pr_last[r['offer']] = (r['d'], r['price'])
for r in L('gap_daily.ndjson'):
    if r['date'] >= gap_last.get(r['art'], ('',))[0]: gap_last[r['art']] = (r['date'], r['gap_pct'])
r6 = []; pst = C.Counter()
for p in sorted(P['price'], key=lambda p: (p['when'], p['art'])):
    d0, now = pr_last.get(p['art'], ('', None)); when = f'2026-{p["when"][3:5]}-{p["when"][0:2]}'
    gd, gp = gap_last.get(p['art'], ('', None))
    if now is None: st = '<span class="chip chip-bad">нет цены</span>'
    elif d0 < when or (d0 == when and TODAY <= when): st = f'<span class="chip chip-off">ждём {p["when"]}</span>'
    elif now <= p['price_new'] * 1.005: st = '<span class="chip chip-done">снижена</span>'
    else: st = '<span class="chip chip-bad">не снижена</span>'
    pst['ждём' if 'ждём' in st else 'снижена' if '>снижена' in st else 'не снижена']+= 1
    if gp is not None and gp < 10: pst['eb'] += 1
    eb = '' if gp is None else (f'<span class="chip chip-bad">выпал из Эластичного бустинга?</span>' if gp < 10 else '')
    r6.append(f'<tr><td>{p["when"]}</td><td>{html.escape(p["art"])}<div class="muted s">{html.escape(str(p["name"])[:46])}</div></td>'
              f'<td class="r">{F(now)}<div class="muted s">{DM(d0) if d0 else ""}</div></td><td class="r">{F(p["price_new"])} <span class="muted">{p["step"]}</span></td>'
              f'<td>{st}</td><td class="r">{F(gp)}%<div class="muted s">{DM(gd) if gd else ""}</div></td><td>{eb}</td></tr>')
tbl6 = ('<div class="tbl-wrap tall"><table class="gtbl single"><thead><tr><th>С</th><th>Артикул</th><th class="r">Наша цена сейчас, ₽</th>'
        '<th class="r">Целевая, ₽</th><th>Статус</th><th class="r" title="На сколько цена на сайте ниже нашей (gap_daily). Обвал ниже 10% - товар, похоже, выпал из Эластичного бустинга">Скидка OZON</th><th></th></tr></thead><tbody>'
        + ''.join(r6) + '</tbody></table></div>')

# ---------- блок 3: воронка по 10 карточкам (обзор)
def fun_row(name, s, extra=''):
    cells = []
    for k in ('vsearch', 'pdp', 'cart', 'units'):
        b = per_wk(s[k], *BASE); a = per_wk(s[k], START, W1)
        cells.append(f'<td class="r sep">{F(b)}</td><td class="r">{F(a)}</td><td class="r">{dchip(pct_d(b, a))}</td>')
    vb, _ = wsum(s['views'], *BASE); ub, _ = wsum(s['units'], *BASE)
    va, _ = wsum(s['views'], START, W1); ua, _ = wsum(s['units'], START, W1)
    cb = ub / vb * 1000 if vb else None; ca = ua / va * 1000 if va else None
    cells.append(f'<td class="r sep">{F(cb, 2)}</td><td class="r">{F(ca, 2)}</td>')
    return f'<tr><td>{name}{extra}</td>{"".join(cells)}</tr>'
r3 = [fun_row(f'<b>{html.escape(c["short"])}</b>', SER[i]) for i, c in enumerate(cards)]
tot = {k: [None if all(x[k][j] is None for x in SER) else sum(x[k][j] or 0 for x in SER) for j in range(len(DAYS))] for k in ('views', 'vsearch', 'pdp', 'cart', 'units')}
r3.append(fun_row('<b>Все 10</b>', tot))
r3.append(fun_row('<span class="muted">Весь магазин</span>', STORE))
tbl3 = ('<div class="tbl-wrap"><table class="gtbl"><thead><tr class="grp"><th></th><th colspan="3" class="sep">Показы в поиске, в нед</th><th colspan="3" class="sep">Карточка, в нед</th>'
        '<th colspan="3" class="sep">Корзина, в нед</th><th colspan="3" class="sep">Заказано, шт в нед</th><th colspan="2" class="sep">Заказов на 1 000 показов</th></tr>'
        '<tr><th>Карточка</th>' + '<th class="r sep">база</th><th class="r">с 15.10</th><th class="r">Δ</th>' * 4 + '<th class="r sep">база</th><th class="r">с 15.10</th></tr></thead><tbody>'
        + ''.join(r3) + '</tbody></table></div>')

DATA = dict(days=DAYS, start=START, w1=W1, sv_last=SV_LAST, od_last=OD_LAST, ad_last=AD_LAST, today=TODAY,
            cards=[dict(short=c['short'], art=c['main_art'], thr=c['threshold'], thrp=c['threshold_price'], base2=round(2 * c['u_wk_base'], 2)) for c in cards],
            ser=SER, store=STORE, store_rev=ser(lambda d: store_rev[d], OD_LAST),
            goal=P['goal'], base_win=list(BASE), spend=SPEND, weeks=[w for w, _, _ in WEEKS], week_start=[a for _, a, _ in WEEKS],
            price_st=dict(pst), price_n=len(P['price']), price_first=sum(p['when'] == '15.10' for p in P['price']))

CSS = open(HERE + '/proto_plan_tab.css').read()
JS = open(HERE + '/proto_plan_tab.js').read()
page = f'''<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Тесты · План с 15.10 (прототип)</title><style>{CSS}</style></head><body><div class="wrap">
<div class="proto">ПРОТОТИП для Ивана, {DM(TODAY)}: так будет выглядеть первый блок страницы «Тесты». Данные настоящие по {DM(SV_LAST)}; дни с 15.10 пустые - «ещё нет данных». Ниже блока - то, что уже есть на странице (тесты 1-4), без изменений.</div>
<h1>Тесты · A/B по рекламе</h1>
<details class="card tcard" open><summary><div class="chead"><span class="ctitle">План с 15.10: как идём к цели</span>
<span class="chip chip-run">день {max(0, (day(TODAY) - day(START)).days + 1)} из 14 до проверки 29.10</span></div></summary>
<p class="hyp">Цель: больше заказов и прибыли. С 15.10 в 10 карточках главный товар получает клик 20 000 ₽ в неделю, остальные товары карточки - минимальный клик 8 ₽, у 26 артикулов цена вниз (15 с 15.10, 11 с 22.10). 29.10 по каждой карточке: заказов за 15-28.10 не меньше порога - оставляем, меньше - откат.</p>
<div class="gauges" id="gauges"></div>
<div class="plaques"><div class="plaque"><span class="pl-l">К выплате</span> раз в месяц, по закрытию «Отчета». Цель: октябрь <b>{F(P["goal"]["pay_mln"]["oct"]["mid"], 1)} млн</b>, ноябрь <b>{F(P["goal"]["pay_mln"]["nov"]["mid"], 1)} млн</b> (с откатами 29.10 - {F(P["goal"]["nov_rollback"]["pay_mln"], 1)})</div></div>

<div class="sec">1. Заказы 10 карточек против порога 29.10</div>
<p class="legend">Заказы - все товары объединённой карточки, шт, без отмен. Последние 3 дня бледные: заказы ещё досчитываются. Порог - столько заказов за 15-28.10, чтобы карточку без эффекта оставить не чаще 15%.</p>
<div class="flasks" id="flasks"></div>
<p class="legend">Колба = порог 29.10. <span class="sw sw-fill"></span>заказы с 15.10 (зелёная - идём по графику, жёлтая - отстаём до 30%, красная - больше) <span class="sw sw-ghost"></span>те же 14 дней до старта (01-14.10) <span class="sw sw-need"></span>сколько нужно на сегодня <span class="sw sw-thp"></span>порог с поправкой на цену</p>
<details class="fold"><summary>Таблица по карточкам</summary>{tbl2}</details>

<div class="sec">2. Воронка 10 карточек, как на тестах</div>
<p class="legend">Показы, карточка, корзина, заказано - ночной синк OZON по дню OZON (заказано с отменами, как в тестах). Позиция - съём тестов, есть у 7 главных из 10. База - 14.09-11.10, та же, что у порогов. «С 15.10» - среднее в неделю по дням с данными.</p>
{tbl3}
<div class="dyn"><div class="mrow-b" id="cardsel"></div><div class="mrow-b" id="metsel"></div><div id="dynchart"></div><div id="dyntbl"></div></div>

<div class="sec">3. Магазин против цели месяца</div>
<p class="legend">Заказы и оборот магазина по дням, накопительно с 01.10. Линия - цель «средне», серый коридор - от «плохо» до «хорошо»; прирост к базе считаем с 17.10 (2-3 дня реклама набирает показы).</p>
<div class="two"><div id="stU"></div><div id="stT"></div></div>

<div class="sec">4. Реклама по неделям чт-ср</div>
<p class="legend">Расход по товарам из отчёта кабинета (без ставки за заказ). Красным - больше 120% или меньше 50% плана. Последние дни недели дозаливаются несколько ночей.</p>
<div class="mrow-b" id="wksel"></div><div id="pills"></div>
<details class="fold"><summary>Таблица по неделям</summary>{tbl5}</details>

<div class="sec">5. Цена 26 артикулов</div>
<p class="legend">Наша цена - ежедневный срез цен (около 08:53 МСК, раньше срока снижения 10:00, поэтому в день старта статус «ждём»). Скидка OZON - на сколько цена на сайте ниже нашей; обвал ниже 10% - товар, похоже, выпал из Эластичного бустинга, цену вернуть.</p>
<div id="pricepills"></div>
<details class="fold"><summary>Все 26 артикулов</summary>{tbl6}</details>

<details class="fold"><summary><b>Как считаем и что ещё не готово</b></summary><div class="fold-b"><ul class="notes">
<li>День заказа: сейчас в данных дата из API OZON по UTC без времени. Заказы с 00:00 до 03:00 МСК попадают в прошлый день. В сборщике сохраним время заказа и переведём в МСК - до этого числа по дням могут сдвинуться на 1-2 заказа.</li>
<li>Оборот магазина - сумма заказов без отмен по orders_daily. Цель 24,2 млн посчитана от базы 20,4 млн (модель 13.10), а orders_daily за ту же базу даёт 20,9 - факт будет выглядеть чуть лучше цели (около +2%).</li>
<li>Клики по карточке - клики кампании, разнесённые по доле расхода товара в кампании.</li>
<li>Позиции в поиске нет у GENTRIS, TRUBIS L120, ARFEO: их нет в съёме тестов. В сборщике добавим 10 главных в съём.</li>
<li>Данные: воронка по {DM(SV_LAST)}, заказы по {DM(OD_LAST)}, реклама по {DM(AD_LAST)}. План - Excel 15.10 (freeze_plan.py).</li>
</ul></div></details>
</details>
<details class="card tcard"><summary><div class="chead"><span class="ctitle muted">Тест 1-4 и остальные блоки страницы - без изменений</span></div></summary></details>
</div><script>window.PD={json.dumps(DATA, ensure_ascii=False)};
{JS}</script></body></html>'''
open(OUT, 'w').write(page)
print(f'{OUT}: {len(page) // 1024} KB; воронка по {SV_LAST}, заказы по {OD_LAST}, реклама по {AD_LAST}; заказов 10 карточек 01-14.10',
      sum(cum(SER[i]['orders'], '2026-10-01', '2026-10-14') or 0 for i in range(10)), '; магазин окт', oct_u, round((oct_rev or 0) / 1e6, 2))

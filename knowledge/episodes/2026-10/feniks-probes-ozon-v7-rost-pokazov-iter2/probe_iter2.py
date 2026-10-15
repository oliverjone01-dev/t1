# ФЕНИКС iter2 «Рост показов» (OZON-plan-2026-10-14.xlsx): пробы порога 29.10, «плохо с проверкой», волны 2, согласованности листов.
# python3 -I -B probe_iter2.py <OZON-plan.xlsx>   (модель автора импортируется как есть, @ HEAD)
import sys, os, json, math, random, collections as C
V7 = '/home/user/t1/knowledge/episodes/2026-10/ozon-testy-scripts/v7'
sys.path.insert(0, V7); sys.path.insert(0, V7 + '/../v5')
import io, contextlib
with contextlib.redirect_stdout(io.StringIO()):
    import cards7 as K, forecast as F
from openpyxl import load_workbook
XL = sys.argv[1]
LV = 20000; TOP = 10; MO = 4.33
top = K.cards[:TOP]

def sf(k, lam): return K.pois_sf(k, lam)
print('== P1 «Цель» = cards7.total')
for lvl in (20000, 10000):
    for sc in F.SCN:
        t = K.total(lvl, sc, TOP)
        print(f'  {lvl} {sc:8} units {t["units"]:+6.1f} turn {t["turn"]/1e6:+5.2f} pay {t["pay"]/1e6:+5.2f} spend {t["spend"]/1e3:6.0f} prof {t["prof"]/1e3:+6.0f} prof_adm {t["prof_adm"]/1e3:+6.0f}')
    print(f'  {lvl} bad_month {K.bad_month(lvl, TOP)/1e3:+.0f}')

print('== P2 порог: lam=2u, k, P(пройти | ноль), P(пройти | средне/хорошо) при 20 000')
rows = []
for c in top:
    lam = 2 * c['u_wk']; k = K.threshold(c)
    p0 = sf(k, lam); pm = K.pass_prob(c, LV, 'средний'); ph = K.pass_prob(c, LV, 'высокий')
    _, du, sp, pr = K.main_effect(c, LV, 'средний'); n, du2, sp2, pr2 = K.min_effect(c, 'средний')
    rows.append(dict(c=c, lam=lam, k=k, p0=p0, pm=pm, ph=ph))
    print(f'  {c["main_art"]:20} lam {lam:5.1f} k {k:3d}  P0 {p0:.3f}  Pсредне {pm:.2f}  Pхорошо {ph:.2f}  +ед/2нед средне {2*(du+du2):4.1f}')
print(f'  ожидаемо ложно оставленных при нуле: {sum(r["p0"] for r in rows):.2f} из 10; max P0 {max(r["p0"] for r in rows):.3f}')
def pbin(ps):                      # распределение числа прошедших (Пуассон-биномиальное)
    d = [1.0]
    for p in ps:
        d = [ (d[i] if i < len(d) else 0) * (1 - p) + (d[i-1] * p if i >= 1 else 0) for i in range(len(d) + 1)]
    return d
for nm, key in (('ноль', 'p0'), ('средне', 'pm'), ('хорошо', 'ph')):
    d = pbin([r[key] for r in rows]); print(f'  P(>=5 из 10 | {nm}) = {sum(d[5:]):.3f}; среднее прошедших {sum(i*x for i, x in enumerate(d)):.1f}')

print('== P3 цена в тех же карточках: реклама = 0, цена по модели v5 (EPS, XFER), дни цены в окне 15-28.10')
lst = {o['sku']: o['step'] for o in json.load(open('/tmp/ozon-v5/list26.json'))}
xl = load_workbook(XL)
when = {}
for r in xl['Цена вниз'].iter_rows(min_row=3, values_only=True):
    if r[1] and r[0]: when[r[1]] = 14 if str(r[0]).startswith('15.10') else 7
art2sku = {}
for g in K.G:
    for s in g['skus']: art2sku[s['offer']] = s['sku']
o4 = K.o4
for sc in F.SCN:
    tot0 = 0; bad = 0
    for r in rows:
        c = r['c']; g = next(g for g in K.G if g['main'] == c['card']); dl = 0
        for s in g['skus']:
            if s['sku'] in lst and s['offer'] in when:
                u = o4[s['sku']] / F.WEEKS; up = (1 - lst[s['sku']] / 100) ** F.EPS[sc] - 1
                dl += u * up * (1 - F.XFER[sc]) * when[s['offer']] / 7
        p = sf(r['k'], r['lam'] + dl); r['pp_' + sc] = p; r['dl_' + sc] = dl; tot0 += p
        _, _, sp, _ = K.main_effect(c, LV, 'низкий'); _, _, sp2, _ = K.min_effect(c, 'низкий'); w = sp + sp2
        bad += w * 2 + p * w * (MO - 2)
    print(f'  цена {sc:8}: ожидаемо оставленных при нулевой рекламе {tot0:.2f} из 10; «плохо с проверкой» {-bad/1e3:+.0f} тыс.')
for r in rows:
    print(f'    {r["c"]["main_art"]:20} +ед. от цены за 2 нед (средне) {r["dl_средний"]:4.2f}  P(оставить | реклама 0, цена средне) {r["pp_средний"]:.3f}')

print('== P4 сверхразброс: недельные заказы без отмен по карточкам, 12 недель до 11.10 (20.07-11.10)')
import datetime as dt
wk = lambda d: (dt.date.fromisoformat(d) - dt.date(2026, 7, 20)).days // 7
ser = {r['c']['card']: [0] * 12 for r in rows}
mem = {}
for g in K.G:
    for s in g['skus']: mem[s['sku']] = g['main']
canc = C.Counter(); allu = C.Counter()
for o in F.L('orders_daily.ndjson'):
    cd = mem.get(o['sku'])
    if cd in ser and F.A <= o['d'] <= F.B:
        allu[cd] += o['units']; canc[cd] += o['units'] if o['status'] == 'cancelled' else 0
    if cd in ser and o['status'] != 'cancelled' and '2026-07-20' <= o['d'] <= '2026-10-11':
        ser[cd][wk(o['d'])] += o['units']
vmr = []
for r in rows:
    x = ser[r['c']['card']]; m = sum(x) / 12; v = sum((a - m) ** 2 for a in x) / 11
    # 2-недельные суммы, тренд снят линейно по неделям
    n = 12; tb = sum(range(n)) / n; xb = m
    b = sum((i - tb) * (a - xb) for i, a in enumerate(x)) / sum((i - tb) ** 2 for i in range(n))
    res = [a - (xb + b * (i - tb)) for i, a in enumerate(x)]; vd = sum(e * e for e in res) / (n - 2)
    vmr.append(vd / m if m else 0)
    print(f'  {r["c"]["main_art"]:20} нед.: {x}  среднее {m:4.1f}  VMR {v/m if m else 0:4.2f}  VMR без тренда {vd/m if m else 0:4.2f}  последние 4 нед {x[-4:]}')
print(f'  медиана VMR без тренда {sorted(vmr)[len(vmr)//2]:.2f}')
def nb_sf(k, mean, vmr_):             # P(X >= k), отрицательное биномиальное с дисперсией vmr*mean
    if vmr_ <= 1.0001: return sf(k, mean)
    p = 1 / vmr_; rr = mean * p / (1 - p)
    cdf = 0; pmf = p ** rr
    for i in range(k):
        cdf += pmf; pmf *= (i + rr) / (i + 1) * (1 - p)
    return 1 - cdf
for V in (1.5, 2.0):
    ps = [nb_sf(r['k'], r['lam'], V) for r in rows]
    print(f'  при VMR {V}: P(оставить | ноль) по карточкам {[round(p, 2) for p in ps]}, ожидаемо {sum(ps):.2f} из 10')

print('== P5 отмены: доля отменённых штук в базе 14.09-11.10 по 10 карточкам, P(оставить | ноль), если считать с отменами')
for r in rows:
    cd = r['c']['card']; sh = canc[cd] / allu[cd] if allu[cd] else 0
    print(f'  {r["c"]["main_art"]:20} отменено {canc[cd]:3d} из {allu[cd]:3d} ({sh:.0%})  P0 с отменами {sf(r["k"], r["lam"] / (1 - sh) if sh < 1 else r["lam"]):.2f}')
print(f'  всего: {sum(canc[r["c"]["card"]] for r in rows)} из {sum(allu[r["c"]["card"]] for r in rows)}; ожидаемо оставленных при нуле с отменами {sum(sf(r["k"], r["lam"] / (1 - canc[r["c"]["card"]] / allu[r["c"]["card"]])) for r in rows):.2f}')

print('== P6 средне с учётом проверки 29.10 (прошедшие работают до конца месяца, откаченные - 0 после 2 недель)')
for sc in ('средний', 'высокий'):
    full = 0; chk = 0
    for r in rows:
        c = r['c']; _, du, sp, pr = K.main_effect(c, LV, sc); n, du2, sp2, pr2 = K.min_effect(c, sc)
        p = K.pass_prob(c, LV, sc); wk_pr = pr + pr2
        full += wk_pr * MO; chk += wk_pr * 2 + p * wk_pr * (MO - 2)
    print(f'  {sc}: без проверки {full/1e3:+.0f} тыс. (= «Цель»), с проверкой {chk/1e3:+.0f} тыс.')

print('== P7 волна 2 (карточки 11-20) при 20 000, в месяц')
for sc in F.SCN:
    a = K.total(LV, sc, 20); b = K.total(LV, sc, 10)
    print(f'  {sc:8} заказов {a["units"]-b["units"]:+6.1f} расход {(a["spend"]-b["spend"])/1e3:6.0f} тыс. прибыль {(a["prof"]-b["prof"])/1e3:+6.0f} тыс. с АДМ {(a["prof_adm"]-b["prof_adm"])/1e3:+6.0f} тыс.')
w2 = K.cards[10:20]
print('  заказов карточки в неделю у волны 2:', [round(c['u_wk'], 2) for c in w2])
print('  P(оставить | ноль) у волны 2 по своим порогам:', [round(sf(K.threshold(c), 2 * c['u_wk']), 2) for c in w2])

print('== P8 красные кампании и главные товары: на каких товарах тратили 08-11.10 (ads_sku_daily)')
ws = xl['Все кампании']; dec = {}
for r in ws.iter_rows(min_row=4, values_only=True):
    if r[1] and str(r[1]).isdigit(): dec[str(r[1])] = (r[0], r[2], r[4])
mains = {c['main']: (i + 1, c['main_art']) for i, c in enumerate(K.cards[:20])}
off = {}
for g in K.G:
    for s in g['skus']: off[s['sku']] = s['offer']
sp_c = C.defaultdict(C.Counter)
for a in F.L('ads_sku_daily.ndjson'):
    if '2026-10-08' <= a['d'] <= F.B and a['cid'] in dec: sp_c[a['cid']][a['sku']] += a['sp']
cardpos = {c['card']: i + 1 for i, c in enumerate(K.cards)}
for cid, (d_, art, e) in dec.items():
    tot = sum(sp_c[cid].values()); onmain = {mains[s][1]: round(v / 4 * 7) for s, v in sp_c[cid].items() if s in mains}
    cards_ = sorted({cardpos.get(mem.get(s), 0) for s in sp_c[cid]})
    if 'минимум' in str(d_) or onmain or 'до 10.11' in str(d_):
        print(f'  {cid} {str(d_):22} {art:20} темп {e} ₽/нед; карточки (место в очереди) {cards_}; на главных: {onmain}')

print('== P9 отменённый блок «Волна 2» против «Карточки» / «Минимальный клик»')
blk = []; start = False
for r in ws.iter_rows(values_only=True):
    if r[0] and str(r[0]).startswith('Волна 2'): start = True; print('  заголовок блока:', r[0]); continue
    if start and r[1] and r[0] != 'Что делаем': blk.append((r[0], r[1]))
main_art = {c['main_art']: (i + 1, 'волна 1' if i < 10 else 'волна 2' if i < 20 else 'позже') for i, c in enumerate(K.cards)}
minc = {}
for i, c in enumerate(K.cards[:20]):
    for s, art, nm, o in c['others']: minc[art] = 'волна 1' if i < 10 else 'волна 2'
for d_, art in blk:
    print(f'  {art:22} в блоке: {d_:32} | «Карточки»: {main_art.get(art, "-")} | «Минимальный клик»: {minc.get(art, "-")}')

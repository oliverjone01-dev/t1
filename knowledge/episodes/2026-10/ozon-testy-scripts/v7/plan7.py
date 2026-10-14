# v7: план исполнения варианта 1 (Иван 14.10: «выбираем вариант 1», нужен повышенный клик, лесенка ставок или выходные).
# Модель прибыли и сценарии - v5/forecast.py (импорт, без копий логики). Горизонт: 4 недели 15.10-11.11 (до распродажи),
# плюс «установившийся месяц» = 4,33 недели в конечном состоянии варианта. Прибыль без АДМ (ответ «2а»), строка с АДМ 30% рядом.
# Варианты (у всех ставка за заказ 5%, цена у 17 артикулов 15.10, у 9 карточек теста 4 - с 22.10):
#  А  клик на минимум: нед 1-2 только KONUX на минимум, с нед 3 весь клик минимум (В1б)
#  Б  как задуман: KONUX и KUVINO на текущем бюджете весь срок, остальной клик с нед 3 минимум (В1)
#  В  А + лесенка с 30.10 (после замера цены) на 3 артикулах: 5 000 -> 10 000 -> 15 000 ₽/нед, шаг вверх только если
#     заказы карточки за неделю выросли; стоп-правило: нет роста - откат на минимум
#  Г  А + клик только Сб-Вс на тех же 3 артикулах, 10 000 ₽ на выходные
# Клик сверх минимума: заказы по отчёту рекламы = u_ref x (бюджет / w_ref)^0,81 (E_SP v5), доля своих k по сценарию v5,
# цена ниже -> заказы x (1 - шаг)^ε. u_ref, w_ref - отчёт рекламы по товару 03.07-11.10 (ads_sku_daily, om / цена).
import sys, os, json, collections as C
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE + '/../v5')
import forecast as F
D = F.D; WK_SKU = 14.3                                           # 03.07-11.10 = 100 дней
sp = C.Counter(); om = C.Counter()
for a in F.L('ads_sku_daily.ndjson'):
    if a['cid'] != F.CPO_ID: sp[a['sku']] += a['sp']; om[a['sku']] += a['om']
WAIT = {F.art2sku[a] for a in ('GGT-03-3-3-E-16080', 'GGL-09-2', 'GGM-01-1', 'GGK-02-2-2-80', 'GGL-07-XL-2', 'GGM-24-1',
                                'GGM-23-3-1', 'GGT-03-3-5-E-16080', 'GGM-16-1-3-LED')}
NOW = set(F.lst) - WAIT
ACTIVE = {k for k, c in F.camp.items() if F.active(c)}
KONUX = F.KONUX_IDS; SEL = F.SEL                                # SEL = KONUX 37675958 + KUVINO 39931246
WEEKEND = {'низкий': 1.0, 'средний': 1.0, 'высокий': 1.12}     # ₽ на заказ рекламы Сб-Вс на 11% ниже будней (03.07-11.10), шум
STEPS = (5000, 10000, 15000)

def ref(sku):
    r = F.rows[sku]; w = sp[sku] / WK_SKU; u = om[sku] / r['p0'] / WK_SKU
    return w, u
def extra(sku, w, sc, eff=1.0):
    """прибыль в неделю от клика с бюджетом w сверх минимума на товаре sku (цена уже снижена)"""
    r = F.rows[sku]; w0, u0 = ref(sku)
    if not w0 or not u0 or w <= F.MIN_WK: return 0, 0
    st = F.lst[sku]['step'] / 100 if sku in F.lst else 0
    p1 = r['p0'] * (1 - st); a1 = F.pi(r, p1, 0.05, r['s'])
    du = F.K_CLK[sc] * u0 * ((w / w0) ** F.E_SP - (F.MIN_WK / w0) ** F.E_SP) * (1 - st) ** F.EPS[sc] * eff
    du *= 1 - F.XFER[sc]                                        # часть «своих» перетянута у соседей по карточке
    return du * a1 - (w - F.MIN_WK), du
def kbe(sku, w):
    """какая доля заказов рекламы должна быть своей, чтобы бюджет w окупился (средняя эластичность, без перетока)"""
    r = F.rows[sku]; w0, u0 = ref(sku); st = F.lst[sku]['step'] / 100 if sku in F.lst else 0
    a1 = F.pi(r, r['p0'] * (1 - st), 0.05, r['s'])
    du = u0 * ((w / w0) ** F.E_SP - (F.MIN_WK / w0) ** F.E_SP) * (1 - st) ** F.EPS['средний']
    return (w - F.MIN_WK) / (du * a1) if du > 0 else None

# кандидаты лесенки: все товары с бюджетом от минимума (2 000 ₽/нед, иначе степень 0,81 экстраполирует с нуля) и 2+ заказами по отчёту рекламы за 03.07-11.10, ранжируем по kbe при 10 000 ₽/нед
cand = []
for sku in (s for s in sp if s in F.rows):
    w0, u0 = ref(sku)
    if u0 * WK_SKU >= 2 and w0 >= F.MIN_WK: cand.append((kbe(sku, 10000), sku, w0, u0))
cand.sort()
LAD = [x[1] for x in cand[:3]]                                 # дальше 3-го нужно больше 100% своих

def week(sc, cut, keep):
    x = F.run('В1б', sc, cut=cut, keep=keep); return {k: v / F.H for k, v in x.items() if isinstance(v, (int, float))}
def plan(v, sc):
    """4 недели: список недельных итогов; плюс установившаяся неделя"""
    base = week(sc, None, ACTIVE)                               # как сейчас без цены: нужен для разницы
    b0 = F.run('В0', sc); b0 = {k: val / F.H for k, val in b0.items()}
    W = []
    for t in range(4):
        cut = NOW if t == 0 else set(F.lst)
        if v == 'Б': keep = ACTIVE if t < 2 else SEL
        else: keep = ACTIVE - KONUX if t < 2 else set()
        x = week(sc, cut, keep); add = 0; du = 0; spx = 0
        if v in ('В', 'Г') and t >= 2:                          # с 30.10
            for sku in LAD:
                if v == 'В':
                    lvl = STEPS[t - 2]
                    gain, d = extra(sku, lvl, sc)
                    if F.K_CLK[sc] == 0 and t == 3: lvl = F.MIN_WK; gain, d = 0, 0   # стоп-правило: на нед 3 роста нет -> откат
                else:
                    lvl = 10000; gain, d = extra(sku, lvl, sc, WEEKEND[sc])
                add += gain; du += d; spx += lvl - F.MIN_WK
        x['prof'] += add; x['prof_adm'] += add; x['units'] += du; x['clk'] += spx
        W.append(x)
    # установившийся режим
    if v == 'Б': keep = SEL
    else: keep = set()
    y = week(sc, set(F.lst), keep); add = du = spx = 0
    if v in ('В', 'Г'):
        for sku in LAD:
            lvl = 15000 if v == 'В' else 10000
            gain, d = extra(sku, lvl, sc, WEEKEND[sc] if v == 'Г' else 1)
            if v == 'В' and gain < 0: gain, d, lvl = 0, 0, F.MIN_WK            # стоп-правило оставляет только окупившиеся
            if v == 'Г' and gain < 0: gain, d, lvl = 0, 0, F.MIN_WK
            add += gain; du += d; spx += lvl - F.MIN_WK
    y['prof'] += add; y['prof_adm'] += add; y['units'] += du; y['clk'] += spx
    return W, y, b0

if __name__ == '__main__':
    out = dict(lad=[], res={})
    print('кандидаты лесенки (kbe = нужная доля своих заказов при 10 000 ₽/нед, средняя эластичность):')
    for k_, sku, w0, u0 in cand[:12]:
        r = F.rows[sku]
        stp = F.lst[sku]['step'] if sku in F.lst else 0
        print(f'  {r["art"]:20} шаг -{stp}%  клик {w0:7,.0f} ₽/нед  заказов рекламы {u0:.2f}/нед  '
              f'прибыль заказа {F.pi(r, r["p0"]*(1-stp/100), 0.05, r["s"]):7,.0f}  своих нужно {k_:.0%}'
              f'{"  -> лесенка" if sku in LAD else ""}{"  (карточка теста 4)" if sku in WAIT else ""}'.replace(',', ' '))
        out['lad'].append(dict(art=r['art'], step=stp, u_store=F.U[sku] / F.WEEKS, w0=w0, u0=u0, kbe=k_, lad=sku in LAD, wait=sku in WAIT,
                               camp=sorted(c for c in F.camp if F.art2sku.get(F.camp[c]['off']) == sku and c in ACTIVE)))
    print('\nитог, тыс. ₽ (разница с «как сейчас»): 4 недели 15.10-11.11 | месяц в установившемся режиме (4,33 нед)')
    for v in ('А', 'Б', 'В', 'Г'):
        for sc in F.SCN:
            W, y, b0 = plan(v, sc)
            d4 = sum(w['prof'] for w in W) - 4 * b0['prof']; dm = (y['prof'] - b0['prof']) * 4.33
            res = dict(d4=d4, d4_adm=sum(w['prof_adm'] for w in W) - 4 * b0['prof_adm'], dm=dm,
                       dm_adm=(y['prof_adm'] - b0['prof_adm']) * 4.33,
                       u4=sum(w['units'] for w in W), u4_0=4 * b0['units'], um=y['units'] * 4.33, um_0=b0['units'] * 4.33,
                       turn_m=y['turn'] * 4.33, turn_m0=b0['turn'] * 4.33, pay_m=y['pay'] * 4.33, pay_m0=b0['pay'] * 4.33,
                       clk_m=y['clk'] * 4.33, clk_m0=b0['clk'] * 4.33, cpo_m=y['cpo'] * 4.33,
                       drr=(y['clk'] + y['cpo']) / y['turn'], drr0=b0['drr'], prof_m=y['prof'] * 4.33, prof_m0=b0['prof'] * 4.33,
                       prof_adm_m=y['prof_adm'] * 4.33, prof_adm_m0=b0['prof_adm'] * 4.33)
            out['res'][f'{v}|{sc}'] = res
            print(f'  {v} {sc:8} 4 нед {d4/1e3:+6.0f} (с АДМ {res["d4_adm"]/1e3:+6.0f})  месяц {dm/1e3:+6.0f}  '
                  f'заказов/мес {res["um"]:5.0f} (сейчас {res["um_0"]:.0f})  оборот/мес {res["turn_m"]/1e6:5.2f} (сейчас {res["turn_m0"]/1e6:.2f})  '
                  f'клик/мес {res["clk_m"]/1e3:4.0f} (сейчас {res["clk_m0"]/1e3:.0f})  ДРР {res["drr"]:.1%}')
    json.dump(out, open('/tmp/ozon-v7/plan7.json', 'w'), ensure_ascii=False, indent=1)

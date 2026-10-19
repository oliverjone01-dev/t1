# v7 iter2: план исполнения варианта 1 (Иван 14.10: «выбираем вариант 1», повышенный клик, лесенка ставок или выходные).
# Правки по return ФЕНИКСА 6,35 (G1-G10): две фазы, чтобы цена и клик не смешались в одной карточке в одни недели.
#  Фаза 1, 15.10-11.11 (4 недели): цена у 17 артикулов с 15.10, у 9 карточек теста 4 - с 22.10 (при продлении теста 4 - с 29.10).
#     Клик в карточках, где снижаем цену, не трогаем (иначе стоп-правило цены по доле в показах сработает от нашего уреза, G1).
#     1а: клик весь как сейчас (39 из 46 кампаний - в карточках цены). 1б: дорогой клик (10 000+ ₽/нед по темпу с 08.10) на минимум сразу,
#     цена и клик в этих карточках смешаются.
#  Фаза 2, с 19.11 (после распродажи), 6 недель: клик KONUX и KUVINO (TRUBIS E-16080 не окупается ни при каком бюджете):
#     А минимум; Б текущий бюджет; В лесенка 5 000 -> 10 000 -> 15 000 ₽/нед, ступень 2 недели, шаг вверх по правилу;
#     Г 5 000 ₽/нед только Сб-Вс, то же правило; Д умеренный: KONUX 10 000, KUVINO 5 000 весь срок.
# Модель прибыли и сценарии - v5/forecast.py (импорт). Прибыль без АДМ (ответ «2а»).
# Клик на товаре: заказы рекламы = o_ref x (бюджет / w_ref)^0,81, o_ref и w_ref - кампания товара за 14.09-11.10 (та же база,
# что потеря при урезе в v5, G5); своих k по сценарию; прибыль заказа - после снижения цены; эластичность к заказам рекламы
# не применяется (она уже в базе заказов, G5 двойной счёт).
# Правило ступени (G4): за 2 недели заказов по отчёту рекламы не меньше 2 x бюджет / (0,375 x прибыль заказа)
# (0,375 = безубыточность среднего сценария: k 0,5 x (1 - переток 0,25)). Иначе - минимум до конца фазы.
# Ожидание лесенки - Монте-Карло: заказы рекламы ~ Пуассон, прибыль - от своих заказов (k).
import sys, os, json, random, math, collections as C
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE + '/../v5')
import forecast as F
WAIT = {F.art2sku[a] for a in ('GGT-03-3-3-E-16080', 'GGL-09-2', 'GGM-01-1', 'GGK-02-2-2-80', 'GGL-07-XL-2', 'GGM-24-1',
                                'GGM-23-3-1', 'GGT-03-3-5-E-16080', 'GGM-16-1-3-LED')}
# Иван 14.10 «а»: у EVELIX, OSOLIS, ARFEO цена уже снижена 08.10 (-12% / -10% / -16% с 25.09) - второй шаг с 15.10 не делаем, решение 22.10
PRICE_08 = {F.art2sku[a] for a in ('GGM-02-1-2', 'GGL-09-2', 'GGK-02-2-2-80')}
NOW = set(F.lst) - WAIT - PRICE_08 - {F.art2sku['GGT-48-5-1-100-180']}     # QUATRIS: в 1в его кампания 44988572 уходит на минимум 15.10, цена - 22.10 с новой базой показов
ACTIVE = {k for k, c in F.camp.items() if F.active(c)}
# --- карточки (card_groups.json): кампания в карточке цены, если её товар в одной карточке с любым из 26
G = json.load(open(F.D + 'card_groups.json'))['groups']
card = {s['sku']: g['main'] for g in G for s in g['skus']}
off2card = {s['offer']: g['main'] for g in G for s in g['skus']}
PCARDS = {card[s] for s in F.lst if s in card}
def camp_card(c):
    o = c['off']
    if o in off2card: return off2card[o]
    t = o.split('-')                                            # кампании на группу (GGT-E-16080, GGM-20): по совпадению частей артикула
    hits = {cd for of, cd in off2card.items() if all(x in of.split('-') for x in t)}
    return next(iter(hits)) if len(hits) == 1 else ('?' + o)
IN_P = {k for k in ACTIVE if camp_card(F.camp[k]) in PCARDS}
import datetime as _dt
def tempo(k):                                                    # ₽/нед по темпу 08-11.10
    return sum(a['sp'] for a in F.ads if a['id'] == k and '2026-10-08' <= a['d'] <= F.B) / 4 * 7
EXP = {k for k in ACTIVE if tempo(k) >= 10000}
OUT_P = ACTIVE - IN_P
# --- фаза 2: товары и их кампании (база - кампания 14.09-11.10, как в Word 13.10 раздел 4)
LAD = {'GGT-35-5-1-100-180': '37675958', 'GGM-18-2-2': '39931246'}
TRUBIS = {'GGT-03-3-3-E-16080': '37239106'}
D_W = {'GGT-35-5-1-100-180': 10000, 'GGM-18-2-2': 5000}
W_NOW = {'GGT-35-5-1-100-180': 30000, 'GGM-18-2-2': 20000, 'GGT-03-3-3-E-16080': F.MIN_WK}   # TRUBIS: старая кампания стоп 08.10
LAD_IDS = {'37675958', '39931246'}                              # идущие кампании лесенки (в фазе 1 они в карточках цены, не трогаем)
STEPS = (5000, 10000, 15000); WK2 = 6                          # 3 ступени по 2 недели
WEEKEND = {'низкий': 0.79, 'средний': 0.89, 'высокий': 1.0}    # 2 дня из 7: 0,79 по степени 0,81 на день (ФЕНИКС G10) x 1,12 дешевле заказ Сб-Вс (шум)
BE = 0.375

def ref(art):
    c = F.camp[{**LAD, **TRUBIS}[art]]; return c['sp'] / F.WEEKS, c['o'] / F.WEEKS
def pi_cut(art):
    sku = F.art2sku[art]; r = F.rows[sku]; return F.pi(r, r['p0'] * (1 - F.lst[sku]['step'] / 100), 0.05, r['s'])
def mu(art, w, eff=1.0):
    """заказов рекламы в неделю при бюджете w"""
    w0, o0 = ref(art); return o0 * (w / w0) ** F.E_SP * eff
def val(art, w, sc, eff=1.0):
    """прибыль клика в неделю при бюджете w против минимума: свои заказы x прибыль - расход сверх минимума"""
    return F.K_CLK[sc] * (mu(art, w, eff) - mu(art, F.MIN_WK)) * pi_cut(art) - (w - F.MIN_WK)
def kbe(art, w):
    d = mu(art, w) - mu(art, F.MIN_WK); return (w - F.MIN_WK) / (d * pi_cut(art))
def thr(art, w): return math.ceil(2 * w / (BE * pi_cut(art)))
def ladder(art, sc, weekend=False, N=20000, seed=7):
    """ожидаемая прибыль за 6 недель против минимума и доля дошедших до каждой ступени"""
    rnd = random.Random(seed); tot = 0; reach = C.Counter(); spend = 0
    steps = (5000, 5000, 5000) if weekend else STEPS
    eff = WEEKEND[sc] if weekend else 1.0
    def pois(m):
        L = math.exp(-m); k = 0; p = 1.0
        while True:
            p *= rnd.random()
            if p < L: return k
            k += 1
    for _ in range(N):
        on = True
        for i, w in enumerate(steps):
            if not on: break
            reach[i] += 1
            tot += 2 * val(art, w, sc, eff); spend += 2 * (w - F.MIN_WK)
            n = pois(2 * mu(art, w, eff))
            if n < thr(art, w): on = False
    return tot / N, {i: reach[i] / N for i in range(3)}, spend / N

def phase1(sc, out_min, ext=False, rate=False):
    # out_min: False - 1а всё как сейчас; True - 1б весь дорогой клик на минимум; 'v' - 1в дорогой на минимум, кроме KONUX и KUVINO
    """4 недели 15.10-11.11 против «как сейчас»"""
    F.RATE = rate
    b0 = {k: v / F.H for k, v in F.run('В0', sc).items()}
    S_ = C.Counter()
    for t in range(4):
        cut = NOW if (t == 0 or (ext and t == 1)) else set(F.lst)
        keep = ACTIVE - (EXP - LAD_IDS if out_min == 'v' else EXP) if out_min else ACTIVE
        x = F.run('В1б', sc, cut=cut, keep=keep)
        for k in ('prof', 'prof_adm', 'units', 'turn', 'pay', 'clk'): S_[k] += x[k] / F.H
    F.RATE = False
    return {k: S_[k] - 4 * b0[k] for k in S_}, b0

def phase2(sc, out_min):
    """6 недель с 19.11: база - цена у 26, клик после фазы 1, на 3 товарах - текущий бюджет (Б); варианты - разница к Б"""
    keep = ACTIVE - EXP if out_min else ACTIVE
    base = F.run('В1б', sc, cut=set(F.lst), keep=keep); base = {k: v / F.H for k, v in base.items()}
    R = {}
    vB = sum(val(a, W_NOW[a], sc) for a in LAD)                # Б: как есть
    vA = 0                                                       # А: все три на минимуме
    lad = {a: ladder(a, sc) for a in LAD}; wkd = {a: ladder(a, sc, True) for a in LAD}
    R['Б'] = 0.0; R['А'] = WK2 * (vA - vB); R['В'] = sum(x[0] for x in lad.values()) - WK2 * vB
    R['Г'] = sum(x[0] for x in wkd.values()) - WK2 * vB
    R['Д'] = WK2 * (sum(val(a, D_W[a], sc) for a in LAD) - vB)
    return R, base, lad, wkd

if __name__ == '__main__':
    out = dict(in_p=sorted(IN_P), out_p=sorted(OUT_P), ph1={}, ph2={}, lad={})
    w_in = sum(F.camp[k]['sp'] for k in IN_P) / F.WEEKS; w_out = sum(F.camp[k]['sp'] for k in OUT_P) / F.WEEKS
    print(f'кампаний идёт {len(ACTIVE)}: в карточках цены {len(IN_P)} ({w_in:,.0f} ₽/нед), вне {len(OUT_P)} ({w_out:,.0f} ₽/нед); '
          f'дорогой клик (10 000+ ₽/нед по темпу 08-11.10): {len(EXP)} кампаний, {sum(tempo(k) for k in EXP):,.0f} ₽/нед; '
          f'{sorted((F.camp[k]["off"], round(tempo(k))) for k in EXP)}; '
          f'не сопоставлено с карточкой: {[F.camp[k]["off"] for k in ACTIVE if str(camp_card(F.camp[k])).startswith("?")]}'.replace(',', ' '))
    print('\nфаза 1, 4 недели, тыс. ₽ против «как сейчас» (база: средний бюджет 4 недель | темп с даты запуска, RATE):')
    for om in (False, True, 'v'):
        for sc in F.SCN:
            d, b0 = phase1(sc, om); dr, _ = phase1(sc, om, rate=True); de, _ = phase1(sc, om, ext=True)
            out['ph1'][f'{om}|{sc}'] = dict(d=d, dr=dr, de=de, b0=b0)
            print(f'  {dict([(False, "1а клик как сейчас        "), (True, "1б дорогой клик на минимум"), ("v", "1в то же, KONUX/KUVINO как есть")])[om]} {sc:8} прибыль {d["prof"]/1e3:+6.0f} '
                  f'(темп {dr["prof"]/1e3:+6.0f}, тест 4 продлён {de["prof"]/1e3:+6.0f})  с АДМ {d["prof_adm"]/1e3:+6.0f}  '
                  f'заказов {d["units"]:+5.1f}  оборот {d["turn"]/1e6:+5.2f} млн  К выплате {d["pay"]/1e6:+5.2f} млн  клик {d["clk"]/1e3:+5.0f}')
    print('\nфаза 2, кандидаты (база - кампания 14.09-11.10):')
    for a in {**LAD, **TRUBIS}:
        w0, o0 = ref(a)
        print(f'  {a:20} w_ref {w0:7,.0f} заказов рекламы {o0:.2f}/нед  своих нужно при 10 000: {kbe(a, 10000):.0%}; '
              f'порог ступени 2 нед: {[thr(a, w) for w in STEPS]} заказов'.replace(',', ' '))
        out['lad'][a] = dict(w0=w0, o0=o0, kbe10=kbe(a, 10000), thr=[thr(a, w) for w in STEPS], mu=[mu(a, w) for w in STEPS])
    print('\nфаза 2, 6 недель с 19.11, тыс. ₽ против Б (KONUX 30 000, KUVINO 20 000 как сейчас):')
    for sc in F.SCN:
        R, base, lad, wkd = phase2(sc, True)
        out['ph2'][sc] = dict(R=R, reach={a: x[1] for a, x in lad.items()}, reach_w={a: x[1] for a, x in wkd.items()},
                              spend={a: x[2] for a, x in lad.items()}, base=base)
        print(f'  {sc:8} ' + '  '.join(f'{v} {R[v]/1e3:+6.0f}' for v in 'АБВГД') +
              '   дошли до ступени 3: ' + ', '.join(f'{a[:10]} {x[1][2]:.0%}' for a, x in lad.items()))
    print('\nустановившийся месяц (4,33 нед): цена у 26, 1в, фаза 2 Д (KONUX 10 000, KUVINO 5 000), против «как сейчас»:')
    for rate in (False, True):
        for sc in F.SCN:
            F.RATE = rate
            b0 = F.run('В0', sc); x = F.run('В1б', sc, cut=set(F.lst), keep=ACTIVE - (EXP - LAD_IDS)); F.RATE = False
            dD = sum(val(a, D_W[a], sc) - val(a, W_NOW[a], sc) for a in LAD)
            dDu = sum(F.K_CLK[sc] * (mu(a, D_W[a]) - mu(a, W_NOW[a])) for a in LAD)
            m = {k: (x[k] - b0[k]) / F.H * 4.33 for k in ('prof', 'units', 'turn', 'pay', 'clk')}
            for a in LAD:
                sk = F.art2sku[a]; r = F.rows[sk]; p1 = r['p0'] * (1 - F.lst[sk]['step'] / 100)
                du_ = F.K_CLK[sc] * (mu(a, D_W[a]) - mu(a, W_NOW[a])) * 4.33; m['turn'] += du_ * p1; m['pay'] += du_ * r['keep'] * p1
            m['prof'] += dD * 4.33; m['units'] += dDu * 4.33; m['clk'] += sum(D_W[a] - W_NOW[a] for a in LAD) * 4.33
            out['month|' + str(rate) + '|' + sc] = dict(m=m, units0=b0['units'] / F.H * 4.33, turn0=b0['turn'] / F.H * 4.33,
                                                       clk0=b0['clk'] / F.H * 4.33, drr0=b0['drr'])
            print(f'  {"темп 08-11.10" if rate else "ср. 4 недель "} {sc:8} прибыль {m["prof"]/1e3:+6.0f}  заказов {m["units"]:+5.1f} '
                  f'(сейчас {b0["units"]/F.H*4.33:.0f})  оборот {m["turn"]/1e6:+5.2f} млн (сейчас {b0["turn"]/F.H*4.33/1e6:.2f})  '
                  f'К выплате {m["pay"]/1e6:+5.2f} млн  клик {m["clk"]/1e3:+5.0f} (сейчас {b0["clk"]/F.H*4.33/1e3:.0f})')
    json.dump(out, open('/tmp/ozon-v7/plan7.json', 'w'), ensure_ascii=False, indent=1, default=float)

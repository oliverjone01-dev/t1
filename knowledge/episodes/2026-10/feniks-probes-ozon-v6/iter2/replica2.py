# ФЕНИКС 14.10, итерация 2: независимая реплика модели 76d8244 по текстам страницы (не по xlsx).
# Сценарий = структура расходов (низкий - август, средний - июль-сентябрь суммами, высокий - сентябрь) + рычаги.
# FV6=<каталог rp_2026-03..10.txt> python3 -I -B replica2.py
import os, re, json
S = os.environ.get('FV6', '/tmp/feniks-v6/branch/')
MON = ['март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь']
def num(s):
    s = s.replace('−', '-').replace('\xa0', '').replace(' ', '').replace(' ', '').replace('₽', '').replace(',', '.')
    try: return float(s)
    except ValueError: return None
def table(txt, head, n):
    out, on = {}, False
    for line in txt.splitlines():
        if line.startswith(head + '\t'): on = True; continue
        if on:
            p = line.split('\t')
            if len(p) < n + 1: break
            out[p[0]] = [num(x) for x in p[1:n + 1]]
    return out
sep = open(os.path.join(S, 'rp_2026-09.txt'), encoding='utf-8').read()
T3 = table(sep, 'Статья\tмарт 2026', 7); T4 = table(sep, 'Показатель\tмарт 2026', 7)
U = []
for k in range(3, 10):
    t = open(os.path.join(S, f'rp_2026-{k:02d}.txt'), encoding='utf-8').read()
    U.append(int(re.search(r'\nВсего\n[\d\s]+ ₽\n.*\nреализовано (\d+) шт', t).group(1)))
def g(k, j): return T3[k][j]
def agg(js):
    s = lambda k: sum(g(k, j) for j in js)
    N = s('Начислено (оборот)'); ads = s('Реклама (весь расход по начислениям OZON)')
    logoz = s('Всего сборов = затраты площадки') - s('Комиссия') - s('Эквайринг') - s('Хранение') - s('Прочие (без рекламы)') - ads
    dinc = s('К выплате (с учетом Доставки покупателя)') - s('К выплате'); ship = s('К выплате') - s('СС произв.') + dinc - s('Валовая прибыль')
    u = sum(U[j] for j in js)
    st = dict(comm=s('Комиссия') / N, logi=logoz / N, acq=s('Эквайринг') / N, sto=s('Хранение') / N, oth=s('Прочие (без рекламы)') / N,
              cpo=sum(T4['за заказ'][j] for j in js) / N, clk=sum(T4['за клик'][j] for j in js) / N, cc=s('СС произв.') / N,
              real=s('Реализовано (база налога)') / N, dinc=dinc / u, ship=ship / u, adm=0.3, k=0.86, tax=0.15)
    st['b'] = (s('АДМ 30%') / 0.3 - s('К выплате') - 0.86 * ads) / N
    return st
SC = {'low': agg([5]), 'mid': agg([4, 5, 6]), 'high': agg([6])}
N0, U0 = g('Начислено (оборот)', 6), U[6]; P0 = N0 / U0
LEV = {'low': dict(eps=-1.0, u2=2.1 * 0.3 * 30.4 / 23, mk=0.0), 'mid': dict(eps=-2.0, u2=2.1 * 0.5 * 30.4 / 23, mk=0.5), 'high': dict(eps=-3.6, u2=2.1 * 30.4 / 23, mk=1.0)}
def clkpb(j):
    rv = T4['Зеркала, за клик: выручка'][j] + T4['Мебель, за клик: выручка'][j]; sp = T4['Зеркала, за клик: расход'][j] + T4['Мебель, за клик: расход'][j]
    return rv / sp
R = {'low': clkpb(5), 'mid': clkpb(4), 'high': clkpb(6)}
S26, STEP, CC26, MU = 0.48, 0.095, 0.1387 / 0.1511, 46 / 128
def col(st, u, N, NS, N26, clk):
    m = 1 - st['comm'] - st['logi'] - st['acq'] - st['sto'] - st['oth'] - st['cpo']
    kv = N * m - clk; ads = N * st['cpo'] + clk
    cc = (N0 + NS + N26 * CC26) * st['cc']
    gross = kv - cc - u * st['ship'] + u * st['dinc']
    admv = st['adm'] * (kv + st['k'] * ads + st['b'] * N); tax = st['tax'] * st['real'] * N
    return dict(N=N, kv=kv, ads=ads, net=gross - admv - tax)
def levers(sc, eps=None):
    L = dict(LEV[sc]); e = L['eps'] if eps is None else eps
    l1u = U0 * S26 * (-e) * STEP; l1ns = N0 * S26 * (-e) * STEP; l1n = l1ns - STEP * (N0 * S26 + l1ns)
    l2u = 20 * L['u2']; l2n = l2u * 57000; l2c = 20 * 1500 * 4.35
    l3u = max(0, (round((130 + 116) / 2) - 60) * L['mk'] - l1u * MU); l3n = l3u * 3370310 / 60
    return dict(l1u=l1u, l1ns=l1ns, l1n=l1n, l2u=l2u, l2n=l2n, l2c=l2c, l3u=l3u, l3n=l3n,
                su=l1u + l2u + l3u, sn=l1n + l2n + l3n, sns=l2n + l3n, lev=N0 + l1n + l2n + l3n)
out = {}
for sc, st in SC.items():
    base_clk = st['clk'] * N0
    lv = levers(sc)
    lev = col(st, U0 + lv['su'], lv['lev'], lv['sns'], lv['l1ns'], base_clk + lv['l2c'])
    gap = max(0, 30e6 - lv['lev'])
    full = col(st, U0 + lv['su'] + gap / P0, lv['lev'] + gap, lv['sns'] + gap, lv['l1ns'], base_clk + lv['l2c'] + gap / R[sc])
    scale = col(st, U0 * 30e6 / N0, 30e6, 30e6 - N0, 0, st['clk'] * 30e6)
    nowx = col(st, U0, N0, 0, 0, base_clk)
    # вклад рычагов по одному: разница колонок
    def only(i):
        L = dict(LEV[sc]); keep = levers(sc)
        z = {k: 0 for k in keep}; z['lev'] = N0
        if i == 1: z.update(l1u=keep['l1u'], l1ns=keep['l1ns'], l1n=keep['l1n'], su=keep['l1u'], sn=keep['l1n'], sns=0, lev=N0 + keep['l1n'])
        if i == 2: z.update(l2c=keep['l2c'], su=keep['l2u'], sn=keep['l2n'], sns=keep['l2n'], lev=N0 + keep['l2n'])
        if i == 3: z.update(su=keep['l3u'], sn=keep['l3n'], sns=keep['l3n'], lev=N0 + keep['l3n'])
        c = col(st, U0 + z['su'], z['lev'], z['sns'], z.get('l1ns', 0) if i == 1 else 0, base_clk + z['l2c'])
        return c['net'] - nowx['net']
    out[sc] = dict(lev_N=lv['lev'], lev_net=lev['net'], full_net=full['net'], full_ads=full['ads'], scale_net=scale['net'], now_net=nowx['net'],
                   l1=only(1), l2=only(2), l3=only(3), R=R[sc], clk_base=base_clk)
    # то же при рекламе сентября (клик 819 422 + доля CPO сентября), структура без рекламы - сценария
    st2 = dict(st); st2['cpo'] = SC['high']['cpo']
    lev2 = col(st2, U0 + lv['su'], lv['lev'], lv['sns'], lv['l1ns'], SC['high']['clk'] * N0 + lv['l2c'])
    out[sc]['lev_net_sep_ads'] = lev2['net']
for sc, o in out.items():
    print(sc, {k: (round(v, 3) if isinstance(v, float) and abs(v) < 100 else round(v)) for k, v in o.items()})
# бэктест: структура июля-сентября на марте-июне (вне выборки) и на июле-сентябре (в выборке)
st = SC['mid']; sts = SC['high']
for j in range(7):
    N = g('Начислено (оборот)', j); u = U[j]
    pm = col(st, u, N, N - N0, 0, st['clk'] * N); ps = col(sts, u, N, N - N0, 0, sts['clk'] * N)
    tag = 'в выборке' if j in (4, 5, 6) else 'вне выборки'
    print(f'{MON[j]}: факт {g("Чистая прибыль", j):+,.0f}; структура июля-сентября {pm["net"]:+,.0f} (ошибка {pm["net"]-g("Чистая прибыль", j):+,.0f}, {tag}); структура сентября {ps["net"]:+,.0f} (ошибка {ps["net"]-g("Чистая прибыль", j):+,.0f})')
print('комиссия: средний', round(SC['mid']['comm'], 4), 'сентябрь', round(SC['high']['comm'], 4), '; октябрь 01-12 (main) 0.508 -> разница со средним', round(0.508 - SC['mid']['comm'], 4))

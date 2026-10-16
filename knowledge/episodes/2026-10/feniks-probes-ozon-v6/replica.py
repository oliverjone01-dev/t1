# ФЕНИКС 14.10, аудит OZON v6: независимая реплика модели forecast30.py по тексту страницы «Отчет» (не по xlsx).
# Вход: каталог FV6 с rp_2026-06..10.txt (page_text.js на снимке ветки 39a3e3e). Модуль для probes_v6.py.
import re, os
S = os.environ.get('FV6', '/tmp/feniks-v6/branch/')
MON = ['март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь']

def num(s):
    s = s.replace('−', '-').replace('\xa0', '').replace(' ', '').replace(' ', '').replace('₽', '').replace(',', '.')
    try:
        return float(s)
    except ValueError:
        return None

def table(txt, head, n):
    out, on = {}, False
    for line in txt.splitlines():
        if line.startswith(head + '\t'):
            on = True; continue
        if on:
            p = line.split('\t')
            if len(p) < n + 1: break
            out[p[0]] = [num(x) for x in p[1:n + 1]]
    return out

sep = open(os.path.join(S, 'rp_2026-09.txt'), encoding='utf-8').read()
T3 = table(sep, 'Статья\tмарт 2026', 7)
T4 = table(sep, 'Показатель\tмарт 2026', 7)
units = {}
for m, fn in [('июнь', '06'), ('июль', '07'), ('август', '08'), ('сентябрь', '09')]:
    t = open(os.path.join(S, f'rp_2026-{fn}.txt'), encoding='utf-8').read()
    units[m] = int(re.search(r'Реализовано, шт\t(\d+)\t(\d+)', t).group(2))

def month(m):
    j = MON.index(m)
    g = {k: v[j] for k, v in T3.items()}
    N = g['Начислено (оборот)']
    ads = g['Реклама (весь расход по начислениям OZON)']
    logoz = g['Всего сборов = затраты площадки'] - g['Комиссия'] - g['Эквайринг'] - g['Хранение'] - g['Прочие (без рекламы)'] - ads
    dinc = g['К выплате (с учетом Доставки покупателя)'] - g['К выплате']
    ship = g['К выплате'] - g['СС произв.'] + dinc - g['Валовая прибыль']
    U = units.get(m)
    st = dict(N0=N, U0=U, comm=g['Комиссия'] / N, logi=logoz / N, acq=g['Эквайринг'] / N, sto=g['Хранение'] / N,
              oth=g['Прочие (без рекламы)'] / N, cpo=T4['за заказ'][j] / N, clk0=T4['за клик'][j], cc=g['СС произв.'] / N,
              real=g['Реализовано (база налога)'] / N, dinc_u=dinc / U if U else None, ship_u=ship / U if U else None,
              adm=0.30, k=0.86, tax=0.15, net=g['Чистая прибыль'], kv=g['К выплате'], clk_cab=T4['за клик'][j])
    st['b'] = (g['АДМ 30%'] / 0.30 - g['К выплате'] - 0.86 * ads) / N
    return st

def col(st, u, N, Ns, clk):
    fees = N * (st['comm'] + st['logi'] + st['acq'] + st['sto'] + st['oth'] + st['cpo']) + clk
    kv = N - fees
    gross = kv - Ns * st['cc'] - u * st['ship_u'] + u * st['dinc_u']
    ads = N * st['cpo'] + clk
    admv = st['adm'] * (kv + st['k'] * ads + st['b'] * N)
    taxv = st['tax'] * st['real'] * N
    return dict(N=N, units=u, kv=kv, ads=ads, gross=gross, admv=admv, taxv=taxv, net=gross - admv - taxv)

SC = dict(low=dict(eps=-1.0, u2=2.1 * 0.3 * 30.4 / 23, mk=0.0, R=2.0), mid=dict(eps=-2.0, u2=2.1 * 0.5 * 30.4 / 23, mk=0.5, R=3.6),
          high=dict(eps=-3.6, u2=2.1 * 30.4 / 23, mk=1.0, R=6.2))
LEV = dict(s26=0.48, step=0.095, n2=20, p2=57000, c2=1500, w2=4.35, mT=round((130 + 116) / 2), m0=60, mp=3370310 / 60, T=30e6)

def levers(st, sc, on=(1, 2, 3), mir_cap=False, mir_share=46 / 128):
    L = LEV
    l1u = st['U0'] * L['s26'] * (-sc['eps']) * L['step'] if 1 in on else 0
    l1ns = st['N0'] * L['s26'] * (-sc['eps']) * L['step'] if 1 in on else 0
    l1px = -L['step'] * (st['N0'] * L['s26'] + l1ns) if 1 in on else 0
    l2u = L['n2'] * sc['u2'] if 2 in on else 0
    l2n = l2u * L['p2']; l2c = L['n2'] * L['c2'] * L['w2'] if 2 in on else 0
    l3u = max(0, L['mT'] - L['m0']) * sc['mk'] if 3 in on else 0
    if mir_cap and 1 in on:      # зеркала рычага 1 (46 из 128 шт 26 артикулов) входят в возврат к уровню июля-августа
        l3u = max(0, l3u - l1u * mir_share)
    l3n = l3u * L['mp']
    return dict(l1u=l1u, l1ns=l1ns, l1px=l1px, l2c=l2c, su=l1u + l2u + l3u, sn=l1ns + l1px + l2n + l3n,
                sns=l1ns + l2n + l3n, lev=st['N0'] + l1ns + l1px + l2n + l3n)

def lev_col(st, lv):
    return col(st, st['U0'] + lv['su'], lv['lev'], st['N0'] + lv['sns'], st['clk0'] + lv['l2c'])

def full_col(st, lv, R, T=None):
    T = T or LEV['T']
    gap = max(0, T - lv['lev'])
    c = col(st, st['U0'] + lv['su'] + gap / (st['N0'] / st['U0']), lv['lev'] + gap, st['N0'] + lv['sns'] + gap, st['clk0'] + lv['l2c'] + gap / R)
    c['gap'] = gap
    return c

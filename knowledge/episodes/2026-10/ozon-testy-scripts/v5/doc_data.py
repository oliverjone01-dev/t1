# v5: числа для Word «В1 против В2» (make5.js). Берёт forecast.py как модуль, пишет /tmp/ozon-v5/doc.json (вне репо).
# Все числа Word - отсюда (G9 ФЕНИКСА: в make5.js литералов нет). Запуск: python3 -I doc_data.py <путь к xlsx Ивана>
# (после list26.py и pilot.py)
import sys, os, json
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import openpyxl
import forecast as F
names = {r[0]: r[1] for r in openpyxl.load_workbook(sys.argv[1], data_only=True).worksheets[0].iter_rows(min_row=2, values_only=True) if r[0]}
short = lambda a: (names.get(a) or '').replace('GENGLASS ', '').split(',')[0][:46]
t = lambda x: f'{x/1000:+,.0f}'.replace(',', ' ') if abs(x) >= 500 else '0'
rub = lambda x: f'{x:,.0f}'.replace(',', ' ')
pc = lambda x, f='+.0%': format(x, f).replace('.', ',')
SC = F.SCN
R = {(v, sc): F.run(v, sc) for v in ('В0', 'Вк', 'В1', 'В1б', 'В2') for sc in SC}
dif = lambda a, b: [t(R[(a, sc)]['prof'] - R[(b, sc)]['prof']) for sc in SC]
d = {}
d['scen'] = [[sc, pc(F.EPS[sc], '+.1f') + f' ({pc(0.9 ** F.EPS[sc] - 1)})', pc(F.K_CLK[sc]), pc(F.D9[sc]), pc(F.M9[sc], '+.1%'), pc(F.XFER[sc])] for sc in SC]
d['main'] = [['Вариант 1 как задуман: ставка 5%, цена у 26, дорогой клик KONUX и KUVINO, остальной клик минимум'] + dif('В1', 'В0'),
             ['Вариант 1 рекомендуемый: ставка 5%, цена у 26, весь клик минимум'] + dif('В1б', 'В0'),
             ['Вариант 2: ставка 9%, цены как есть, весь клик минимум'] + dif('В2', 'В0'),
             ['Рекомендуемый вариант 1 минус вариант 2'] + dif('В1б', 'В2'),
             ['Вариант 1 как задуман минус вариант 2'] + dif('В1', 'В2')]
d['v1b_v2'] = dif('В1б', 'В2')
d['dec'] = [['Дорогой клик до минимума (в обоих вариантах)'] + dif('Вк', 'В0'),
            ['Своя цена -5...-10% у 26 артикулов (только В1)'] + dif('В1б', 'Вк'),
            ['Дорогой клик KONUX и KUVINO оставить (только В1 как задуман)'] + dif('В1', 'В1б'),
            ['Ставка за заказ 9% (только В2)'] + dif('В2', 'Вк')]
d['ops'] = []
for v, lab in (('В0', 'Сейчас (идущие кампании, среднее 4 недель)'), ('В1б', 'Вариант 1 рекомендуемый'), ('В1', 'Вариант 1 как задуман'), ('В2', 'Вариант 2')):
    x = R[(v, 'средний')]
    d['ops'].append([lab, f'{x["units"]:.0f}', rub(round(x['clk'] / 1000)) + ' тыс.', rub(round(x['cpo'] / 1000)) + ' тыс.', pc(x['drr'], '.1%')])
EPSL = (0, -1, -2, -2.15, -3.6)
d['eps'] = [[pc(e, '+.2f') if e == -2.15 else pc(e, '+.1f'), pc(0.9 ** e - 1), t(F.run('В1б', 'средний', e)['prof'] - F.run('Вк', 'средний', e)['prof']),
             t(F.run('В1б', 'средний', e)['prof'] - F.run('В2', 'средний', e)['prof'])] for e in EPSL]
d['need25'] = pc(0.9 ** -2.15 - 1); d['up46'] = pc(0.9 ** F.EPS['высокий'] - 1)
d['price0'] = d['eps'][0][2]          # снижение цены без прироста заказов, тыс. за 2 нед
d['v1b_v2_eps0'] = d['eps'][0][3]
fj = json.load(open('/tmp/ozon-v5/forecast.json'))
d['m9eq'] = [pc(fj['m9eq'][sc], '+.1%') for sc in SC]
d['m9'] = [pc(F.M9[sc], '+.1%') for sc in SC]
d['sh9_100'] = t(fj['sh9_100'] * 1000)
PA = F.per_article()
d['art'] = [[x['art'], short(x['art']), pc(x['u_wk'], '.2f'), rub(round(x['p0'], -1)), f'-{x["step"]}%',
             rub(round(x['vit0'], -1)) + ' -> ' + rub(round(x['vit1'], -1)), rub(round(x['pi0'], -2)) + ' -> ' + rub(round(x['pi1'], -2)),
             f'+{x["need"]:.0%}', t(x['d_низкий']), t(x['d_средний']), t(x['d_высокий'])] for x in PA]
d['art_tot'] = [t(sum(x['d_' + sc] for x in PA)) for sc in SC]
d['cand'] = []
# доля своих заказов дорогой кампании по тесту 3 (test3_close.py): рост карточки сверх роста магазина / заказы по отчёту рекламы
T3 = {'GGM-18-2-2': (8.0, 9.1, 0.13), 'GGT-35-5-1-100-180': (11.0, 9.2, None)}
own = {}
for c in fj['cand']:
    pay = c['w'] / (c['o'] * c['pi'])
    if c['off'] in T3:
        b0, b1, st = T3[c['off']]
        own[c['off']] = max(0, (b1 - b0 * (1 + (st or 0))) / c['o'])
    d['cand'].append([c['off'], 'идёт' if c['active'] else 'остановлена ' + c['last'][8:] + '.' + c['last'][5:7], rub(round(c['w'], -2)),
                      pc(c['o'], '.2f'), rub(round(c['w'] / c['o'], -2)), rub(round(c['pi'], -2)), f'{pay:.0%}',
                      f'{own[c["off"]]:.0%}' if c['off'] in own else 'нет данных', 'нет'])
d['own_kuvino'] = f"{own['GGM-18-2-2']:.0%}"
d['pay'] = {c['off']: f"{c['w'] / (c['o'] * c['pi']):.0%}" for c in fj['cand']}
CA = F.cpo_articles()
d['cpo_tot'] = [rub(round(sum(x['extra'] for x in CA), -3)), t(sum(x['d'] for x in CA)), str(len(CA))]
d['cpo'] = [[x['art'], short(x['art']), pc(x['u_wk'], '.2f'), rub(round(x['p0'], -1)), rub(round(x['extra'], -2)), t(x['d'])] for x in CA[:15]]
lst = json.load(open('/tmp/ozon-v5/list26.json'))
d['skip'] = [[o['art'], short(o['art']), f'{o["h10"]:.0f}%' if o['h10'] is not None else '-', f'{o["file_step"]}%'] for o in lst if o['step'] == 0]
d['n10'] = sum(o['step'] == 10 for o in lst); d['nless'] = sum(0 < o['step'] < 10 for o in lst)
pj = json.load(open('/tmp/ozon-v5/pilot.json'))
d['pilot'] = dict(wait=', '.join(pj['wait']), nwait=len(pj['wait']), nnow=pj['n_now'], share=f"{pj['share26']:.0%}", ctrl=pj['C'],
                  mde={str(k): f'+{v:.0%}' for k, v in pj['mde'].items()})
d['base'] = dict(units=sum(F.U_all.values()), rev=pc(F.rev / 1e6, '.1f'), SH=pc(F.SH, '.2f'), shp=pc(0.04 * F.SH, '.1%'),
                 clk_act=rub(round(R[('В0', 'средний')]['clk'] / 2 / 1000)), cpo_wk=rub(round(F.cpo_sp / F.WEEKS / 1000)))
# I2 ФЕНИКСА: первые 2 недели так, как в «Предлагаю» (цена у артикулов вне карточек теста 4, на минимум только KONUX)
wait_skus = [o['sku'] for o in lst if o['art'] in pj['wait']]
d['first2w'] = [t(F.first2w(sc, wait_skus)) for sc in SC]
act = {k_ for k_, c in F.camp.items() if F.active(c)}
now = set(F.lst) - set(wait_skus)
p17 = F.run('В1б', 'средний', eps=0, cut=now, keep=act)['prof'] - F.run('В0', 'средний')['prof']
p26 = F.run('В1б', 'средний', eps=0, keep=act)['prof'] - F.run('В0', 'средний')['prof']
d['loss4w'] = t(p17 + p26)       # цена без прироста заказов: 2 недели 17 артикулов + 2 недели все 26
# I3: порог отката по шуму - падение заказов карточек опыта к магазину за 2 недели, ложный откат при нулевом эффекте
import math
T2, C2 = pj['T'] / F.WEEKS * 2, pj['C'] / F.WEEKS * 2
se2 = math.sqrt(2 / T2 + 2 / C2)
Nrm = lambda z: 0.5 * (1 + math.erf(z / math.sqrt(2)))
d['rollback'] = dict(thr='-50%', false=f'{Nrm(math.log(0.5) / se2):.0%}', at23=f'{Nrm((math.log(0.5) - math.log(1.23)) / se2):.0%}')
# I1: клик «сейчас» по темпу кампаний с даты запуска
F.RATE = True
d['rate'] = dict(clk=rub(round(F.run('В0', 'средний')['clk'] / 1000)), dec=[t(F.run('Вк', sc)['prof'] - F.run('В0', sc)['prof']) for sc in SC],
                 v1v2=[t(F.run('В1б', sc)['prof'] - F.run('В2', sc)['prof']) for sc in SC])
F.RATE = False
d['drr0'] = d['ops'][0][4]; d['drr1'] = d['ops'][1][4]; d['drr2'] = d['ops'][3][4]
json.dump(d, open('/tmp/ozon-v5/doc.json', 'w'), ensure_ascii=False, indent=1)
print(json.dumps({k: d[k] for k in ('first2w', 'loss4w', 'rollback', 'rate', 'main', 'dec', 'ops', 'eps', 'm9eq', 'sh9_100', 'pilot', 'own_kuvino', 'pay', 'base')}, ensure_ascii=False))

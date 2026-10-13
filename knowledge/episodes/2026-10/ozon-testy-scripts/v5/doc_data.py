# v5: числа для Word «В1 против В2» (make5.js). Берёт forecast.py как модуль, пишет /tmp/ozon-v5/doc.json (вне репо).
# Запуск: python3 -I doc_data.py <путь к xlsx Ивана>
import sys, os, json
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import openpyxl
import forecast as F
names = {r[0]: r[1] for r in openpyxl.load_workbook(sys.argv[1], data_only=True).worksheets[0].iter_rows(min_row=2, values_only=True) if r[0]}
short = lambda a: (names.get(a) or '').replace('GENGLASS ', '').split(',')[0][:46]
t = lambda x: f'{x/1000:+,.0f}'.replace(',', ' ') if abs(x) >= 500 else '0'
rub = lambda x: f'{x:,.0f}'.replace(',', ' ')
R = {(v, sc): F.run(v, sc) for v in ('В0', 'Вк', 'В1', 'В1б', 'В2') for sc in F.SCN}
d = {}
d['scen'] = [[sc, f'{F.EPS[sc]:+.1f}'.replace('.', ','), f'{F.K_CLK[sc]:.0%}', f'{F.D9[sc]:+.0%}', f'{F.XFER[sc]:.0%}'] for sc in F.SCN]
d['main'] = []
for v, lab in (('В1', 'Вариант 1: ставка 5%, цена -5...-10% у 26, дорогой клик KONUX и KUVINO, остальной клик минимум'),
               ('В1б', 'Вариант 1 без дорогого клика (весь клик минимум)'),
               ('В2', 'Вариант 2: ставка 9%, цены как есть, весь клик минимум')):
    d['main'].append([lab] + [t(R[(v, sc)]['prof'] - R[('В0', sc)]['prof']) for sc in F.SCN])
d['main'].append(['Вариант 1 минус вариант 2'] + [t(R[('В1', sc)]['prof'] - R[('В2', sc)]['prof']) for sc in F.SCN])
d['dec'] = []
for lab, a, b in (('Дорогой клик до минимума (в обоих вариантах)', 'Вк', 'В0'), ('Своя цена -5...-10% у 26 артикулов (только В1)', 'В1б', 'Вк'),
                  ('Дорогой клик KONUX и KUVINO оставить (только В1)', 'В1', 'В1б'), ('Ставка за заказ 9% (только В2)', 'В2', 'Вк')):
    d['dec'].append([lab] + [t(R[(a, sc)]['prof'] - R[(b, sc)]['prof']) for sc in F.SCN])
d['ops'] = []
for v, lab in (('В0', 'Сейчас (среднее 4 недель)'), ('В1', 'Вариант 1'), ('В2', 'Вариант 2')):
    x = R[(v, 'средний')]
    d['ops'].append([lab, f'{x["units"]:.0f}', rub(round(x['clk'] / 1000)) + ' тыс.', rub(round(x['cpo'] / 1000)) + ' тыс.', f'{x["drr"]:.1%}'.replace('.', ',')])
d['eps'] = [[f'{e:+.1f}'.replace('.', ','), f'{(0.9 ** e - 1):+.0%}', t(F.run('В1б', 'средний', e)['prof'] - F.run('Вк', 'средний', e)['prof']),
             t(F.run('В1', 'средний', e)['prof'] - F.run('В2', 'средний', e)['prof'])] for e in (0, -1, -2, -2.15, -3.6)]
d['eps'][3][0] = '-2,15'
d['art'] = []
for x in F.per_article():
    d['art'].append([x['art'], short(x['art']), f'{x["u_wk"]:.2f}'.replace('.', ','), rub(round(x['p0'], -1)), f'-{x["step"]}%',
                     rub(round(x['vit0'], -1)) + ' -> ' + rub(round(x['vit1'], -1)), rub(round(x['pi0'], -2)) + ' -> ' + rub(round(x['pi1'], -2)),
                     f'+{x["need"]:.0%}', t(x['d_низкий']), t(x['d_средний']), t(x['d_высокий'])])
PA = F.per_article()
d['art_tot'] = [t(sum(x['d_' + sc] for x in PA)) for sc in F.SCN]
d['cand'] = []
for c in json.load(open('/tmp/ozon-v5/forecast.json'))['cand']:
    d['cand'].append([c['off'], 'идёт' if c['active'] else 'остановлена ' + c['last'][8:] + '.' + c['last'][5:7], rub(round(c['w'], -2)),
                      f'{c["o"]:.2f}'.replace('.', ','), rub(round(c['w'] / c['o'], -2)), rub(round(c['pi'], -2)), f'{c["w"] / (c["o"] * c["pi"]):.0%}',
                      'держим' if c['sel'] else 'не включаем'])
CA = F.cpo_articles()
d['cpo_tot'] = [rub(round(sum(x['extra'] for x in CA), -3)), t(sum(x['d'] for x in CA)), str(len(CA))]
d['cpo'] = [[x['art'], short(x['art']) or '', f'{x["u_wk"]:.2f}'.replace('.', ','), rub(round(x['p0'], -1)), rub(round(x['extra'], -2)), t(x['d'])] for x in CA[:15]]
lst = json.load(open('/tmp/ozon-v5/list26.json'))
d['skip'] = [[o['art'], short(o['art']), f'{o["h10"]:.0f}%' if o['h10'] is not None else '-', f'{o["file_step"]}%'] for o in lst if o['step'] == 0]
d['base'] = dict(units=sum(F.U_all.values()), rev=f'{F.rev / 1e6:.1f}'.replace('.', ','),
                 SH=f'{F.SH:.2f}'.replace('.', ','), clk0=rub(round(F.clk0 / 1000)), cpo_wk=rub(round(F.cpo_sp / F.WEEKS / 1000)))
d['v2_be'] = t(R[('В2', 'высокий')]['prof'] - R[('Вк', 'высокий')]['prof'])
json.dump(d, open('/tmp/ozon-v5/doc.json', 'w'), ensure_ascii=False, indent=1)
print(json.dumps({k: d[k] for k in ('main', 'dec', 'ops', 'eps', 'art_tot', 'cpo_tot', 'base')}, ensure_ascii=False, indent=0))
print('skip', len(d['skip']))

# ФЕНИКС проба B1 (OZON v5): экономика заказа v5 (исправленная модель P20: keep с 01.09, налог x PAY, доставка) против
# «Отчета» за сентябрь на тех же артикулах. Сравнивается прибыль ДО рекламы и ДО АДМ - ровно то, что v5 кладёт в pi()
# (реклама в v5 отдельно, АДМ не вычитается). Вход: /tmp/feniks-floor/sep_rows.json (p7_report.js), floor_rows_patched.json.
# Печатает только суммы, без прибыли по артикулам (репозиторий публичный).
import json
sep = json.load(open('/tmp/feniks-floor/sep_rows.json'))
fl = {r['sku']: r for r in json.load(open('/tmp/feniks-floor/floor_rows_patched.json'))}
PAY, TAX = 0.914, 0.15
both = [x for x in sep if x['sk'] in fl and x['units'] >= 1]
def sums(rows):
    rep = sum(x['amt'] + x['adv'] - x['cc'] - (x['ship'] - x['dinc']) - TAX * x['tb'] for x in rows)
    mod = sum(x['acc'] * fl[x['sk']]['keep'] - x['cc'] - fl[x['sk']]['shipn'] * x['units'] - TAX * x['acc'] * fl[x['sk']]['s'] * PAY for x in rows)
    return rep, mod
F = lambda v: '{:,.0f}'.format(v).replace(',', ' ')
rep, mod = sums(both)
print('артикулов в «Отчете» сентября', len(sep), '; с реализацией и в модели', len(both), '; штук', sum(x['units'] for x in both))
print('ПРИБЫЛЬ ДО РЕКЛАМЫ И АДМ: «Отчет»', F(rep), '| модель v5', F(mod), '| разница %+.1f%%' % ((mod / rep - 1) * 100))
lst = {o['sku'] for o in json.load(open('/tmp/ozon-v5/list26.json')) if o['step'] > 0}
r26 = [x for x in both if x['sk'] in lst]
a, b = sums(r26)
print('из них 26 снижаемых: артикулов', len(r26), '; разница модели к «Отчету» %+.1f%%' % ((b / a - 1) * 100))

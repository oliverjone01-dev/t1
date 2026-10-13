# ФЕНИКС проба P8: мост «Отчет» сентября (P7, тот же расчёт, что страница) -> формула floor.py на тех же артикулах.
# Вход: sep_rows.json (строки таблицы по артикулам за 01-30.09 из katya-report.html, снимок 11.10) и rows.json
# (параметры floor.py @ e4988f5: keep, shipn, s по SKU). Цель: какая часть расхождения от какой статьи.
import json
SP = '/tmp/feniks-floor/'; import os as _os; _os.makedirs(SP, exist_ok=True)
sep = json.load(open(SP + 'sep_rows.json'))
fl = {r['sku']: r for r in json.load(open('/home/user/t1/knowledge/episodes/2026-10/ozon-price-floor/floor_rows.json'))}
both = [x for x in sep if x['sk'] in fl and x['units'] > 0]
print('[P8] артикулов в «Отчете» сентября', len(sep), '; из них в модели floor (171) и с реализацией', len(both))
T = {k: 0.0 for k in ('acc', 'amt', 'adv', 'amtS', 'cc', 'ship', 'dinc', 'tb', 'net', 'units')}
F = {k: 0.0 for k in ('amt', 'adm', 'adm_rep_style', 'tax', 'shipn', 'net', 'net_admfix')}
for x in both:
    r = fl[x['sk']]
    for k in T: T[k] += x[k] or 0
    m_amt = x['acc'] * r['keep']                     # К выплате до рекламы по доле floor
    F['amt'] += m_amt
    base = m_amt - x['adv']                          # floor: база АДМ = К выплате - реклама
    F['adm'] += 0.30 * base
    F['adm_rep_style'] += 0.30 * max(m_amt - 0, 0)   # как «Отчет» на деле: реклама дней без продаж базу не режет
    F['tax'] += 0.15 * x['acc'] * r['s']
    F['shipn'] += r['shipn'] * x['units']
    net = m_amt - x['adv'] - x['cc'] - r['shipn'] * x['units'] - 0.30 * base - 0.15 * x['acc'] * r['s']
    F['net'] += net
    F['net_admfix'] += m_amt - x['adv'] - x['cc'] - r['shipn'] * x['units'] - 0.30 * m_amt - 0.15 * x['acc'] * r['s']
R = lambda v: '{:,.0f}'.format(v).replace(',', ' ')
amt_pre = T['amt'] + T['adv']
print('[P8] «Отчет» на этих артикулах: начислено', R(T['acc']), '| К выплате до рекламы', R(amt_pre), '(доля %.3f)' % (amt_pre / T['acc']),
      '| реклама', R(T['adv']), '| база АДМ', R(T['amtS']), '| С/С', R(T['cc']), '| наша доставка - покупателя', R(T['ship'] - T['dinc']),
      '| база налога', R(T['tb']), '| ЧИСТАЯ', R(T['net']))
print('[P8] floor на тех же: К выплате до рекламы', R(F['amt']), '(доля %.3f)' % (F['amt'] / T['acc']), '| АДМ', R(F['adm']),
      '| налог', R(F['tax']), '| чистая доставка', R(F['shipn']), '| ЧИСТАЯ', R(F['net']))
print('[P8] разложение разницы чистой floor - «Отчет» = %s:' % R(F['net'] - T['net']))
print('     доля «К выплате» (keep с 01.06 против сентября):', R(F['amt'] - amt_pre))
print('     АДМ (floor режет базу рекламой, «Отчет» по дням с отсечкой):', R(0.30 * T['amtS'] - F['adm']))
print('     налог (floor: цена x витрина/предельная; «Отчет»: оплата покупателя + G):', R(0.15 * T['tb'] - F['tax']))
print('     доставка (floor: медиана на штуку; «Отчет»: ведомость - доход покупателя):', R((T['ship'] - T['dinc']) - F['shipn']))
print('[P8] чистая floor с базой АДМ без вычета рекламы:', R(F['net_admfix']))

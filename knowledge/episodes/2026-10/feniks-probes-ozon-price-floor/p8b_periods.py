# ФЕНИКС проба B2: формула floor.py против «Отчета» на трёх периодах (август закрыт, сентябрь закрыт, 01-10.10 открыт)
import json
SP = '/tmp/feniks-floor/'; import os as _os; _os.makedirs(SP, exist_ok=True)
per = json.load(open(SP + 'periods_rows.json'))
fl = {r['sku']: r for r in json.load(open('/home/user/t1/knowledge/episodes/2026-10/ozon-price-floor/floor_rows.json'))}
R = lambda v: '{:,.0f}'.format(v).replace(',', ' ')
for lab, rows in per.items():
    both = [x for x in rows if x['sk'] in fl and x['units'] > 0]
    rep = sum(x['net'] for x in both)
    fnet = 0; fnet_fix = 0; amt_pre = 0; facc = 0; famt = 0
    for x in both:
        r = fl[x['sk']]
        m_amt = x['acc'] * r['keep']; famt += m_amt; facc += x['acc']; amt_pre += x['amt'] + x['adv']
        tax = 0.15 * x['acc'] * r['s']; sh = r['shipn'] * x['units']
        fnet += m_amt - x['adv'] - x['cc'] - sh - 0.30 * (m_amt - x['adv']) - tax
    print('[B2] %s: артикулов %d | «Отчет» чистая %s | формула floor %s | разница %s (%+.0f%%) | доля К выплате: «Отчет» %.3f, floor %.3f | реклама %s, база АДМ «Отчета» %s против К выплате-реклама %s' % (
        lab, len(both), R(rep), R(fnet), R(fnet - rep), (fnet - rep) / abs(rep) * 100 if rep else 0, amt_pre / facc if facc else 0, famt / facc if facc else 0,
        R(sum(x['adv'] for x in both)), R(sum(x['amtS'] for x in both)), R(sum(x['amt'] for x in both))))

# ФЕНИКС итерация 2 (OZON v5 @ 6a8dd1c), спор п.2: «клик до минимума» по кампаниям на forecast.py автора.
# Действие = сумма по идущим кампаниям [экономия (w - min(w, 2000)) - потерянные заказы x k x прибыль заказа] x 2 нед.
# Разбор моей формулы итерации 1 «уже случилось»: она вычитала заказы и у кампаний с расходом 0 в окне (модель их не считает).
import sys
sys.path.insert(0, '/home/user/t1/knowledge/episodes/2026-10/ozon-testy-scripts/v5')
import forecast as F
rows = []
for cid, c in F.camp.items():
    w = c['sp'] / F.WEEKS; o = c['o'] / F.WEEKS; act = F.active(c)
    new = min(w, F.MIN_WK) if act else 0
    frac = (1 - (new / w) ** F.E_SP) if w > 0 else 0
    rows.append(dict(cid=cid, off=c['off'] or '-', act=act, w=w, new=new, o=o, frac=frac, pi=F.camp_pi(c)[0], last=c['last']))
print('остановленные до 10.10:')
for r in sorted((r for r in rows if not r['act']), key=lambda r: -r['w']):
    print(f"  {r['cid']} {r['off'][:22]:22} расход {r['w']:8,.0f} ₽/нед  заказов отчёта {r['o']:.2f}/нед  потери в модели {'да' if r['w'] > 0 else 'нет (w=0)'}".replace(',', ' '))
for sc in F.SCN:
    k = F.K_CLK[sc]; act = [r for r in rows if r['act']]; stop = [r for r in rows if not r['act']]
    save = sum(r['w'] - r['new'] for r in act) * 2; lost = sum(r['o'] * r['frac'] * k * r['pi'] for r in act) * 2
    model = F.run('Вк', sc)['prof'] - F.run('В0', sc)['prof']
    extra = sum(r['o'] * k * r['pi'] for r in stop if r['w'] == 0) * 2
    print(f"{sc:8}: экономия {save/1e3:+.0f}, потери {-lost/1e3:+.0f}, итог {(save-lost)/1e3:+.0f}; модель Вк-В0 {model/1e3:+.0f}; "
          f"лишнее в моей формуле итерации 1 (кампании с расходом 0) {extra/1e3:.1f} тыс.")
print('крупнейшие идущие кампании, средний сценарий (k 0,5), тыс. ₽ за 2 нед:')
for r in sorted((r for r in rows if r['act']), key=lambda r: -(r['w'] - r['new']))[:6]:
    s = (r['w'] - r['new']) * 2 / 1e3; l = r['o'] * r['frac'] * 0.5 * r['pi'] * 2 / 1e3
    print(f"  {r['cid']} {r['off'][:22]:22} экономия {s:+6.1f}  потери {-l:+6.1f}  итог {s-l:+6.1f}")

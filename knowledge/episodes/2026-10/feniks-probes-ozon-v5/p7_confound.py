# ФЕНИКС проба P7 (OZON v5): смешение в замере пилота - урезание клика ложится на опыт (26) и контроль (25) неравно;
# плюс проверка «KUVINO - около половины своих» по числам самого Word (карточка 8,0 -> 9,1 при магазине +13%)
import sys, json, collections as C
sys.path.insert(0, '/home/user/t1/knowledge/episodes/2026-10/ozon-testy-scripts/v5')
import forecast as F
lst = json.load(open('/tmp/ozon-v5/list26.json'))
T = {o['art'] for o in lst if o['step'] > 0}; K = {o['art'] for o in lst if o['step'] == 0}
cg = json.load(open('/home/user/t1/analytics-mvp/data/card_groups.json'))['groups']
off2g = {s['offer']: g['model'] for g in cg for s in g['skus']}
gT = {off2g[a] for a in T if a in off2g}; gK = {off2g[a] for a in K if a in off2g}
kuv = {cid for cid in F.SEL if F.camp[cid]['off'] == 'GGM-18-2-2'}
agg = C.defaultdict(lambda: [0.0, 0.0, 0])
for cid, c in F.camp.items():
    if not F.active(c): continue
    w = c['sp'] / F.WEEKS; new = w if cid in kuv else min(w, F.MIN_WK)
    o = c['off']; grp = 'опыт (товар)' if o in T else ('контроль (товар)' if o in K else
          ('карточка опыта' if off2g.get(o) in gT else ('карточка контроля' if off2g.get(o) in gK else 'прочие')))
    a = agg[grp]; a[0] += w; a[1] += new; a[2] += 1
for g, (w, n, k) in sorted(agg.items()):
    print(f'{g:18}: кампаний {k:2}, клик сейчас {w:8,.0f} ₽/нед -> в пилоте {n:8,.0f} ({(n / w - 1) if w else 0:+.0%})'.replace(',', ' '))
print('KUVINO по числам Word: карточка 8,0 -> 9,1 = %+.1f%%, магазин +13%%; сверх магазина %+.2f заказа/нед; '
      'доп. заказов отчёта рекламы 2,8 - 0,7 = 2,1/нед -> своих %.0f%% (Word: «около половины», порог 54%%)'
      % ((9.1 / 8.0 - 1) * 100, 9.1 - 8.0 * 1.13, (9.1 - 8.0 * 1.13) / 2.1 * 100))

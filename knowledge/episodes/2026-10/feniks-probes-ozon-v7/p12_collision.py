import sys, json, collections as C
V7 = '/home/user/t1/knowledge/episodes/2026-10/ozon-testy-scripts/v7'
sys.path.insert(0, V7); sys.path.insert(0, V7 + '/../v5')
import forecast as F
import plan7 as P
# price-cut SKUs whose own click campaigns are cut to the minimum by the plan (15.10 KONUX, 29.10 the rest)
D = F.D
ad = [json.loads(l) for l in open(D + 'ads_daily.ndjson')]
sv = [json.loads(l) for l in open(D + 'sku_views.ndjson')]
tot = C.Counter(); per = C.defaultdict(C.Counter)
for r in sv:
    tot[r['date']] += r.get('vsearch', 0) or 0; per[r['sku']][r['date']] += r.get('vsearch', 0) or 0
vw = C.defaultdict(C.Counter)
for a in ad:
    if a['id'] != F.CPO_ID: vw[a['off']][a['d']] += a.get('vw', 0)
U_all = sum(F.U[s] / F.WEEKS for s in F.lst)
hit = []; u_hit = 0
for sku, o in F.lst.items():
    art = F.rows[sku]['art']
    cs = [(cid, c['sp'] / F.WEEKS) for cid, c in F.camp.items() if c['off'] == art and F.active(c) and c['sp'] / F.WEEKS > F.MIN_WK]
    if not cs: continue
    days = [d for d in tot if '2026-10-05' <= d <= '2026-10-11']
    sh = sum(per[sku][d] for d in days) / sum(tot[d] for d in days)
    adsh = sum(vw[art][d] for d in days) / max(1, sum(per[sku][d] for d in days))
    u = F.U[sku] / F.WEEKS; u_hit += u
    hit.append((art, [f'{cid}:{w:,.0f}'.replace(',', ' ') for cid, w in cs], f'search share 05-11.10 {sh:.2%}', f'ad impressions / sku search views {adsh:.0%}', f'orders/wk {u:.2f}',
                'cut 15.10' if any(cid in P.KONUX for cid, _ in cs) else 'cut 29.10', 'price ' + ('15.10' if sku in P.NOW else '22.10/29.10')))
for h in hit: print(h)
print(f'price-cut SKUs with own click above minimum: {len(hit)} of {len(F.lst)}; their base orders {u_hit:.2f} of {U_all:.2f}/wk ({u_hit / U_all:.0%})')

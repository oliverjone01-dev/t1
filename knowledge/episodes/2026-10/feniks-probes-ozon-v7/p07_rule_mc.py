import sys, json, math, random, collections as C
V7 = '/home/user/t1/knowledge/episodes/2026-10/ozon-testy-scripts/v7'
sys.path.insert(0, V7); sys.path.insert(0, V7 + '/../v5')
import forecast as F
import plan7 as P
random.seed(20261014)
D = F.D
g = json.load(open(D + 'card_groups.json'))['groups']
off2card = {s['offer']: i for i, gr in enumerate(g) for s in gr['skus']}
def _thr(art):                                              # note: half of order profit after the price cut, rounded down to 100 (no figures in the repo)
    s_ = F.art2sku[art]; r = F.rows[s_]; st = F.lst[s_]['step'] / 100
    return math.floor(0.5 * F.pi(r, r['p0'] * (1 - st), 0.05, r['s']) / 100) * 100
THR = {a: _thr(a) for a in ('GGT-35-5-1-100-180', 'GGT-03-3-3-E-16080', 'GGM-18-2-2')}
BASE = {'GGT-35-5-1-100-180': 8.75, 'GGT-03-3-3-E-16080': 12.5, 'GGM-18-2-2': 7.5}    # card orders/wk 14.09-11.10 (p02_data.py)
def pois(l):
    if l <= 0: return 0
    L_, k, p = math.exp(-l), 0, 1.0
    while True:
        p *= random.random()
        if p <= L_: return k
        k += 1
def card_lambda(sku, sc, w):
    """expected card orders per week in the ladder week under the plan7/v5 model: price on all 26, clicks at minimum, ladder at w"""
    art = F.rows[sku]['art']; ci = off2card[art]; offs = {s['offer'] for s in g[ci]['skus']}
    eps, k, xf = F.EPS[sc], F.K_CLK[sc], F.XFER[sc]
    lam = BASE[art]
    for s2, r in F.rows.items():
        if r['art'] in offs and s2 in F.lst:
            u = F.U[s2] / F.WEEKS; st = F.lst[s2]['step'] / 100
            lam += u * ((1 - st) ** eps - 1) * (1 - xf)
    for cid, c in F.camp.items():                              # own orders lost by cutting this card's campaigns to minimum
        if c['off'] in offs and F.active(c):
            wc = c['sp'] / F.WEEKS
            if wc > F.MIN_WK: lam -= k * c['o'] / F.WEEKS * (1 - (F.MIN_WK / wc) ** F.E_SP)
    gain, du = P.extra(sku, w, sc)                            # own ladder orders net of transfer (plan7)
    return lam + du
def ad_lambda(sku, sc, w):
    """attributed ad orders of the SKU at budget w (plan7 basis), independent of own share k"""
    w0, u0 = P.ref(sku); st = F.lst[sku]['step'] / 100
    return u0 * (w / w0) ** F.E_SP * (1 - st) ** F.EPS[sc]
def passes(sku, sc, w):
    art = F.rows[sku]['art']; la = ad_lambda(sku, sc, w); lc = card_lambda(sku, sc, w)
    a = pois(la); card = pois(max(lc - la, 0)) + a
    return card >= BASE[art] and a >= 1 and w / a <= THR[art]
N = 20000
print('P(step rule passes), Monte Carlo N=%d; columns: scenario | lambda ad orders 5k/10k | lambda card 5k | P(pass step1) | P(pass step1 and step2)' % N)
for sku in P.LAD:
    art = F.rows[sku]['art']
    for sc in F.SCN:
        p1 = p12 = 0
        for _ in range(N):
            s1 = passes(sku, sc, 5000)
            if s1:
                p1 += 1
                if passes(sku, sc, 10000): p12 += 1
        print(f'  {art:20} {sc:8} ad {ad_lambda(sku, sc, 5000):.2f}/{ad_lambda(sku, sc, 10000):.2f}  card {card_lambda(sku, sc, 5000):5.2f} (base {BASE[art]})  '
              f'step1 {p1 / N:.0%}  both {p12 / N:.0%}  true gain at 15k {P.extra(sku, 15000, sc)[0]:+8.0f}/wk')
# break-even threshold under the model's own mid assumptions (own share 0.5, transfer 0.25), marginal over the minimum
print('\nthreshold in note (half of profit) vs model mid break-even k*(1-xfer)*profit:')
for sku in P.LAD:
    r = F.rows[sku]; st = F.lst[sku]['step'] / 100; a1 = F.pi(r, r['p0'] * (1 - st), 0.05, r['s'])
    print(f'  {r["art"]:20} note threshold / order profit {THR[r["art"]] / a1:.2f}; model mid break-even / order profit {0.5 * 0.75:.3f}; note is {THR[r["art"]] / (0.375 * a1) - 1:+.0%} laxer')

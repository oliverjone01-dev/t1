import sys, os, json, math, random, statistics as S
V7 = '/home/user/t1/knowledge/episodes/2026-10/ozon-testy-scripts/v7'
sys.path.insert(0, V7); sys.path.insert(0, V7 + '/../v5')
import forecast as F
import plan7 as P        # module level: cand, LAD (no __main__)
H = F.H
SC = F.SCN
KONUX_C, KUVINO_C = '37675958', '39931246'
ALL = set(F.lst)
print('LAD', [F.rows[s]['art'] for s in P.LAD])

# ---- probe M1: round trip. KONUX (or KUVINO) campaign at its current budget after the price cut, computed two ways
print('\nM1 round trip: campaign kept at current budget (v5 keep) vs cut to minimum + plan7.extra() back to the same budget, weekly profit')
for cid in (KONUX_C, KUVINO_C):
    c = F.camp[cid]; w = c['sp'] / F.WEEKS; sku = F.art2sku[c['off']]
    for sc in SC:
        keep = F.run('В1б', sc, cut=ALL, keep={cid})['prof'] / H
        cut = F.run('В1б', sc, cut=ALL, keep=set())['prof'] / H
        g, du = P.extra(sku, w, sc)
        print(f'  {c["off"]:20} {sc:8} keep {keep - cut:+9.0f} | cut+extra {g:+9.0f} | diff {g - (keep - cut):+8.0f} per week; month x4.33 {4.33 * (g - (keep - cut)):+9.0f}')

# ---- probe M2: turnover and pay ignore steal and lost orders (units do subtract them)
print('\nM2 turn/pay vs units (steady state, variant A = all 26 prices, all click to minimum), per month x4.33')
def deductions(sc, cut, keep):
    eps, k, xf = F.EPS[sc], F.K_CLK[sc], F.XFER[sc]
    st_turn = st_pay = st_u = 0
    for sku, r in F.rows.items():
        u = F.U[sku] / F.WEEKS
        if not u: continue
        if sku in F.lst and sku in cut:
            p = r['p0'] * (1 - F.lst[sku]['step'] / 100); u1 = u * (p / r['p0']) ** eps; st = (u1 - u) * xf
            st_u += st; st_turn += st * r['p0']; st_pay += st * r['keep'] * r['p0']
    lo_u = lo_turn = lo_pay = 0
    for cid, c in F.camp.items():
        w = c['sp'] * F.wk_rate(c)
        if cid in keep or w <= 0: continue
        new = min(w, F.MIN_WK) if F.active(c) else 0
        dl = c['o'] * F.wk_rate(c) * (1 - (new / w) ** F.E_SP) * k
        sku = F.art2sku.get(c['off'])
        if sku:
            r = F.rows[sku]; p = r['p0'] * (1 - F.lst[sku]['step'] / 100) if (sku in F.lst and sku in cut) else r['p0']; kp = r['keep']
        else:
            p = S.median(r['p0'] for r in F.rows.values()); kp = S.median(r['keep'] for r in F.rows.values())
        lo_u += dl; lo_turn += dl * p; lo_pay += dl * kp * p
    return st_u, st_turn, st_pay, lo_u, lo_turn, lo_pay
for sc in SC:
    a = F.run('В1б', sc, cut=ALL, keep=set()); b = F.run('В0', sc)
    da = deductions(sc, ALL, set()); db = deductions(sc, set(), {k for k, c in F.camp.items() if F.active(c)})
    m = 4.33 / H
    d_turn = (a['turn'] - b['turn']) * m; d_pay = (a['pay'] - b['pay']) * m
    corr_turn = d_turn - ((da[1] + da[4]) - (db[1] + db[4])) * 4.33
    corr_pay = d_pay - ((da[2] + da[5]) - (db[2] + db[5])) * 4.33
    print(f'  {sc:8} turnover delta model {d_turn/1e6:+.2f} mln -> with steal+lost {corr_turn/1e6:+.2f} | pay delta model {d_pay/1e6:+.2f} -> {corr_pay/1e6:+.2f} | '
          f'units delta {(a["units"] - b["units"]) * m:+.1f}')

# ---- probe M3: week 2 price on 17 (test 4 extended to 28.10, note "Как считали" says weeks 1-2 = 17) vs code (26 from week 2)
print('\nM3 4-week delta, thousand RUB: code (26 prices from week 2) vs week 2 with 17 prices')
NOW = P.NOW
def plan_alt(v, sc, t1_cut):
    base_b0 = F.run('В0', sc); b0 = {k: val / H for k, val in base_b0.items()}
    tot = 0
    for t in range(4):
        cut = NOW if t == 0 else (t1_cut if t == 1 else ALL)
        keep = (P.ACTIVE - P.KONUX if t < 2 else set()) if v != 'Б' else (P.ACTIVE if t < 2 else P.SEL)
        x = P.week(sc, cut, keep); add = 0
        if v in ('В', 'Г') and t >= 2:
            for sku in P.LAD:
                if v == 'В':
                    lvl = P.STEPS[t - 2]; gain, d = P.extra(sku, lvl, sc)
                    if F.K_CLK[sc] == 0 and t == 3: gain = 0
                else:
                    gain, d = P.extra(sku, 10000, sc, P.WEEKEND[sc])
                add += gain
        tot += x['prof'] + add
    return (tot - 4 * b0['prof']) / 1e3
for v in ('А', 'Б', 'В', 'Г'):
    print('  ', v, [f'{plan_alt(v, sc, ALL):+.0f} / {plan_alt(v, sc, NOW):+.0f}' for sc in SC])

# ---- probe M4: RATE=True (campaigns launched inside the window at their rate since launch; open gap I1 of v5 iter2)
print('\nM4 RATE=True: click now per month and month deltas (A) vs RATE=False')
for rate in (False, True):
    F.RATE = rate
    out = []
    for sc in SC:
        W, y, b0 = P.plan('А', sc)
        out.append(f'{(y["prof"] - b0["prof"]) * 4.33 / 1e3:+.0f}')
    b0 = F.run('В0', 'средний')
    print(f'  RATE={rate}: click now {b0["clk"] / H * 4.33 / 1e3:.0f} thousand/month; A month delta {out}')
F.RATE = False

# ---- probe M5: reference windows for kbe (100 days per-sku om/p0 vs 4 weeks per-sku vs campaign o)
print('\nM5 kbe at 10 000/wk by reference window')
import collections as C
sp4 = C.Counter(); om4 = C.Counter()
for a in F.L('ads_sku_daily.ndjson'):
    if a['cid'] != F.CPO_ID and F.A <= a['d'] <= F.B: sp4[a['sku']] += a['sp']; om4[a['sku']] += a['om']
def kbe_ref(sku, w0, u0, w=10000):
    r = F.rows[sku]; st = F.lst[sku]['step'] / 100 if sku in F.lst else 0
    a1 = F.pi(r, r['p0'] * (1 - st), 0.05, r['s'])
    du = u0 * ((w / w0) ** F.E_SP - (F.MIN_WK / w0) ** F.E_SP) * (1 - st) ** F.EPS['средний']
    return (w - F.MIN_WK) / (du * a1) if du > 0 else None
for sku in P.LAD:
    r = F.rows[sku]; w0, u0 = P.ref(sku)
    w4 = sp4[sku] / 4; u4 = om4[sku] / r['p0'] / 4
    cs = [c for k, c in F.camp.items() if F.art2sku.get(c['off']) == sku and c['o'] > 0]
    cw = sum(c['sp'] for c in cs) / 4; co = sum(c['o'] for c in cs) / 4
    print(f'  {r["art"]:20} 100d: w0 {w0:7.0f} u0 {u0:.2f} kbe {kbe_ref(sku, w0, u0):.0%} | 4wk per-sku: w {w4:7.0f} u {u4:.2f} kbe {kbe_ref(sku, w4, u4) if u4 else float("nan"):.0%} | '
          f'4wk campaign o: w {cw:7.0f} o {co:.2f} kbe {kbe_ref(sku, cw, co) if co else float("nan"):.0%}')

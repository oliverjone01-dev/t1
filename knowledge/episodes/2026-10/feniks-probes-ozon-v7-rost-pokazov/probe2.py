# ФЕНИКС, пробы 2: урез 7 кампаний, пересечение с ценой 26, строка с АДМ, Монте-Карло правила 29.10
import sys, json, collections as C, random
V7 = '/home/user/t1/knowledge/episodes/2026-10/ozon-testy-scripts/v7'
sys.path.insert(0, V7); sys.path.insert(0, V7 + '/../v5')
import cards7 as K, forecast as F
P = K.P
top = K.cards[:10]
topcards = {c['card'] for c in top}

# Q1. 7 дорогих кампаний (EXP без лесенки KONUX/KUVINO)
cut = P.EXP - P.LAD_IDS
tot = 0
for k in sorted(cut, key=lambda k: -P.tempo(k)):
    cc = P.camp_card(F.camp[k]); tot += P.tempo(k)
    print(f"Q1 {k} {F.camp[k]['off']:22} tempo {P.tempo(k):8.0f}/wk  card {cc}  in_top10 {cc in topcards}  o4w {F.camp[k]['o']}")
print('Q1 n', len(cut), 'sum tempo/wk', round(tot), '-> month x4.33', round(tot * 4.33))

# Q2. пересечение со снижением цены 26 (решено «вместе»)
lst = set(F.lst)
cards_with_price = [c['main_art'] for c in top if c['card'] in P.PCARDS]
print('Q2 top10 cards that contain price-cut SKUs:', len(cards_with_price), cards_with_price)
others_in = [(c['main_art'], a) for c in top for (s, a, _, _) in c['others'] if s in lst]
mains_in = [c['main_art'] for c in top if c['main'] in lst]
print('Q2 price-cut SKUs among min-click others:', len(others_in), others_in)
print('Q2 price-cut SKUs among mains:', mains_in)
print('Q2 price-cut SKUs total in 10 cards:', sum(1 for g in json.load(open(F.D + 'card_groups.json'))['groups'] if g['main'] in topcards for s in g['skus'] if s['sku'] in lst), 'of', len(lst))

# Q3. строка «с АДМ справочно» (решение 13.10 «2а»): прибыль - 0,30 x К выплате прироста
for lvl in (10000, 20000):
    for sc in F.SCN:
        t = K.total(lvl, sc, 10)
        print(f"Q3 lvl {lvl} {sc:8} prof {t['prof']/1e3:+7.0f}K pay {t['pay']/1e3:7.0f}K  -> with ADM {(t['prof'] - F.ADM * t['pay'])/1e3:+7.0f}K")

# Q4. Монте-Карло правила 29.10 на уровне 20 000 (решение Ивана)
LVL = 20000
rest_wk = 68.0 - sum(c['u_wk'] for c in top)
def eff(c, sc):
    _, du, sp, _ = K.main_effect(c, LVL, sc); n, du2, sp2, _ = K.min_effect(c, sc)
    return du + du2, sp + sp2
def pois(lam, rng):
    # Кнут, лямбда до ~60
    import math
    L_ = math.exp(-lam); k = 0; p = 1.0
    while True:
        p *= rng.random()
        if p <= L_: return k
        k += 1
rng = random.Random(14)
N = 20000
for sc in ('низкий', 'средний'):
    keepA = C.Counter(); keepB = C.Counter(); wave2 = 0; spend_kept = 0.0
    for _ in range(N):
        rb, ra = pois(2 * rest_wk, rng), pois(2 * rest_wk, rng)
        sb = sa = 0
        for i, c in enumerate(top):
            e, sp = eff(c, sc)
            b = pois(2 * c['u_wk'], rng); a = pois(2 * (c['u_wk'] + e), rng)
            sb += b; sa += a
            if a > b: keepA[i] += 1
            if a * max(rb, 1) > b * ra: keepB[i] += 1
            if a > b: spend_kept += sp
        if sa > sb: wave2 += 1
    print(f'Q4 {sc}: rest_wk {rest_wk:.2f}')
    for i, c in enumerate(top):
        e, sp = eff(c, sc)
        print(f"   {c['main_art']:20} base {c['u_wk']:5.2f}/wk eff {e:4.2f}/wk spend {sp:7.0f}/wk  P(keep raw) {keepA[i]/N:.2f}  P(keep store-adj) {keepB[i]/N:.2f}")
    print(f'   E[kept cards raw] {sum(keepA.values())/N:.1f}  P(wave2: sum after > before) {wave2/N:.2f}  E[spend kept after 29.10] {spend_kept/N*4.33/1e3:.0f}K per month')

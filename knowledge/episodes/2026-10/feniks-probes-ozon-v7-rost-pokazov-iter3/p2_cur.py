# P2: «Клик главного сейчас» (Карточки F) по кампаниям: из чего состоит темп 08-11.10, что останется после 15.10,
# сколько реально добавит бюджет 20 000 и сколько расход модели (lvl - cur) недосчитывает
import sys, json, collections as C
V7 = '/home/user/t1/knowledge/episodes/2026-10/ozon-testy-scripts/v7'
sys.path.insert(0, V7); sys.path.insert(0, V7 + '/../v5')
import cards7 as K, plan7 as P, forecast as F
D = F.D
asd = [json.loads(l) for l in open(D + 'ads_sku_daily.ndjson')]
ads = [json.loads(l) for l in open(D + 'ads_daily.ndjson')]
LVL = 20000
act = {k: K.campaign_action(k, LVL)[0] for k in P.ACTIVE}
print('действия:', C.Counter(act.values()))
tot_model = 0; tot_real = 0
for c in K.cards[:10]:
    m = c['main']; by = C.Counter(); by13 = C.Counter(); days = C.defaultdict(set)
    for a in asd:
        if a['sku'] != m or a['cid'] == F.CPO_ID: continue
        if '2026-10-08' <= a['d'] <= F.B: by[a['cid']] += a['sp'] / 4 * 7; days[a['cid']].add(a['d'])
        if '2026-10-12' <= a['d'] <= '2026-10-13': by13[a['cid']] += a['sp'] / 2 * 7
    cur = c['main_sp_wk']
    parts = ', '.join(f"{cid}({F.camp[cid]['off'] if cid in F.camp else '?'}; {act.get(cid, 'не идёт')}; дней {len(days[cid])}) {v:,.0f}" for cid, v in by.most_common())
    # после 15.10: кампания 'main' на артикул главного -> LVL целиком на главного; 'main' на общий артикул -> LVL x доля главного;
    # 'min' -> 2 000 x доля главного; 'keep' -> как есть; не идущая -> 0
    after = 0; new_needed = True
    for cid, v in by.items():
        a_ = act.get(cid)
        tot_c = sum(x['sp'] for x in asd if x['cid'] == cid and '2026-10-08' <= x['d'] <= F.B) / 4 * 7
        sh = v / tot_c if tot_c else 1
        if a_ == 'main': after += LVL * sh; new_needed = False
        elif a_ == 'min': after += min(tot_c, F.MIN_WK) * sh
        elif a_ == 'keep': after += v
    if new_needed and cur < LVL: after += LVL                      # новая кампания на 20 000 целиком на главного
    real_add = after - sum(by13.values()) if by13 else after - cur
    model_add = max(LVL - cur, 0)
    tot_model += model_add
    print(f"{c['main_art']:20} сейчас (Карточки F) {cur:7,.0f} | по кампаниям: {parts or '-'} | 12-13.10: {sum(by13.values()):7,.0f} | после 15.10 на главном ~{after:7,.0f} | модель +{model_add:,.0f}".replace(',', ' '))

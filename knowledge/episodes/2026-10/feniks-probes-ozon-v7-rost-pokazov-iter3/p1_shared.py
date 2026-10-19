# P1: кампании на общий артикул - куда идёт расход 08-11.10 (и 08-13.10), какое действие ставит правило, конфликт с «Карточками»
# запуск: python3 -I -B p1_shared.py   (после restore_inputs.py; импортирует cards7 из v7)
import sys, json, collections as C
V7 = '/home/user/t1/knowledge/episodes/2026-10/ozon-testy-scripts/v7'
sys.path.insert(0, V7); sys.path.insert(0, V7 + '/../v5')
import cards7 as K, plan7 as P, forecast as F
D = F.D
asd = [json.loads(l) for l in open(D + 'ads_sku_daily.ndjson')]
off = {}
for g in json.load(open(D + 'card_groups.json'))['groups']:
    for s in g['skus']: off[s['sku']] = s['offer']
card_of = {s: c['card'] for c in K.cards for s in [c['main']]}
mains10 = {c['main']: c for c in K.cards[:10]}
mains20 = {c['main']: c for c in K.cards[:20]}
sku2card = {}
for g in json.load(open(D + 'card_groups.json'))['groups']:
    for s in g['skus']: sku2card[s['sku']] = g['main']
main_of_card = {c['card']: c['main'] for c in K.cards}
rank = {c['card']: i + 1 for i, c in enumerate(K.cards)}
LIST = ['43629255', '44989441', '40047060', '42275919', '43629267', '43629388', '43629561', '43629636', '43629658', '43629692', '44990317', '44990352']
own = K.own_mains()
print('главные с собственной кампанией (own_mains):', sorted(off.get(s, s) for s in own))
for cid in LIST:
    c = F.camp.get(cid, {}); o = c.get('off', '')
    act, t = K.campaign_action(cid, 20000)
    for lo, hi in (('2026-10-08', '2026-10-11'), ('2026-10-08', '2026-10-13')):
        s = C.Counter()
        for a in asd:
            if str(a['cid']) == cid and lo <= a['d'] <= hi: s[a['sku']] += a['sp']
        tot = sum(s.values())
        parts = []
        for sku, v in s.most_common(4):
            cd = sku2card.get(sku); r = rank.get(cd)
            tag = 'ГЛАВНЫЙ#%s' % r if sku in mains20 else ('карточка#%s' % r if r else '-')
            parts.append(f'{off.get(sku, sku)} {v / tot:.0%} ({tag})')
        if lo == '2026-10-08' and hi == '2026-10-11':
            print(f'{cid} {o:14} действие={act:5} темп={t:7,.0f} ₽/нед  art2sku={F.art2sku.get(o)}  08-11.10: всего {tot:7,.0f} ₽ -> ' + '; '.join(parts))
        else:
            print(f'{"":39}08-13.10: всего {tot:7,.0f} ₽ -> ' + '; '.join(parts))
# сколько всего кампаний на общий артикул среди идущих (не сопоставлены с товаром)
gen = sorted(k for k in P.ACTIVE if not F.art2sku.get(F.camp[k]['off']))
print('\nидущих кампаний на общий артикул (art2sku пусто):', len(gen), gen)
print('не в списке брифа:', sorted(set(gen) - set(LIST)))

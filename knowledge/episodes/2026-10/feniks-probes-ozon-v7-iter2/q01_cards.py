# ФЕНИКС iter2, проба Q01: кампании против карточек (card_groups.json), конфликт «цена и урез клика в одной карточке в один день».
# Печатает только артикулы, кампании, бюджеты и даты; прибыль по артикулам не печатает.
import sys, json, collections as C
V7 = '/home/user/t1/knowledge/episodes/2026-10/ozon-testy-scripts/v7'
sys.path.insert(0, V7); sys.path.insert(0, V7 + '/../v5')
import forecast as F
import plan7 as P

G = json.load(open(F.D + 'card_groups.json'))['groups']
main2offers = C.defaultdict(list)
for g in G:
    for s in g['skus']:
        main2offers[g['main']].append(s['offer'])
sku2art = {r['sku']: r['art'] for r in F.rows.values()}
price_day = {}
for s in F.lst:
    price_day[F.rows[s]['art']] = '15.10' if s in P.NOW else '22.10'
art2card = {}
for g in G:
    for s in g['skus']:
        art2card[s['offer']] = g['main']

print('== активные кампании: id | артикул | карточка | темп 08-11.10 ₽/нед | первый день расхода | в EXP | в 1в на минимум 15.10')
cut15 = P.EXP - P.LAD_IDS
rows = []
for k in sorted(P.ACTIVE, key=lambda k: -P.tempo(k)):
    c = F.camp[k]
    cd = P.camp_card(c)
    rows.append((k, c['off'], cd, round(P.tempo(k)), c['first'], k in P.EXP, k in cut15))
for r in rows:
    print(' ', r)

print('\n== несопоставленные кампании: кандидаты по частям артикула')
for k in P.ACTIVE:
    c = F.camp[k]; cd = P.camp_card(c)
    if str(cd).startswith('?'):
        t = c['off'].split('-')
        hits = sorted({cd2 for of, cd2 in art2card.items() if all(x in of.split('-') for x in t)})
        print(' ', k, c['off'], 'темп', round(P.tempo(k)), 'первый день', c['first'], 'всего за окно', round(c['sp']), '-> карточки-кандидаты:', hits)
        for h in hits:
            offs = main2offers[h]
            pr = [o for o in offs if o in price_day]
            print('     ', h, 'офферов', len(offs), 'из них в списке цены:', [(o, price_day[o]) for o in pr])

print('\n== карточки, где кампания уходит на минимум 15.10 (1в): артикулы цены в той же карточке и день цены')
for k in sorted(cut15):
    c = F.camp[k]; cd = P.camp_card(c)
    offs = main2offers.get(cd, [])
    pr = [(o, price_day[o]) for o in offs if o in price_day]
    print(' ', k, c['off'], 'карточка', cd, '| цена в карточке:', pr)

print('\n== то же для KONUX и KUVINO (фаза 2)')
for k in sorted(P.LAD_IDS):
    c = F.camp[k]; cd = P.camp_card(c)
    offs = main2offers.get(cd, [])
    pr = [(o, price_day[o]) for o in offs if o in price_day]
    print(' ', k, c['off'], 'карточка', cd, '| цена в карточке:', pr)

# конфликт: артикул цены 15.10 в карточке, где 15.10 кампания уходит на минимум
conf = []
for k in cut15:
    cd = P.camp_card(F.camp[k])
    for o in main2offers.get(cd, []):
        if price_day.get(o) == '15.10':
            conf.append((o, k, F.camp[k]['off']))
print('\n== КОНФЛИКТ 15.10 (цена и урез клика в одной карточке в один день):', sorted(set(conf)))

# ФЕНИКС проба P16: прямые выходы из «Эластичного» в состояние без бустингов (только рассрочки/нет записей): что с s и ценой
import json, collections as C
D = '/home/user/t1/analytics-mvp/data/'
L = lambda f: [json.loads(l) for l in open(D + f)]
A = L('acts_daily.ndjson'); G = L('gap_daily.ndjson'); P = L('prices_daily.ndjson')
acts = C.defaultdict(set)
for a in A: acts[(a['date'], a['art'])].add(a['title'])
boost = lambda ts: any('Эластичн' in x or 'бустинг' in x.lower() for x in ts)
days = sorted(set(a['date'] for a in A))
s = C.defaultdict(dict); pr = C.defaultdict(dict)
for g in G: s[g['art']][g['date']] = g['site_to_seller']
for p in P: pr[p['offer']][p['d']] = (p['price'], p['before'])
arts = set(a['art'] for a in A)
ex = []
for art in arts:
    for i in range(1, len(days)):
        a0 = acts.get((days[i-1], art), set()); a1 = acts.get((days[i], art), set())
        if any('Эластичн' in x for x in a0) and not boost(a1):
            ex.append((art, days[i-1], days[i], s[art].get(days[i-1]), s[art].get(days[i]), pr[art].get(days[i-1]), pr[art].get(days[i]), sorted(x[:25] for x in a1)))
print('[P16] выходов из «Эластичного» без перехода в другой бустинг:', len(ex))
for e in ex[:20]: print('   ', e)
# и обратные входы: из «без бустинга» в Эластичный
en = []
for art in arts:
    for i in range(1, len(days)):
        a0 = acts.get((days[i-1], art), set()); a1 = acts.get((days[i], art), set())
        if not boost(a0) and any('Эластичн' in x for x in a1):
            en.append((art, days[i-1], days[i], s[art].get(days[i-1]), s[art].get(days[i]), pr[art].get(days[i-1]), pr[art].get(days[i])))
print('[P16] входов в «Эластичный» из состояния без бустинга:', len(en))
for e in en[:12]: print('   ', e)

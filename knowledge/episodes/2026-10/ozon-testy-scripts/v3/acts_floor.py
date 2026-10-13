# Тезисы Ивана 6-7: «Эластичный» - цена акции = предельной, ничего не режет; «Максимальный бустинг» срезал
# предельную цену у 39 из 74 товаров (медиана -9,9%). Предельная = цена витрины / site_to_seller
# (coinv_daily.site_listed за 23-24.09, gap_daily). Рубли не печатаем - только отношения.
# Запуск: python3 -I acts_floor.py
import os
ROOT=os.path.abspath(__file__).split('knowledge/')[0]
import json,collections as C,statistics as S
D=ROOT+'analytics-mvp/data/'
L=lambda f:[json.loads(l) for l in open(D+f)]
G={(g['date'],g['art']):g['site_to_seller'] for g in L('gap_daily.ndjson')}
W={(r['date'],r['art']):r['site_listed'] for r in L('coinv_daily.ndjson') if r.get('observed') and r.get('site_listed')}
A=C.defaultdict(dict)
for a in L('acts_daily.ndjson'):
    if a['date'] in ('2026-09-23','2026-09-24'):
        t='E' if 'Эластичный' in a['title'] else 'U' if 'усил' in a['title'] else 'M' if a['title'].startswith('Максимальный') else None
        if t:
            try: A[(a['date'],a['art'])][t]=float(a['value'])
            except: pass
r=C.defaultdict(list)
for k,v in A.items():
    if k in G and k in W and G[k]:
        floor=W[k]/G[k]
        key=''.join(sorted(v))
        for t,val in v.items(): r[(key,t)].append(val/floor)
for (key,t),x in sorted(r.items()):
    x=sorted(x); print('товар в акциях %-4s цена акции %s / предельная: n=%d медиана %.3f p10 %.3f p90 %.3f; =предельной (±1%%) %.0f%%'%(key,t,len(x),S.median(x),x[len(x)//10],x[9*len(x)//10],100*sum(abs(v-1)<=0.01 for v in x)/len(x)))
B={(p['d'],p['offer']):p['before'] for p in L('prices_daily.ndjson') if p['d']>='2026-09-23' and p.get('before')}
x=sorted(float(a['value'])/B[(a['date'],a['art'])] for a in L('acts_daily.ndjson') if 'Эластичный' in a['title'] and (a['date'],a['art']) in B)
print('цена «Эластичного» / зачёркнутая: n=%d медиана %.3f (ниже зачёркнутой на %.0f%%)'%(len(x),S.median(x),(1-S.median(x))*100))
x=[(k,v) for (k,t),v in r.items()]
n=sum(1 for (key,t),v in r.items() if key=='E' for _ in v); ok=sum(1 for (key,t),v in r.items() if key=='E' for y in v if abs(y-1)<=0.01)
print('только «Эластичный»: цена акции = предельной (±1%%) у %d из %d'%(ok,n))

# Тезис 9-10: «Максимальный бустинг» стартовал 08.09 - его товары подешевели на 13,2% против 7,1% у магазина;
# «Усиленный» с 09.08: показы в поиске +136% против +46% у остальных. Состав акции до 23.09 есть только
# через date_from в снимках 23.09+ (товары, вышедшие до 23.09, не видны). Запуск: python3 -I max0809.py
import os
ROOT=os.path.abspath(__file__).split('knowledge/')[0]
import json,collections as C,statistics as S,math
D=ROOT+'analytics-mvp/data/'
L=lambda f:[json.loads(l) for l in open(D+f)]
M={a['art'] for a in L('acts_daily.ndjson') if a['title']=='Максимальный бустинг' and a['date_from']=='2026-09-08'}
H=C.defaultdict(dict)
for r in L('coinv_daily.ndjson'):
    if r.get('observed') and r.get('site_listed'): H[r['art']][r['date']]=r['site_listed']
def ch(arts,a,b):
    v=[math.log(H[x][b]/H[x][a]) for x in arts if a in H[x] and b in H[x]]
    return len(v),(math.exp(S.median(v))-1)*100
for a,b in (('2026-09-07','2026-09-08'),('2026-09-08','2026-09-09'),('2026-09-07','2026-09-09')):
    n1,m1=ch(M,a,b); n2,m2=ch(set(H)-M,a,b)
    print('%s -> %s: «Максимальный» с 08.09 (n=%d) %+.1f%%, остальные (n=%d) %+.1f%%'%(a[5:],b[5:],n1,m1,n2,m2))
off=json.load(open(D+'sku_offer.json')); SP=C.Counter()
for r in L('ads_sku_daily.ndjson'):
    if '2026-07-25'<='2026-08-22': SP[r['sku']]+=r['sp'] if '2026-07-25'<=r['d']<='2026-08-22' else 0
V=C.defaultdict(C.Counter); n=C.defaultdict(set)
for r in L('sku_views.ndjson'):
    d=r['date']; s=str(r['sku'])
    if SP[s]: continue
    w='до 02-08.08' if '2026-08-02'<=d<='2026-08-08' else 'после 09-15.08' if '2026-08-09'<=d<='2026-08-15' else None
    if w: V[w]['vsearch']+=r.get('vsearch') or 0; n[w].add(s)
print('все товары без рекламы за клик 25.07-22.08: показы в поиске в день на товар',{w:round(V[w]['vsearch']/7/len(n[w]),1) for w in V},'рост %+.0f%%'%((V['после 09-15.08']['vsearch']/V['до 02-08.08']['vsearch']-1)*100))

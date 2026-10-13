# Тест 4, все 10 товаров (Иван 13.10: «включи все обратно»): предельная и витрина до/после, акции, реклама за клик.
# Нам остаётся ~44% предельной до логистики (комиссия ~51% + ставка за заказ 5% считаются от предельной; tests.json, история теста 4).
# До = 06.10 (последний день до снижения 07.10), после = последний день с данными. Запуск: python3 -I test4_table.py
import os,json,collections as C,statistics as S
ROOT=os.path.abspath(__file__).split('knowledge/')[0]; D=ROOT+'analytics-mvp/data/'
T=json.load(open(ROOT+'analytics-mvp/tools/tests/tests.json'))['тесты_цены'][0]
ARTS=T['тест']; M=T['модели']; START=T['старт']
P=C.defaultdict(dict); G=C.defaultdict(dict); SKU={}; A=C.defaultdict(lambda:C.defaultdict(list)); SP=C.defaultdict(C.Counter); CID=C.defaultdict(set)
for l in open(D+'prices_daily.ndjson'):
    r=json.loads(l)
    if r.get('price'): P[r['offer']][r['d']]=r['price']
for l in open(D+'gap_daily.ndjson'):
    r=json.loads(l); G[r['art']][r['date']]=r['site_to_seller']; SKU[r['art']]=r['sku']
for l in open(D+'acts_daily.ndjson'):
    r=json.loads(l)
    if 'Рассрочка' not in r['title']: A[r['art']][r['date']].append(r['title'].split('.')[0]+' '+r['value'])
for l in open(D+'ads_sku_daily.ndjson'):
    r=json.loads(l)
    if r['sp']>0: SP[r['sku']][r['d']]+=r['sp']; CID[r['sku']].add(r['cid'])
gd=sorted({d for a in G for d in G[a]}); d0=max(d for d in gd if d<START); d1=max(gd)
med=lambda d:S.median(G[a][d] for a in G if d in G[a])
print('до %s, после %s; витрина/предельная по магазину %.3f -> %.3f'%(d0,d1,med(d0),med(d1)))
for a in ARTS:
    s=SKU[a]; p0,p1=P[a][d0],P[a][d1]; v0,v1=G[a][d0]*p0,G[a][d1]*p1
    adj=(G[a][d1]/med(d1))/(G[a][d0]/med(d0))*p1/p0-1   # витрина к магазину
    ad=lambda d:'; '.join(sorted(A[a].get(d,[]))) or 'нет'
    sp_pre=sum(v for d,v in SP[s].items() if '2026-09-30'<=d<START); sp_post=sum(v for d,v in SP[s].items() if d>=START)
    print('|%s|%s|%s|%.0f|%.0f|%+.1f%%|%.0f -> %.0f|%.0f|%.0f|%+.1f%%|%+.1f%%|%s -> %s|%s|'%(a,M[a],'исключён' if a in T['исключены'] else 'чистый',
        p0,p1,(p1/p0-1)*100,0.44*p0,0.44*p1,v0,v1,(v1/v0-1)*100,adj*100,ad(d0),ad(d1),
        ('%.0f ₽ за 7 дн. до / %.0f ₽ с 07.10 (кампании %s)'%(sp_pre,sp_post,', '.join(sorted(CID[s])))) if sp_pre+sp_post else 'нет'))

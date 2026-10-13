# Тезис 8: надбавку даёт реклама за клик, а не акция: товары в «Максимальном»/«Усилении» без рекламы надбавки не имеют.
# Разрыв gap_daily (1 - витрина / предельная) по группам, медиана по товаро-дням 25.09-07.10. Запуск: python3 -I acts_gap.py
import os
ROOT=os.path.abspath(__file__).split('knowledge/')[0]
import json,collections as C,statistics as S,datetime as dt
D=ROOT+'analytics-mvp/data/'
L=lambda f:[json.loads(l) for l in open(D+f)]
sh=lambda d,k:(dt.date.fromisoformat(d)+dt.timedelta(k)).isoformat()
off=json.load(open(D+'sku_offer.json'))
SP=C.defaultdict(C.Counter)
for r in L('ads_sku_daily.ndjson'): SP[off.get(r['sku'],r['sku'])][r['d']]+=r['sp']
A=C.defaultdict(set)
for a in L('acts_daily.ndjson'):
    if a['title'].startswith('Максимальный'): A[(a['date'],a['art'])].add('MU')
g=C.defaultdict(list)
for x in L('gap_daily.ndjson'):
    d,a=x['date'],x['art']
    if not('2026-09-25'<=d<='2026-10-07'): continue
    ad=any(SP[a][sh(d,-k)]>0 for k in range(0,4))
    g[('реклама за клик' if ad else 'без рекламы')+(', в «Максимальном»/«Усилении»' if A.get((d,a)) else ', вне этих акций')].append(x['gap_pct'])
for k,v in sorted(g.items()): print('%-55s товаро-дней %4d, разрыв медиана %.1f п., квартили %.1f..%.1f'%(k,len(v),S.median(v),sorted(v)[len(v)//4],sorted(v)[3*len(v)//4]))

# Тезис Ивана 3: ставка за заказ двигает цену всего магазина: 5% = -4 п., 9% = ещё -3, выкл. = +8%.
# Индекс магазина: медиана дневного изменения цены на сайте (coinv_daily.site_listed) у товаров без расхода
# за клик 8 дней. Журнал ставок analytics-mvp/tools/tests/cpo_history.psv. Запуск: python3 -I cpo_price.py
import os
ROOT=os.path.abspath(__file__).split('knowledge/')[0]
import json,collections as C,statistics as S,math,datetime as dt
D=ROOT+'analytics-mvp/data/'
L=lambda f:[json.loads(l) for l in open(D+f)]
sh=lambda d,k:(dt.date.fromisoformat(d)+dt.timedelta(k)).isoformat()
H=C.defaultdict(dict); P=C.defaultdict(dict)
for r in L('coinv_daily.ndjson'):
    if r.get('observed') and r.get('site_listed'): H[r['sku']][r['date']]=r['site_listed']; P[r['sku']][r['date']]=r['coinv_listed_pct']
SP=C.defaultdict(C.Counter)
for r in L('ads_sku_daily.ndjson'): SP[r['sku']][r['d']]+=r['sp']
days=sorted({d for s in H.values() for d in s})
clean=lambda s,d:sum(SP[s][sh(d,-k)] for k in range(0,8))==0
mv={};pts={};share={}
for a,b in zip(days,days[1:]):
    v=[math.log(H[s][b]/H[s][a]) for s in H if a in H[s] and b in H[s] and clean(s,b)]
    if len(v)>50:
        mv[b]=S.median(v); share[b]=sum(abs(x)>0.02 for x in v)/len(v)
log=[l.strip().split('|') for l in open(ROOT+'analytics-mvp/tools/tests/cpo_history.psv')][1:]
ch=C.OrderedDict()
for ts,c,u in log: ch.setdefault(ts[:10],[]).append(ts[11:16]+' '+c)
pc=lambda x:'%+.1f%%'%((math.exp(x)-1)*100)
print('день  | сдвиг цен магазина (медиана) | доля товаров со сдвигом >2% | смена ставки (UTC)')
big=[]
for d in days[1:]:
    if d not in mv: continue
    c=ch.get(d,'')
    if c or abs(mv[d])>0.02:
        print(d,'%7s %4.0f%%'%(pc(mv[d]),share[d]*100),' ; '.join(c) if c else '-')
# сводка: каждое событие ставки -> сдвиг в день события и на следующий
print('\nсобытие ставки -> сдвиг магазина за день события + следующий день')
res=C.defaultdict(list)
for d,cs in ch.items():
    last=cs[-1].split(' ',1)[1]; first=cs[0].split(' ',1)[1]
    x=sum(mv.get(sh(d,k),0) for k in (0,1))
    key=(first.split('>')[0] if '>' in first else first)+'>'+(last.split('>')[1] if '>' in last else last)
    res[key].append((d,x)); 
for k,v in res.items(): print(' %-14s'%k,' '.join('%s %s'%(d[5:],pc(x)) for d,x in v))
nmove=sum(1 for d in mv if abs(mv[d])>0.02); near=sum(1 for d in mv if abs(mv[d])>0.02 and any(sh(d,k) in ch for k in (0,-1)))
print('\nдней со сдвигом магазина >2%%: %d, из них в день смены ставки или на следующий: %d'%(nmove,near))
nch=len(ch); hit=sum(1 for d in ch if any(abs(mv.get(sh(d,k),0))>0.02 for k in (0,1)))
print('дней со сменой ставки: %d, за которыми сдвиг >2%% в тот же или следующий день: %d'%(nch,hit))

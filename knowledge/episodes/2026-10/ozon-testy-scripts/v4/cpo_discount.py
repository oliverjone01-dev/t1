# Вопрос Ивана 13.10: сколько скидки (цены на сайте) дают уровни ставки за заказ 5/7/9% и выключение,
# если убрать другие влияния. Запуск: python3 -I cpo_discount.py
# Что убираем: (1) надбавку от рекламы за клик - берём только товары без расхода за клик 14 дней (надбавка держится ~7);
# (2) свои правки цены отдельных товаров - медиана по ~400 товарам; (3) сдвиги OZON по неделям - эффекты недели;
# (4) день недели; (5) откаты через 2-4 дня - смотрим эффект на 0..6 день после смены, а не только в день смены.
# Данные: coinv_daily.site_listed (цена на сайте, 12.06-24.09), ads_sku_daily (расход за клик), журнал ставок по 07.09.
import os,json,math,collections as C,statistics as S,datetime as dt
import numpy as np
ROOT=os.path.abspath(__file__).split('knowledge/')[0]; D=ROOT+'analytics-mvp/data/'
sh=lambda d,k:(dt.date.fromisoformat(d)+dt.timedelta(k)).isoformat()
H=C.defaultdict(dict)
for l in open(D+'coinv_daily.ndjson'):
    r=json.loads(l)
    if r.get('observed') and r.get('site_listed'): H[r['sku']][r['date']]=r['site_listed']
SP=C.defaultdict(C.Counter)
for l in open(D+'ads_sku_daily.ndjson'):
    r=json.loads(l); SP[r['sku']][r['d']]+=r['sp']
CLEAN=14
clean=lambda s,d:sum(SP[s][sh(d,-k)] for k in range(CLEAN+1))==0
days=sorted({d for s in H.values() for d in s})
mv={};n={}
for a,b in zip(days,days[1:]):
    if sh(a,1)!=b: continue                      # пропуск дня = пропуск
    v=[math.log(H[s][b]/H[s][a]) for s in H if a in H[s] and b in H[s] and clean(s,b)]
    if len(v)>50: mv[b]=S.median(v); n[b]=len(v)
# состояние ставки на конец каждого дня (UTC) по журналу; до первой записи 5%
log=[l.strip().split('|') for l in open(ROOT+'analytics-mvp/tools/tests/cpo_history.psv')][1:]
st={}; cur='5'
ev=C.defaultdict(list)
for ts,c,u in log: ev[ts[:10]].append(c)
for d in [sh('2026-06-01',k) for k in range(0,110)]:
    for c in ev.get(d,[]):
        cur='OFF' if c=='OFF' else ('5' if c=='ON 5%' else c.split('>')[1].split('.')[0])
    st[d]=cur
LAST='2026-09-23'  # после 07.09 ставка 5% (команда 13.10), цены сайта по 23-24.09
dd=[d for d in sorted(mv) if d<=LAST]
print('дней с индексом магазина:',len(dd),'; товаров в индексе в день, медиана:',int(S.median(n[d] for d in dd)))
print('смены ставки (конец дня):',' '.join('%s %s'%(d[5:],st[d]) for d in sorted(ev)))
lv=['7','9','OFF']
def dummy(d,x): return 1.0 if st.get(d)==x else 0.0
def fit(dd,L,weekfe=True,dow=True):
    # изменение индекса за день d = сумма по лагам k (0..L) скачков состояния (d-k) + неделя + день недели
    X=[];y=[];names=[]
    for x in lv:
        for k in range(L+1): names.append('%s_l%d'%(x,k))
    wk=sorted({dt.date.fromisoformat(d).isocalendar()[1] for d in dd}); dw=list(range(1,7))
    for d in dd:
        row=[dummy(sh(d,-k),x)-dummy(sh(d,-k-1),x) for x in lv for k in range(L+1)]
        w=dt.date.fromisoformat(d).isocalendar()[1]
        if weekfe: row+=[1.0 if w==q else 0.0 for q in wk]
        else: row+=[1.0]
        if dow: row+=[1.0 if dt.date.fromisoformat(d).isoweekday()==q else 0.0 for q in dw]
        X.append(row); y.append(mv[d])
    X=np.array(X); y=np.array(y)
    b,*_=np.linalg.lstsq(X,y,rcond=None); e=y-X@b
    XtXi=np.linalg.pinv(X.T@X); V=XtXi@(X.T*(e**2))@X@XtXi   # HC0
    out={}
    for i,x in enumerate(lv):
        idx=list(range(i*(L+1),(i+1)*(L+1)))
        cum=b[idx].sum(); se=math.sqrt(max(V[np.ix_(idx,idx)].sum(),0))
        day2=b[idx[:3]].sum(); se2=math.sqrt(max(V[np.ix_(idx[:3],idx[:3])].sum(),0))
        out[x]=(cum,se,day2,se2)
    return out,len(y),X.shape[1]
pc=lambda x:'%+.1f%%'%((math.exp(x)-1)*100)
ci=lambda m,s:'%s (95%% ДИ %s...%s)'%(pc(m),pc(m-1.96*s),pc(m+1.96*s))
lab={'7':'7% вместо 5%','9':'9% вместо 5%','OFF':'выключено вместо 5%'}
# Модель уровня: индекс цены магазина (накопленная медиана изменений) = состояние ставки (с задержкой lag дней)
# + эффект недели + день недели. Внутри недели ставку в июне-августе меняли 1-2 раза - это и сравниваем.
# Модель изменений с лагами 0-6 и неделями переобучается (41 параметр на 83 дня, ответ прыгает от -5% до +25%) - не используем.
def level(dd,lag,weekfe=True,ref='5'):
    I={};acc=0.0;dl=None
    allD=sorted(mv)
    # уровень считаем только по непрерывным отрезкам: при пропуске дня отрезок новый (свой эффект)
    seg=0;segs={}
    for d in allD:
        if dl and sh(dl,1)!=d: seg+=1
        acc+=mv[d]; I[d]=acc; segs[d]=seg; dl=d
    use=[d for d in dd if d in I]
    states=[x for x in ['5','7','9','OFF'] if x!=ref and any(st[sh(d,-lag)]==x for d in use)]
    wk=sorted({(segs[d],dt.date.fromisoformat(d).isocalendar()[1]) for d in use}) if weekfe else sorted({(segs[d],0) for d in use})
    X=[];y=[]
    for d in use:
        g=(segs[d],dt.date.fromisoformat(d).isocalendar()[1] if weekfe else 0)
        X.append([1.0 if st[sh(d,-lag)]==x else 0.0 for x in states]+[1.0 if g==q else 0.0 for q in wk]
                 +[1.0 if dt.date.fromisoformat(d).isoweekday()==q else 0.0 for q in range(1,7)])
        y.append(I[d])
    X=np.array(X);y=np.array(y);b,*_=np.linalg.lstsq(X,y,rcond=None);e=y-X@b
    XtXi=np.linalg.pinv(X.T@X);V=XtXi@(X.T*(e**2))@X@XtXi
    return {x:(b[i],math.sqrt(max(V[i,i],0))) for i,x in enumerate(states)},len(y),X.shape[1]
lab2={'5':'5%','7':'7%','9':'9%','OFF':'выключено'}
for title,sub,wf,ref in [('основная: неделя + день недели, база 7%',dd,True,'7'),
                         ('то же, база 5%',dd,True,'5'),
                         ('без недели (только день недели), база 5%',dd,False,'5'),
                         ('только июнь-июль (7 и 9%), база 7%',[d for d in dd if d<'2026-08-01'],True,'7'),
                         ('без 27.08-10.09, база 5%',[d for d in dd if not '2026-08-27'<=d<='2026-09-10'],True,'5')]:
    for lag in (0,1,2,3):
        out,N,P=level(sub,lag,wf,ref)
        print('%-42s задержка %d дн. (дней %d, парам. %d): '%(title,lag,N,P)+'; '.join('%s к %s %s'%(lab2[x],lab2[ref],ci(m,s)) for x,(m,s) in out.items()))
# сырые события для контроля: сдвиг индекса за день смены + следующий и за 0..4 дня
print('\nсобытия (сдвиг индекса магазина; пропуск дня - пропуск):')
prev='5'
for d in sorted(ev):
    if d>LAST: break
    new=st[d]
    w2=[sh(d,k) for k in (0,1)]; w5=[sh(d,k) for k in range(5)]
    f=lambda w:pc(sum(mv[x] for x in w)) if all(x in mv for x in w) else 'нет данных'
    print('  %s %3s -> %-3s  0-1 день %8s   0-4 дня %8s'%(d[5:],prev,new,f(w2),f(w5)))
    prev=new
# база: типичный сдвиг индекса в день без смены ставки в тот день и 2 дня до
q=[mv[d] for d in dd if not any(sh(d,-k) in ev for k in range(3))]
print('\nдни без смены (0-2 дня назад): %d, медиана %s, |сдвиг|>2%%: %d'%(len(q),pc(S.median(q)),sum(abs(x)>0.02 for x in q)))

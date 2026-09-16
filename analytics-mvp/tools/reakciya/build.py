import pandas as pd, numpy as np, json, re, os
import sys,os
# Запускать из analytics-mvp:  python3 tools/reakciya/build.py
# Читает сырые выгрузки кабинета из tools/reakciya/data-cabinet/ (в git не хранятся, см. README),
# пишет срез в data/reakciya.json. Дальше:  npm run reakciya
ROOT=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
D=os.path.join(ROOT,'tools','reakciya','data-cabinet')+os.sep
L=os.path.join(ROOT,'data')+os.sep
snap=pd.read_csv(D+'snapshot_514_2026-09-09.psv',sep='|')
nm=snap['name'].astype(str).str.lower()
snap['cat']=np.where(nm.str.contains('зеркал'),'Зеркала','Мебель')
sku2art=dict(zip(snap['sku'],snap['art'])); sku2cat=dict(zip(snap['sku'],snap['cat']))
sku2name=dict(zip(snap['sku'],snap['name'])); art2sku=dict(zip(snap['art'],snap['sku']))
id2sku=dict(zip(snap['id'],snap['sku']))

an=pd.read_csv(D+'analytics_sku_daily_2026-06-12_09-09.psv',sep='|')
an['d']=pd.to_datetime(an['date'])
an=an.sort_values(['sku','d'])

# соинвест по дням из истории цен
ph=pd.read_pickle(D+'price_history.pkl')
mc=ph[ph['src']=='marketing-consumer'].copy()
mc['d']=mc['ts'].dt.normalize()
mc=mc.sort_values('ts').groupby(['art','d'],as_index=False).last()
cap=dict(zip(snap['art'],snap['seller']))
mc['cap']=mc['art'].map(cap)
mc['coinv']=(1-mc['mp']/mc['cap'])*100
co=mc[['art','d','coinv']].dropna()

# события
ev=pd.read_csv(D+'ads_campaign_history_2026-06-13_09-10.psv',sep='|')
ev['ts']=pd.to_datetime(ev['ts_utc']).dt.tz_localize(None)+pd.Timedelta(hours=3)
ev['user']=ev['user'].astype(str).str.split('@').str[0]
ev=ev.rename(columns={'obj_id':'sku','camp':'campname','type':'etype','change':'chg'})
nw=pd.read_csv(L+'events_new.psv',sep='|')
nw['ts']=pd.to_datetime(nw['ts']).dt.tz_localize(None)+pd.Timedelta(hours=3)
nw=nw.rename(columns={'camp':'camp_id','type':'etype','change':'chg'})
nw['campname']=''
ev=pd.concat([ev[['camp_id','campname','ts','etype','chg','sku','user']],
              nw[['camp_id','campname','ts','etype','chg','sku','user']]],ignore_index=True)
ev=ev.drop_duplicates(subset=['camp_id','ts','chg','sku'])
cn=ev[ev['campname'].astype(str).str.len()>0].groupby('camp_id')['campname'].last().to_dict()
ev['campname']=ev['camp_id'].map(cn).fillna('')
ev['sku']=pd.to_numeric(ev['sku'],errors='coerce')

cpo=pd.read_csv(D+'cpo_history.psv',sep='|')
cpo['ts']=pd.to_datetime(cpo['ts_utc']).dt.tz_localize(None)+pd.Timedelta(hours=3)

print('события кампаний:',len(ev),'диапазон',ev['ts'].min(),ev['ts'].max())
print('CPO событий:',len(cpo))
print('аналитика SKU-дней:',len(an),'до',an['d'].max().date())
print('соинвест точек:',len(co))

# ---------- группировка событий в действия ----------
def fam(t,c):
    t=str(t); c=str(c)
    if 'Активация' in t or t=='Активация' or t=='Деактивация':
        return 'Выключение кампании' if 'еактивир' in c or t=='Деактивация' else 'Включение кампании'
    if 'Архивация' in t: return 'Архивация кампании'
    if 'бюджет' in t.lower() or t=='Бюджет': return 'Бюджет'
    if 'ставки' in t.lower() or t=='Ставка': return 'Ставка за клик'
    if 'товаров' in t.lower(): return 'Товары в кампании'
    if 'стратег' in t.lower(): return 'Стратегия'
    if 'распределения' in t.lower(): return 'Распределение бюджета'
    if 'автодобавл' in t.lower(): return 'Автодобавление'
    if 'размещен' in t.lower(): return 'Площадки'
    return t[:28]
ev['fam']=[fam(a,b) for a,b in zip(ev['etype'],ev['chg'])]
def nums(s):
    v=re.findall(r'(\d+(?:[.,]\d+)?)',str(s).replace(' ',''))
    return [float(x.replace(',','.')) for x in v]
ev['day']=ev['ts'].dt.normalize()
ev['hr']=ev['ts'].dt.floor('h')
ev=ev.sort_values('ts')
camp_skus=ev.dropna(subset=['sku']).groupby('camp_id')['sku'].apply(lambda s:sorted(set(s.astype(int)))).to_dict()

acts=[]
for (cid,fm,sk,hr),g in ev.groupby(['camp_id','fam','sku','hr'],dropna=False):
    g=g.sort_values('ts')
    first,last=g.iloc[0],g.iloc[-1]
    n1,n2=nums(first['chg']),nums(last['chg'])
    detail=str(last['chg'])[:90]
    if fm in ('Ставка за клик','Бюджет') and n1 and n2:
        a,b=n1[0],n2[-1]
        if abs(a-b)<1e-9 and len(g)>1: continue
        detail=('%g -> %g'%(a,b))+(' ₽' if fm=='Ставка за клик' else ' ₽/нед')
    acts.append(dict(kind='cpc',camp=int(cid),campname=last['campname'],ts=last['ts'],fam=fm,
                     detail=detail,sku=(int(sk) if pd.notna(sk) else None),user=last['user'],n=len(g)))
for _,r in cpo.iterrows():
    ch=str(r['change'])
    fm='Ставка оплаты за заказ' if '>' in ch else ('Выключение оплаты за заказ' if ch=='OFF' else 'Включение оплаты за заказ')
    acts.append(dict(kind='cpo',camp=0,campname='Оплата за заказ - все товары',ts=r['ts'],fam=fm,
                     detail=ch.replace('>',' -> '),sku=None,user=str(r['user']),n=1))
A0=pd.DataFrame(acts).sort_values('ts').reset_index(drop=True)
A0['hr']=A0['ts'].dt.floor('h')
def fill_sku(r):
    if r['kind']!='cpc' or (r['sku'] is not None and not pd.isna(r['sku'])): return r['sku']
    ss=camp_skus.get(r['camp'],[])
    return ss[0] if len(ss)==1 else r['sku']
A0['sku']=A0.apply(fill_sku,axis=1)
RANK={'Включение кампании':0,'Выключение кампании':0,'Архивация кампании':0,'Товары в кампании':1,
      'Бюджет':2,'Ставка за клик':3,'Стратегия':4,'Ставка оплаты за заказ':0,
      'Включение оплаты за заказ':0,'Выключение оплаты за заказ':0}
mg=[]
for (cid,sk,hr),g in A0.groupby(['camp','sku','hr'],dropna=False):
    g=g.sort_values(g['fam'].map(lambda x:RANK.get(x,9)).rename('r').values.argsort().argsort() if False else 'ts')
    g=g.assign(_r=g['fam'].map(lambda x:RANK.get(x,9))).sort_values(['_r','ts'])
    head=g.iloc[0]
    parts=[]
    for _,rr in g.iterrows():
        d=str(rr['detail'])
        parts.append(rr['fam'] if rr['fam'] in ('Включение кампании','Выключение кампании','Архивация кампании','Товары в кампании','Стратегия') else rr['fam']+' '+d)
    mg.append(dict(kind=head['kind'],camp=head['camp'],campname=head['campname'],ts=g['ts'].max(),
                   fam=head['fam'],detail='; '.join(dict.fromkeys(parts))[:160],sku=head['sku'],
                   user=head['user'],n=int(g['n'].sum()),nfam=len(g)))
A=pd.DataFrame(mg).sort_values('ts').reset_index(drop=True)
A['day']=A['ts'].dt.normalize()
print('действий после группировки:',len(A))
print(A['fam'].value_counts().to_string())

# ---------- эффект ----------
an_i=an.set_index(['sku','d']).sort_index()
piv={m:an.pivot_table(index='d',columns='sku',values=m,aggfunc='sum') for m in
     ['search_position','search_views','pdp_views','ordered_units']}
co['skux']=co['art'].map(art2sku)
piv['coinv']=co.dropna(subset=['skux']).pivot_table(index='d',columns='skux',values='coinv',aggfunc='last')
DMAX=an['d'].max()
store={m:(piv[m].median(axis=1) if m in ('search_position','coinv') else piv[m].sum(axis=1)) for m in piv}

def win(m,skus,a,b,how):
    P=piv[m]
    cols=[s for s in skus if s in P.columns]
    if not cols: return np.nan
    sub=P.loc[(P.index>=a)&(P.index<=b),cols]
    if sub.empty: return np.nan
    if how=='med': return float(np.nanmedian(sub.values))
    return float(np.nansum(sub.values))/max(1,len(sub))

HOW={'search_position':'med','coinv':'med','search_views':'sum','pdp_views':'sum','ordered_units':'sum'}
rows=[]
for i,r in A.iterrows():
    d=r['day']
    if r['kind']=='cpo': skus=list(piv['ordered_units'].columns)
    elif r['sku'] is not None and not pd.isna(r['sku']): skus=[int(r['sku'])]
    else: skus=camp_skus.get(r['camp'],[])
    if not skus: continue
    base_sv=win('search_views',skus,d-pd.Timedelta(days=7),d-pd.Timedelta(days=1),'sum')
    rec=dict(idx=i,ts=r['ts'],fam=r['fam'],detail=r['detail'],user=r['user'],camp=r['camp'],ctrl=(r['kind']!='cpo'),
             base=(None if base_sv is None or np.isnan(base_sv) else round(float(base_sv))),
             campname=r['campname'],kind=r['kind'],nsku=len(skus),
             sku=(int(r['sku']) if r['sku'] is not None and not pd.isna(r['sku']) else None))
    for m in HOW:
        how=HOW[m]
        b0=win(m,skus,d-pd.Timedelta(days=7),d-pd.Timedelta(days=1),how)
        sb=(store[m].loc[(store[m].index>=d-pd.Timedelta(days=7))&(store[m].index<=d-pd.Timedelta(days=1))]).mean()
        for k in (1,3,7):
            end=d+pd.Timedelta(days=k)
            if end>DMAX: rec[f'{m}_{k}']=None; continue
            a0=win(m,skus,d+pd.Timedelta(days=1),end,how)
            sa=(store[m].loc[(store[m].index>=d+pd.Timedelta(days=1))&(store[m].index<=end)]).mean()
            if b0 is None or np.isnan(b0) or a0 is None or np.isnan(a0): rec[f'{m}_{k}']=None; continue
            ctrl = (r['kind']!='cpo')
            if m in ('search_position','coinv'):
                val=(a0-b0)-(((sa-sb) if (ctrl and not np.isnan(sa) and not np.isnan(sb)) else 0))
            else:
                if b0<=0: val=None
                elif ctrl:
                    val=None if sb<=0 else ((a0/b0)-(sa/sb))*100
                else:
                    val=(a0/b0-1)*100
            rec[f'{m}_{k}']=None if val is None or (isinstance(val,float) and np.isnan(val)) else round(float(val),1)
    rows.append(rec)
EFF=pd.DataFrame(rows)
print('действий с эффектом:',len(EFF))
print('есть +7:',EFF['ordered_units_7'].notna().sum(),' есть +3:',EFF['ordered_units_3'].notna().sum())

# ---------- текущее состояние кампаний ----------
TODAY=pd.Timestamp('2026-09-15')
st={}
for cid,g in A0[A0['kind']=='cpc'].groupby('camp'):
    g=g.sort_values('ts')
    on=None; onts=None
    for _,r in g.iterrows():
        if r['fam']=='Включение кампании': on=True; onts=r['ts']
        elif r['fam'] in ('Выключение кампании','Архивация кампании'): on=False; onts=r['ts']
    bud=g[g['fam']=='Бюджет']
    bid=g[g['fam']=='Ставка за клик']
    def lastnum(df):
        for _,rr in df.sort_values('ts').iloc[::-1].iterrows():
            v=nums(rr['detail'])
            if v: return v[-1]
        return None
    lastbud=lastnum(bud); lastbid=lastnum(bid)
    st[cid]=dict(camp=cid,name=(g['campname'].iloc[-1] or str(cid)),on=on,on_ts=onts,
                 wbudget=lastbud,bid=lastbid,skus=camp_skus.get(cid,[]),
                 last_ts=g['ts'].max(),nacts=len(g))
CS=pd.DataFrame(st.values())
CS['days_since']=(TODAY-CS['last_ts']).dt.days
active=CS[CS['on']==True]
print('кампаний в логе:',len(CS),'| активны по логу:',len(active),'| выключены:',(CS['on']==False).sum(),'| неизвестно:',CS['on'].isna().sum())
print(active[['camp','name','wbudget','bid','days_since']].sort_values('days_since').head(12).to_string(index=False))
cur=pd.read_csv(L+'cur_prices.psv',sep='|')
cur['sku']=cur['id'].map(id2sku)
cur['coinv']=(1-cur['site']/cur['cap'])*100
cur['art']=cur['sku'].map(sku2art); cur['cat']=cur['sku'].map(sku2cat)
adv=set()
for c in active['camp']: adv.update(camp_skus.get(c,[]))
cur['adv']=cur['sku'].isin(adv)
print('\nтоваров с M-акцией:',(cur['act']=='M').sum(),' из них без рекламы:',((cur['act']=='M')&(~cur['adv'])).sum())
print('медиана соинвеста: реклама %.1f%% | без рекламы %.1f%%' % (cur[cur['adv']]['coinv'].median(), cur[~cur['adv']]['coinv'].median()))

# ---------- алерты ----------
AL=[]
NORM_W=250*7
mset=set(cur[cur['act']=='M']['sku'].dropna().astype(int))
off7=CS[(CS['on']==False)&(CS['last_ts']>=TODAY-pd.Timedelta(days=7))]
if len(off7):
    sk=[]; nm=[]
    for _,r in off7.iterrows(): sk+=list(r['skus']); nm.append(r['name'])
    AL.append(dict(sev='high',rule='Кампания выключена на этой неделе',what=', '.join(nm[:4]),
        detail='Выключено кампаний: %d. По закону 2 надбавка к скидке держится ещё 5-7 дней и пропадает, по закону 3 ставка за заказ по этим товарам поднимается с 10%% до 23%%.'%len(off7),
        action='Включить обратно либо осознанно принять потерю надбавки и рост ставки за заказ',n=len(set(sk)),skus=sorted(set(sk))[:8]))
off14=CS[(CS['on']==False)&(CS['last_ts']>=TODAY-pd.Timedelta(days=21))&(CS['last_ts']<TODAY-pd.Timedelta(days=7))]
sk14=sorted({s2 for _,r in off14.iterrows() for s2 in r['skus']})
if sk14:
    AL.append(dict(sev='low',rule='Выключены раньше, надбавка уже ушла',what='%d кампаний за 8-21 день'%len(off14),
        detail='По этим товарам надбавка к скидке Ozon уже должна была пропасть. Это кандидаты на повторное включение с копеечным бюджетом.',
        action='Сверить с оборотом и включить те, что продаются',n=len(sk14),skus=sk14[:8]))
over=active[active['wbudget'].notna()&(active['wbudget']>NORM_W)]
if len(over):
    tot=int(over['wbudget'].sum()); norm=int(NORM_W*len(over))
    AL.append(dict(sev='high',rule='Бюджеты выше нормы',what='%d активных кампаний'%len(over),
        detail='Суммарный недельный бюджет %s ₽ против нормы %s ₽. Надбавка к скидке от бюджета не зависит: 34 ₽ и 4 500 ₽ в день дают одинаково.'%(f'{tot:,}'.replace(',',' '),f'{norm:,}'.replace(',',' ')),
        action='Ужать каждую до 1 750 ₽ в неделю, через 3 дня проверить надбавку по истории цен',
        n=len(over),skus=[int(x) for c in over['camp'] for x in camp_skus.get(c,[])][:8]))
mnoadv=cur[(cur['act']=='M')&(~cur['adv'])]
if len(mnoadv):
    loss=int((mnoadv['cap']*0.01).sum())
    AL.append(dict(sev='mid',rule='Акция без рекламы',what='Максимальный бустинг, %d товаров'%len(mnoadv),
        detail='Товары сидят в акции со срезанной предельной ценой и не имеют кампании за клик. Та же надбавка к скидке доступна за счёт Ozon через копеечную кампанию.',
        action='Включить кампанию, дождаться надбавки через 2-3 дня, выйти из акции',n=len(mnoadv),
        skus=[int(x) for x in mnoadv['sku'].dropna().head(8)]))
AL.append(dict(sev='high',rule='Ставка 23% в спящем списке',what='Оплата за заказ - выбранные товары',
    detail='46 товаров из 47 имеют ставку 23%. Валовая прибыль с заказа 16,7% цены, значит включение списка убыточно по каждому товару.',
    action='Опустить ставки до 10% или очистить список, чтобы случайное включение не стоило прибыли',n=46,skus=[]))
cpo_now=str(cpo.sort_values('ts').iloc[-1]['change'])
cpo_rate=float(cpo_now.split('>')[-1].replace('%','')) if '>' in cpo_now else None
if cpo_rate is not None and cpo_rate>5:
    AL.append(dict(sev='high',rule='Ставка оплаты за заказ выше 5%',what='Все товары',
        detail='Сейчас %s. Каждый лишний пункт ставки это лишние деньги с каждого заказа магазина.'%cpo_now.replace('>',' -> '),
        action='Вернуть 5%',n=0,skus=[]))
else:
    AL.append(dict(sev='ok',rule='Оплата за заказ в норме',what='Все товары, ставка 5%',
        detail='Последнее изменение %s, инструмент включён. Это правильный режим.'%cpo.sort_values('ts').iloc[-1]['ts'].strftime('%d.%m'),
        action='Не трогать. Пятничные 9% не возвращать',n=0,skus=[]))
stale=active[active['days_since']>21]
if len(stale):
    AL.append(dict(sev='low',rule='Кампании без присмотра',what='%d активных кампаний'%len(stale),
        detail='Последнее изменение больше 21 дня назад: '+', '.join(list(stale['name'])[:5])+'. Такие кампании тратят бюджет молча.',
        action='Проверить, нужны ли они, и либо ужать бюджет, либо выключить',
        n=int(stale['skus'].map(len).sum()),skus=[int(x) for r in stale['skus'] for x in r][:8]))
print('алертов:',len(AL))
for a in AL: print(' ',a['sev'],'|',a['rule'],'|',a['what'],'|',a['n'])

# ---------- уровни: товар / группа / магазин ----------
def lvl(skus):
    P=piv; out={}
    cols=[s for s in skus if s in P['ordered_units'].columns]
    if not cols: return None
    last7=P['ordered_units'].index.max()-pd.Timedelta(days=6)
    prev7=last7-pd.Timedelta(days=7)
    for m in ['search_position','search_views','pdp_views','ordered_units','coinv']:
        Pm=P[m]; c2=[s for s in cols if s in Pm.columns]
        if not c2: out[m]=[None,None]; continue
        a=Pm.loc[Pm.index>=last7,c2]; b=Pm.loc[(Pm.index>=prev7)&(Pm.index<last7),c2]
        f=(lambda x: float(np.nanmedian(x.values))) if m in ('search_position','coinv') else (lambda x: float(np.nansum(x.values)))
        out[m]=[None if a.empty else round(f(a),1), None if b.empty else round(f(b),1)]
    return out
allsk=list(piv['ordered_units'].columns)
grp={'Магазин':allsk,
     'Мебель':[s for s in allsk if sku2cat.get(s)=='Мебель'],
     'Зеркала':[s for s in allsk if sku2cat.get(s)=='Зеркала'],
     'С рекламой':[s for s in allsk if s in adv],
     'Без рекламы':[s for s in allsk if s not in adv]}
LV={k:lvl(v) for k,v in grp.items()}
LVN={k:len(v) for k,v in grp.items()}

# соинвест сейчас по группам (из свежего снимка 15.09)
CO_NOW={}
for k,f in [('Магазин',lambda d:d),('Мебель',lambda d:d[d['cat']=='Мебель']),('Зеркала',lambda d:d[d['cat']=='Зеркала']),
            ('С рекламой',lambda d:d[d['adv']]),('Без рекламы',lambda d:d[~d['adv']])]:
    dd=f(cur).dropna(subset=['coinv'])
    CO_NOW[k]=[round(float(dd['coinv'].median()),1),len(dd)]

# ---------- спарклайны, сводка по типам, календарь ----------
def series(skus,d,m,half=7):
    P=piv[m]; cols=[x for x in skus if x in P.columns]
    out=[]
    for k in range(-half,half+1):
        dd=d+pd.Timedelta(days=k)
        if not cols or dd not in P.index: out.append(None); continue
        v=P.loc[dd,cols]
        out.append(None if v.isna().all() else (float(np.nanmedian(v)) if m in ('search_position','coinv') else float(np.nansum(v))))
    return [None if x is None or (isinstance(x,float) and np.isnan(x)) else round(x,1) for x in out]

SP={}
SPMIN=(pd.Timestamp('2026-09-15')-pd.Timedelta(days=45))
for _,r in EFF.iterrows():
    i=int(r['idx']); ar=A.loc[i]
    if ar['day']<SPMIN: continue
    if ar['kind']=='cpo': skus=list(piv['ordered_units'].columns)
    elif ar['sku'] is not None and not pd.isna(ar['sku']): skus=[int(ar['sku'])]
    else: skus=camp_skus.get(ar['camp'],[])
    sv=series(skus,ar['day'],'search_views')
    if all(x is None for x in sv): continue
    SP[i]=dict(sv=[None if x is None else int(round(x)) for x in sv])

# сводка по типам действий
BT=[]
for fm,g in EFF.groupby('fam'):
    row=dict(fam=fm,n=int(len(g)))
    for m in ['search_position','search_views','pdp_views','ordered_units','coinv']:
        for k in (3,7):
            v=pd.to_numeric(g[f'{m}_{k}'],errors='coerce').dropna()
            row[f'{m}_{k}']=None if len(v)<3 else round(float(v.median()),1)
            row[f'{m}_{k}_n']=int(len(v))
    BT.append(row)
BT=sorted(BT,key=lambda x:-x['n'])

# календарь
CAL={}
for _,r in A.iterrows():
    d=r['day'].strftime('%Y-%m-%d')
    c=CAL.setdefault(d,dict(n=0,cpo=0,on=0,off=0,bid=0,bud=0))
    c['n']+=1
    if r['kind']=='cpo': c['cpo']+=1
    if r['fam']=='Включение кампании': c['on']+=1
    if r['fam'] in ('Выключение кампании','Архивация кампании'): c['off']+=1
    if r['fam']=='Ставка за клик': c['bid']+=1
    if r['fam']=='Бюджет': c['bud']+=1

# ---------- шаги ставки оплаты за заказ ----------
def parse_rate(ch):
    ch=str(ch)
    if ch=='OFF': return None
    if ch.startswith('ON'):
        m=re.search(r'([\d.]+)',ch); return float(m.group(1)) if m else None
    m=re.findall(r'([\d.]+)%',ch)
    return float(m[-1]) if m else None
cpo_steps=[]
for _,r in cpo.sort_values('ts').iterrows():
    ch=str(r['change'])
    val=parse_rate(ch)
    prev=parse_rate(ch.split('>')[0]) if '>' in ch else None
    kind='off' if ch=='OFF' else ('on' if ch.startswith('ON') else ('up' if (prev is not None and val is not None and val>prev) else 'down'))
    cpo_steps.append(dict(d=r['ts'].strftime('%Y-%m-%d'),t=r['ts'].strftime('%H:%M'),
                          v=val,prev=prev,kind=kind,txt=ch.replace('>',' -> '),user=str(r['user'])))

# ---------- дневные ряды по группам (для периода и таймлайна) ----------
MET=['search_position','search_views','pdp_views','ordered_units','coinv']
alldates=sorted({d.strftime('%Y-%m-%d') for m in MET for d in piv[m].index})
DAILY={'_dates':alldates,'_met':MET}
for k,skus in grp.items():
    arrs={m:[None]*len(alldates) for m in MET}
    pos={d:i for i,d in enumerate(alldates)}
    for m in MET:
        P=piv[m]; c2=[x for x in skus if x in P.columns]
        if not c2: continue
        sub=P[c2]
        ser=(sub.median(axis=1) if m in ('search_position','coinv') else sub.sum(axis=1))
        for d,v in ser.items():
            if pd.isna(v): continue
            arrs[m][pos[d.strftime('%Y-%m-%d')]]=round(float(v),1)
    DAILY[k]=[arrs[m] for m in MET]

# ---------- лента ----------
EFF['art']=EFF['sku'].map(sku2art)
EFF['cat']=EFF['sku'].map(sku2cat)
feed=[]
for _,r in EFF.sort_values('ts',ascending=False).iterrows():
    EM=['coinv','search_views','search_position','pdp_views','ordered_units']
    ev=[]
    for m in EM:
        for k in (1,3,7):
            v=r.get(f'{m}_{k}')
            ev.append(None if v is None or (isinstance(v,float) and np.isnan(v)) else round(float(v),1))
    sp=SP.get(int(r['idx']))
    row=dict(ts=r['ts'].strftime('%Y-%m-%d %H:%M'),fam=r['fam'],detail=r['detail'],user=r['user'],
        campname=r['campname'] or ('Оплата за заказ' if r['kind']=='cpo' else ''),
        scope=('магазин' if r['kind']=='cpo' else ('товар' if r['sku'] else 'кампания')),
        art=(r['art'] if isinstance(r['art'],str) else ''),cat=(r['cat'] if isinstance(r['cat'],str) else ''),
        e=ev)
    if int(r['nsku'])>1: row['nsku']=int(r['nsku'])
    if not bool(r['ctrl']): row['nc']=1
    b=(None if pd.isna(r.get('base')) else int(r['base']))
    if b is None or b<50: row['weak']=1
    if b is not None: row['base']=b
    if sp: row['sp']=sp['sv']
    feed.append(row)
feed=feed  # все действия, период фильтруется на странице

# ---------- тесты ----------
adv_l=sorted(adv); noadv_m=[int(x) for x in mnoadv['sku'].dropna()]
tests=[
 dict(name='Включение 8 кампаний 7 сентября',status='измерен',started='2026-09-07',read='2026-09-15',
   t=len(adv_l),c=int((~cur['adv']).sum()),
   res=[['Соинвест, тест','%.1f %%'%CO_NOW['С рекламой'][0]],['Соинвест, контроль','%.1f %%'%CO_NOW['Без рекламы'][0]],
        ['Разница','%+.1f пункта'%(CO_NOW['С рекламой'][0]-CO_NOW['Без рекламы'][0])]],
   note='Единственный тест, по которому уже есть замер. Разница по соинвесту совпадает с законом 2 (надбавка 9-12 пунктов).'),
 dict(name='Бюджет: 250 ₽ в день против текущего',status='не запущен',started='',read='',
   t=4,c=4,res=[['Метрика','соинвест, показы в поиске'],['Срок','2 недели'],['Правило','если соинвест не упал более чем на 2 пункта - режем все']],
   note='Берём 4 из 8 активных кампаний, ужимаем до 1 750 ₽ в неделю, 4 оставляем как есть.'),
 dict(name='Акция против копеечной кампании',status='не запущен',started='',read='',
   t=10,c=8,res=[['Метрика','показы, заказы, соинвест'],['Срок','3 недели'],['Правило','если показы упали меньше чем на 20% - выходим из акции по всем']],
   note='10 товаров из 18, что сидят в Максимальном бустинге без рекламы, получают кампанию. 8 остаются контролем.'),
 dict(name='Оплата за заказ ABAB',status='не запущен',started='',read='',
   t=0,c=0,res=[['Метрика','заказы магазина в день, показы'],['Срок','4 недели по схеме неделя через неделю'],['Правило','инструмент остаётся, если в недели включено заказов больше минимум на 30%']],
   note='Инструмент один на весь магазин, контрольной группы товаров не бывает. Контроль только по времени.'),
]

OUT=dict(emet=['coinv','search_views','search_position','pdp_views','ordered_units'],updated='2026-09-15',data_until='2026-09-09',prices_until='2026-09-15',
  feed=feed,alerts=AL,levels_n=LVN,coinv=CO_NOW,tests=tests,daily=DAILY,
  camps=[dict(camp=int(r['camp']),name=r['name'],on=bool(r['on']),bid=(None if pd.isna(r['bid']) else float(r['bid'])),
              wb=(None if pd.isna(r['wbudget']) else float(r['wbudget'])),n=len(r['skus']),
              days=int(r['days_since']),last=r['last_ts'].strftime('%d.%m')) for _,r in CS.sort_values('last_ts',ascending=False).iterrows()],
  cpo=dict(rate=cpo_rate,last=cpo.sort_values('ts').iloc[-1]['ts'].strftime('%d.%m.%Y'),
           hist=[[r['ts'].strftime('%d.%m'),str(r['change'])] for _,r in cpo.sort_values('ts').iterrows()][-12:],
           steps=cpo_steps),
  totals=dict(acts=len(A),acts_eff=len(EFF),camps=len(CS),active=int(len(active)),
              skus=len(cur),m_act=int((cur['act']=='M').sum()),m_noadv=len(mnoadv),
              wbudget=int(active['wbudget'].fillna(0).sum()),wbudget_norm=int(NORM_W*len(active))))
def clean(o):
    if isinstance(o,dict): return {k:clean(v) for k,v in o.items()}
    if isinstance(o,(list,tuple)): return [clean(v) for v in o]
    if isinstance(o,float) and (np.isnan(o) or np.isinf(o)): return None
    if isinstance(o,(np.integer,)): return int(o)
    if isinstance(o,(np.floating,)): return None if np.isnan(o) else float(o)
    return o
OUT=clean(OUT)
json.dump(OUT,open(L+'reakciya.json','w'),ensure_ascii=False,default=str,allow_nan=False,separators=(',',':'))
print('JSON записан, размер',os.path.getsize(L+'reakciya.json'),'байт')
print('лента:',len(feed),'алертов:',len(AL),'тестов:',len(tests))

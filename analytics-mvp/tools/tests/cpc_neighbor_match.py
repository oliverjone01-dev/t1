# Проба 01.10 (сессия v14): поиск соседа по объединённой карточке по дню и сумме заказа + сверка с листом Union.
# Xlsx-отчёты кабинета (март-июль) в репо не лежат (решение Ивана 01.10, п.5): путь D рабочий только в сессии v14.
# Запуск из analytics-mvp: python3 tools/tests/cpc_neighbor_match.py
import json,collections,openpyxl,glob,itertools
D='/root/.claude/uploads/aaae571b-5ba0-59b6-8a80-b4e5d9348820/'
card={}
for g in json.load(open('data/card_groups.json'))['groups']:
    for s in g['skus']: card[s['sku']]=g['main']
members=collections.defaultdict(set)
for s,c in card.items(): members[c].add(s)
orders=[json.loads(l) for l in open('data/orders_daily.ndjson')]
orders=[o for o in orders if o['units']>0]  # включая отменённые: атрибуция OZON по дате заказа
byday=collections.defaultdict(list)
for o in orders: byday[o['d']].append(o)
# truth: Union by month
U=collections.defaultdict(set)
for f in glob.glob(D+'*.xlsx'):
    wb=openpyxl.load_workbook(f,read_only=True,data_only=True)
    st=list(wb['Statistics'].iter_rows(values_only=True)); ym='2026-0'+st[0][0][12]
    un=list(wb['Union'].iter_rows(values_only=True)); hu=un[1]
    for r in un[2:]:
        if not r[0]: continue
        r=dict(zip(hu,r)); U[(ym,str(r['SKU в продвижении']),str(r['ID кампании']))].add(str(r['SKU из объединенной карточки']))
import datetime
def days(d,k):
    t=datetime.date.fromisoformat(d); return [(t+datetime.timedelta(i)).isoformat() for i in range(-k,k+1)]
res=collections.Counter(); ex=[]
for l in open('data/ads_attr_daily.ndjson'):
    r=json.loads(l)
    if not r.get('soldM'): continue
    ym=r['d'][:7]; p=r['sku']; omM=r['omM']; q=r['soldM']
    sib=members.get(card.get(p),set())-{p}
    cand=[o for d in days(r['d'],0) for o in byday[d] if o['sku']!=p]
    hit=None
    for kind,pool in (('карточка',[o for o in cand if o['sku'] in sib]),('весь магазин',cand)):
        for n in range(1,min(q,4)+1):
            for comb in itertools.combinations(pool,n):
                if sum(o['units'] for o in comb)==q and abs(sum(o['revenue'] for o in comb)-omM)<=max(2,0.01*omM):
                    hit=(kind,comb);break
            if hit:break
        if hit:break
    key=(ym,p,r['id'])
    if not hit: res['не нашли']+=1; continue
    skus={o['sku'] for o in hit[1]}
    tr=U.get(key)
    st='нет Union (авг-сен)' if tr is None else ('совпало с Union' if skus<=tr else 'не совпало')
    res[hit[0]+' | '+st]+=1
    if st=='не совпало' and len(ex)<3: ex.append((key,omM,q,skus,tr))
for k,v in sorted(res.items()): print(k,v)
print(ex)

print('--- август/сентябрь')
own=collections.defaultdict(collections.Counter)  # (ym,p,cid) -> {'own':шт, sku:шт}
for l in open('data/ads_attr_daily.ndjson'):
    r=json.loads(l); ym=r['d'][:7]
    if ym not in('2026-08','2026-09'): continue
    k=(ym,r['sku'],r['id']); own[k]['__own']+=r.get('sold',0) or 0; own[k]['__m']+=r.get('soldM',0) or 0
    if r.get('soldM'):
        sib=members.get(card.get(r['sku']),set())-{r['sku']}
        pool=[o for o in byday[r['d']] if o['sku'] in sib]; hit=None
        for n in range(1,min(r['soldM'],4)+1):
            for comb in itertools.combinations(pool,n):
                if sum(o['units'] for o in comb)==r['soldM'] and abs(sum(o['revenue'] for o in comb)-r['omM'])<=max(2,0.01*r['omM']): hit=comb;break
            if hit:break
        if hit:
            for o in hit: own[k][o['sku']]+=o['units']
        else: own[k]['__unk']+=r['soldM']
sp=collections.Counter(); spk=collections.Counter()
for l in open('data/ads_sku_daily.ndjson'):
    r=json.loads(l); ym=r['d'][:7]
    if ym in('2026-08','2026-09'): sp[ym]+=r['sp']; spk[(ym,r['sku'],r['cid'])]+=r['sp']
for ym in('2026-08','2026-09'):
    cov=nb=nosale=unk=0
    for k,v in spk.items():
        if k[0]!=ym: continue
        a=own.get(k)
        if a is None: continue
        cov+=v; U_=a['__own']+a['__m']
        if U_==0: nosale+=v; continue
        nbu=sum(u for s,u in a.items() if not s.startswith('__'))
        nb+=v*nbu/U_; unk+=v*a['__unk']/U_
    print(f'{ym}: CPC {sp[ym]:,.0f}; с атрибуцией API {cov:,.0f} ({cov/sp[ym]:.0%}); из неё на соседей {nb:,.0f}; соседа не нашли {unk:,.0f}; без продаж {nosale:,.0f}; без атрибуции {sp[ym]-cov:,.0f}')

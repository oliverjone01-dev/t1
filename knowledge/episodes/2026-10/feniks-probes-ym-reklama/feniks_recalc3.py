import json, collections, statistics, datetime
D='/home/user/t1/analytics-mvp/data-ym/'
rd=lambda f:[json.loads(l) for l in open(D+f)]
n=rd('netting.ndjson'); o=rd('orders.ndjson')
B='Буст продаж, оплата за продажи'; Q=('2026-07','2026-08','2026-09')
p=[r for r in o if not r['service']]; oc={(r['order'],r['sku']):r for r in p}
ball=collections.defaultdict(float); bd={}
for r in n:
    if r['service']==B and r['type'] in ('Удержание','Списание'):
        k=(r['order'],r['sku']); ball[k]+=-r['amount']; bd.setdefault(k,[]).append(r['d'])
# --- 4 floor-mirror SKUs, same population
S4=('GGM-01-1','GGM-01-2','GGM-01-3','GGM-29-4')
rev=sum(r['revenue'] for r in p if r['sku'] in S4 and r['created'][:7] in Q and r['status']=='DELIVERED')
bs=sum(v for k,v in ball.items() if k in oc and oc[k]['sku'] in S4 and oc[k]['created'][:7] in Q)
bpost=sum(-r['amount'] for r in n if r['service']==B and r['type'] in ('Удержание','Списание') and r['sku'] in S4 and r['d'][:7] in Q)
print('S4 same-pop: rev',rev,'boost',round(bs),'rate',round(bs/rev*100,1),'| posting-window boost',round(bpost))
print('S4 same-pop: if 8%:',round(rev*0.08),'diff',round(bs-rev*0.08))
# --- KONUX 5-1 october
s='GGT-35-5-1-100-180'
for k in sorted([k for k in ball if k[1]==s], key=lambda k: min(bd[k])):
    r=oc.get(k)
    if r and min(bd[k])>='2026-09-20':
        print(' KONUX51 order',k[0],'created',r['created'],'posted',sorted(set(bd[k])),'price',r['price'],'cnt',r['count'],'boost',round(ball[k]),'rate',round(ball[k]/(r['price']*r['count'])*100,1),r['status'])
for m in ('2026-07','2026-08','2026-09','2026-10'):
    g=[r for r in p if r['sku']==s and r['created'][:7]==m]
    if g: print(' KONUX51',m,'orders',len(g),'canc',sum(r['status'].startswith('CANCELLED') for r in g),'deliv',sum(r['status']=='DELIVERED' for r in g),'inflight',sum(r['status'] in ('DELIVERY','PROCESSING','PICKUP') for r in g),'avg price',round(sum(r['price'] for r in g)/len(g)),'avg buyer',round(sum(r['p_buyer'] for r in g)/len(g)))
oct=[k for k in ball if k[1]==s and min(bd[k])>='2026-10-02']
print(' KONUX51 boost posted ge 02.10: n',len(oct),'sum',round(sum(ball[k] for k in oct)),'price sum',sum(oc[k]['price']*oc[k]['count'] for k in oct if k in oc))
# --- cancellations, reorders: author logic vs one-to-one matching
W=[r for r in p if r['created'][:7] in Q]
canc=lambda r: r['status'].startswith('CANCELLED')
print('Q orders',len(W),'cancelled',sum(map(canc,W)))
grp=collections.defaultdict(list)
for r in W: grp[(r['created'],r['sku'],r['region'])].append(r)
auth=0; oneone=0; sameprice=0
for key,g in grp.items():
    cz=[r for r in g if canc(r)]; dl=[r for r in g if r['status']=='DELIVERED']
    if dl:
        auth+=len(cz); oneone+=min(len(cz),len(dl))
print('reorders: author-def',auth,'one-to-one',oneone)
# --- Moscow + MO
msk={'Москва','Балашиха','Химки','Мытищи','Подольск','Одинцово','Красногорск','Люберцы'}
MO_EXTRA={'Видное','Королёв','Реутов','Долгопрудный','Щёлково','Пушкино','Раменское','Домодедово','Ногинск','Электросталь','Котельники','Дзержинский','Лобня','Ивантеевка','Фрязино','Жуковский','Серпухов','Коломна','Сергиев Посад','Дмитров','Истра','Чехов','Наро-Фоминск','Звенигород','Апрелевка','Внуковское','Ленинский городской округ','Солнечногорск','Клин','Воскресенск','Егорьевск','Лыткарино','Дедовск','Голицыно','Зеленоград','Троицк','Московский','Щербинка','Заречье','Развилка','Сосенское','Мосрентген','Новоивановское','Бутово','Власиха','Кокошкино','Краснознаменск','Старая Купавна','Электроугли','Обухово','Дрезна'}
regs=collections.Counter(r['region'] for r in W)
mo_found={x:regs[x] for x in MO_EXTRA if x in regs}
print('MO cities in data not in author set:',mo_found)
for c,lab in (('74986385','мебель'),('1023124','зеркала')):
    g=[r for r in W if r['business']==c]
    def net_rate(sel):
        gg=[r for r in g if sel(r)]
        cz=[r for r in gg if canc(r)]
        rr=[r for r in cz if any(x['status']=='DELIVERED' and x['order']!=r['order'] for x in grp[(r['created'],r['sku'],r['region'])])]
        return len(gg),len(cz),len(rr),round((len(cz)-len(rr))/len(gg)*100,1) if gg else None, round(len(cz)/len(gg)*100,1) if gg else None
    print(lab,'MSK(author set): n,canc,reord,net%,gross%',net_rate(lambda r: r['region'] in msk),'| other',net_rate(lambda r: r['region'] not in msk))
    print(lab,'MSK+extra MO: ',net_rate(lambda r: r['region'] in msk or r['region'] in MO_EXTRA))
a=[r for r in W if r['region'] in msk]; z=[r for r in W if r['region'] not in msk]
print('gross MSK',round(sum(map(canc,a))/len(a)*100,1),'other',round(sum(map(canc,z))/len(z)*100,1))
a2=[r for r in W if r['region'] in msk or r['region'] in MO_EXTRA]; z2=[r for r in W if not (r['region'] in msk or r['region'] in MO_EXTRA)]
print('gross MSK+MO extra',round(sum(map(canc,a2))/len(a2)*100,1),len(a2),'other',round(sum(map(canc,z2))/len(z2)*100,1),len(z2))
# avg delivered check мебель Q
dm=[r for r in W if r['business']=='74986385' and r['status']=='DELIVERED']
print('мебель avg delivered line revenue',round(sum(r['revenue'] for r in dm)/len(dm)), 'n',len(dm))

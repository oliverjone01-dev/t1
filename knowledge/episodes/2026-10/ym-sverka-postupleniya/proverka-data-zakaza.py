#!/usr/bin/env python3
"""Проверка 20.10: строятся ли отчёты комиссионера 1С по дате заказа (получения денег), а не по дате доставки. Только чтение.
Запуск: python3 -I proverka-data-zakaza.py <корень репо> <папка с файлами 1С>
A. с июля: заказано (по дате заказа) против доставлено (по дате доставки), шт и деньги за товар, отмены, в пути.
B. реестр Маркета: дата проводки «Платёж покупателя» относительно даты доставки и даты заказа (доставленные с июля).
C. документы 1С июль-сентябрь против баз «по дате заказа» (без отменённых / все) и «по дате доставки», равенство до 2 ₽.
"""
import json, collections, re, statistics, sys
import pandas as pd
root, bdir = sys.argv[1], sys.argv[2]
CAB={'1023124':'зеркала','74986385':'мебель'}
orders=[r for r in (json.loads(l) for l in open(f'{root}/analytics-mvp/data-ym/orders.ndjson') if l.strip()) if not r.get('fake')]
net=[json.loads(l) for l in open(f'{root}/analytics-mvp/data-ym/netting.ndjson') if l.strip()]
goods=[r for r in orders if not r['service']]
print('A. месяц | кабинет | заказано шт (по дате заказа) | деньги | доставлено шт (по дате доставки) | деньги | отменено шт из заказанных в месяце | ещё в пути')
A=collections.defaultdict(lambda: collections.defaultdict(float))
for r in goods:
    cab=CAB[r['business']]; mc=r['created'][:7]
    if mc>='2026-07': A[(mc,cab)]['зак_шт']+=r['count']; A[(mc,cab)]['зак_₽']+=r['p_buyer']*r['count']
    if r['status']=='DELIVERED' and r['statusDate'][:7]>='2026-07': A[(r['statusDate'][:7],cab)]['дост_шт']+=r['count']; A[(r['statusDate'][:7],cab)]['дост_₽']+=r['p_buyer']*r['count']
    if mc>='2026-07' and r['status'].startswith('CANCELLED'): A[(mc,cab)]['отм_шт']+=r['count']
    if mc>='2026-07' and r['status']!='DELIVERED' and not r['status'].startswith('CANCELLED'): A[(mc,cab)]['путь_шт']+=r['count']
for k in sorted(A): a=A[k]; print(k, int(a['зак_шт']), int(a['зак_₽']), int(a['дост_шт']), int(a['дост_₽']), int(a['отм_шт']), int(a['путь_шт']))
sd={r['order']:r['statusDate'] for r in goods if r['status']=='DELIVERED'}; cr={r['order']:r['created'] for r in goods}
P=[r for r in net if r['type']=='Начисление' and r['src']=='Платёж покупателя' and r.get('order') in sd and sd[r['order']]>='2026-07-01' and str(r.get('status') or '').strip()]
lag=[(pd.Timestamp(r['d'])-pd.Timestamp(sd[r['order']])).days for r in P]; lag2=[(pd.Timestamp(r['d'])-pd.Timestamp(cr[r['order']])).days for r in P]
print('\nB. проводок платежа покупателя по доставленным с июля:', len(P), '| проводка раньше доставки:', sum(l<0 for l in lag), '| медиана дней от доставки до проводки:', statistics.median(lag), '| медиана дней от заказа до проводки:', statistics.median(lag2))
v=pd.read_excel(f'{bdir}/otchet-komissionera.xlsx',header=None)
kom=[(w[1][6:]+'-'+w[1][3:5], str(w[3]), float(w[6])) for _,w in v.iloc[6:].iterrows() if isinstance(w[1],str) and re.match(r'\d\d\.\d\d\.\d{4}',w[1])]
byc=collections.defaultdict(float); byc_all=collections.defaultdict(float); byd=collections.defaultdict(float)
for r in goods:
    k=(r['created'][:7], r['campaign']); byc_all[k]+=r['p_buyer']*r['count']
    if not r['status'].startswith('CANCELLED'): byc[k]+=r['p_buyer']*r['count']
    if r['status']=='DELIVERED': byd[(r['statusDate'][:7], r['campaign'])]+=r['p_buyer']*r['count']
camps=sorted(set(r['campaign'] for r in goods))
print('\nC. документ | сумма 1С | равен базе «по дате заказа» (без отменённых / все) | равен «по дате доставки»')
for ym,num,amt in kom:
    if ym<'2026-07': continue
    print(ym,num,int(amt),[c for c in camps if abs(byc[(ym,c)]-amt)<=2],[c for c in camps if abs(byc_all[(ym,c)]-amt)<=2],[c for c in camps if abs(byd[(ym,c)]-amt)<=2])

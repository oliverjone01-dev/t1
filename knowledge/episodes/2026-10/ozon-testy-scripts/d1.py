# График «до/после» теста 1 для отчёта Word (данные - abs.py по sku_views и orders_daily)
import os,matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':10,'axes.spines.top':False,'axes.spines.right':False})
B='#2a6fdb';G='#9aa3ad'
f,ax=plt.subplots(1,4,figsize=(7.6,2.9))
data=[('Показы в поиске',2072,5805),('Заходы в карточку',353,713),('Корзины',22,51),('Заказы',0.57,1.83)]
for a,(t,b,v) in zip(ax,data):
  a.bar(['до','после'],[b,v],color=[G,B]);a.set_title(t,fontsize=9)
  for i,y in enumerate([b,v]): a.text(i,y*1.02,(f'{y:,.0f}'.replace(',',' ') if y>10 else str(y).replace('.',',')),ha='center',fontsize=8)
  a.set_yticks([])
f.suptitle('11 товаров с рекламой 8-12 ₽: в среднем за день, до 04-17.09 и после 18.09-10.10',fontsize=9.5)
f.tight_layout();f.savefig(os.path.join(os.path.dirname(os.path.abspath(__file__)),'d1.png'),dpi=200)

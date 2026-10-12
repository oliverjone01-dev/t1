import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':10,'axes.spines.top':False,'axes.spines.right':False})
B='#2a6fdb';G='#9aa3ad';R='#d9534f'
O='/tmp/claude-0/doc/'
# 1 test1 gap shift
d=['19.09','20.09','21.09','23.09','24.09','25.09','28.09','29.09','30.09','01.10','02.10','03.10','05.10','06.10','07.10','08.10','09.10','10.10','11.10']
v=[1.1,1.2,9.2,9.5,8.7,8.3,5.2,4.7,4.7,4.3,4.3,7.4,6.4,6.7,6.8,7.1,8.1,6.3,7.3]
f,a=plt.subplots(figsize=(7.5,3.2));a.plot(d,v,'-o',color=B,lw=2,ms=4,label='сдвиг разрыва теста к контролю, п.')
a.axhline(5,color=R,ls='--',lw=1,label='порог успеха +5 п.');a.axhline(2,color=G,ls=':',lw=1,label='порог провала +2 п.')
a.set_ylabel('п.');a.tick_params(axis='x',rotation=60,labelsize=8);a.legend(frameon=False,fontsize=8,loc='lower right');a.set_title('Тест 1: доплата OZON (разрыв) после включения рекламы 8-12 ₽',fontsize=10)
f.tight_layout();f.savefig(O+'c1.png',dpi=200)
# 2 test1 orders
f,a=plt.subplots(figsize=(7.5,3));x=[0,1];w=0.35
a.bar([i-w/2 for i in x],[0.57,1.83],w,color=B,label='тест, 11 товаров');a.bar([i+w/2 for i in x],[3.43/3.43*0.57*0+3.43,3.17],w,color=G,label='магазин вне карточек теста')
for i,(t,c) in enumerate([(0.57,3.43),(1.83,3.17)]):
  a.text(i-w/2,t+0.05,f'{t:.2f}'.replace('.',','),ha='center',fontsize=9);a.text(i+w/2,c+0.05,f'{c:.2f}'.replace('.',','),ha='center',fontsize=9)
a.set_xticks(x);a.set_xticklabels(['до: 04-17.09','после: 18.09-10.10']);a.set_ylabel('заказов в день, шт');a.legend(frameon=False,fontsize=8)
a.set_title('Тест 1: заказы в день без отмен (тест x3,2, магазин -7%)',fontsize=10);f.tight_layout();f.savefig(O+'c2.png',dpi=200)
# 3 test3 cards
f,ax=plt.subplots(1,3,figsize=(7.5,3),sharey=False)
data=[('KONUX\n25 ₽, 30 тыс./нед',['авг','07-21.09','22.09-10.10'],[6.8,10.3,9.2]),('KUVINO\n45 ₽, 20 тыс./нед',['авг','13-30.09','01-10.10'],[5.2,6.6,9.1]),('OZEVIS\nбюджет 20 -> 6 тыс.',['авг','18-27.09','01-10.10'],[3.2,2.8,2.8])]
for a,(t,l,v) in zip(ax,data):
  a.bar(l,v,color=[G,G,B]);a.set_title(t,fontsize=9);a.tick_params(axis='x',labelsize=7)
  for i,y in enumerate(v): a.text(i,y+0.15,str(y).replace('.',','),ha='center',fontsize=8)
ax[0].set_ylabel('заказов карточки в неделю, шт');f.suptitle('Тест 3: заказы объединённой карточки целиком',fontsize=10);f.tight_layout();f.savefig(O+'c3.png',dpi=200)
# 4 test4 status
f,a=plt.subplots(figsize=(7.5,2.6))
lab=['чистые','реклама за клик','две акции','выпал из акции','скидка не дошла']
val=[3,2,1,1,3];cols=[B,R,R,R,G]
a.barh(lab[::-1],val[::-1],color=cols[::-1])
for i,y in enumerate(val[::-1]): a.text(y+0.05,i,str(y),va='center',fontsize=9)
a.axvline(5,color=R,ls='--',lw=1);a.text(5.05,4.3,'нужно 5 для вердикта',fontsize=8,color=R)
a.set_xlim(0,6.5);a.set_xlabel('товаров из 10');a.set_title('Тест 4: состав группы на 11.10',fontsize=10);f.tight_layout();f.savefig(O+'c4.png',dpi=200)
print('ok')

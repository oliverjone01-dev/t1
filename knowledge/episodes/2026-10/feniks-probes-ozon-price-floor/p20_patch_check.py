# ФЕНИКС проба P20: предложенная правка floor.py (замены R1-R9 из аудита 12.10) применяется к floor.py @ HEAD
# ровно один раз каждая и даёт вывод, на котором стоят заменённые формулировки. Файл автора не трогается:
# копия пишется в /tmp/feniks-floor/, floor_rows.json - туда же.
import subprocess, os
os.makedirs('/tmp/feniks-floor', exist_ok=True)
src = subprocess.run(['git', '-C', '/home/user/t1', 'show', 'HEAD:knowledge/episodes/2026-10/ozon-price-floor/floor.py'],
                     capture_output=True, text=True, check=True).stdout
R = [
 ("CPO=0.05; ADM=0.30; TAX=0.15; ADS_PP=0.065; CPC_WK=1500; RENT=0.10",
  "CPO=0.039; ADM=0.30; TAX=0.15; PAY=0.914; ADS_PP=0.065; CPC_WK=1500; RENT=0.10; KEEP_FROM='2026-09-01'\n"
  "# CPO: факт списания ставки за заказ, сентябрь 818 149 / начислено 21 010 545 = 3,9% [ДАННЫЕ: cpo_sku_daily, «Отчет» 01-30.09]\n"
  "# PAY: оплата покупателя / (наша цена x site_to_seller) = 0,905 (медиана 198 заказов) x 1,01 (G) - база налога «Отчета»\n"
  "# KEEP_FROM: комиссия росла ступенями (заказы июня 43,7%, сентября 49,4%, октября 50,5%), доля К выплате - с 01.09"),
 ("fee=C.defaultdict(lambda:[0,0]); sn=C.defaultdict(list)\nfor o in O:\n    if o['status']!='delivered' or o['revenue']<=0 or o['d']<'2026-06-01': continue\n    f=fee[o['sku']]; f[0]+=o['payout']; f[1]+=o['revenue']\n    k=o['order'] if o['order'] in ship else o['order'].rsplit('-',1)[0]\n",
  "fee=C.defaultdict(lambda:[0,0]); fee6=C.defaultdict(lambda:[0,0]); sn=C.defaultdict(list)\nfor o in O:\n    if o['status']!='delivered' or o['revenue']<=0 or o['d']<'2026-06-01': continue\n    f=fee6[o['sku']]; f[0]+=o['payout']; f[1]+=o['revenue']\n    if o['d']>=KEEP_FROM: f=fee[o['sku']]; f[0]+=o['payout']; f[1]+=o['revenue']\n"),
 ("allf=[sum(v[0] for v in fee.values()),sum(v[1] for v in fee.values())]\nstore_keep=allf[0]/allf[1];",
  "allf=[sum(v[0] for v in fee.values()),sum(v[1] for v in fee.values())]; all6=[sum(v[0] for v in fee6.values()),sum(v[1] for v in fee6.values())]\nstore_keep=allf[0]/allf[1]; drift=store_keep/(all6[0]/all6[1]);"),
 ("od=C.Counter(o['sku'] for o in O if o['status']!='cancelled' and o['d']>='2026-08-12')\nfor o in O:\n    if o['status']!='cancelled' and o['d']>='2026-08-12': pass\n", ""),
 ("    keep=fee[sku][0]/fee[sku][1] if fee[sku][1]>0 else store_keep\n",
  "    keep=fee[sku][0]/fee[sku][1] if fee[sku][1]>0 else (fee6[sku][0]/fee6[sku][1]*drift if fee6[sku][1]>0 else store_keep)\n"),
 ("        base=p*keep-CPO*p-cpc\n        return base-cogs[sku]-shipn-ADM*base-TAX*p*sh, base\n    k=0.70*(keep-CPO)-TAX*s_ads\n    fixed=cogs[sku]+shipn+0.70*cpc_o\n",
  "        base=p*keep-CPO*p-cpc   # К выплате - реклама: знаменатель рентабельности, как в «Отчете»\n"
  "        # АДМ «Отчета» считается по дням с отсечкой минуса: реклама дней без продаж базу не режет (сентябрь: 86% рекламы)\n"
  "        return base-cogs[sku]-shipn-ADM*p*keep-TAX*p*sh*PAY, base\n    k=0.70*keep-CPO-TAX*s_ads*PAY\n    fixed=cogs[sku]+shipn+cpc_o\n"),
 ("        k=0.70*(r['keep']-CPO)-TAX*s_ads; fx=r['cogs']+r['shipn']+0.70*cpc\n",
  "        k=0.70*r['keep']-CPO-TAX*s_ads*PAY; fx=r['cogs']+r['shipn']+cpc\n"),
 ("        s=r['s']; k=0.70*(r['keep']-CPO)-TAX*s; fx=r['cogs']+r['shipn']\n",
  "        s=r['s']; k=0.70*r['keep']-CPO-TAX*s*PAY; fx=r['cogs']+r['shipn']\n"),
 ("print('\\nесли реклама утроит заказы (как в тесте 1):')",
  "print('\\n[ГИПОТЕЗА] если реклама утроит заказы (x3 - верх теста 1: 11 товаров без рекламы, база 8 шт, с перетягиванием в KONUX; для товаров с рекламой и от 0,5 шт/нед не проверено):')"),
 ("/home/user/t1/knowledge/episodes/2026-10/ozon-price-floor/floor_rows.json", "/tmp/feniks-floor/floor_rows_patched.json"),
]
out = src
for i, (a, b) in enumerate(R, 1):
    n = out.count(a)
    assert n == 1, f'замена R{i} найдена {n} раз'
    out = out.replace(a, b)
open('/tmp/feniks-floor/floor_patched.py', 'w').write(out)
r = subprocess.run(['python3', '-I', '/tmp/feniks-floor/floor_patched.py'], capture_output=True, text=True)
print('все 10 замен применились по одному разу; вывод исправленного floor.py:')
print(r.stdout, r.stderr[-500:])

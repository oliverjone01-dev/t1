#!/usr/bin/env python3
"""Прототип блока «Ставка буста по марже» для вкладки «Маркетинг» дашборда Маркета. Читает max-stavka.json, пишет HTML.
Запуск: python3 -I proto-max-stavka.py <max-stavka.json> <выход.html>
"""
import json, sys, html
J = json.load(open(sys.argv[1])); rows = [r for r in J['rows'] if r['u'] >= 1]
# кампания по артикулу - из сводного отчёта кабинета мебели 16.10 (лист «Сводный отчет», столбец «Названия кампаний»);
# ставка кампании - со скрина списка кампаний 16.10 (видны 9 из 30). Зеркала: скрина нет.
BIDS = {'QUATRIS': 12.99, 'GENTRIS': 15, 'KONUX': 19, 'TRUBIS Stone': 11.95, 'Перегородки реечные': 9, 'TRUBIS раздвижной': 9.99,
        'VIOLUR раздвижной 110,120': 8.45, 'Перегородки ZONIQUE Premium': 5, 'TRUBIS Oval 120': 10}
CAMP = {}
try:
    import pandas as pd, zipfile, re, io, os
    xp = os.path.join(os.path.dirname(os.path.abspath(sys.argv[1])), 'kabinet-20261016', 'business_boost_consolidated_74986385_16-10-2026.xlsx')
    z = zipfile.ZipFile(xp); buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w') as zo:
        for nm in z.namelist():
            d = z.read(nm)
            if nm == 'xl/styles.xml': d = re.sub(rb'<family val="\d+"', b'<family val="2"', d)
            zo.writestr(nm, d)
    sh = pd.read_excel(buf, sheet_name='Сводный отчет', header=3)
    for _, w in sh.iterrows():
        if isinstance(w.iloc[0], str) and isinstance(w.iloc[20], str): CAMP[w.iloc[0]] = w.iloc[20].strip()   # в отчёте у артикула одна кампания, запятая внутри имени
except Exception as e: print('кабинет не прочитан:', e, file=sys.stderr)
for r in rows:
    r['camp'] = CAMP.get(r['sku'], ''); r['bid'] = BIDS.get(r['camp'])
ck = J['check']
def esc(s): return html.escape(str(s))
data = json.dumps([dict(sku=r['sku'], name=r['name'], cab=r['cab'], n=r['n'], u=r['u'], d0=r['d0'], d1=r['d1'], camp=r['camp'], bid=r['bid'], price=r['price'], cat=r['cat'], acc=r['acc'], pts=r['pts_in'],
                        place_m=r['m']['place'], pay_m=r['m']['pay'], dlv_m=r['m']['dlv'], boost_m=r['m']['boost'], oth_m=r['m']['fine'] + r['m']['other'],
                        place_p=r['p']['place'], boost_p=r['p']['boost'], oth_p=r['p']['dlv'] + r['p']['fine'] + r['p']['other'],
                        cogs=r['cogs'], ship=r['ship'], shipflag=r['shipflag']) for r in rows], ensure_ascii=False)
page = f"""<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Маркет: ставка по марже</title>
<style>
:root{{--bg:#f7f7f5;--card:#fff;--ink:#1b1d21;--mute:#6b7280;--bd:#e3e3df;--c1:#f1f1ee;--c2:#e9f4ff;--acc:#1d6fd8;--bad:#b42318;--ok:#067647;--warn:#b54708}}
@media (prefers-color-scheme:dark){{:root:not([data-theme="light"]){{--bg:#111316;--card:#181b20;--ink:#e8e8e6;--mute:#9aa1ab;--bd:#2a2f36;--c1:#1d2026;--c2:#14263b;--acc:#6aa8ff;--bad:#f97066;--ok:#47cd89;--warn:#f7b267}}}}
:root[data-theme="dark"]{{--bg:#111316;--card:#181b20;--ink:#e8e8e6;--mute:#9aa1ab;--bd:#2a2f36;--c1:#1d2026;--c2:#14263b;--acc:#6aa8ff;--bad:#f97066;--ok:#47cd89;--warn:#f7b267}}
body{{margin:0;background:var(--bg);color:var(--ink);font:14px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}}
main{{max-width:1000px;margin:0 auto;padding:20px 16px 60px}}
h1{{font-size:22px;margin:0 0 4px}} h2{{font-size:17px;margin:28px 0 8px}}
.card{{background:var(--card);border:1px solid var(--bd);border-radius:10px;padding:14px 16px;margin:12px 0;overflow-x:auto}}
.mute{{color:var(--mute);font-size:13px}}
.ctl{{display:flex;flex-wrap:wrap;gap:14px 22px;align-items:center;font-size:13px}} .ctl label{{display:flex;gap:6px;align-items:center}}
.ctl input[type=number]{{width:70px;padding:3px 6px;border:1px solid var(--bd);border-radius:6px;background:var(--bg);color:var(--ink)}}
.ctl select{{padding:3px 6px;border:1px solid var(--bd);border-radius:6px;background:var(--bg);color:var(--ink)}}
.t{{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums;font-size:12.5px}}
.t td,.t th{{padding:5px 7px;border-bottom:1px solid var(--bd);text-align:right;white-space:nowrap}}
.t td:first-child,.t th:first-child{{text-align:left}} .t th{{font-weight:600;font-size:11.5px;vertical-align:bottom;cursor:pointer}} .t th span{{font-weight:400;color:var(--mute)}}
.t th.g{{text-align:center;background:var(--c1);color:var(--mute);cursor:default;font-weight:500}}
.t .c2{{background:var(--c2)}} .t .k{{font-weight:700}} .neg{{color:var(--bad)}} .pos{{color:var(--ok)}} .w{{color:var(--warn)}}
.t td.nm{{max-width:260px;white-space:normal;font-size:11.5px;color:var(--mute);text-align:left}}
.q li{{margin:8px 0}} b.r{{color:var(--acc)}} details{{border-top:1px solid var(--bd);padding:8px 0}} summary{{cursor:pointer}}
.tag{{display:inline-block;padding:1px 6px;border-radius:5px;background:var(--c1);color:var(--mute);font-size:11px}}
</style></head><body><main>
<h1>Яндекс Маркет: ставка буста по марже артикула</h1>
<p class="mute">Прототип для вкладки «Маркетинг». На 1 штуку, по доставленным заказам с июля по 15.10. Ставка кампании - кабинет мебели 16.10 (по зеркалам нет). Все цифры [ДАННЫЕ], ставки [РАСЧЁТ].</p>
<div class="card"><div class="ctl">
<label>Кабинет <select id="cab"><option value="">оба</option><option>мебель</option><option>зеркала</option></select></label>
<label>Штук не меньше <input type="number" id="minu" value="3" min="1"></label>
<label>АДМ, % <input type="number" id="adm" value="{J['adm']*100:.0f}" min="0" max="100"></label>
<label>Налог, % <input type="number" id="tax" value="{J['tax']*100:.0f}" min="0" max="100"></label>
<label>Буст баллами - расход <select id="pts"><option value="1">да</option><option value="0">нет</option></select></label>
<label>Нужная прибыль с 1 шт, ₽ <input type="number" id="want" value="5000" step="1000"></label>
<span class="mute" id="cnt"></span>
</div></div>
<div class="card"><table class="t" id="tb"><thead><tr>
<th data-k="sku">SKU</th><th data-k="cab">кабинет</th><th data-k="camp">кампания</th><th data-k="u">штук</th>
<th data-k="bid">ставка<br>кампании</th><th data-k="cur">ставка<br>факт<br><span>списано</span></th>
<th data-k="pre">до АДМ<br>и налога<br><span>₽ с 1 шт</span></th><th data-k="net" class="k">чистая<br><span>₽ с 1 шт</span></th>
<th data-k="maxb" class="k">МАКС<br>ставка<br><span>в ноль</span></th><th data-k="wantb" class="k">ставка при<br>нужной<br>прибыли</th>
</tr></thead><tbody></tbody></table>
<p class="mute">До АДМ и налога = К выплате − С/С − наша доставка (при «буст баллами = да» минус буст баллами). Чистая = то же − АДМ от К выплате − налог от Начислено, как в «Отчёте». МАКС в ноль = (чистая + буст) / цена карточки. Ставка факт - списанная, она ниже ставки кампании, потому что списывают уровень конкурента.</p>
</div>
<details><summary class="mute">Вопросы перед встройкой в дашборд</summary><ol class="q">
<li>Период: скользящие 90 дней плюс выбор месяца, как в других блоках «Маркетинга». <b class="r">Рекомендую</b> так.</li>
<li>Буст баллами как расход по умолчанию. <b class="r">Рекомендую</b> да.</li>
<li>АДМ и налог - те же поля, что в «Отчёте». <b class="r">Рекомендую</b> да.</li>
<li>Нужная прибыль: одна цифра или процент от Начислено. <b class="r">Рекомендую</b> 10% от Начислено.</li>
<li>Себестоимость у части артикулов не заполнена. Кто заполняет?</li>
</ol><p class="mute">Сверка: деньги по реестру = деньги по API заказов у {ck['ok']} из {ck['total']} заказов до рубля.</p></details>
</main>
<script>
var R={data};
var f0=function(x){{return x==null?'-':Math.round(x).toLocaleString('ru-RU');}};
var f1=function(x){{return x==null?'-':(Math.round(x*10)/10).toLocaleString('ru-RU',{{minimumFractionDigits:1,maximumFractionDigits:1}})+'%';}};
var sortK='boost',sortD=-1;
function calc(r){{var adm=+document.getElementById('adm').value/100,tax=+document.getElementById('tax').value/100,pts=document.getElementById('pts').value==='1',want=+document.getElementById('want').value;
 var fees=r.place_m+r.pay_m+r.dlv_m+r.boost_m+r.oth_m,payout=r.acc-fees,a=adm*payout,t=tax*r.acc;
 var pre=r.cogs==null?null:payout-r.cogs-r.ship-(pts?r.boost_p:0);var net=pre==null?null:pre-a-t;var boost=r.boost_m+(pts?r.boost_p:0);
 return Object.assign({{}},r,{{payout:payout,adm:a,tax:t,pre:pre,net:net,netpct:net==null?null:100*net/r.acc,boost:boost,cur:100*(r.boost_m+r.boost_p)/r.price,maxb:net==null?null:100*(net+boost)/r.price,wantb:net==null?null:100*(net+boost-want)/r.price}});}}
function cls(v){{return v==null?'':(v<0?' class="neg"':'');}}
function draw(){{var cab=document.getElementById('cab').value,minu=+document.getElementById('minu').value;
 var rows=R.filter(function(r){{return (!cab||r.cab===cab)&&r.u>=minu;}}).map(calc);
 rows.sort(function(a,b){{var x=a[sortK],y=b[sortK];if(x==null)return 1;if(y==null)return -1;return (x<y?-1:x>y?1:0)*sortD;}});
 var h='';rows.forEach(function(r){{h+='<tr><td title="'+r.name.replace(/"/g,'')+'">'+r.sku+'</td><td>'+r.cab+'</td><td class="mute" style="text-align:left">'+(r.camp||(r.cab==='зеркала'?'нет отчёта':'без буста'))+'</td><td>'+r.u+'</td>'
 +'<td>'+(r.bid!=null?f1(r.bid):(r.camp?'<span class="mute">нет на скрине</span>':'-'))+'</td><td>'+f1(r.cur)+'</td>'
 +'<td'+cls(r.pre)+'>'+f0(r.pre)+'</td><td class="k c2"'+cls(r.net)+'>'+f0(r.net)+'</td><td class="k c2"'+cls(r.maxb)+'>'+f1(r.maxb)+'</td><td class="k"'+cls(r.wantb)+'>'+f1(r.wantb)+'</td></tr>';}});
 document.querySelector('#tb tbody').innerHTML=h;document.getElementById('cnt').textContent='артикулов: '+rows.length;}}
document.querySelectorAll('#tb th[data-k]').forEach(function(th){{th.onclick=function(){{var k=th.dataset.k;if(sortK===k)sortD=-sortD;else{{sortK=k;sortD=(k==='sku'||k==='cab')?1:-1;}}draw();}};}});
['cab','minu','adm','tax','pts','want'].forEach(function(id){{document.getElementById(id).oninput=draw;}});
draw();
</script></body></html>"""
open(sys.argv[2], 'w').write(page); print('ok', sys.argv[2], len(rows), 'артикулов')

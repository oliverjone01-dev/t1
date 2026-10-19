#!/usr/bin/env python3
"""Прототип блока «Ставка буста по марже» для вкладки «Маркетинг» дашборда Маркета. Читает max-stavka.json, пишет HTML.
Запуск: python3 -I proto-max-stavka.py <max-stavka.json> <выход.html>
"""
import json, sys, html
J = json.load(open(sys.argv[1])); rows = [r for r in J['rows'] if r['u'] >= 1]
ck = J['check']
def esc(s): return html.escape(str(s))
data = json.dumps([dict(sku=r['sku'], name=r['name'], cab=r['cab'], n=r['n'], u=r['u'], d0=r['d0'], d1=r['d1'], price=r['price'], cat=r['cat'], acc=r['acc'], pts=r['pts_in'],
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
main{{max-width:1400px;margin:0 auto;padding:20px 16px 60px}}
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
<p><b>Период статистики: заказы, созданные с {J['period'][0]} по {J['period'][1]}</b> (три с половиной месяца, чтобы по артикулу набралось заказов), доставленные и не возвращённые. По каждому артикулу в таблице даты первого и последнего заказа.</p>
<p class="mute">Прототип блока для вкладки «Маркетинг», в дашборд не встроен. проводки реестра взаиморасчётов по номеру заказа, себестоимость sku_cogs, наша доставка по ведомости перевозчика. На 1 штуку. Все цифры [ДАННЫЕ], ставки [РАСЧЁТ].
Проверка: деньги по реестру = деньги по API заказов у {ck['ok']} из {ck['total']} заказов до рубля.</p>

<div class="card"><div class="ctl">
<label>Кабинет <select id="cab"><option value="">оба</option><option>мебель</option><option>зеркала</option></select></label>
<label>Штук не меньше <input type="number" id="minu" value="3" min="1"></label>
<label>АДМ, % от К выплате <input type="number" id="adm" value="{J['adm']*100:.0f}" min="0" max="100"></label>
<label>Налог, % от Начислено <input type="number" id="tax" value="{J['tax']*100:.0f}" min="0" max="100"></label>
<label>Буст баллами считать расходом <select id="pts"><option value="1">да (решение v18)</option><option value="0">нет (как в «Отчёте»)</option></select></label>
<label>Нужная прибыль с 1 шт, ₽ <input type="number" id="want" value="5000" step="1000"></label>
<span class="mute" id="cnt"></span>
</div></div>

<div class="card"><table class="t" id="tb"><thead>
<tr><th class="g" colspan="5">артикул</th><th class="g" colspan="6">итог на 1 шт</th><th class="g" colspan="3">приход на 1 шт</th><th class="g" colspan="5">сборы Маркета деньгами</th><th class="g" colspan="4">наши расходы</th><th class="g" colspan="2">баллами (справочно)</th></tr>
<tr>
<th data-k="sku">SKU</th><th data-k="cab">кабинет</th><th data-k="u">штук</th><th data-k="d0">заказы<br><span>с .. по</span></th><th data-k="price">цена карточки<br><span>сейчас в каталоге</span></th>
<th data-k="pre">до АДМ<br>и налога<br><span>с 1 шт</span></th><th data-k="net" class="k">чистая<br><span>с 1 шт</span></th><th data-k="netpct">чистая<br><span>% от Начислено</span></th><th data-k="cur">ставка факт<br><span>списано, деньги+баллы</span></th><th data-k="maxb" class="k">МАКС ставка<br><span>в ноль</span></th><th data-k="wantb" class="k">ставка при<br>нужной прибыли</th>
<th data-k="acc">Начислено<br><span>деньги покупателя</span></th><th data-k="pts">баллы скидки<br><span>Маркет + Плюс</span></th><th data-k="payout">К выплате<br><span>после сборов деньгами</span></th>
<th data-k="place_m">размещение</th><th data-k="pay_m">платёж</th><th data-k="dlv_m">доставка</th><th data-k="boost_m">буст</th><th data-k="oth_m">прочее</th>
<th data-k="cogs">С/С</th><th data-k="ship">наша<br>доставка</th><th data-k="adm">АДМ</th><th data-k="tax">налог</th>
<th data-k="place_p">размещение</th><th data-k="boost_p">буст</th>
</tr></thead><tbody></tbody></table>
<p class="mute">Как читать. «До АДМ и налога» = К выплате − С/С − наша доставка (при «буст баллами = да» минус ещё буст баллами). «Чистая» = то же минус АДМ и налог, как на вкладке «Отчет». «МАКС в ноль» = (чистая + буст) / цена карточки: списанная ставка, при которой заказ выходит в ноль. «При нужной прибыли» = (чистая + буст − нужная прибыль) / цена карточки. Списывают уровень конкурента, не потолок кампании, поэтому «факт» ниже ставки в кабинете. Пометка <span class="w">!</span> у нашей доставки: в ведомости перевозчика есть заказы без суммы, расход занижен.</p>
</div>

<h2>Что в этих цифрах не так, как в прошлом разборе</h2>
<div class="card">
<ul class="q">
<li>В разборе 16-19.10 максимальная ставка считалась без АДМ и налога и с баллами как деньгами: у KONUX выходило 27-35%. С АДМ 30% и налогом 15% по правилам «Отчёта» чистая прибыль столов KONUX около нуля уже при нынешних списаниях 9-12%, и места для повышения ставки нет.</li>
<li>Буст на Маркете на 80-90% списывается баллами скидки, которые на руки не приходят. Если считать их расходом (решение v18), чистая у KONUX уходит в минус 6-10 тыс. ₽ с заказа; если не считать (как «Отчет»), около нуля. Это главный выбор для ставки: переключатель «буст баллами» вверху.</li>
<li>АДМ 30% от К выплате - 11 тыс. ₽ на стол, самая большая наша статья после себестоимости. Ставка 30% принята для «Отчёта» 02.10 как норматив, не из факта. Если АДМ на Маркете другое, вся таблица сдвигается: поле вверху.</li>
</ul></div>

<h2>Вопросы перед встройкой в дашборд</h2>
<div class="card"><ol class="q">
<li>Период. Сейчас июль - 15.10 по дате заказа, чтобы набрать заказов по артикулу. В дашборде: <b class="r">рекомендую</b> скользящие 90 дней плюс выбор месяца, как в других блоках «Маркетинга».</li>
<li>Буст баллами. <b class="r">Рекомендую</b> по умолчанию «да»: баллы расходуются почти полностью (остаток по KONUX от −1 до +3 тыс. на заказ), значит буст баллами вытесняет оплату размещения деньгами.</li>
<li>АДМ 30% от К выплате и налог 15% от Начислено - брать те же поля, что в «Отчёте» (ACC_RATE), чтобы была одна настройка на весь дашборд. <b class="r">Рекомендую</b> да.</li>
<li>Нужная прибыль с 1 шт - одна цифра на все артикулы или процент от Начислено? <b class="r">Рекомендую</b> процент (10% от Начислено), тогда зеркала и столы сравнимы.</li>
<li>Где на вкладке: отдельный блок «Ставка по марже» под таблицей буста, артикулы с 3+ штук за период, остальные свёрнуты. <b class="r">Рекомендую</b> так.</li>
<li>Себестоимость: у части артикулов нет в sku_cogs (строка показывает прочерк, чистая не считается). Кто заполняет?</li>
</ol></div>

<details><summary class="mute">Сверка и источники</summary><p class="mute">Проводки реестра по заказу: «Платёж покупателя» деньгами (товар + доставка), «Баллы за скидку Маркета/Плюс», удержания деньгами и списания баллами по услугам. API заказов делит платёж за доставку и сборы между позициями, поэтому сверка по всем позициям заказа: {ck['ok']} из {ck['total']} до 2 ₽; остальные отличаются на 200-900 ₽ из-за «Отзывов за баллы» и «Доставки покупателю», которые API относит иначе. Буст по KONUX 1-3 за 16.09-15.10 равен отчёту кабинета до рубля (107 028).</p></details>
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
 var h='';rows.forEach(function(r){{h+='<tr><td title="'+r.name.replace(/"/g,'')+'">'+r.sku+'</td><td>'+r.cab+'</td><td>'+r.u+'</td><td class="mute">'+r.d0.slice(5).replace('-','.')+' .. '+r.d1.slice(5).replace('-','.')+'</td><td>'+f0(r.price)+(r.cat?' <span class="tag">'+f0(r.cat)+'</span>':'')+'</td>'
 +'<td class="c2"'+cls(r.pre)+'>'+f0(r.pre)+'</td><td class="k c2"'+cls(r.net)+'>'+f0(r.net)+'</td><td class="c2"'+cls(r.netpct)+'>'+f1(r.netpct)+'</td><td class="c2">'+f1(r.cur)+'</td><td class="k c2"'+cls(r.maxb)+'>'+f1(r.maxb)+'</td><td class="k c2"'+cls(r.wantb)+'>'+f1(r.wantb)+'</td>'
 +'<td>'+f0(r.acc)+'</td><td>'+f0(r.pts)+'</td><td>'+f0(r.payout)+'</td>'
 +'<td>'+f0(r.place_m)+'</td><td>'+f0(r.pay_m)+'</td><td>'+f0(r.dlv_m)+'</td><td>'+f0(r.boost_m)+'</td><td>'+f0(r.oth_m)+'</td>'
 +'<td>'+(r.cogs==null?'<span class="w">нет</span>':f0(r.cogs))+'</td><td>'+f0(r.ship)+(r.shipflag?' <span class="w">!</span>':'')+'</td><td>'+f0(r.adm)+'</td><td>'+f0(r.tax)+'</td>'
 +'<td>'+f0(r.place_p)+'</td><td>'+f0(r.boost_p)+'</td></tr>';}});
 document.querySelector('#tb tbody').innerHTML=h;document.getElementById('cnt').textContent='артикулов: '+rows.length;}}
document.querySelectorAll('#tb th[data-k]').forEach(function(th){{th.onclick=function(){{var k=th.dataset.k;if(sortK===k)sortD=-sortD;else{{sortK=k;sortD=(k==='sku'||k==='cab')?1:-1;}}draw();}};}});
['cab','minu','adm','tax','pts','want'].forEach(function(id){{document.getElementById(id).oninput=draw;}});
draw();
</script></body></html>"""
open(sys.argv[2], 'w').write(page); print('ok', sys.argv[2], len(rows), 'артикулов')

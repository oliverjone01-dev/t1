# ФЕНИКС iter5 (381f11d5). T4 / M5 / G1: мутанты против plan-tab.test.ts головы (81 тест). Список iter4 (m7_mutants.py, 33 шт.)
# без изменений плюс мутанты нового кода зон (G1a-G1f). «ЖИВ» = тесты зелёные при сломанном коде. Копия src дерева 381f11d5 в
# scratch/p8/mut, одна замена на мутант, прогон vitest plan-tab.test.ts. Шаблон, которого нет ровно один раз, - «нет строки».
# Приёмка координатора: «k=1» (G1a) и «реклама как заказы» (V5c) убиты. Приёмка M5 iter4: V5c, S11v, S9v, W5a, S10', P11, P12.
# python3 -I m8_mutants.py
import os, re, shutil, subprocess
SP = '/tmp/claude-0/-home-user-t1/76832855-1f9d-5a4f-aeaa-595f7a6dd8fa/scratchpad/p8/'
SRC = SP + 'tree_381f11d5/analytics-mvp/'
MUT = SP + 'mut/analytics-mvp/'
if os.path.isdir(SP + 'mut'): shutil.rmtree(SP + 'mut')
shutil.copytree(SRC + 'src', MUT + 'src')
for f in ('package.json', 'tsconfig.json'): shutil.copy(SRC + f, MUT + f)
os.symlink(os.path.realpath(SRC + 'node_modules'), MUT + 'node_modules')
os.symlink(os.path.realpath(SRC + 'data'), MUT + 'data')
TS, JS = 'src/scripts/plan-tab.ts', 'src/scripts/plan-tab/plan-tab.client.js'
M = [
    # G1 - новый код зон (381f11d5)
    ('G1a клиент: k=1 - зоны от 100% плана периода (баг iter4)', JS, 'k=mk>0?mk/100:1', 'k=1'),
    ('G1b клиент: картинка от 100% плана периода, атрибут data-zone от метки', JS,
     'zones.forEach(function(z){s+=arc(z[0]+.7,Math.max(z[0]+.7,z[1]-.7),z[2])});',
     'zones.forEach(function(z){s+=arc(z[0]/k+.7,Math.max(z[0]/k+.7,Math.min(MAX,z[1]/k)-.7),z[2])});'),
    ('G1c клиент: data-zone списан со статуса, а не с дуги', JS, 'zc=z[2]})}', 'zc=st.c})}'),
    ('G1d клиент: граница зоны заказов строго больше', JS, '(pc>=z[0]&&(pc<z[1]||top))', '(pc>z[0]&&(pc<z[1]||top))'),
    ('G1e клиент: у рекламы зоны без масштаба', JS, 'k=mk>0?mk/100:1', 'k=o.hiBad?1:mk>0?mk/100:1'),
    ('G1f клиент: у заказов зоны без масштаба', JS, 'k=mk>0?mk/100:1', 'k=!o.hiBad?1:mk>0?mk/100:1'),
    # клиент: приёмка T4 из iter2 и места pg() (m7)
    ('S15 клиент: неопределённая переменная (класс 753bf11)', JS, "pg('Заказы 10 карточек',G.cards,'',0)", "pg('Заказы 10 карточек',GX.cards,'',0)"),
    ('P11 клиент: ключ плашки «частично» с опечаткой', JS, "['частично','Снижена частично'", "['частичн','Снижена частично'"),
    ('P12 клиент: ключ «по плану» старый («ждём»)', JS, "['по плану','Срок сегодня или позже'", "['ждём','Срок сегодня или позже'"),
    ("S1' клиент: «на пути» строго больше нужного", JS, 'return x>=CW.need[i]', 'return x>CW.need[i]'),
    ("S10' клиент: «на пути» против полного порога, а не пути на дату", JS, 'return x>=CW.need[i]', 'return x>=CW.need[i]*14/Math.max(CW.n_in,1)'),
    ('S9v клиент: стрелка - к плану на дату, а не к плану периода', JS, 'val:has?g.fact:null,plan:g.plan,', 'val:has?g.fact:null,plan:g.plan_td,'),
    ('S11v клиент: цвет по плану периода, а не на дату', JS, 'stPct:td,', ''),
    ('V3c клиент: метка всегда на 100%', JS, 'mark:g.plan?g.plan_td/g.plan*100:null', 'mark:null'),
    ('V4c клиент: строки «справочно» нет', JS, 'l3:g.ref?', 'l3:false?'),
    ('V5c клиент: реклама как заказы («больше - зеленее»)', JS, "pg('Реклама, все клики',G.ads,' тыс. ₽',0,1e3,true)", "pg('Реклама, все клики',G.ads,' тыс. ₽',0,1e3,false)"),
    ('W5d клиент: «рано» только 1 день', JS, 'cwEarly=CW.n_in>0&&CW.n_in<3', 'cwEarly=CW.n_in>0&&CW.n_in<2'),
    ('W5f клиент: подпись окна решения снята', JS, "l2:'окно решения '+dm(D.start)+'-'+dm(D.w1)+', нужно 5'", "l2:'нужно 5'"),
    ('W5h клиент: при «рано» снова число карточек', JS, "l1:cwEarly?'рано: '+CW.n_in+' дн. окна'", "l1:cwEarly?cwOn+' из 10'"),
    # сервер v7
    ('V1s период с 1-го числа (01-14.10 в факте и плане)', TS, 'const from = m1 > start ? m1 : start;', 'const from = m1;'),
    ('V2s план на дату = план периода', TS, 'plan_td: w.last ? r(sum(planDay, w.from, w.last)) : 0', 'plan_td: w.last ? r(sum(planDay, w.from, w.to)) : 0'),
    ('V3s «справочно» без проверки данных', TS, 'ref && last >= ref[1] && drange(...ref).some((d) => src.has(d))', 'ref'),
    ('V4s ноябрь магазина по цели октября', TS, 'return g.nov.mid / 30;', 'return g.oct.mid / 31;'),
    ('V5s октябрь магазина ровно по дням (без пути цели)', TS, 'if (d.slice(5, 7) === "10") return goalPath(g.oct, n, "mid") - goalPath(g.oct, n - 1, "mid");',
     'if (d.slice(5, 7) === "10") return g.oct.mid / 31;'),
    ('V7s ставка рекламы без прочих кампаний', TS, 'const adsRate = (PLAN_WK + OTHER_WK) / 7;', 'const adsRate = PLAN_WK / 7;'),
    ('V8s оборот из штук, а не из выручки', TS, '(a, b) => sumMap(stRev, a, b) / 1e6', '(a, b) => sumMap(stU, a, b) / 1e6'),
    ('V9s период не переходит на ноябрь', TS, 'const m1 = last > start ? last.slice(0, 8) + "01" : start.slice(0, 8) + "01";', 'const m1 = start.slice(0, 8) + "01";'),
    ('V10s «Оплата за заказ» в расходе (S14)', TS, "    if (String(a.id) === CPO_ID) continue;\n", ''),
    # W5 (сервер)
    ('W5a нужно = порог целиком (без n_in / 14)', TS, 'Math.round(c.threshold * nIn / 14 * 10) / 10', 'c.threshold'),
    ('W5b факт окна с 1-го числа месяца', TS, 'sumMap(od[i]!, START, W1 < OD_LAST ? W1 : OD_LAST)', 'sumMap(od[i]!, "2026-10-01", W1 < OD_LAST ? W1 : OD_LAST)'),
    ('W5c факт окна не обрезан 28.10', TS, 'sumMap(od[i]!, START, W1 < OD_LAST ? W1 : OD_LAST)', 'sumMap(od[i]!, START, OD_LAST)'),
    # M5: живые с iter2
    ('P2 порог «частично» 0,5% убран', TS, 'if (now < priceNow * 0.995)', 'if (now < priceNow)'),
    ('P5 чип «частично» серым', TS, 'ps.key === "частично" ? "chip-mid"', 'ps.key === "частично" ? "chip-off"'),
    ('P6 «нет цены» отдельным ключом плашек', TS, 'key = ps.key === "нет цены" ? "не снижена" : ps.key', 'key = ps.key'),
    ('P7 фильтр пустой gap_pct снят', TS, 'if (!Number.isFinite(Number(r.gap_pct)) || r.gap_pct == null) continue;', ''),
    ('P9 цвета п.п. перепутаны', TS, 'gdd > 0 ? "#34D399" : "#FF7A7E"', 'gdd > 0 ? "#FF7A7E" : "#34D399"'),
    ('S3 темп прочих / 14 дней вместо 13', TS, 'Math.max(0, otherSp) / 13 * 7', 'Math.max(0, otherSp) / 14 * 7'),
    ('S7 прочие без вычета 11 кампаний', TS, '- P.to_min.reduce((t, k) => t + sumMap(campDaily.get(String(k.cid)) ?? new Map(), ...OTHER_WIN), 0);', ';'),
    ('S12 нет предупреждения о неполной рекламе по товарам', TS, 'if (ADS_FULL < OTHER_WIN[1]) warnings.push', 'if (false) warnings.push'),
]
orig = {p: open(MUT + p, encoding='utf-8').read() for p in (TS, JS)}
alive, missing, killed = [], [], []
for name, p, a, b in M:
    src = orig[p]
    if src.count(a) != 1:
        missing.append(name.split()[0]); print(f'нет строки ({src.count(a)}) | {name}', flush=True); continue
    open(MUT + p, 'w', encoding='utf-8').write(src.replace(a, b))
    r = subprocess.run(['npx', 'vitest', 'run', TS.replace('.ts', '.test.ts')], cwd=MUT, capture_output=True, text=True, timeout=300)
    open(MUT + p, 'w', encoding='utf-8').write(src)
    ok = r.returncode == 0
    m = re.search(r'Tests\s+(.*?)\(', r.stdout)
    (alive if ok else killed).append(name.split()[0])
    print(f"{'ЖИВ ' if ok else 'убит'} | {name} | {m.group(1).strip() if m else '?'}", flush=True)
print(f'убито {len(killed)}:', ' '.join(killed))
print(f'живых {len(alive)} из {len(M) - len(missing)}:', ' '.join(alive), '| нет строки:', ' '.join(missing) or '-')
for need in (('G1a', 'V5c'), ('V5c', 'S11v', 'S9v', 'W5a', "S10'", 'P11', 'P12')):
    print('приёмка', '+'.join(need), ':', 'убиты все' if all(x in killed for x in need) else 'живы ' + ' '.join(x for x in need if x not in killed))

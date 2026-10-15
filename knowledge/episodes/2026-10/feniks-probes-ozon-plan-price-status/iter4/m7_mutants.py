# ФЕНИКС iter4 (ba5b560). T4 / M5: мутанты против plan-tab.test.ts головы (79 тестов). Шаблоны m6_mutants.py (iter3) перенесены
# на новый код: клиент (pg, «на пути», плашки цены), сервер v7 (gaugePeriod, plan_td, ref, storeGoalDay, ставка рекламы), W5 и
# 8 серверных мутантов M5, живых с iter2. Копия src дерева ba5b560 в scratch/p7/mut, одна замена на мутант, прогон vitest
# plan-tab.test.ts. «ЖИВ» = тесты зелёные при сломанном коде. Шаблон, которого нет ровно один раз, печатается как «нет строки».
# python3 -I m7_mutants.py
import os, re, shutil, subprocess
SP = '/tmp/claude-0/-home-user-t1/67620a7f-7583-5c98-9212-3a5e79611236/scratchpad/p7/'
SRC = SP + 'tree_ba5b560/analytics-mvp/'
MUT = SP + 'mut/analytics-mvp/'
if os.path.isdir(SP + 'mut'): shutil.rmtree(SP + 'mut')
shutil.copytree(SRC + 'src', MUT + 'src')
for f in ('package.json', 'tsconfig.json'): shutil.copy(SRC + f, MUT + f)
os.symlink(os.path.realpath(SRC + 'node_modules'), MUT + 'node_modules')
os.symlink(os.path.realpath(SRC + 'data'), MUT + 'data')
TS, JS = 'src/scripts/plan-tab.ts', 'src/scripts/plan-tab/plan-tab.client.js'
M = [
    # клиент: приёмка T4 из iter2 (S15, P11, P12, S1', S9, S10', S11) в новом коде + новые места pg()
    ('S15 клиент: неопределённая переменная (класс 753bf11)', JS, "pg('Заказы 10 карточек',G.cards,'',0)", "pg('Заказы 10 карточек',GX.cards,'',0)"),
    ('P11 клиент: ключ плашки «частично» с опечаткой', JS, "['частично','Снижена частично'", "['частичн','Снижена частично'"),
    ('P12 клиент: ключ «по плану» старый («ждём»)', JS, "['по плану','Срок сегодня или позже'", "['ждём','Срок сегодня или позже'"),
    ("S1' клиент: «на пути» строго больше нужного", JS, 'return x>=CW.need[i]', 'return x>CW.need[i]'),
    ("S10' клиент: «на пути» против полного порога, а не пути на дату", JS, 'return x>=CW.need[i]', 'return x>=CW.need[i]*14/Math.max(CW.n_in,1)'),
    ('S9v клиент: стрелка - к плану на дату, а не к плану периода', JS, 'val:has?g.fact:null,plan:g.plan,', 'val:has?g.fact:null,plan:g.plan_td,'),
    ('S11v клиент: цвет по плану периода, а не на дату', JS, 'stPct:td,', ''),
    ('V3c клиент: метка всегда на 100%', JS, 'mark:g.plan?g.plan_td/g.plan*100:null', 'mark:null'),
    ('V4c клиент: строки «справочно» нет', JS, 'l3:g.ref?', 'l3:false?'),
    ('V5c клиент: реклама «больше - зеленее»', JS, "pg('Реклама, все клики',G.ads,' тыс. ₽',0,1e3,true)", "pg('Реклама, все клики',G.ads,' тыс. ₽',0,1e3,false)"),
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
    # M5: живые с iter2 (m5_mutants.py / m6b_iter2_alive.py)
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
alive, missing = [], []
for name, p, a, b in M:
    src = orig[p]
    if src.count(a) != 1:
        missing.append(name.split()[0]); print(f'нет строки ({src.count(a)}) | {name}', flush=True); continue
    open(MUT + p, 'w', encoding='utf-8').write(src.replace(a, b))
    r = subprocess.run(['npx', 'vitest', 'run', TS.replace('.ts', '.test.ts')], cwd=MUT, capture_output=True, text=True, timeout=300)
    open(MUT + p, 'w', encoding='utf-8').write(src)
    ok = r.returncode == 0
    m = re.search(r'Tests\s+(.*?)\(', r.stdout)
    if ok: alive.append(name.split()[0])
    print(f"{'ЖИВ ' if ok else 'убит'} | {name} | {m.group(1).strip() if m else '?'}", flush=True)
print(f'живых {len(alive)} из {len(M) - len(missing)}:', ' '.join(alive), '| нет строки:', ' '.join(missing) or '-')
